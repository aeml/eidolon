package main

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// A fresh wallet read establishes a point-in-time balance. It cannot promise
// that freeing bag space will not deliver a separately earned room award.
// This uses real admission/dispatch/recovery and the filesystem save journal,
// with modeled durable storage; it is not proof of the public QA account's cause.
func TestFreshWalletBeforeBagChangeMayReleaseEarnedRoomGold(t *testing.T) {
	for _, action := range []string{MsgSell, MsgStashDeposit} {
		for _, pending := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/pending=%t", action, pending), func(t *testing.T) {
				store, instance, players, _ := roomDeliveryFixture(t)
				t.Cleanup(world.StopBackground)
				player := players[0]
				instance.RunLevel = 40
				player.ResonanceRanks = map[string]int{"fortune": 1}
				for i := range player.Inventory {
					player.Inventory[i] = game.Item{ID: fmt.Sprintf("retained-gear-%d", i), Name: "Retained gear", Type: game.ItemArmor,
						Slot: "chest", Rarity: game.RarityCommon, Value: 3, Stack: 1, MaxStack: 1, Level: 1}
				}
				original := world.GetEntityCopy(player.ID)
				store.characters[player.Name] = characterSnapshotForSave(player.Name, original)
				var feedback []game.DungeonRoomClearRewardEvent
				world.OnEvent = func(kind string, value interface{}) {
					if kind == "room_clear_reward" {
						event := value.(game.DungeonRoomClearRewardEvent)
						if event.PlayerID == player.ID {
							feedback = append(feedback, event)
						}
					}
				}
				var op database.DungeonRoomRewardOperation
				if pending {
					world.MarkDungeonRoomCleared(instance.ID, 1)
					plans := world.PendingDungeonRoomRewardPlans()
					if len(plans) != 1 {
						t.Fatal("full bag did not retain the actual room operation")
					}
					op = plans[0]
					participant, found := database.DungeonRoomRewardRecipientFor(op, player.Name)
					// Real level40/elite-ambush/fortune1 calculation, not an
					// injected balance or hand-authored award amount.
					if !found || participant.Gold != 175 || len(participant.Items) != 1 || len(feedback) != 0 {
						t.Fatal("unexpected actual prepared entitlement", participant.Gold, len(participant.Items), len(feedback))
					}
				}
				// The original dungeon may already have been left. Pending
				// entitlement remains claimable from ordinary town bag work.
				player.InstanceID = ""
				client := newLevelCommandClient()
				client.username, client.playerID = player.Name, player.ID
				client.handleMessage(Message{Type: MsgGetEPWallet, Payload: json.RawMessage(`{"readID":"before-bag-change"}`)})
				baseline := readEPResult(t, client)
				if !baseline.Success || baseline.Pending || baseline.ReadID != "before-bag-change" || baseline.Gold != original.Gold {
					t.Fatal("fresh authoritative baseline was not exact", baseline)
				}
				payload, err := json.Marshal(SellPayload{ItemID: original.Inventory[0].ID})
				if err != nil {
					t.Fatal(err)
				}
				message := Message{Type: action, Payload: payload}
				client.handleMessage(message)
				for _, response := range drainSentMessages(client.send) {
					if response.Type == MsgError {
						t.Fatal("bag action was rejected")
					}
				}
				saleGold, rewardGold := 0, 0
				if action == MsgSell {
					saleGold = original.Inventory[0].Value
				}
				if pending {
					rewardGold = 175
				}
				final := world.GetEntityCopy(player.ID)
				if final.Gold != baseline.Gold+saleGold+rewardGold || final.EP != original.EP || !reflect.DeepEqual(final.Equipment, original.Equipment) {
					t.Fatal("separate sale/reward accounting or equipment changed", final.Gold, baseline.Gold, saleGold, rewardGold)
				}
				if len(feedback) != boolCount(pending) || (pending && feedback[0].Gold != rewardGold) {
					t.Fatal("earned Gold lacks exactly one saved room feedback event")
				}
				for _, item := range original.Inventory[1:] {
					found := false
					for _, retained := range final.Inventory {
						if retained.ID == item.ID && reflect.DeepEqual(retained, item) {
							found = true
						}
					}
					if !found {
						t.Fatal("unrelated bag item changed")
					}
				}
				if action == MsgStashDeposit && (len(final.Stash) != 1 || !reflect.DeepEqual(final.Stash[0], original.Inventory[0])) {
					t.Fatal("exact stash item was not preserved")
				}
				if pending {
					saved := store.characters[player.Name]
					if saved.Gold != final.Gold || !database.DungeonRoomRewardCharacterReceiptMatches(saved, op) ||
						!reflect.DeepEqual(saved.Inventory, databaseItems(final.Inventory, true)) || !reflect.DeepEqual(saved.Stash, databaseItems(final.Stash, false)) {
						t.Fatal("room feedback preceded exact durable whole-character proof")
					}
				}
				client.handleMessage(message)
				drainSentMessages(client.send)
				if world.GetEntityCopy(player.ID).Gold != final.Gold || len(feedback) != boolCount(pending) {
					t.Fatal("repeated bag request repeated a sale or earned room award")
				}
				t.Logf("freshGold=%d actionGold=%d earnedRoomGold=%d finalGold=%d; separate reward receipt/feedback=%t", baseline.Gold, saleGold, rewardGold, final.Gold, pending)
			})
		}
	}
}

func boolCount(value bool) int {
	if value {
		return 1
	}
	return 0
}
