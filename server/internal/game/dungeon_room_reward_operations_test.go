package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func frozenRoomRewardFixture(t *testing.T, hook string) (*World, *DungeonInstance, []*Entity, database.DungeonRoomRewardOperation) {
	t.Helper()
	w := newTestWorld()
	layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "start", Width: 40, Height: 40}, {Type: "normal", Hook: hook, X: 100, Width: 40, Height: 40}, {Type: "boss", X: 200, Width: 40, Height: 40}}}
	instance := &DungeonInstance{ID: "dungeon_frozen_room", Layout: layout, RunLevel: 40, DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal,
		RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
	w.storeDungeonInstance(instance.ID, instance)
	players := make([]*Entity, 0)
	for index, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		name := fmt.Sprintf("cohort-%d", index)
		player := newTestPlayer("player-"+name, class)
		player.Name, player.InstanceID, player.Level, player.MaxExperience = name, instance.ID, 40, experienceRequiredForLevel(40)
		player.Health, player.MaxHealth, player.Mana, player.MaxMana = 10, 100, 5, 100
		player.Gold, player.Inventory = 99, make([]Item, MaxInventorySize)
		w.AddEntity(player)
		players = append(players, player)
	}
	op, err := w.PrepareDungeonRoomReward(instance.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	return w, instance, players, op
}

func TestDungeonRoomRewardPreparationFreezesFourRolesWithoutMutating(t *testing.T) {
	w, instance, players, op := frozenRoomRewardFixture(t, "elite_ambush")
	if len(op.Participants) != 4 || instance.RoomState.Rooms[1].Cleared || instance.RoomState.Rooms[1].Rewarded {
		t.Fatal("pure preparation changed cleared progress or lost recipients")
	}
	for index, player := range players {
		if player.Gold != 99 || player.Experience != 0 || player.Inventory[0].ID != "" || player.ItemDeliveryReceipts[op.ID] != "" || op.Participants[index].Username != player.Name || len(op.Participants[index].Items) != 1 {
			t.Fatal("preparation granted reward or lost frozen roll", index)
		}
	}
	// Kill-time eligibility, not remote party membership. Preserve the frozen
	// first cohort even if eligibility changes before a coordinator can save it.
	players[0].Disconnected = true
	players[1].State, players[1].Health = "DEAD", 0
	players[2].InstanceID = "dungeon_other"
	later, err := w.PrepareDungeonRoomReward(instance.ID, 1)
	if err != nil || len(later.Participants) != 1 || len(op.Participants) != 4 {
		t.Fatal("later scene changed the already captured first cohort", err)
	}
}

func TestDungeonRoomRewardEffectsPreserveFrozenItemAndReplayReceipt(t *testing.T) {
	_, _, players, op := frozenRoomRewardFixture(t, "elite_ambush")
	for index, player := range players {
		progression, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op)
		if err != nil || !changed || player.Gold != 99+op.Participants[index].Gold || progression.XP != op.Participants[index].XP || player.ItemDeliveryReceipts[op.ID] != op.Fingerprint || !player.UnjournaledSave {
			t.Fatal("frozen recipient lost grant or private receipt", err)
		}
		var earned Item
		if json.Unmarshal([]byte(op.Participants[index].Items[0]), &earned) != nil || !reflect.DeepEqual(player.Inventory[0], earned) {
			t.Fatal("grant changed originally rolled metadata")
		}
		bag, gold, xp := cloneItems(player.Inventory), player.Gold, player.Experience
		if _, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op); err != nil || changed || player.Gold != gold || player.Experience != xp || !reflect.DeepEqual(player.Inventory, bag) {
			t.Fatal("receipt replay granted the room twice", err)
		}
	}
}

func TestDungeonRoomRewardFullBagKeepsEntireGrantAndRoll(t *testing.T) {
	_, _, players, op := frozenRoomRewardFixture(t, "elite_ambush")
	player := players[0]
	second := Item{ID: "second-frozen-unique", Name: "Exact second blade", Type: ItemWeapon, Stack: 1, MaxStack: 1, Potency: 4, Stats: map[string]int{"damage": 23}}
	payload, _ := json.Marshal(second)
	op.Participants[0].Items = append(op.Participants[0].Items, string(payload))
	op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
	for index := range player.Inventory {
		player.Inventory[index] = Item{ID: fmt.Sprintf("occupied-%d", index), Stack: 1}
	}
	player.Inventory[0] = Item{}
	before := cloneItems(player.Inventory)
	if _, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op); !errors.Is(err, ErrDungeonRoomRewardFull) || changed || player.Gold != 99 || player.Experience != 0 || player.ItemDeliveryReceipts[op.ID] != "" || !reflect.DeepEqual(player.Inventory, before) {
		t.Fatal("partial placement spent/awarded part of a full-bag reward", err)
	}
	player.Inventory[1] = Item{}
	if _, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op); err != nil || !changed || player.Inventory[1].ID != second.ID || player.Gold != 99+op.Participants[0].Gold {
		t.Fatal("space retry lost the exact retained roll", err)
	}
}

func TestDungeonRoomRewardRefusalsArePure(t *testing.T) {
	for _, failure := range []string{"Gold overflow", "unknown item metadata", "conflicting receipt", "owned inventory identity", "owned stash identity", "owned buyback identity", "owned equipment identity", "foreign character"} {
		t.Run(failure, func(t *testing.T) {
			_, _, players, op := frozenRoomRewardFixture(t, "elite_ambush")
			player := players[0]
			var item Item
			_ = json.Unmarshal([]byte(op.Participants[0].Items[0]), &item)
			switch failure {
			case "Gold overflow":
				player.Gold = math.MaxInt
			case "unknown item metadata":
				var fields map[string]any
				_ = json.Unmarshal([]byte(op.Participants[0].Items[0]), &fields)
				fields["futureArt"] = map[string]string{"identity": "retain-not-reconstruct"}
				payload, _ := json.Marshal(fields)
				op.Participants[0].Items[0] = string(payload)
				op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
			case "conflicting receipt":
				player.ItemDeliveryReceipts = map[string]string{op.ID: "other-frozen-roll"}
			case "owned inventory identity":
				player.Inventory[0] = item
			case "owned stash identity":
				player.Stash = []Item{item}
			case "owned buyback identity":
				player.Buyback = []Item{item}
			case "owned equipment identity":
				player.Equipment["mainHand"] = item
			case "foreign character":
				player.Name = "other-account"
			}
			before, gold, xp := cloneItems(player.Inventory), player.Gold, player.Experience
			if _, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op); err == nil || changed || player.Gold != gold || player.Experience != xp || player.UnjournaledSave || !reflect.DeepEqual(player.Inventory, before) {
				t.Fatal("refused reward left a partial economic effect", failure, err)
			}
		})
	}
}

func TestDungeonRoomRewardLateShrineDoesNotRenewBuffOrRevive(t *testing.T) {
	for _, state := range []string{"late", "dead", "outside"} {
		t.Run(state, func(t *testing.T) {
			_, _, players, op := frozenRoomRewardFixture(t, "shrine")
			player := players[0]
			op.CreatedAt = time.Now().UTC().Truncate(time.Millisecond).Add(-time.Minute)
			op.Fingerprint, _ = database.DungeonRoomRewardFingerprint(op)
			if state == "dead" {
				player.State, player.Health = "DEAD", 0
			} else if state == "outside" {
				player.InstanceID = ""
			}
			health, mana := player.Health, player.Mana
			if _, changed, err := player.ApplyDungeonRoomRewardCharacterEffect(op); err != nil || !changed || player.SanctuaryDamageReduction || !player.SanctuaryEndTime.IsZero() {
				t.Fatal("late shrine lost earned currency or renewed timed protection", err)
			}
			if state == "late" {
				if player.Health != health+30 || player.Mana != mana+30 {
					t.Fatal("same-instance retained shrine healing was lost")
				}
			} else if player.Health != health || player.Mana != mana {
				t.Fatal("shrine resurrected or healed outside its original instance")
			}
		})
	}
}
