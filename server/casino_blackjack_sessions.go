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

const publicBlackjackTable = "public-blackjack"

var blackjackMu sync.Mutex
var blackjackCached *database.BlackjackTableRecord
var blackjackAvailable bool
var extraBlackjack = map[string]*database.BlackjackTableRecord{}
var extraBlackjackAvailable = map[string]bool{}

func blackjackTableID(ids []string) string {
	if len(ids) > 0 {
		return ids[0]
	}
	return publicBlackjackTable
}
func setBlackjackCache(id string, record *database.BlackjackTableRecord, available bool) {
	// An unavailable read must not erase an unresolved pending-owner fence.
	if record == nil {
		record, _ = getBlackjackCache(id)
	}
	if id == publicBlackjackTable {
		blackjackCached, blackjackAvailable = record, available
	} else {
		extraBlackjack[id], extraBlackjackAvailable[id] = record, available
	}
}
func getBlackjackCache(id string) (*database.BlackjackTableRecord, bool) {
	if id == publicBlackjackTable {
		return blackjackCached, blackjackAvailable
	}
	return extraBlackjack[id], extraBlackjackAvailable[id]
}

type blackjackParticipant struct {
	PlayerID string `json:"playerId"`
	Name     string `json:"name"`
	Seat     int    `json:"seat"`
	Bet      int    `json:"bet"`
	Paid     bool   `json:"paid"`
}

type blackjackTableState struct {
	RoundID    string                 `json:"roundId"`
	Phase      string                 `json:"phase"`
	Players    []blackjackParticipant `json:"players"`
	DealAt     time.Time              `json:"dealAt"`
	FinishedAt time.Time              `json:"finishedAt"`
	Round      *game.BlackjackRound   `json:"round,omitempty"`
}

func newBlackjackLobby() (*blackjackTableState, error) {
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	return &blackjackTableState{RoundID: hex.EncodeToString(nonce[:]), Phase: "betting", DealAt: time.Now().Add(casinoBettingWindow), Players: []blackjackParticipant{}}, nil
}

func decodeBlackjackState(record *database.BlackjackTableRecord) (*blackjackTableState, error) {
	var state blackjackTableState
	if err := json.Unmarshal(record.State, &state); err != nil {
		return nil, err
	}
	if len(state.RoundID) != 32 || len(state.Players) > 6 {
		return nil, errors.New("invalid saved blackjack lobby")
	}
	players, seats := map[string]bool{}, map[int]bool{}
	for _, p := range state.Players {
		if !strings.HasPrefix(p.PlayerID, "player-") || len(p.PlayerID) <= 7 || players[p.PlayerID] || p.Seat < 0 || p.Seat >= 6 || seats[p.Seat] || !game.ValidBlackjackBet(p.Bet) {
			return nil, errors.New("invalid funded blackjack participant")
		}
		players[p.PlayerID], seats[p.Seat] = true, true
	}
	switch state.Phase {
	case "betting":
		if state.Round != nil || (len(state.Players) > 0 && state.DealAt.IsZero()) {
			return nil, errors.New("invalid blackjack betting state")
		}
	case "playing", "settling", "complete":
		if state.Round == nil || state.Round.ID != state.RoundID || len(state.Round.Players) != len(state.Players) {
			return nil, errors.New("invalid saved blackjack round")
		}
		if err := state.Round.Validate(); err != nil {
			return nil, err
		}
		for _, p := range state.Round.Players {
			if !players[p.PlayerID] {
				return nil, errors.New("blackjack round participant changed")
			}
		}
		if (state.Phase == "playing") != (state.Round.Phase == "playing") {
			return nil, errors.New("blackjack phase mismatch")
		}
		if state.Phase == "complete" {
			if state.FinishedAt.IsZero() {
				return nil, errors.New("blackjack completion time missing")
			}
			for _, p := range state.Players {
				if !p.Paid {
					return nil, errors.New("blackjack payout not complete")
				}
			}
		}
	default:
		return nil, errors.New("unknown saved blackjack phase")
	}
	return &state, nil
}

// All helpers ending Locked require blackjackMu. Only currency callers also
// hold the recipient account lock, always acquired BEFORE blackjackMu.
func loadBlackjackLocked(ids ...string) (*database.BlackjackTableRecord, *blackjackTableState, error) {
	id := blackjackTableID(ids)
	r, err := db.GetBlackjackTable(id)
	if err != nil {
		setBlackjackCache(id, nil, false)
		return nil, nil, err
	}
	s, err := decodeBlackjackState(r)
	if err != nil {
		setBlackjackCache(id, nil, false)
		return nil, nil, err
	}
	setBlackjackCache(id, r, true)
	return r, s, nil
}

func refreshBlackjackLocked(ids ...string) { _, _, _ = loadBlackjackLocked(ids...) }

func advanceBlackjackLocked(record *database.BlackjackTableRecord, state *blackjackTableState) error {
	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	next, err := db.AdvanceBlackjackTable(record.TableID, record.Version, encoded)
	if err == nil {
		setBlackjackCache(record.TableID, next, true)
	}
	return err
}

func initializeBlackjack() error {
	for _, table := range game.CasinoTables() {
		if table.Game != "blackjack" {
			continue
		}
		lobby, err := newBlackjackLobby()
		if err != nil {
			return err
		}
		encoded, _ := json.Marshal(lobby)
		if _, err := db.CreateBlackjackTable(table.ID, encoded); err != nil {
			return err
		}
	}
	// Existing character journals have already replayed. Resolve the one pending
	// transfer before accepting logins; old rounds otherwise retain their shoe.
	return tickBlackjack(time.Now())
}

func requireBlackjackSeat(client *Client, sessionID string) (*game.Entity, error) {
	player := world.GetEntityCopy(client.playerID)
	if player == nil || player.Disconnected || player.CasinoSeat == nil || !game.IsCasinoBlackjackTable(player.CasinoSeat.TableID) || player.CasinoSeat.SessionID != sessionID || player.InstanceID != game.CasinoInstanceID || player.Health <= 0 {
		return nil, errors.New("sit at the blackjack table before playing")
	}
	return player, nil
}

func transferBlackjackLocked(record *database.BlackjackTableRecord, state *blackjackTableState, playerID string, amount int, purpose string) error {
	encoded, err := json.Marshal(state)
	if err != nil {
		return err
	}
	op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:%s:%d:%s", state.RoundID, record.Version, purpose), PlayerID: playerID, Currency: "gold", Amount: amount, NextState: encoded}
	pending, err := db.BeginBlackjackTransfer(record.TableID, record.Version, op)
	if err != nil {
		return err
	}
	setBlackjackCache(record.TableID, pending, true)
	_, err = recoverBlackjackTransferLocked(*pending)
	return err
}

// The command/login admission path already owns this account lock. Consult the
// cached intent first so normal movement does not perform a database query.
func recoverAccountBlackjackLocked(username string) error {
	if err := recoverAccountPokerLocked(username); err != nil {
		return err
	}
	if err := recoverAccountSlotsLocked(username); err != nil {
		return err
	}
	blackjackMu.Lock()
	defer blackjackMu.Unlock()
	for _, table := range game.CasinoTables() {
		if table.Game != "blackjack" {
			continue
		}
		record, _ := getBlackjackCache(table.ID)
		if record == nil || record.Pending == nil || record.Pending.PlayerID != "player-"+username {
			continue
		}
		_, err := recoverBlackjackTransferLocked(*record)
		refreshBlackjackLocked(table.ID)
		if err != nil && !errors.Is(err, database.ErrInsufficientGold) {
			return err
		}
	}
	return nil
}

func handleBlackjackBet(client *Client, sessionID, roundID string, bet int, now time.Time) error {
	blackjackMu.Lock()
	defer blackjackMu.Unlock()
	player, err := requireBlackjackSeat(client, sessionID)
	if err != nil {
		return err
	}
	defer refreshBlackjackLocked(player.CasinoSeat.TableID)
	r, state, err := loadBlackjackLocked(player.CasinoSeat.TableID)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("table funds are being saved; please wait")
	}
	if state.RoundID != roundID || state.Phase != "betting" || !game.ValidBlackjackBet(bet) {
		return errors.New("review the current round and choose 20–100,000 Gold in steps of 20")
	}
	for _, p := range state.Players {
		if p.PlayerID == client.playerID && p.Bet == bet {
			return nil
		} // Retry of accepted bet.
		if p.PlayerID == client.playerID || p.Seat == player.CasinoSeat.Seat {
			return errors.New("this round already has a wager for that player or seat")
		}
	}
	if !state.DealAt.IsZero() && !now.Before(state.DealAt) {
		return errors.New("betting has closed for this round")
	}
	if len(state.Players) >= 6 {
		return errors.New("this blackjack round is full")
	}
	state.Players = append(state.Players, blackjackParticipant{PlayerID: client.playerID, Name: player.Name, Seat: player.CasinoSeat.Seat, Bet: bet})
	if state.DealAt.IsZero() {
		state.DealAt = now.Add(casinoBettingWindow)
	}
	return transferBlackjackLocked(r, state, client.playerID, -bet, "bet")
}

func handleBlackjackPlay(client *Client, sessionID, roundID, action string, revision uint64, now time.Time) error {
	blackjackMu.Lock()
	defer blackjackMu.Unlock()
	player, err := requireBlackjackSeat(client, sessionID)
	if err != nil {
		return err
	}
	defer refreshBlackjackLocked(player.CasinoSeat.TableID)
	r, state, err := loadBlackjackLocked(player.CasinoSeat.TableID)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		return errors.New("table funds are being saved; please wait")
	}
	if state.RoundID != roundID || state.Phase != "playing" {
		return errors.New("blackjack round changed; review the table")
	}
	next, extra, err := state.Round.Propose(client.playerID, action, revision, now)
	if err != nil {
		return err
	}
	state.Round = next
	if next.Phase == "complete" {
		state.Phase = "settling"
	}
	if extra > 0 {
		return transferBlackjackLocked(r, state, client.playerID, -extra, action)
	}
	return advanceBlackjackLocked(r, state)
}

// One bounded tick: pure round transitions under table lock; currency recovery
// separately under recipient-account THEN table lock. No cross-account locking.
func tickBlackjack(now time.Time, ids ...string) error {
	if len(ids) == 0 {
		var result error
		for _, table := range game.CasinoTables() {
			if table.Game == "blackjack" {
				result = errors.Join(result, tickBlackjack(now, table.ID))
			}
		}
		return result
	}
	id := ids[0]
	blackjackMu.Lock()
	r, state, err := loadBlackjackLocked(id)
	if err != nil {
		blackjackMu.Unlock()
		return err
	}
	recipient := ""
	if r.Pending != nil {
		recipient = r.Pending.PlayerID
	} else {
		switch state.Phase {
		case "betting":
			if state.DealAt.IsZero() || (len(state.Players) == 0 && !now.Before(state.DealAt)) {
				state.DealAt = nextCasinoBettingDeadline(state.DealAt, now)
				err = advanceBlackjackLocked(r, state)
			} else if len(state.Players) > 0 && !now.Before(state.DealAt) {
				entries := make([]game.BlackjackEntry, 0, len(state.Players))
				for _, p := range state.Players {
					entries = append(entries, game.BlackjackEntry{PlayerID: p.PlayerID, Seat: p.Seat, Bet: p.Bet})
				}
				state.Round, err = game.NewBlackjackRound(state.RoundID, entries, now)
				if err == nil {
					state.Phase = "playing"
					if state.Round.Phase == "complete" {
						state.Phase = "settling"
					}
					err = advanceBlackjackLocked(r, state)
				}
			}
		case "playing":
			if !now.Before(state.Round.Deadline) {
				state.Round, err = state.Round.Timeout(now)
				if err == nil {
					if state.Round.Phase == "complete" {
						state.Phase = "settling"
					}
					err = advanceBlackjackLocked(r, state)
				}
			}
		case "settling":
			for _, p := range state.Players {
				if !p.Paid {
					recipient = p.PlayerID
					break
				}
			}
		case "complete":
			if !now.Before(state.FinishedAt.Add(casinoResultPause)) {
				state, err = newBlackjackLobby()
				if err == nil {
					state.DealAt = now.Add(casinoBettingWindow)
					err = advanceBlackjackLocked(r, state)
				}
			}
		}
	}
	blackjackMu.Unlock()
	if err != nil || recipient == "" {
		return err
	}
	unlock := lockCharacterWork(strings.TrimPrefix(recipient, "player-"))
	defer unlock()
	blackjackMu.Lock()
	defer blackjackMu.Unlock()
	defer refreshBlackjackLocked(id)
	r, state, err = loadBlackjackLocked(id)
	if err != nil {
		return err
	}
	if r.Pending != nil {
		if r.Pending.PlayerID != recipient {
			return nil
		}
		_, err = recoverBlackjackTransferLocked(*r)
		if errors.Is(err, database.ErrInsufficientGold) {
			return nil
		}
		return err
	}
	if state.Phase != "settling" {
		return nil
	}
	for i, p := range state.Players {
		if p.PlayerID != recipient || p.Paid {
			continue
		}
		payout := 0
		for _, rp := range state.Round.Players {
			if rp.PlayerID == recipient {
				for _, h := range rp.Hands {
					payout += h.Payout
				}
			}
		}
		state.Players[i].Paid = true
		allPaid := true
		for _, p := range state.Players {
			allPaid = allPaid && p.Paid
		}
		if allPaid {
			state.Phase, state.FinishedAt = "complete", now
		}
		if payout == 0 {
			return advanceBlackjackLocked(r, state)
		}
		return transferBlackjackLocked(r, state, recipient, payout, "payout")
	}
	return nil
}

type blackjackTableView struct {
	ServerNow   time.Time              `json:"serverNow"`
	NextRoundAt time.Time              `json:"nextRoundAt"`
	MaxBet      int                    `json:"maxBet"`
	Available   bool                   `json:"available"`
	RoundID     string                 `json:"roundId,omitempty"`
	Phase       string                 `json:"phase,omitempty"`
	Processing  bool                   `json:"processing"`
	Players     []blackjackParticipant `json:"players"`
	DealAt      time.Time              `json:"dealAt"`
	Round       *game.BlackjackView    `json:"round,omitempty"`
	Gold        int                    `json:"gold"`
}

func blackjackViewFor(playerID string) blackjackTableView {
	blackjackMu.Lock()
	defer blackjackMu.Unlock()
	id := publicBlackjackTable
	if p := world.GetEntityCopy(playerID); p != nil && p.CasinoSeat != nil {
		id = p.CasinoSeat.TableID
	}
	blackjackCached, blackjackAvailable := getBlackjackCache(id)
	view := blackjackTableView{ServerNow: time.Now(), Available: blackjackAvailable, Players: []blackjackParticipant{}, MaxBet: game.BlackjackMaxBet}
	if !blackjackAvailable || blackjackCached == nil {
		return view
	}
	state, err := decodeBlackjackState(blackjackCached)
	if err != nil {
		view.Available = false
		return view
	}
	view.RoundID, view.Phase, view.Processing, view.Players, view.DealAt = state.RoundID, state.Phase, blackjackCached.Pending != nil, state.Players, state.DealAt
	if state.Phase == "complete" {
		view.NextRoundAt = state.FinishedAt.Add(casinoResultPause)
	}
	if state.Round != nil {
		round := state.Round.View(playerID)
		view.Round = &round
		if view.Processing {
			view.Round.Actions = []string{}
		}
	}
	if player := world.GetEntityCopy(playerID); player != nil {
		view.Gold = player.Gold
	}
	return view
}
