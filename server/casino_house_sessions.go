package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const houseRevealTime = 6 * time.Second

// Both games have a shared betting clock and automatic outcomes, not per-seat
// turns. The existing durable table intent + character receipt owns all money.
type houseParticipant struct {
	PlayerID  string             `json:"playerId"`
	Name      string             `json:"name"`
	Seat      int                `json:"seat"`
	SessionID string             `json:"sessionId"`
	Wagers    []game.CasinoWager `json:"wagers"`
	Paid      bool               `json:"paid"`
}
type houseTableState struct {
	RoundID    string               `json:"roundId"`
	Game       string               `json:"game"`
	Rules      string               `json:"rules"`
	Phase      string               `json:"phase"`
	DealAt     time.Time            `json:"dealAt"`
	RevealAt   time.Time            `json:"revealAt"`
	FinishedAt time.Time            `json:"finishedAt"`
	Players    []houseParticipant   `json:"players"`
	Number     *int                 `json:"number,omitempty"`
	Baccarat   *game.BaccaratResult `json:"baccarat,omitempty"`
}
type houseCacheEntry struct {
	record       *database.BlackjackTableRecord
	available    bool
	pendingOwner string
}

var houseMu sync.Mutex
var houseCache = map[string]houseCacheEntry{}

func houseRules(kind string) string {
	switch kind {
	case "roulette":
		return game.RouletteRulesVersion
	case "baccarat":
		return game.BaccaratRulesVersion
	}
	return ""
}

func newHouseLobby(kind string, now time.Time) (*houseTableState, error) {
	if houseRules(kind) == "" {
		return nil, errors.New("unknown house game")
	}
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	return &houseTableState{RoundID: hex.EncodeToString(nonce[:]), Game: kind, Rules: houseRules(kind),
		Phase: "betting", DealAt: now.Add(casinoBettingWindow), Players: []houseParticipant{}}, nil
}

func decodeHouseState(record *database.BlackjackTableRecord) (*houseTableState, error) {
	bad := errors.New("invalid saved casino house round")
	table, ok := game.CasinoTableByID(record.TableID)
	if !ok || houseRules(table.Game) == "" {
		return nil, bad
	}
	var s houseTableState
	if json.Unmarshal(record.State, &s) != nil {
		return nil, bad
	}
	id, err := hex.DecodeString(s.RoundID)
	if err != nil || len(id) != 16 || s.Game != table.Game || s.Rules != houseRules(table.Game) || s.DealAt.IsZero() || len(s.Players) > 6 {
		return nil, bad
	}
	players, seats := map[string]bool{}, map[int]bool{}
	allPaid := len(s.Players) > 0
	for _, p := range s.Players {
		if !strings.HasPrefix(p.PlayerID, "player-") || len(p.PlayerID) <= 7 || len(p.PlayerID) > 128 || players[p.PlayerID] ||
			p.Seat < 0 || p.Seat >= 6 || seats[p.Seat] || p.SessionID == "" || len(p.SessionID) > 128 {
			return nil, bad
		}
		if _, err := game.ValidateHouseWagers(s.Game, table.Currency, p.Wagers); err != nil {
			return nil, err
		}
		players[p.PlayerID], seats[p.Seat] = true, true
		allPaid = allPaid && p.Paid
		if p.Paid && (s.Phase == "betting" || s.Phase == "revealing") {
			return nil, bad
		}
	}
	if s.Phase == "betting" {
		if s.Number != nil || s.Baccarat != nil || !s.RevealAt.IsZero() || !s.FinishedAt.IsZero() {
			return nil, bad
		}
		return &s, nil
	}
	if len(s.Players) == 0 || s.RevealAt.Before(s.DealAt.Add(houseRevealTime)) {
		return nil, bad
	}
	if s.Game == "roulette" {
		if s.Number == nil || game.RouletteColor(*s.Number) == "" || s.Baccarat != nil {
			return nil, bad
		}
	} else if s.Number != nil || s.Baccarat.Validate() != nil {
		return nil, bad
	}
	switch s.Phase {
	case "revealing", "settling":
		if !s.FinishedAt.IsZero() || allPaid {
			return nil, bad
		}
	case "complete":
		if !allPaid || s.FinishedAt.Before(s.RevealAt) {
			return nil, bad
		}
	default:
		return nil, bad
	}
	return &s, nil
}

func loadHouseLocked(id string) (*database.BlackjackTableRecord, *houseTableState, error) {
	entry := houseCache[id]
	fail := func(err error) (*database.BlackjackTableRecord, *houseTableState, error) {
		entry.available = false
		houseCache[id] = entry
		return nil, nil, err
	}
	r, err := db.GetBlackjackTable(id)
	if err != nil {
		return fail(err)
	}
	s, err := decodeHouseState(r)
	if err != nil {
		return fail(err)
	}
	if r.Pending != nil {
		if err := validateHouseTransfer(r, s); err != nil {
			return fail(err)
		}
		entry.pendingOwner = r.Pending.PlayerID
	} else {
		entry.pendingOwner = ""
	}
	entry.record, entry.available = r, true
	houseCache[id] = entry
	return r, s, nil
}

func advanceHouseLocked(r *database.BlackjackTableRecord, s *houseTableState) error {
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	if _, err = decodeHouseState(&database.BlackjackTableRecord{TableID: r.TableID, State: encoded}); err != nil {
		return err
	}
	next, err := db.AdvanceBlackjackTable(r.TableID, r.Version, encoded)
	if err == nil {
		houseCache[r.TableID] = houseCacheEntry{record: next, available: true}
	}
	return err
}

func housePayout(s *houseTableState, currency string, p houseParticipant) (int, error) {
	if s.Game == "roulette" && s.Number != nil {
		return game.RoulettePayout(currency, p.Wagers, *s.Number)
	}
	if s.Game == "baccarat" {
		return game.BaccaratPayout(currency, p.Wagers, s.Baccarat)
	}
	return 0, errors.New("house result unavailable")
}

func markHouseComplete(s *houseTableState, now time.Time) {
	for _, p := range s.Players {
		if !p.Paid {
			return
		}
	}
	s.Phase, s.FinishedAt = "complete", now
}

// The pending payload may only append one funded seat or mark one exactly
// recomputed payout paid. It cannot alter the outcome, timers or other players.
func validateHouseTransfer(r *database.BlackjackTableRecord, s *houseTableState) error {
	op := r.Pending
	if op == nil {
		return errors.New("missing house transfer")
	}
	if err := op.ValidateForTable(r.TableID); err != nil {
		return err
	}
	next, err := decodeHouseState(&database.BlackjackTableRecord{TableID: r.TableID, State: op.NextState})
	if err != nil {
		return err
	}
	expected := *s
	expected.Players = append([]houseParticipant{}, s.Players...)
	valid := false
	purpose := "payout"
	if s.Phase == "betting" && op.Amount < 0 && len(next.Players) == len(s.Players)+1 {
		p := next.Players[len(next.Players)-1]
		amount, e := game.ValidateHouseWagers(s.Game, op.Currency, p.Wagers)
		if e == nil && p.PlayerID == op.PlayerID && !p.Paid && amount == -op.Amount {
			expected.Players = append(expected.Players, p)
			valid = true
			purpose = "wager"
		}
	} else if s.Phase == "settling" && op.Amount > 0 {
		for i, p := range s.Players {
			amount, e := housePayout(s, op.Currency, p)
			if e == nil && p.PlayerID == op.PlayerID && !p.Paid && amount == op.Amount {
				expected.Players[i].Paid = true
				markHouseComplete(&expected, next.FinishedAt)
				valid = true
				break
			}
		}
	}
	// Begin increments the record version exactly once. Replays retain this ID.
	wantID := fmt.Sprintf("casino:%s:%s:%d:%s", s.Game, s.RoundID, r.Version-1, purpose)
	a, _ := json.Marshal(expected)
	b, _ := json.Marshal(next)
	if !valid || op.ID != wantID || !bytes.Equal(a, b) {
		return errors.New("house transfer disagrees with funded round")
	}
	return nil
}

func transferHouseLocked(r *database.BlackjackTableRecord, s *houseTableState, owner string, amount int, purpose string) error {
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	currency, err := database.CasinoCurrencyForRecord(r.TableID)
	if err != nil {
		return err
	}
	op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:%s:%s:%d:%s", s.Game, s.RoundID, r.Version, purpose),
		PlayerID: owner, Currency: currency, Amount: amount, NextState: encoded}
	old, err := decodeHouseState(r)
	if err != nil {
		return err
	}
	candidate := *r
	candidate.Version++
	candidate.Pending = &op
	if err := validateHouseTransfer(&candidate, old); err != nil {
		return err
	}
	// Preserve the owner even when the database committed but its reply was lost.
	houseCache[r.TableID] = houseCacheEntry{r, true, owner}
	pending, err := db.BeginBlackjackTransfer(r.TableID, r.Version, op)
	if err != nil {
		return err
	}
	houseCache[r.TableID] = houseCacheEntry{pending, true, owner}
	_, err = recoverBlackjackTransferLocked(*pending)
	return err
}

func recoverAccountHouseLocked(username string) error {
	houseMu.Lock()
	defer houseMu.Unlock()
	for id, entry := range houseCache {
		if entry.pendingOwner != "player-"+username {
			continue
		}
		r, _, err := loadHouseLocked(id)
		if err != nil {
			return err
		}
		if r.Pending == nil {
			continue
		}
		if r.Pending.PlayerID != "player-"+username {
			return errors.New("house recovery owner changed")
		}
		_, err = recoverBlackjackTransferLocked(*r)
		_, _, refreshErr := loadHouseLocked(id)
		if err != nil && !casinoInsufficientFunds(err) {
			return err
		}
		if refreshErr != nil {
			return refreshErr
		}
	}
	return nil
}

func initializeHouseTables() error {
	for _, table := range game.CasinoTables() {
		if houseRules(table.Game) == "" {
			continue
		}
		s, err := newHouseLobby(table.Game, time.Now())
		if err != nil {
			return err
		}
		encoded, _ := json.Marshal(s)
		if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
			return err
		}
	}
	return tickHouseTables(time.Now())
}

func handleHouseBet(c *Client, sessionID, roundID string, wagers []game.CasinoWager, now time.Time) error {
	p := world.GetEntityCopy(c.playerID)
	if p == nil || p.Disconnected || p.Health <= 0 || p.InstanceID != game.CasinoInstanceID || p.CasinoSeat == nil || p.CasinoSeat.SessionID != sessionID {
		return errors.New("sit at the table before wagering")
	}
	id := p.CasinoSeat.TableID
	table, ok := game.CasinoTableByID(id)
	if !ok || houseRules(table.Game) == "" {
		return errors.New("sit at roulette or baccarat first")
	}
	amount, err := game.ValidateHouseWagers(table.Game, table.Currency, wagers)
	if err != nil {
		return err
	}
	houseMu.Lock()
	defer houseMu.Unlock()
	defer func() { _, _, _ = loadHouseLocked(id) }()
	r, s, err := loadHouseLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("table funds are being saved; please wait")
	}
	if s.RoundID != roundID {
		return errors.New("round changed; review the table")
	}
	for _, funded := range s.Players {
		if funded.PlayerID == c.playerID && funded.SessionID == sessionID && reflect.DeepEqual(funded.Wagers, wagers) {
			return nil
		}
		if funded.PlayerID == c.playerID || funded.Seat == p.CasinoSeat.Seat {
			return errors.New("this player or seat already has a confirmed wager; choose your next stake next round")
		}
	}
	if s.Phase != "betting" || !now.Before(s.DealAt) || len(s.Players) >= 6 {
		return errors.New("betting has closed for this round")
	}
	if err := requireCasinoFundingLocked(c, table.Currency, amount, now); err != nil {
		return err
	}
	s.Players = append(s.Players, houseParticipant{PlayerID: c.playerID, Name: p.Name, Seat: p.CasinoSeat.Seat, SessionID: sessionID, Wagers: append([]game.CasinoWager(nil), wagers...)})
	return transferHouseLocked(r, s, c.playerID, -amount, "wager")
}

func tickHouseTables(now time.Time, ids ...string) error {
	if len(ids) == 0 {
		var result error
		for _, table := range game.CasinoTables() {
			if houseRules(table.Game) != "" {
				result = errors.Join(result, tickHouseTables(now, table.ID))
			}
		}
		return result
	}
	id := ids[0]
	houseMu.Lock()
	r, s, err := loadHouseLocked(id)
	if err != nil {
		houseMu.Unlock()
		return err
	}
	owner := ""
	if r.Pending != nil {
		owner = r.Pending.PlayerID
	} else {
		switch s.Phase {
		case "betting":
			if !now.Before(s.DealAt) {
				if len(s.Players) == 0 {
					s.DealAt = nextCasinoBettingDeadline(s.DealAt, now)
				} else {
					if s.Game == "roulette" {
						var n int
						n, err = game.RouletteSpin()
						s.Number = &n
					} else {
						s.Baccarat, err = game.NewBaccaratResult()
					}
					s.Phase, s.RevealAt = "revealing", now.Add(houseRevealTime)
				}
				if err == nil {
					err = advanceHouseLocked(r, s)
				}
			}
		case "revealing":
			if !now.Before(s.RevealAt) {
				s.Phase = "settling"
				err = advanceHouseLocked(r, s)
			}
		case "settling":
			for _, p := range s.Players {
				if !p.Paid {
					owner = p.PlayerID
					break
				}
			}
		case "complete":
			if !now.Before(s.FinishedAt.Add(casinoResultPause)) {
				s, err = newHouseLobby(s.Game, now)
				if err == nil {
					err = advanceHouseLocked(r, s)
				}
			}
		}
	}
	houseMu.Unlock()
	if err != nil || owner == "" {
		return err
	}
	unlock := lockCharacterWork(strings.TrimPrefix(owner, "player-"))
	defer unlock()
	houseMu.Lock()
	defer houseMu.Unlock()
	defer func() { _, _, _ = loadHouseLocked(id) }()
	r, s, err = loadHouseLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		if r.Pending.PlayerID != owner {
			return nil
		}
		_, err = recoverBlackjackTransferLocked(*r)
		if casinoInsufficientFunds(err) {
			return nil
		}
		return err
	}
	if s.Phase != "settling" {
		return nil
	}
	currency, err := database.CasinoCurrencyForRecord(id)
	if err != nil {
		return err
	}
	for i, p := range s.Players {
		if p.PlayerID != owner || p.Paid {
			continue
		}
		amount, err := housePayout(s, currency, p)
		if err != nil {
			return err
		}
		s.Players[i].Paid = true
		markHouseComplete(s, now)
		if amount == 0 {
			return advanceHouseLocked(r, s)
		}
		return transferHouseLocked(r, s, owner, amount, "payout")
	}
	return nil
}

type houseParticipantView struct {
	PlayerID string             `json:"playerId"`
	Name     string             `json:"name"`
	Seat     int                `json:"seat"`
	Wagers   []game.CasinoWager `json:"wagers"`
	Paid     bool               `json:"paid"`
	Payout   int                `json:"payout"`
}
type houseTableView struct {
	Game        string                 `json:"game"`
	Currency    string                 `json:"currency"`
	Rules       string                 `json:"rules"`
	Balance     int                    `json:"balance"`
	MinBet      int                    `json:"minBet"`
	MaxBet      int                    `json:"maxBet"`
	BetStep     int                    `json:"betStep"`
	Available   bool                   `json:"available"`
	Processing  bool                   `json:"processing"`
	RoundID     string                 `json:"roundId"`
	Phase       string                 `json:"phase"`
	ServerNow   time.Time              `json:"serverNow"`
	DealAt      time.Time              `json:"dealAt"`
	RevealAt    time.Time              `json:"revealAt"`
	NextRoundAt time.Time              `json:"nextRoundAt"`
	Players     []houseParticipantView `json:"players"`
	Number      *int                   `json:"number,omitempty"`
	Baccarat    *game.BaccaratResult   `json:"baccarat,omitempty"`
	Spots       []game.RouletteSpot    `json:"spots,omitempty"`
}

func houseViewFor(owner string) *houseTableView {
	houseMu.Lock()
	defer houseMu.Unlock()
	p := world.GetEntityCopy(owner)
	if p == nil || p.CasinoSeat == nil {
		return nil
	}
	table, ok := game.CasinoTableByID(p.CasinoSeat.TableID)
	if !ok || houseRules(table.Game) == "" {
		return nil
	}
	v := &houseTableView{Game: table.Game, Currency: table.Currency, Rules: houseRules(table.Game), Balance: casinoBalance(p, table.Currency), ServerNow: time.Now(), Players: []houseParticipantView{}}
	v.MinBet, v.MaxBet, v.BetStep = game.CasinoBetLimits(table.Game, table.Currency)
	entry := houseCache[table.ID]
	if !entry.available || entry.record == nil {
		return v
	}
	s, err := decodeHouseState(entry.record)
	if err != nil {
		return v
	}
	v.Available, v.Processing = true, entry.pendingOwner != ""
	v.RoundID, v.Phase, v.DealAt, v.RevealAt = s.RoundID, s.Phase, s.DealAt, s.RevealAt
	if s.Game == "roulette" {
		v.Spots = game.RouletteSpots()
	}
	visible := s.Phase == "settling" || s.Phase == "complete"
	if visible {
		v.Number, v.Baccarat = s.Number, s.Baccarat
	}
	if s.Phase == "complete" {
		v.NextRoundAt = s.FinishedAt.Add(casinoResultPause)
	}
	for _, member := range s.Players {
		payout := 0
		if visible {
			payout, _ = housePayout(s, table.Currency, member)
		}
		v.Players = append(v.Players, houseParticipantView{member.PlayerID, member.Name, member.Seat, member.Wagers, member.Paid, payout})
	}
	return v
}
