package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/forging"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"github.com/gorilla/websocket"
)

// Capture the actual initial owner messages, not a local copy of the hydration
// code. The usual resourceLoginCharacter helper consumes inventory on its way
// to quest_update, so this route deliberately retains all three initial views.
func inventorySessionJoin(t *testing.T, address, name, password, class string) (*websocket.Conn, []game.Item, []game.Quest, loadoutResponse) {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial("ws://"+address+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	resourceSend(t, conn, MsgLogin, map[string]string{"username": name, "password": password})
	resourceReadMessage(t, conn, "login_success", nil)
	resourceSend(t, conn, MsgJoin, JoinPayload{Type: class})
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	var bag []game.Item
	var quests []game.Quest
	var loadout loadoutResponse
	for {
		kind, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		if kind != websocket.TextMessage {
			continue
		}
		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			t.Fatal(err)
		}
		switch message.Type {
		case MsgError:
			t.Fatal("ordinary compatibility login/join rejected")
		case MsgInventory:
			bag = nil // A full replacement; omitted zero fields must not retain a prior slot's metadata.
			if err := json.Unmarshal(message.Payload, &bag); err != nil {
				t.Fatal(err)
			}
		case MsgQuestUpdate:
			if err := json.Unmarshal(message.Payload, &quests); err != nil {
				t.Fatal(err)
			}
		case MsgLoadoutResult:
			if err := json.Unmarshal(message.Payload, &loadout); err != nil {
				t.Fatal(err)
			}
			if len(bag) != game.MaxInventorySize || len(quests) == 0 || !loadout.Success {
				t.Fatal("initial join omitted its complete owner bag, quests or successful build snapshot")
			}
			return conn, bag, quests, loadout
		}
	}
}

// Opt-in disposable Mongo plus an exact built production binary. These are
// prepared compatibility saves, not earned leveling, casino winnings or raid
// clears. Real ordinary sockets and independent Mongo reads prove each save.
func TestInventoryActualSavedLoginDragAndRestart(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	random := make([]byte, 24)
	if _, err := rand.Read(random); err != nil {
		t.Fatal(err)
	}
	prefix, password := "codex-compat188-"+hex.EncodeToString(random[:5]), hex.EncodeToString(random)
	type fixture struct {
		saved *database.Character
		fresh bool
	}
	var fixtures []fixture
	party := "party-player-" + prefix + "-0"
	var look game.EquipmentAppearance
	for _, offer := range game.CosmeticCatalogue() {
		if offer.Appearance.Slot == "chest" {
			look = offer.Appearance
			break
		}
	}
	if look.BaseName == "" {
		t.Fatal("actual chest cosmetic catalogue unavailable")
	}
	for index, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric", "Wizard", "Wizard"} {
		name := fmt.Sprintf("%s-%d", prefix, index)
		if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
			t.Fatal(err)
		}
		if index == 5 {
			fixtures = append(fixtures, fixture{saved: &database.Character{Name: name, Class: class}, fresh: true})
			continue // No character document: ordinary join creates the starter.
		}
		skill := map[string]string{"Fighter": "Charge", "Rogue": "Piercing Throw", "Wizard": "Fireball", "Cleric": "Spirit Guardians"}[class]
		chest := database.Item{ID: name + "-chest", Name: "Woven Robe", Type: "ARMOR", Slot: "chest", Rarity: "RARE", Level: 1, Stack: 1, MaxStack: 1,
			StatScaleVersion: game.ItemStatScaleVersion, Stats: map[string]int{"strength": 2}}
		saved := &database.Character{Name: name, Class: class, Level: 30, ProgressionVersion: game.CurrentProgressionVersion,
			XP: 23, X: 5000, Z: 5000, Gold: 777, EP: 55, SelectedBranch: "A", SkillPoints: 2, PartyID: party,
			Stats:      database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
			Resources:  &database.CharacterResources{Version: 1, Health: 20, Mana: 0},
			WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 180}, LastDailyQuest: time.Now().UTC(),
			GoldCreditReceipts: map[string]int{"retained-credit": 37}, EPCasinoReceipts: map[string]int{"retained-ep": 13},
			VIPAllowanceReceipts: map[string]int{"2026-09": 100}, EPExchangeReceipts: map[string]int{"retained-exchange": 1},
			Equipment: map[string]database.Item{"chest": chest}, SavedHotbar: []string{"", skill, "", ""},
			EquipmentLoadouts: []database.EquipmentLoadout{{Name: "Saved Kit", Class: class, Equipment: map[string]string{"chest": chest.ID}, Hotbar: []string{"", skill, "", ""},
				Build: &database.LoadoutBuild{Branch: "A", TalentRanks: map[string]int{}, SkillRunes: map[string]string{}}}},
			AppearanceCollection: databaseAppearances(map[string]game.EquipmentAppearance{game.AppearanceKey(look): look}),
			Appearances:          databaseAppearances(map[string]game.EquipmentAppearance{"chest": look}),
			Quests: []database.Quest{{ID: "chronicle_01_bell_below", Type: "KILL", Target: "Skeleton", Category: "chronicle", Accepted: true,
				Count: 1, MaxCount: 3, RewardXP: 123, RewardGold: 77, RewardXPQuoted: true, RewardGoldQuoted: true},
				{ID: "compat_retained_chapter", Type: "INVESTIGATE", Category: "chronicle", Accepted: true, LegacyOptional: true,
					Count: 2, MaxCount: 4, InvestigationMask: 5, RewardXPQuoted: true, RewardGoldQuoted: true}},
			Inventory: make([]database.Item, game.MaxInventorySize)}
		saved.Inventory[8] = database.Item{ID: name + "-blade", Name: "Saved Blade", Type: "WEAPON", Slot: "mainHand", Level: 30,
			Stack: 1, MaxStack: 1, Potency: 4, Sockets: 1, Gems: []database.SocketedGem{{Type: "Ruby", Stats: map[string]int{"strength": 2}}},
			Stats: map[string]int{"damage": 19}, StatScaleVersion: game.ItemStatScaleVersion,
			ForgeBasis: &forging.Basis{Level: 20, Potency: 2, Value: 37, Stats: map[string]int{"damage": 11}}}
		saved.Inventory[24] = database.Item{ID: name + "-material", Name: "Eidolon Shard", Type: "MATERIAL", Stack: 7, MaxStack: 1000,
			Icon: "procedural:item:eidolon-shard", StatScaleVersion: game.ItemStatScaleVersion}
		if index == 4 {
			saved.PartyID = ""
			saved.Inventory = []database.Item{saved.Inventory[8], {ID: name + "-legacy", Name: "Heart"}} // Real unversioned material and old compact order.
		}
		if err := repo.SetFirstCharacter(name, saved); err != nil {
			t.Fatal(err)
		}
		fixtures = append(fixtures, fixture{saved: saved})
	}
	journal := t.TempDir()
	for phase := 0; phase < 2; phase++ {
		address, stop := compatStartServer(t, binary, uri, 188+phase, "-save-journal-dir", journal)
		connections := make([]*websocket.Conn, len(fixtures))
		bags := make([][]game.Item, len(fixtures))
		for index := range fixtures {
			f := &fixtures[index]
			before := f.saved
			conn, bag, quests, build := inventorySessionJoin(t, address, before.Name, password, before.Class)
			connections[index] = conn
			if phase > 0 && !reflect.DeepEqual(bag, restoreCharacterInventory(before.Inventory)) {
				t.Fatal("restart changed a saved bag, including the fresh starter")
			}
			if f.fresh {
				for _, quest := range quests {
					if quest.Completed {
						t.Fatal("fresh join fabricated completed quests")
					}
				}
			} else {
				wantBag := restoreCharacterInventory(before.Inventory)
				if !reflect.DeepEqual(bag, wantBag) {
					t.Fatalf("phase%d fixture%d: initial bag positions/metadata changed", phase, index)
				}
				if !build.Restored || !reflect.DeepEqual(build.Profiles, gameLoadouts(before.EquipmentLoadouts)) || !reflect.DeepEqual(build.Hotbar, before.SavedHotbar) || build.Build == nil || build.Build.Branch != "A" {
					t.Fatal("login lost saved build, preset references or hotbar")
				}
				for _, promised := range before.Quests[:2] {
					found := false
					for _, q := range quests {
						if q.ID != promised.ID {
							continue
						}
						found = q.Count == promised.Count && q.MaxCount == promised.MaxCount && q.RewardXP == promised.RewardXP && q.RewardGold == promised.RewardGold && q.Accepted == promised.Accepted && q.Completed == promised.Completed && q.InvestigationMask == promised.InvestigationMask
					}
					if !found {
						t.Fatal("login changed accepted story terms or investigation progress")
					}
				}
				actor := wellRestedReadActor(t, conn, before.Name, func(e *statepb.Entity) bool { return e.Level == 30 && e.PartyId == before.PartyID })
				if actor.Health != 20 || actor.Mana != 0 || actor.Gold != 777 {
					t.Fatal("outside-town reconnect fabricated resources or Gold")
				}
				resourceSend(t, conn, MsgGetWardrobe, map[string]any{})
				var wardrobe cosmeticSocketResult
				resourceReadMessage(t, conn, MsgWardrobeResult, &wardrobe)
				if !wardrobe.Success || !reflect.DeepEqual(wardrobe.Collection, gameAppearances(before.AppearanceCollection)) || !reflect.DeepEqual(wardrobe.Appearances, gameAppearances(before.Appearances)) {
					t.Fatal("restart lost cosmetic ownership or selection")
				}
				if phase == 0 && index < 4 {
					resourceSend(t, conn, MsgInventoryMove, InventoryMovePayload{FromIndex: 8, ToIndex: 6})
					bag = nil // Unmarshal into a new replacement, just as the browser replaces its bag.
					resourceReadMessage(t, conn, MsgInventory, &bag)
					wantBag[6], wantBag[8] = wantBag[8], wantBag[6]
					if !reflect.DeepEqual(bag, wantBag) {
						if len(bag) != len(wantBag) {
							t.Fatal("ordinary drag changed bag capacity")
						}
						for slot := range wantBag {
							if !reflect.DeepEqual(bag[slot], wantBag[slot]) {
								t.Fatalf("phase%d fixture%d: ordinary drag mismatch at slot%d: wire=%+v expected=%+v", phase, index, slot, bag[slot], wantBag[slot])
							}
						}
					}
				}
			}
			bags[index] = bag
		}
		// Keep the four restored members connected together. A copied PartyID
		// alone is not proof that the live registry recognizes its leader.
		for index := 0; index < 4; index++ {
			resourceSend(t, connections[index], MsgGetDungeonStatus, map[string]any{})
			var status struct {
				IsLeader bool `json:"isLeader"`
			}
			resourceReadMessage(t, connections[index], MsgGetDungeonStatus, &status)
			if status.IsLeader != (index == 0) {
				t.Fatal("restored party registry changed dungeon-entry leadership")
			}
		}
		for index := range fixtures {
			f := &fixtures[index]
			before := f.saved
			conn, bag := connections[index], bags[index]
			saved := resourceCloseAndWait(t, repo, conn, before.Name)
			if !reflect.DeepEqual(restoreCharacterInventory(saved.Inventory), bag) {
				t.Fatal("independent fresh Mongo save lost wire bag positions")
			}
			if !f.fresh && (saved.Gold != before.Gold || saved.EP != before.EP || saved.Level != before.Level || saved.XP != before.XP || saved.Stats != before.Stats || saved.PartyID != before.PartyID ||
				!reflect.DeepEqual(saved.Equipment, before.Equipment) || !reflect.DeepEqual(saved.GoldCreditReceipts, before.GoldCreditReceipts) || !reflect.DeepEqual(saved.EPCasinoReceipts, before.EPCasinoReceipts) ||
				!reflect.DeepEqual(saved.VIPAllowanceReceipts, before.VIPAllowanceReceipts) || !reflect.DeepEqual(saved.EPExchangeReceipts, before.EPExchangeReceipts)) {
				t.Fatal("ordinary save changed unrelated earned state or wallet receipts")
			}
			f.saved, f.fresh = saved, false
			// Fresh starter has a different expected build/resources. Continue its
			// next login below as an actual fresh account, not a seeded level30 save.
			if index == 5 {
				f.fresh = true
			}
		}
		stop() // Joined normal shutdown, then a genuinely fresh server process.
	}
	t.Log("native compatibility: four classes, sparse drag/save/restart, old compact material migration, fresh starter, accepted story/build/wardrobe/party/wallet terms retained")
}
