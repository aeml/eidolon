package main

import (
	"encoding/json"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func bankHandlerResult(t *testing.T, client *Client, kind string, request GuildBankPayload) guildBankResult {
	t.Helper()
	encoded, _ := json.Marshal(request)
	client.handleMessage(Message{Type: kind, Payload: encoded})
	var result guildBankResult
	found := false
	for _, reply := range drainSentMessages(client.send) {
		if reply.Type == MsgGuildBankResult {
			if err := json.Unmarshal(reply.Payload, &result); err != nil {
				t.Fatal(err)
			}
			found = true
		}
	}
	if !found {
		t.Fatal("missing correlated bank result")
	}
	return result
}

func TestGuildBankRequestRejectsAmbiguousClientIntent(t *testing.T) {
	for _, request := range []GuildBankPayload{
		{Gold: 1}, {RequestID: "too-short", Gold: 1}, {RequestID: "request-123456789", Gold: 0},
		{RequestID: "request-123456789", Gold: -1}, {RequestID: "request-123456789", Gold: 1, ItemID: "blade"},
		{RequestID: "request-123456789", ItemID: " blade "},
	} {
		if _, err := guildBankRequestAction(MsgGuildBankDeposit, request); err == nil {
			t.Fatal("ambiguous or legacy request accepted", request)
		}
	}
}

func TestGuildBankRequestTerminalLookupPrecedesPlanningAndRejectsChangedReplay(t *testing.T) {
	_, _, _, committer, player := adminMutationFixture(t)
	store, ops := bankSchedulerFixture(t, 1)
	op := ops[0]
	delete(store.ops, op.ID)
	delete(store.held, op.ID)
	op.Username, op.CharacterName, op.PlayerID = "recipient", "recipient", "player-recipient"
	op.ID = database.GuildBankOperationID(op.Username, op.RequestID)
	op.Fingerprint = database.GuildBankOperationFingerprint(op)
	store.ops[op.ID] = op
	client := activeSessions["recipient"]
	request := GuildBankPayload{RequestID: op.RequestID, Gold: op.Gold}
	before := world.GetEntityCopy(player.ID)
	for i := 0; i < 2; i++ {
		result := bankHandlerResult(t, client, MsgGuildBankDeposit, request)
		if result.Status != database.GuildBankComplete || result.RequestID != request.RequestID {
			t.Fatal("terminal request not acknowledged", result)
		}
	}
	request.Gold++
	if result := bankHandlerResult(t, client, MsgGuildBankDeposit, request); result.Status != "invalid" {
		t.Fatal("changed same-ID replay accepted", result)
	}
	if !reflect.DeepEqual(before, world.GetEntityCopy(player.ID)) || len(committer.ids) != 0 {
		t.Fatal("terminal replay planned/saved another financial effect")
	}
}

func TestGuildBankRequestPlannerUsesExactVisibleItemAndFreshPermissions(t *testing.T) {
	player := &game.Entity{ID: "player-owner", Type: game.TypePlayer, Gold: 200, GuildBankRevision: 3,
		Inventory: []game.Item{{ID: "earned", Name: "Earned Blade", Stack: 1, Potency: 7,
			Stats: map[string]int{"damage": 375}, Sockets: 1, Gems: []game.SocketedGem{{Type: "Ruby", Quality: "Flawless", Stats: map[string]int{"strength": 4}}}}}}
	guild := &database.Guild{ID: "guild-test", Version: 12,
		Members: []database.GuildMember{{PlayerID: player.ID, Rank: database.GuildRankMember}}}
	request := GuildBankPayload{RequestID: "request-123456789", ItemID: "earned"}
	op, err := planGuildBankRequest("owner", player, guild, database.GuildBankDepositItem, request)
	if err != nil || op.GuildVersion != 12 || op.CharacterBankRevision != 3 {
		t.Fatal("server revision planning failed", err)
	}
	var item database.Item
	if json.Unmarshal([]byte(op.ItemPayload), &item) != nil || !reflect.DeepEqual(item, databaseItem(player.Inventory[0])) {
		t.Fatal("planned payload normalized or discarded earned item details")
	}
	if _, err := planGuildBankRequest("owner", player, guild, database.GuildBankWithdrawItem, request); err == nil {
		t.Fatal("member planned privileged withdrawal")
	}
	player.Inventory = make([]game.Item, game.MaxInventorySize+1)
	player.Inventory[game.MaxInventorySize] = game.Item{ID: "hidden", Stack: 1}
	request.ItemID = "hidden"
	if _, err := planGuildBankRequest("owner", player, guild, database.GuildBankDepositItem, request); err == nil {
		t.Fatal("hidden bag slot planned for deposit")
	}
	player.Inventory[0] = game.Item{ID: "chronicle-item-personal", Stack: 1}
	request.ItemID = player.Inventory[0].ID
	if _, err := planGuildBankRequest("owner", player, guild, database.GuildBankDepositItem, request); err == nil {
		t.Fatal("personal story item planned for shared bank")
	}
}

func TestGuildBankRequestAdmissionRetainsRetryIdentity(t *testing.T) {
	client := &Client{send: make(chan []byte, 2)}
	request := GuildBankPayload{RequestID: "request-123456789", Gold: 10}
	encoded, _ := json.Marshal(request)
	client.sendInboundRejection(Message{Type: MsgGuildBankDeposit, Payload: encoded}, "recovering previous transfer")
	replies := drainSentMessages(client.send)
	var result guildBankResult
	if len(replies) != 1 || replies[0].Type != MsgGuildBankResult || json.Unmarshal(replies[0].Payload, &result) != nil ||
		result.RequestID != request.RequestID || result.Status != "pending" {
		t.Fatal("admission decided or lost an uncertain request", replies)
	}
}
