package main

import (
	"slices"
	"strings"

	"eidolon-server/internal/database"
)

// No account work lock may already be held. Acquire the entire known trade
// closure in global order, then discover again under ownership. If a peer was
// added while we queued, release ALL locks before expanding; never nest a peer.
// Hot commands read only RAM. Cold login/resume additionally discover saved
// escrow/journal/shared intents, without performing any pre-authentication write.
func lockDirectTradeWork(cold bool, roots ...string) (func(), []string, error) {
	accounts := slices.Clone(roots)
	for attempt := 0; attempt < 4; attempt++ {
		var err error
		accounts, err = directTradeWorkAccounts(accounts, cold, roots)
		if err != nil {
			return nil, nil, err
		}
		unlock := lockCharactersWork(accounts...)
		required, err := directTradeWorkAccounts(accounts, cold, roots)
		if err != nil {
			unlock()
			return nil, nil, err
		}
		if slices.Equal(accounts, required) {
			return unlock, accounts, nil
		}
		unlock()
		accounts = required
	}
	return nil, nil, database.ErrDirectTradeBusy
}

func directTradeWorkAccounts(initial []string, cold bool, roots []string) ([]string, error) {
	accounts := slices.Clone(initial)
	add := func(account string) {
		if account != "" && !slices.Contains(accounts, account) {
			accounts = append(accounts, account)
		}
	}
	addState := func(raw []byte) error {
		state, err := database.DecodeDirectTradeState(raw)
		if err != nil {
			return err
		}
		if state.Escrow != nil {
			if state.Escrow.PeerUsername == "" || state.Escrow.PeerCharacterName != state.Escrow.PeerUsername {
				return database.ErrDirectTradeConflict // Never guess a legacy orphan peer.
			}
			add(state.Escrow.PeerUsername)
		}
		return nil
	}
	if cold && directTradeOperations != nil {
		for _, username := range roots {
			if username == "" {
				continue
			}
			pending, err := directTradeOperations.PendingDirectTradeOperations(username, 2)
			if err != nil {
				return nil, err
			}
			if len(pending) > 1 {
				return nil, database.ErrDirectTradeConflict
			}
			for _, op := range pending {
				if op.Validate() != nil || op.State != database.DirectTradePending || !directTradeOperationHasAccount(op, username) {
					return nil, database.ErrDirectTradeConflict
				}
				for _, participant := range op.Participants {
					add(participant.Username)
				}
			}
			character, err := directTradeOperations.GetDirectTradeCharacter(username, username)
			if err != nil {
				return nil, err
			}
			if character != nil {
				if character.Name != username {
					return nil, database.ErrDirectTradeConflict
				}
				if err := addState(character.DirectTradeState); err != nil {
					return nil, err
				}
			}
			if characterSaveJournal != nil {
				save, err := characterSaveJournal.Read(username)
				if err != nil {
					return nil, err
				}
				if save != nil {
					character, err := save.Character()
					if err != nil {
						return nil, err
					}
					if err := addState(character.DirectTradeState); err != nil {
						return nil, err
					}
				}
			}
			if world != nil {
				if player := world.GetEntityCopy("player-" + username); player != nil {
					if err := addState(player.DirectTradeState); err != nil {
						return nil, err
					}
				}
			}
		}
	}
	// Only participants of actual RAM trades or validated pending records are
	// followed. The bound refuses an inconsistent graph rather than locking an
	// unbounded set supplied by a malformed request or corrupted private state.
	for index := 0; index < len(accounts); index++ {
		if len(accounts) > 16 {
			return nil, database.ErrDirectTradeBusy
		}
		username := accounts[index]
		if entry, found := pendingDirectTradeForAccount(username); found {
			for _, participant := range entry.op.Participants {
				add(participant.Username)
			}
		}
		if world != nil {
			world.Mu.RLock()
			if trade := world.DirectTrades[world.TradeByPlayer["player-"+username]]; trade != nil {
				for _, id := range []string{trade.PlayerAID, trade.PlayerBID} {
					if strings.HasPrefix(id, "player-") {
						add(strings.TrimPrefix(id, "player-"))
					}
				}
			}
			world.Mu.RUnlock()
		}
	}
	slices.Sort(accounts)
	accounts = slices.Compact(accounts)
	accounts = slices.DeleteFunc(accounts, func(account string) bool { return account == "" })
	return accounts, nil
}

func directTradeOperationHasAccount(op database.DirectTradeOperation, username string) bool {
	return op.Participants[0].Username == username || op.Participants[1].Username == username
}
