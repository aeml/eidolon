package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type guildBankResult struct {
	RequestID string `json:"requestId"`
	Status    string `json:"status"`
	Message   string `json:"message"`
}

func (c *Client) sendGuildBankResult(result guildBankResult) {
	encoded, _ := json.Marshal(result)
	c.sendSafe(createMessage(MsgGuildBankResult, encoded))
}

func guildBankRequestAction(kind string, payload GuildBankPayload) (string, error) {
	if !database.ValidGuildBankRequestID(payload.RequestID) || payload.Gold < 0 ||
		(payload.Gold > 0) == (payload.ItemID != "") || len(payload.ItemID) > 256 ||
		strings.TrimSpace(payload.ItemID) != payload.ItemID {
		return "", errors.New("Refresh the game and submit one positive Gold amount or one item per transfer.")
	}
	if kind == MsgGuildBankDeposit {
		if payload.Gold > 0 {
			return database.GuildBankDepositGold, nil
		}
		return database.GuildBankDepositItem, nil
	}
	if kind == MsgGuildBankWithdraw {
		if payload.Gold > 0 {
			return database.GuildBankWithdrawGold, nil
		}
		return database.GuildBankWithdrawItem, nil
	}
	return "", errors.New("invalid guild bank request")
}

// Account work is already owned by normal message admission. Look up the
// immutable request BEFORE reading current balances, items or guild versions.
func handleGuildBankRequest(client *Client, message Message) {
	var payload GuildBankPayload
	result := guildBankResult{Status: "invalid", Message: "Invalid guild bank transfer."}
	defer func() { client.sendGuildBankResult(result) }()
	if json.Unmarshal(message.Payload, &payload) != nil {
		return
	}
	if database.ValidGuildBankRequestID(payload.RequestID) {
		result.RequestID = payload.RequestID
	}
	action, err := guildBankRequestAction(message.Type, payload)
	if err != nil {
		result.Message = err.Error()
		return
	}
	if client.username == "" || client.transportClosed.Load() || client.playerID != "player-"+client.username || !currentCharacterConnection(client) || world == nil {
		result.Message = "Reconnect before transferring guild bank funds."
		return
	}
	result.Status, result.Message = "pending", "Transfer awaiting confirmation. Retry this same request shortly."
	if guildBankOperations == nil {
		return
	}
	stored, err := guildBankOperations.GetGuildBankOperation(database.GuildBankOperationID(client.username, payload.RequestID))
	if err != nil {
		return // Unknown lookup outcome never starts a second financial request.
	}
	if stored != nil {
		if !guildBankRequestMatches(*stored, client.username, action, payload) {
			result.Status, result.Message = "invalid", database.ErrGuildBankOperationConflict.Error()
			return
		}
		trackGuildBankOperation(*stored, false)
	} else {
		if err := reconcilePendingCharacterSaveLocked(client.username); err != nil {
			return
		}
		player := world.GetEntityCopy(client.playerID)
		if player == nil || player.Type != game.TypePlayer {
			result.Status, result.Message = "invalid", "Your character is unavailable."
			return
		}
		guild, err := guildBankOperations.GetGuildForPlayer(client.playerID)
		if err != nil {
			return
		}
		op, err := planGuildBankRequest(client.username, player, guild, action, payload)
		if err != nil {
			result.Status, result.Message = "invalid", err.Error()
			return
		}
		// Persist the complete live baseline first. Offline crash recovery must
		// not debit an older wallet, inventory or progression snapshot.
		if err := saveCharacterDB(client, player); err != nil {
			return
		}
		stored, err = prepareGuildBankOperationLocked(op)
		if err != nil {
			if errors.Is(err, database.ErrGuildBankOperationConflict) {
				result.Status, result.Message = "invalid", err.Error()
			}
			return
		}
	}
	completed, err := completeGuildBankOperationLocked(*stored)
	if err != nil {
		return
	}
	forgetGuildBankOperation(*completed)
	result = guildBankSettlementResult(*completed)
	refreshGuildBankSettlement(*completed)
}

func guildBankRequestMatches(op database.GuildBankOperation, username, action string, payload GuildBankPayload) bool {
	if op.Username != username || op.Action != action || op.Gold != payload.Gold || op.RequestID != payload.RequestID {
		return false
	}
	if payload.ItemID == "" {
		return op.ItemPayload == ""
	}
	var item database.Item
	return json.Unmarshal([]byte(op.ItemPayload), &item) == nil && item.ID == payload.ItemID
}

func planGuildBankRequest(username string, player *game.Entity, guild *database.Guild, action string, payload GuildBankPayload) (database.GuildBankOperation, error) {
	op := database.GuildBankOperation{Version: 1, Username: username, CharacterName: username,
		PlayerID: "player-" + username, RequestID: payload.RequestID, Action: action, Gold: payload.Gold,
		CreatedAt: time.Now().UTC(), State: database.GuildBankPending}
	if player.ID != op.PlayerID || guild == nil {
		return op, errors.New("You are not in a guild.")
	}
	member := false
	for _, entry := range guild.Members {
		if entry.PlayerID == op.PlayerID {
			member = true
			if (action == database.GuildBankWithdrawGold || action == database.GuildBankWithdrawItem) &&
				!database.GuildRankCan(entry.Rank, database.GuildPermissionWithdrawBank) {
				return op, errors.New("Your guild rank cannot withdraw from the bank.")
			}
		}
	}
	if !member {
		return op, errors.New("Guild membership is required.")
	}
	op.GuildID, op.GuildVersion, op.CharacterBankRevision = guild.ID, guild.Version, player.GuildBankRevision
	if payload.ItemID != "" {
		items := guild.Bank.Items
		if action == database.GuildBankDepositItem {
			items = databaseItems(player.Inventory[:min(len(player.Inventory), game.MaxInventorySize)], false)
		}
		for _, item := range items {
			if item.ID == payload.ItemID {
				if item.Stack == 0 {
					item.Stack = 1
				}
				encoded, err := json.Marshal(item)
				if err != nil {
					return op, err
				}
				op.ItemPayload = string(encoded)
				break
			}
		}
		if op.ItemPayload == "" {
			return op, fmt.Errorf("Item is no longer available; refresh the bank.")
		}
	}
	op.ID = database.GuildBankOperationID(username, payload.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	return op, op.Validate()
}

func guildBankSettlementResult(op database.GuildBankOperation) guildBankResult {
	result := guildBankResult{RequestID: op.RequestID, Status: op.State, Message: "Guild bank transfer complete."}
	if op.State == database.GuildBankRejected {
		result.Message = "Transfer was not applied. Refresh the bank and check funds, space and permissions."
	}
	return result
}

func refreshGuildBankSettlement(op database.GuildBankOperation) {
	if world == nil {
		return
	}
	sendInventoryForPlayer(op.PlayerID)
	if db != nil {
		broadcastGuildUpdate(op.GuildID)
	}
}
