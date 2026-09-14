package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/mongo"
)

// Owner-scoped entitlements do not reserve the physical machine after leaving.
// Account work lock is always acquired first. The cache lock only protects small
// snapshots; it is NEVER held during database IO or character saves.
type slotSavedState struct {
	Owner   string           `json:"owner"`
	Session game.SlotSession `json:"session"`
	Owed    int              `json:"owed"`
	Payment string           `json:"payment"` // spin/bonus until its receipt is confirmed.
}

type slotCacheEntry struct {
	State      slotSavedState
	Processing bool
}

var slotsMu sync.RWMutex
var slotsCache = map[string]slotCacheEntry{}
var slotsPending = map[string]string{} // record key -> account username

func slotRecordKey(owner, theme string, currencies ...string) string {
	hash := sha256.Sum256([]byte(owner))
	prefix := "slots:"
	if len(currencies) > 0 && currencies[0] == "ep" {
		prefix = "slots:ep:"
	}
	return prefix + hex.EncodeToString(hash[:]) + ":" + theme
}

func decodeSlotState(key string, encoded []byte) (*slotSavedState, error) {
	var state slotSavedState
	if err := json.Unmarshal(encoded, &state); err != nil {
		return nil, err
	}
	if !strings.HasPrefix(state.Owner, "player-") || len(state.Owner) <= 7 || len(state.Owner) > 128 || slotRecordKey(state.Owner, state.Session.Theme, state.Session.Currency) != key {
		return nil, errors.New("saved slot owner/theme mismatch")
	}
	currency, err := database.CasinoCurrencyForRecord(key)
	if err != nil || !casinoCurrencyMatches(state.Session.Currency, currency) {
		return nil, errors.New("saved slot currency mismatch")
	}
	if err := state.Session.Validate(); err != nil {
		return nil, err
	}
	if state.Owed < 0 || state.Owed > game.SlotMaxPayout {
		return nil, errors.New("invalid saved slot return")
	}
	switch state.Payment {
	case "":
		if state.Owed != 0 {
			return nil, errors.New("slot return lost its payment identity")
		}
	case "spin":
		if state.Session.Last == nil || state.Owed <= 0 || state.Owed != state.Session.Last.Payout {
			return nil, errors.New("slot return disagrees with spin")
		}
	case "bonus":
		if state.Session.Last == nil || state.Owed <= 0 || state.Owed != state.Session.Last.BonusPayout || state.Session.Bonus {
			return nil, errors.New("slot return disagrees with chosen bonus")
		}
	default:
		return nil, errors.New("unknown saved slot payment")
	}
	return &state, nil
}

func markSlotPending(key, owner string) {
	slotsMu.Lock()
	defer slotsMu.Unlock()
	slotsPending[key] = strings.TrimPrefix(owner, "player-")
	cached := slotsCache[key]
	cached.Processing = true
	slotsCache[key] = cached
}

func cacheSettledSlot(key string, state slotSavedState) {
	slotsMu.Lock()
	defer slotsMu.Unlock()
	slotsCache[key] = slotCacheEntry{State: state}
	delete(slotsPending, key)
}

func validateSlotIntent(record *database.BlackjackTableRecord, state *slotSavedState) error {
	op := record.Pending
	if op == nil {
		return errors.New("missing slot transfer intent")
	}
	if err := op.ValidateForTable(record.TableID); err != nil {
		return err
	}
	next, err := decodeSlotState(record.TableID, op.NextState)
	if err != nil {
		return err
	}
	if op.PlayerID != state.Owner || next.Owner != state.Owner {
		return errors.New("slot transfer recipient changed")
	}
	if op.Amount < 0 {
		if state.Payment != "" || state.Session.Bonus || state.Session.FreeSpins != 0 || next.Session.Last == nil || next.Session.Last.Free || next.Session.Revision != state.Session.Revision+1 || op.Amount != -next.Session.Bet {
			return errors.New("invalid committed slot debit")
		}
	} else {
		before, _ := json.Marshal(state.Session)
		after, _ := json.Marshal(next.Session)
		if state.Owed != op.Amount || next.Owed != 0 || next.Payment != "" || !bytes.Equal(before, after) {
			return errors.New("invalid committed slot payout")
		}
	}
	return nil
}

// Caller holds the owner's account lock. Also handles a crash AFTER debit
// resolution but BEFORE the positive payout intent was written.
func recoverSlotRecordLocked(key, username string) error {
	var declined error
	for step := 0; step < 3; step++ {
		r, err := db.GetBlackjackTable(key)
		if err != nil {
			return err
		}
		state, err := decodeSlotState(key, r.State)
		if err != nil {
			return err
		}
		if state.Owner != "player-"+username {
			return errors.New("slot recovery account mismatch")
		}
		if r.Pending != nil {
			if err := validateSlotIntent(r, state); err != nil {
				return err
			}
			r, err = recoverBlackjackTransferLocked(*r)
			if casinoInsufficientFunds(err) {
				declined = err
			}
			if err != nil && !casinoInsufficientFunds(err) {
				return err
			}
			if r == nil {
				return err
			}
			state, err = decodeSlotState(key, r.State)
			if err != nil {
				return err
			}
		}
		if state.Owed == 0 {
			cacheSettledSlot(key, *state)
			if declined != nil {
				return declined
			}
			return nil
		}
		amount, purpose := state.Owed, state.Payment
		state.Owed, state.Payment = 0, ""
		encoded, _ := json.Marshal(state)
		op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:%s:%d:%s-return", key, r.Version, purpose), PlayerID: state.Owner, Currency: slotCurrency(state.Session.Currency), Amount: amount, NextState: encoded}
		markSlotPending(key, state.Owner)
		if _, err := db.BeginBlackjackTransfer(key, r.Version, op); err != nil {
			return err
		}
	}
	return errors.New("slot settlement still pending")
}

func recoverAccountSlotsLocked(username string) error {
	slotsMu.RLock()
	var keys []string
	for key, owner := range slotsPending {
		if owner == username {
			keys = append(keys, key)
		}
	}
	slotsMu.RUnlock()
	for _, key := range keys {
		if err := recoverSlotRecordLocked(key, username); err != nil && !casinoInsufficientFunds(err) {
			return err
		}
	}
	return nil
}

func tickSlotRecovery() error {
	slotsMu.RLock()
	owners := map[string]bool{}
	for _, owner := range slotsPending {
		owners[owner] = true
	}
	slotsMu.RUnlock()
	var first error
	for owner := range owners {
		unlock := lockCharacterWork(owner)
		err := recoverAccountSlotsLocked(owner)
		unlock()
		if first == nil {
			first = err
		}
	}
	return first
}

func initializeSlots() error {
	records, err := db.CasinoSlotRecords()
	if err != nil {
		return err
	}
	for _, record := range records {
		state, err := decodeSlotState(record.TableID, record.State)
		if err != nil {
			return err
		}
		if record.Pending != nil || state.Owed > 0 {
			markSlotPending(record.TableID, state.Owner)
		}
	}
	return tickSlotRecovery()
}

func slotCurrency(currency string) string {
	if currency == "" {
		return "gold"
	}
	return currency
}
func slotSeatDetails(p *game.Entity) (theme, currency string, ok bool) {
	if p == nil || p.CasinoSeat == nil {
		return "", "", false
	}
	table, found := game.CasinoTableByID(p.CasinoSeat.TableID)
	if !found || table.Game != "slots" {
		return "", "", false
	}
	return strings.TrimPrefix(table.ID, table.Floor+"-slots-"), table.Currency, true
}
func requireSlotSeat(client *Client, sessionID string) (*game.Entity, string, error) {
	player := world.GetEntityCopy(client.playerID)
	theme, currency, seated := slotSeatDetails(player)
	if !seated || player.Disconnected || player.Health <= 0 || player.InstanceID != game.CasinoInstanceID || player.CasinoSeat.SessionID != sessionID {
		return nil, "", errors.New("sit at an elemental machine before playing")
	}
	if _, err := game.NewSlotSessionForCurrency(theme, currency); err != nil {
		return nil, "", err
	}
	return player, theme, nil
}

func loadSlotSessionLocked(owner, theme string, currencies ...string) (*database.BlackjackTableRecord, *slotSavedState, error) {
	if !strings.HasPrefix(owner, "player-") || len(owner) <= 7 {
		return nil, nil, errors.New("invalid slot owner")
	}
	currency := "gold"
	if len(currencies) > 0 {
		currency = currencies[0]
	}
	key := slotRecordKey(owner, theme, currency)
	session, err := game.NewSlotSessionForCurrency(theme, currency)
	if err != nil {
		return nil, nil, err
	}
	initial, _ := json.Marshal(slotSavedState{Owner: owner, Session: *session})
	r, err := db.GetBlackjackTable(key)
	if errors.Is(err, mongo.ErrNoDocuments) {
		r, err = db.CreateBlackjackTable(key, initial)
	}
	if err != nil {
		return nil, nil, err
	}
	state, err := decodeSlotState(key, r.State)
	if err != nil {
		return nil, nil, err
	}
	if r.Pending != nil || state.Owed > 0 {
		markSlotPending(key, owner)
		if err := recoverSlotRecordLocked(key, strings.TrimPrefix(owner, "player-")); err != nil && !casinoInsufficientFunds(err) {
			return nil, nil, err
		}
		r, err = db.GetBlackjackTable(key)
		if err != nil {
			return nil, nil, err
		}
		state, err = decodeSlotState(key, r.State)
		if err != nil {
			return nil, nil, err
		}
	}
	cacheSettledSlot(key, *state)
	return r, state, nil
}

// Caller owns the same account lock as normal casino commands.
func handleSlotAction(client *Client, sessionID string, revision uint64, action string, bet, choice int) error {
	player, theme, err := requireSlotSeat(client, sessionID)
	if err != nil {
		return err
	}
	_, currency, _ := slotSeatDetails(player)
	r, state, err := loadSlotSessionLocked(player.ID, theme, currency)
	if err != nil {
		return err
	}
	if state.Session.Revision != revision {
		return errors.New("slot state changed; refresh before acting")
	}
	var next *game.SlotSession
	debit, owed := 0, 0
	switch action {
	case "spin":
		if state.Session.FreeSpins == 0 {
			if err := requireCasinoFundingLocked(client, currency, bet, time.Now()); err != nil {
				return err
			}
		}
		next, debit, err = game.ProposeSlotSpin(state.Session, bet)
		if err == nil {
			owed = next.Last.Payout
		}
	case "bonus":
		next, owed, err = game.ProposeSlotBonus(state.Session, choice)
	default:
		return errors.New("unsupported slot action")
	}
	if err != nil {
		return err
	}
	state.Session, state.Owed = *next, owed
	if owed > 0 {
		state.Payment = action
	} else {
		state.Payment = ""
	}
	encoded, _ := json.Marshal(state)
	markSlotPending(r.TableID, player.ID) // Fence even an ambiguous write acknowledgement.
	if debit > 0 {
		op := database.BlackjackTransfer{ID: fmt.Sprintf("casino:%s:%d:spin", r.TableID, r.Version), PlayerID: player.ID, Currency: currency, Amount: -debit, NextState: encoded}
		_, err = db.BeginBlackjackTransfer(r.TableID, r.Version, op)
	} else {
		_, err = db.AdvanceBlackjackTable(r.TableID, r.Version, encoded)
	}
	if err != nil {
		return err
	}
	return recoverSlotRecordLocked(r.TableID, strings.TrimPrefix(player.ID, "player-"))
}

func prepareSeatedSlotLocked(client *Client) error {
	player := world.GetEntityCopy(client.playerID)
	theme, currency, seated := slotSeatDetails(player)
	if !seated {
		return nil
	}
	key := slotRecordKey(player.ID, theme, currency)
	slotsMu.RLock()
	cached, exists := slotsCache[key]
	slotsMu.RUnlock()
	if exists && cached.State.Owner == player.ID {
		return nil
	}
	_, _, err := loadSlotSessionLocked(player.ID, theme, currency)
	return err
}

type slotMachineView struct {
	Currency   string           `json:"currency"`
	Balance    int              `json:"balance"`
	MinBet     int              `json:"minBet"`
	MaxBet     int              `json:"maxBet"`
	BetStep    int              `json:"betStep"`
	Available  bool             `json:"available"`
	Processing bool             `json:"processing"`
	Gold       int              `json:"gold"`
	Rules      string           `json:"rules"`
	Machine    game.SlotMachine `json:"machine"`
	Lines      [10][5]int       `json:"lines"`
	Session    game.SlotView    `json:"session"`
}

func slotViewFor(playerID string) *slotMachineView {
	player := world.GetEntityCopy(playerID)
	theme, currency, seated := slotSeatDetails(player)
	if !seated {
		return nil
	}
	slotsMu.RLock()
	cached, exists := slotsCache[slotRecordKey(playerID, theme, currency)]
	slotsMu.RUnlock()
	view := &slotMachineView{Currency: currency, Balance: casinoBalance(player, currency), Available: exists && cached.State.Owner == playerID, Processing: cached.Processing, Gold: player.Gold, Rules: game.SlotRulesVersion, Lines: game.SlotPaylines()}
	view.MinBet, view.MaxBet, view.BetStep = game.CasinoBetLimits("slots", currency)
	for _, machine := range game.SlotMachines() {
		if machine.Theme == theme {
			view.Machine = machine
			break
		}
	}
	if view.Available {
		view.Session = cached.State.Session.View()
	}
	return view
}
