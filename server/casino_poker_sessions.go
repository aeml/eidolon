package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const publicPokerTable = "public-poker"

var pokerMu sync.Mutex
var pokerCached *database.BlackjackTableRecord
var pokerAvailable bool
var pokerPendingOwner string // Fence even an ambiguous intent acknowledgement.
var pokerRecoveryUntil time.Time

type pokerCacheEntry struct {
	record       *database.BlackjackTableRecord
	available    bool
	pendingOwner string
}

var extraPoker = map[string]pokerCacheEntry{}

func pokerTableID(ids []string) string {
	if len(ids) > 0 {
		return ids[0]
	}
	return publicPokerTable
}
func getPokerCache(id string) (*database.BlackjackTableRecord, bool, string) {
	if id == publicPokerTable {
		return pokerCached, pokerAvailable, pokerPendingOwner
	}
	c := extraPoker[id]
	return c.record, c.available, c.pendingOwner
}
func setPokerCache(id string, r *database.BlackjackTableRecord, available bool, owner string) {
	if r == nil {
		r, _, _ = getPokerCache(id)
	}
	if id == publicPokerTable {
		pokerCached, pokerAvailable, pokerPendingOwner = r, available, owner
	} else {
		extraPoker[id] = pokerCacheEntry{r, available, owner}
	}
}

type pokerParticipant struct {
	PlayerID  string `json:"playerId"`
	Name      string `json:"name"`
	Seat      int    `json:"seat"`
	SessionID string `json:"sessionId"` // Private seat identity; never in public view.
	BuyIn     int    `json:"buyIn"`
	Paid      bool   `json:"paid"`
}
type pokerTableState struct {
	RoundID    string             `json:"roundId"`
	Phase      string             `json:"phase"`
	ButtonSeat int                `json:"buttonSeat"`
	Players    []pokerParticipant `json:"players"`
	DealAt     time.Time          `json:"dealAt"`
	FinishedAt time.Time          `json:"finishedAt"`
	Round      *game.PokerRound   `json:"round,omitempty"`
}

func newPokerLobby(previousButton int) (*pokerTableState, error) {
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	return &pokerTableState{RoundID: hex.EncodeToString(nonce[:]), Phase: "betting", DealAt: time.Now().Add(casinoBettingWindow), ButtonSeat: previousButton, Players: []pokerParticipant{}}, nil
}

func decodePokerState(record *database.BlackjackTableRecord) (*pokerTableState, error) {
	currency, err := database.CasinoCurrencyForRecord(record.TableID)
	if err != nil {
		return nil, err
	}
	var s pokerTableState
	if err := json.Unmarshal(record.State, &s); err != nil {
		return nil, err
	}
	bad := func() (*pokerTableState, error) { return nil, errors.New("invalid saved poker table") }
	if len(s.RoundID) != 32 || s.ButtonSeat < -1 || s.ButtonSeat > 5 || len(s.Players) > 6 {
		return bad()
	}
	ids, seats := map[string]bool{}, map[int]bool{}
	for _, p := range s.Players {
		if !strings.HasPrefix(p.PlayerID, "player-") || len(p.PlayerID) <= 7 || len(p.PlayerID) > 128 || ids[p.PlayerID] || p.Seat < 0 || p.Seat > 5 || seats[p.Seat] || p.SessionID == "" || !game.ValidCasinoBet("poker", currency, p.BuyIn) {
			return bad()
		}
		ids[p.PlayerID], seats[p.Seat] = true, true
	}
	switch s.Phase {
	case "betting":
		if s.Round != nil || (len(s.Players) >= 2 && s.DealAt.IsZero()) {
			return bad()
		}
		for _, p := range s.Players {
			if p.Paid {
				return bad()
			}
		}
	case "playing", "settling", "complete":
		if s.Round == nil || !casinoCurrencyMatches(s.Round.Currency, currency) || s.Round.ID != s.RoundID || s.Round.Validate() != nil || len(s.Round.Players) != len(s.Players) || (s.Phase == "playing") != (s.Round.Phase == "playing") {
			return bad()
		}
		for _, rp := range s.Round.Players {
			matched := false
			for _, p := range s.Players {
				if p.PlayerID == rp.PlayerID && p.Seat == rp.Seat && p.BuyIn == rp.BuyIn {
					matched = true
				}
			}
			if !matched {
				return bad()
			}
		}
		for _, p := range s.Players {
			if (s.Phase == "playing" && p.Paid) || (s.Phase == "complete" && !p.Paid) {
				return bad()
			}
		}
		if s.Phase == "complete" && s.FinishedAt.IsZero() {
			return bad()
		}
	default:
		return bad()
	}
	return &s, nil
}

// All table helpers hold pokerMu; currency work additionally holds ONLY the
// recipient account lock, acquired first. We reuse the existing receipt ledger.
func loadPokerLocked(ids ...string) (*database.BlackjackTableRecord, *pokerTableState, error) {
	id := pokerTableID(ids)
	_, _, pendingOwner := getPokerCache(id)
	r, err := db.GetBlackjackTable(id)
	if err != nil {
		setPokerCache(id, nil, false, pendingOwner)
		return nil, nil, err
	}
	s, err := decodePokerState(r)
	if err != nil {
		setPokerCache(id, nil, false, pendingOwner)
		return nil, nil, err
	}
	if r.Pending != nil {
		if err := validatePokerTransfer(r, s); err != nil {
			setPokerCache(id, nil, false, pendingOwner)
			return nil, nil, err
		}
		pendingOwner = r.Pending.PlayerID
	} else {
		pendingOwner = ""
	}
	setPokerCache(id, r, true, pendingOwner)
	return r, s, nil
}
func refreshPokerLocked(ids ...string) { _, _, _ = loadPokerLocked(ids...) }
func advancePokerLocked(r *database.BlackjackTableRecord, s *pokerTableState) error {
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	next, err := db.AdvanceBlackjackTable(r.TableID, r.Version, encoded)
	if err == nil {
		setPokerCache(r.TableID, next, true, "")
	}
	return err
}

// Recompute the only legal wallet transitions: one new funded lobby entry,
// one cancelled lobby entry, or the exact payout of one completed participant.
func validatePokerTransfer(r *database.BlackjackTableRecord, s *pokerTableState) error {
	op := r.Pending
	if op == nil {
		return errors.New("missing poker transfer")
	}
	if err := op.ValidateForTable(r.TableID); err != nil {
		return err
	}
	next, err := decodePokerState(&database.BlackjackTableRecord{TableID: r.TableID, State: op.NextState})
	if err != nil {
		return err
	}
	expected := *s
	expected.Players = append([]pokerParticipant{}, s.Players...)
	valid := false
	if s.Phase == "betting" {
		if op.Amount < 0 && len(next.Players) == len(s.Players)+1 {
			p := next.Players[len(next.Players)-1]
			if p.PlayerID == op.PlayerID && p.BuyIn == -op.Amount && !p.Paid {
				expected.Players = append(expected.Players, p)
				expected.DealAt = next.DealAt
				valid = true
			}
		} else if op.Amount > 0 {
			for i, p := range s.Players {
				if p.PlayerID == op.PlayerID && op.Amount == p.BuyIn {
					expected.Players = append(expected.Players[:i], expected.Players[i+1:]...)
					expected.DealAt = next.DealAt
					valid = true
					break
				}
			}
		}
	} else if s.Phase == "settling" && op.Amount > 0 {
		for i, p := range s.Players {
			if p.PlayerID == op.PlayerID && !p.Paid && pokerPayout(s, p.PlayerID) == op.Amount {
				expected.Players[i].Paid = true
				valid = true
				markPokerComplete(&expected, next.FinishedAt)
				break
			}
		}
	}
	a, _ := json.Marshal(expected)
	b, _ := json.Marshal(next)
	if !valid || string(a) != string(b) {
		return errors.New("poker transfer disagrees with funded hand")
	}
	return nil
}

func transferPokerLocked(r *database.BlackjackTableRecord, s *pokerTableState, owner string, amount int, purpose string) error {
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	currency, err := database.CasinoCurrencyForRecord(r.TableID)
	if err != nil {
		return err
	}
	op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:poker:%s:%d:%s", s.RoundID, r.Version, purpose), PlayerID: owner, Currency: currency, Amount: amount, NextState: encoded}
	old, err := decodePokerState(r)
	if err != nil {
		return err
	}
	candidate := *r
	candidate.Pending = &op
	if err := validatePokerTransfer(&candidate, old); err != nil {
		return err
	}
	setPokerCache(r.TableID, r, true, owner)
	pending, err := db.BeginBlackjackTransfer(r.TableID, r.Version, op)
	if err != nil {
		return err
	}
	setPokerCache(r.TableID, pending, true, owner)
	_, err = recoverBlackjackTransferLocked(*pending)
	return err
}

func recoverAccountPokerLocked(username string) error {
	pokerMu.Lock()
	defer pokerMu.Unlock()
	for _, table := range game.CasinoTables() {
		if table.Game != "poker" {
			continue
		}
		_, _, owner := getPokerCache(table.ID)
		if owner != "player-"+username {
			continue
		}
		r, _, err := loadPokerLocked(table.ID)
		if err != nil {
			return err
		}
		if r.Pending == nil {
			continue
		}
		if r.Pending.PlayerID != "player-"+username {
			return errors.New("poker recovery recipient changed")
		}
		_, err = recoverBlackjackTransferLocked(*r)
		refreshPokerLocked(table.ID)
		if err != nil && !casinoInsufficientFunds(err) {
			return err
		}
	}
	return nil
}

func initializePoker() error {
	pokerRecoveryUntil = time.Now().Add(game.CasinoReconnectGrace)
	for _, table := range game.CasinoTables() {
		if table.Game != "poker" {
			continue
		}
		s, err := newPokerLobby(-1)
		if err != nil {
			return err
		}
		encoded, _ := json.Marshal(s)
		if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
			return err
		}
	}
	return tickPoker(time.Now())
}

func requirePokerSeat(client *Client, sessionID string) (*game.Entity, error) {
	p := world.GetEntityCopy(client.playerID)
	if p == nil || p.Disconnected || p.CasinoSeat == nil || !game.IsCasinoPokerTable(p.CasinoSeat.TableID) || p.CasinoSeat.SessionID != sessionID || p.InstanceID != game.CasinoInstanceID || p.Health <= 0 {
		return nil, errors.New("sit at the poker table before playing")
	}
	return p, nil
}

func handlePokerBuyIn(client *Client, sessionID, roundID string, amount int, now time.Time) error {
	player, err := requirePokerSeat(client, sessionID)
	if err != nil {
		return err
	}
	id := player.CasinoSeat.TableID
	pokerMu.Lock()
	defer pokerMu.Unlock()
	defer refreshPokerLocked(id)
	r, s, err := loadPokerLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("poker funds are being saved; please wait")
	}
	currency, err := database.CasinoCurrencyForRecord(id)
	if err != nil {
		return err
	}
	if s.Phase != "betting" || s.RoundID != roundID || !game.ValidCasinoBet("poker", currency, amount) {
		minimum, maximum, step := game.CasinoBetLimits("poker", currency)
		return fmt.Errorf("review the hand and choose %d–%d %s in steps of %d", minimum, maximum, currency, step)
	}
	for _, p := range s.Players {
		if p.PlayerID == client.playerID && p.BuyIn == amount && p.SessionID == sessionID {
			return nil
		}
		if p.PlayerID == client.playerID || p.Seat == player.CasinoSeat.Seat {
			return errors.New("player or seat is already funded for this hand")
		}
	}
	if len(s.Players) >= 6 || (!s.DealAt.IsZero() && !now.Before(s.DealAt)) {
		return errors.New("this hand is closed to new buy-ins")
	}
	if err := requireCasinoFundingLocked(client, currency, amount, now); err != nil {
		return err
	}
	s.Players = append(s.Players, pokerParticipant{PlayerID: client.playerID, Name: player.Name, Seat: player.CasinoSeat.Seat, SessionID: sessionID, BuyIn: amount})
	if s.DealAt.IsZero() {
		s.DealAt = now.Add(casinoBettingWindow)
	}
	return transferPokerLocked(r, s, client.playerID, -amount, "buy-in")
}

func handlePokerPlay(client *Client, sessionID, roundID, action string, amount int, revision uint64, now time.Time) error {
	player, err := requirePokerSeat(client, sessionID)
	if err != nil {
		return err
	}
	id := player.CasinoSeat.TableID
	pokerMu.Lock()
	defer pokerMu.Unlock()
	defer refreshPokerLocked(id)
	r, s, err := loadPokerLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("poker funds are being saved; please wait")
	}
	if s.Phase != "playing" || s.RoundID != roundID {
		return errors.New("poker hand changed; review the table")
	}
	member := false
	for _, p := range s.Players {
		if p.PlayerID == client.playerID && pokerHandSeated(p, id) {
			member = true
		}
	}
	if !member {
		return errors.New("this seat is watching the current hand")
	}
	next, err := s.Round.Propose(client.playerID, action, amount, revision, now)
	if err != nil {
		return err
	}
	s.Round = next
	if next.Phase == "complete" {
		s.Phase = "settling"
	}
	return advancePokerLocked(r, s)
}

func pokerPresence(p pokerParticipant, ids ...string) (seated, connected bool) {
	e := world.GetEntityCopy(p.PlayerID)
	if e == nil || e.CasinoSeat == nil || e.CasinoSeat.TableID != pokerTableID(ids) || e.CasinoSeat.SessionID != p.SessionID || e.CasinoSeat.Seat != p.Seat || e.Health <= 0 || e.InstanceID != game.CasinoInstanceID {
		return false, false
	}
	if e.Disconnected && !time.Now().Before(e.DisconnectedAt.Add(game.CasinoReconnectGrace)) {
		return false, false
	}
	return true, !e.Disconnected
}

// Persisted hand ownership is account+seat, not a dead process's ephemeral
// connection token. The incoming action still requires the NEW live seat token.
func pokerHandSeated(p pokerParticipant, ids ...string) bool {
	e := world.GetEntityCopy(p.PlayerID)
	return e != nil && e.CasinoSeat != nil && e.CasinoSeat.TableID == pokerTableID(ids) && e.CasinoSeat.Seat == p.Seat && e.Health > 0 && e.InstanceID == game.CasinoInstanceID && (!e.Disconnected || time.Now().Before(e.DisconnectedAt.Add(game.CasinoReconnectGrace)))
}

func validatePokerSeatClaim(owner string, seat int, ids ...string) error {
	pokerMu.Lock()
	defer pokerMu.Unlock()
	pokerCached, pokerAvailable, _ := getPokerCache(pokerTableID(ids))
	if !pokerAvailable || pokerCached == nil {
		return errors.New("poker is recovering; please wait")
	}
	s, err := decodePokerState(pokerCached)
	if err != nil {
		return err
	}
	if s.Phase != "playing" {
		return nil
	}
	for _, p := range s.Round.Players {
		if p.Folded {
			continue
		}
		if p.Seat == seat && p.PlayerID != owner {
			return errors.New("seat reserved for a funded poker hand")
		}
		if p.PlayerID == owner && p.Seat != seat {
			return fmt.Errorf("rejoin your funded hand at seat %d", p.Seat+1)
		}
	}
	return nil
}

// Save the explicit leave BEFORE releasing the physical seat. A quick re-seat
// cannot evade a fold or replay a refunded lobby entry.
func handlePokerLeave(client *Client, sessionID string, now time.Time) error {
	e := world.GetEntityCopy(client.playerID)
	if e == nil || e.CasinoSeat == nil || !game.IsCasinoPokerTable(e.CasinoSeat.TableID) {
		return nil
	}
	if e.CasinoSeat.SessionID != sessionID {
		return errors.New("poker seat changed")
	}
	id := e.CasinoSeat.TableID
	pokerMu.Lock()
	defer pokerMu.Unlock()
	defer refreshPokerLocked(id)
	r, s, err := loadPokerLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("poker funds are being saved; please wait")
	}
	for i, p := range s.Players {
		if p.PlayerID != client.playerID {
			continue
		}
		if s.Phase == "betting" {
			s.Players = append(s.Players[:i], s.Players[i+1:]...)
			if len(s.Players) < 2 {
				s.DealAt = time.Time{}
			}
			return transferPokerLocked(r, s, p.PlayerID, p.BuyIn, "cancelled-buy-in")
		}
		if s.Phase == "playing" {
			next, changed := s.Round.Withdraw(p.PlayerID, now)
			if changed {
				s.Round = next
				if next.Phase == "complete" {
					s.Phase = "settling"
				}
				return advancePokerLocked(r, s)
			}
		}
	}
	return nil
}
func pokerPayout(s *pokerTableState, owner string) int {
	if s.Round != nil {
		for _, p := range s.Round.Players {
			if p.PlayerID == owner {
				return p.Payout
			}
		}
	}
	return 0
}
func markPokerComplete(s *pokerTableState, now time.Time) {
	for _, p := range s.Players {
		if !p.Paid {
			return
		}
	}
	s.Phase, s.FinishedAt = "complete", now
}

// Bounded background transition. Release table lock BEFORE taking one account
// lock for a refund/payout; never wait on another account while holding it.
func tickPoker(now time.Time, ids ...string) error {
	if len(ids) == 0 {
		var result error
		for _, table := range game.CasinoTables() {
			if table.Game == "poker" {
				result = errors.Join(result, tickPoker(now, table.ID))
			}
		}
		return result
	}
	id := ids[0]
	pokerMu.Lock()
	r, s, err := loadPokerLocked(id)
	if err != nil {
		pokerMu.Unlock()
		return err
	}
	owner := ""
	if r.Pending != nil {
		owner = r.Pending.PlayerID
	} else {
		switch s.Phase {
		case "betting":
			allConnected := true
			for _, p := range s.Players {
				seated, connected := pokerPresence(p, id)
				allConnected = allConnected && connected
				if !seated {
					owner = p.PlayerID
					break
				}
			}
			if owner == "" && allConnected && len(s.Players) >= 2 && !now.Before(s.DealAt) {
				entries := []game.PokerEntry{}
				for _, p := range s.Players {
					entries = append(entries, game.PokerEntry{PlayerID: p.PlayerID, Seat: p.Seat, BuyIn: p.BuyIn})
				}
				currency, currencyErr := database.CasinoCurrencyForRecord(id)
				if currencyErr != nil {
					err = currencyErr
				} else {
					s.Round, err = game.NewPokerRoundForCurrency(s.RoundID, entries, s.ButtonSeat, now, currency)
				}
				if err == nil {
					s.Phase = "playing"
					err = advancePokerLocked(r, s)
				}
			} else if owner == "" && (s.DealAt.IsZero() || !now.Before(s.DealAt)) {
				s.DealAt = nextCasinoBettingDeadline(s.DealAt, now)
				err = advancePokerLocked(r, s)
			}
		case "playing":
			changed := false
			for _, p := range s.Players {
				if !pokerHandSeated(p, id) && !(now.Before(pokerRecoveryUntil) && world.GetEntityCopy(p.PlayerID) == nil) {
					s.Round, changed = s.Round.Withdraw(p.PlayerID, now)
					if changed {
						break
					}
				}
			}
			if !changed && !now.Before(s.Round.Deadline) {
				s.Round, err = s.Round.Timeout(now)
				changed = err == nil
			}
			if changed {
				if s.Round.Phase == "complete" {
					s.Phase = "settling"
				}
				err = advancePokerLocked(r, s)
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
				s, err = newPokerLobby(s.Round.Players[s.Round.Button].Seat)
				if err == nil {
					s.DealAt = now.Add(casinoBettingWindow)
					err = advancePokerLocked(r, s)
				}
			}
		}
	}
	pokerMu.Unlock()
	if err != nil || owner == "" {
		return err
	}
	unlock := lockCharacterWork(strings.TrimPrefix(owner, "player-"))
	defer unlock()
	pokerMu.Lock()
	defer pokerMu.Unlock()
	defer refreshPokerLocked(id)
	r, s, err = loadPokerLocked(id)
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
	for i, p := range s.Players {
		if p.PlayerID != owner {
			continue
		}
		if s.Phase == "betting" {
			if seated, _ := pokerPresence(p, id); seated {
				return nil
			}
			s.Players = append(s.Players[:i], s.Players[i+1:]...)
			return transferPokerLocked(r, s, owner, p.BuyIn, "cancelled-buy-in")
		}
		if s.Phase == "settling" && !p.Paid {
			amount := pokerPayout(s, owner)
			s.Players[i].Paid = true
			markPokerComplete(s, now)
			if amount == 0 {
				return advancePokerLocked(r, s)
			}
			return transferPokerLocked(r, s, owner, amount, "cash-out")
		}
	}
	return nil
}

type pokerParticipantView struct {
	PlayerID string `json:"playerId"`
	Name     string `json:"name"`
	Seat     int    `json:"seat"`
	BuyIn    int    `json:"buyIn"`
	Paid     bool   `json:"paid"`
}
type pokerTableView struct {
	Currency    string                 `json:"currency"`
	Balance     int                    `json:"balance"`
	MinBuyIn    int                    `json:"minBuyIn"`
	BuyInStep   int                    `json:"buyInStep"`
	SmallBlind  int                    `json:"smallBlind"`
	BigBlind    int                    `json:"bigBlind"`
	ServerNow   time.Time              `json:"serverNow"`
	NextRoundAt time.Time              `json:"nextRoundAt"`
	MaxBuyIn    int                    `json:"maxBuyIn"`
	Available   bool                   `json:"available"`
	Processing  bool                   `json:"processing"`
	RoundID     string                 `json:"roundId"`
	Phase       string                 `json:"phase"`
	Players     []pokerParticipantView `json:"players"`
	DealAt      time.Time              `json:"dealAt"`
	Round       *game.PokerView        `json:"round,omitempty"`
	Gold        int                    `json:"gold"`
}

func pokerViewFor(owner string) pokerTableView {
	pokerMu.Lock()
	defer pokerMu.Unlock()
	id := publicPokerTable
	player := world.GetEntityCopy(owner)
	if player != nil && player.CasinoSeat != nil && game.IsCasinoPokerTable(player.CasinoSeat.TableID) {
		id = player.CasinoSeat.TableID
	}
	pokerCached, pokerAvailable, pokerPendingOwner := getPokerCache(id)
	v := pokerTableView{ServerNow: time.Now(), Available: pokerAvailable, Players: []pokerParticipantView{}, MaxBuyIn: game.PokerMaxBuyIn}
	v.Currency, _ = database.CasinoCurrencyForRecord(id)
	v.MinBuyIn, v.MaxBuyIn, v.BuyInStep = game.CasinoBetLimits("poker", v.Currency)
	v.SmallBlind, v.BigBlind = game.PokerBlinds(v.Currency)
	if !pokerAvailable || pokerCached == nil {
		return v
	}
	s, err := decodePokerState(pokerCached)
	if err != nil {
		v.Available = false
		return v
	}
	v.RoundID, v.Phase, v.DealAt, v.Processing = s.RoundID, s.Phase, s.DealAt, pokerPendingOwner != ""
	if s.Phase == "complete" {
		v.NextRoundAt = s.FinishedAt.Add(casinoResultPause)
	}
	for _, p := range s.Players {
		v.Players = append(v.Players, pokerParticipantView{PlayerID: p.PlayerID, Name: p.Name, Seat: p.Seat, BuyIn: p.BuyIn, Paid: p.Paid})
	}
	if s.Round != nil {
		round := s.Round.View(owner)
		v.Round = &round
		if v.Processing || s.Phase != "playing" {
			v.Round.Actions = []string{}
		}
	}
	if p := world.GetEntityCopy(owner); p != nil {
		v.Gold = p.Gold
		v.Balance = casinoBalance(p, v.Currency)
	}
	return v
}
