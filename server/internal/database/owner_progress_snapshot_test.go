package database

import (
	"bytes"
	"encoding/json"
	"math"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func ownerSnapshotFixture() *Character {
	item := Item{ID: "original-item", Name: "<script>not executable</script>", Type: "WEAPON", Slot: "mainHand",
		Rarity: "Rare", Level: 30, Stats: map[string]int{"strength": 17}, Value: 123, Description: "An earned blade",
		Stack: 1, MaxStack: 1, Potency: 4, Sockets: 1, SetID: "earth-set", UniqueEffect: "earth-ward",
		Gems: []SocketedGem{{Type: "Ruby", Quality: "Rare", Stats: map[string]int{"strength": 3}}}}
	return &Character{Name: "owner-fighter", Class: "Fighter", Level: 30, XP: 654,
		Gold: 2345, EP: 100, ResonanceLevel: 1, ResonanceXP: 87, ResonancePoints: 2,
		ResonanceRanks: map[string]int{"vitality": 1}, Stats: Stats{Strength: 17, Dexterity: 9, Intelligence: 2, Wisdom: 3, Vitality: 12},
		Inventory: []Item{{}, item}, Stash: []Item{item}, Buyback: []Item{item}, Equipment: map[string]Item{"mainHand": item},
		EquipmentLoadouts: []EquipmentLoadout{{Name: "Story", Class: "Fighter", Equipment: map[string]string{"mainHand": item.ID},
			Hotbar: []string{"Strike"}, Build: &LoadoutBuild{Branch: "Guardian", TalentRanks: map[string]int{"ward": 1}, SkillRunes: map[string]string{"Strike": "earth"}}},
			{Name: "Empty", Class: "Fighter"}},
		SavedHotbar: []string{"Strike"}, SkillPoints: 2, SelectedBranch: "Guardian", UnlockedSkills: []string{"Strike"},
		SkillRunes: map[string]string{"Strike": "earth"}, UnlockedTalents: []string{"ward"}, TalentRanks: map[string]int{"ward": 1},
		AppearanceCollection: map[string]EquipmentAppearance{"earned-look": {BaseName: "Blade", Rarity: "Rare", Slot: "mainHand"}},
		Appearances:          map[string]EquipmentAppearance{"mainHand": {BaseName: "Blade", Rarity: "Rare", Slot: "mainHand"}},
		Quests: []Quest{{ID: "story-earth", Type: "COLLECT", Target: "Crystal Shard", Count: 7, MaxCount: 12,
			RewardXP: 345, RewardGold: 100, Accepted: true, Title: "Earth's Memory", Description: "Gather shards",
			Lore: "The crystal remembers", Category: "story", Chapter: 1, ObjectiveText: "Gather twelve shards"},
			{ID: "claimed", Completed: true, Accepted: true, GrantedGold: 98, GrantedXP: 456, GrantedResonanceXP: 7}},
		DirectTradeState: bson.Raw{5, 0, 0, 0, 0}, PartyID: "private-party-identity", InstanceID: "private-instance-identity",
		LastSaveID: "private-save-identity", GuildBankOpID: "private-bank-identity", GuildBankOpFingerprint: "private-bank-proof",
		AdminOperationReceipts: map[string]string{"private-admin-identity": "private-admin-proof"},
		ItemDeliveryReceipts:   map[string]string{"private-delivery-identity": "private-delivery-proof"},
		PendingBossLoot:        []string{"private-loot-identity"}, GoldCreditReceipts: map[string]int{"private-credit-identity": 98},
		VIPAllowanceReceipts: map[string]int{"private-vip-identity": 100}, EPExchangeReceipts: map[string]int{"private-exchange-identity": 1},
		EPCasinoReceipts: map[string]int{"private-casino-identity": 3}, WeeklyRaidRewardReceipts: map[string]bool{"private-weekly-identity": true},
		DungeonProgress: &CharacterDungeonResume{InstanceID: "private-resume-instance", PartyID: "private-resume-party"},
		Resources:       &CharacterResources{Version: 1, Health: 0, Mana: 3, Dead: true},
		WellRested:      &CharacterWellRested{Version: 1, RemainingSeconds: 123.5},
	}
}

func TestOwnerProgressSnapshotPreservesGameplayWithoutMutatingPersistence(t *testing.T) {
	character := ownerSnapshotFixture()
	before, err := bson.Marshal(character)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 4, 13, 0, 0, 0, time.FixedZone("fixture", 3600))
	encoded, err := encodeOwnerProgressSnapshot(character, now, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	var snapshot ownerProgressSnapshot
	if err := json.Unmarshal(encoded, &snapshot); err != nil {
		t.Fatal(err)
	}
	got := snapshot.Character
	if snapshot.Format != "eidolon-owner-progression" || snapshot.Version != 1 || !snapshot.GeneratedAt.Equal(now) || snapshot.GeneratedAt.Location() != time.UTC {
		t.Fatal("snapshot lacks stable format/version/UTC timestamp")
	}
	if got.Name != character.Name || got.Level != 30 || got.XP != 654 || got.Gold != 2345 || got.EP != 100 || got.ResonanceXP != 87 || got.Stats.Strength != 17 {
		t.Fatal("snapshot lost owner progression/currency/stats")
	}
	if len(got.Inventory) != 2 || got.Inventory[0].ID != "" || got.Inventory[1].ID != "original-item" || got.Inventory[1].Gems[0].Stats["strength"] != 3 || got.Equipment["mainHand"].Potency != 4 || got.Stash[0].ID != "original-item" || got.Buyback[0].ID != "original-item" {
		t.Fatal("snapshot changed item identity, empty bag positions or equipment/gems")
	}
	if got.Loadouts[0].Build.Branch != "Guardian" || got.Loadouts[1].Build != nil || got.Loadouts[0].Equipment["mainHand"] != "original-item" || got.Hotbar[0] != "Strike" || got.SkillRunes["Strike"] != "earth" || got.TalentRanks["ward"] != 1 || got.Appearances["mainHand"].Rarity != "Rare" || got.AppearanceCollection["earned-look"].BaseName != "Blade" {
		t.Fatal("snapshot lost builds, loadouts or appearance ownership")
	}
	if got.Quests[0].Count != 7 || got.Quests[0].MaxCount != 12 || got.Quests[0].Completed || !got.Quests[1].Completed || got.Quests[1].GrantedGold != 98 || got.Quests[1].GrantedResonanceXP != 7 {
		t.Fatal("snapshot changed quest progress/claim/reward state")
	}
	if got.Resources == nil || got.Resources.Health != 0 || got.Resources.Mana != 3 || !got.Resources.Dead || got.WellRested == nil || got.WellRested.RemainingSeconds != 123.5 {
		t.Fatal("snapshot lost explicit zero/death resources or rested duration")
	}
	if strings.Contains(string(encoded), "private-") || strings.Contains(string(encoded), "<script>") {
		t.Fatal("snapshot leaked internal identities/proofs or unescaped markup")
	}
	if got.Inventory[1].Name != character.Inventory[1].Name {
		t.Fatal("JSON escaping changed actual item text")
	}
	after, err := bson.Marshal(character)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("export serializer mutated stored character state", err)
	}
	repeated, err := encodeOwnerProgressSnapshot(character, now.UTC(), 1<<20)
	if err != nil || !bytes.Equal(encoded, repeated) {
		t.Fatal("snapshot ordering is not deterministic", err)
	}
}

func TestOwnerProgressSnapshotBudgetsReturnNoPartialData(t *testing.T) {
	character := ownerSnapshotFixture()
	now := time.Unix(1_700_000_000, 0).UTC()
	encoded, err := encodeOwnerProgressSnapshot(character, now, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	for _, budget := range []int{-1, 0, 1, len(encoded) - 1} {
		got, err := encodeOwnerProgressSnapshot(character, now, budget)
		if err != errOwnerProgressSnapshot || got != nil {
			t.Fatal("invalid/exhausted budget returned data", budget)
		}
	}
	if got, err := encodeOwnerProgressSnapshot(character, now, len(encoded)); err != nil || !bytes.Equal(got, encoded) {
		t.Fatal("exact response budget failed", err)
	}
	for _, invalid := range []*Character{nil, {Class: "Fighter"}} {
		if got, err := encodeOwnerProgressSnapshot(invalid, now, 1<<20); err != errOwnerProgressSnapshot || got != nil {
			t.Fatal("invalid character accepted")
		}
	}
	if got, err := encodeOwnerProgressSnapshot(character, time.Time{}, 1<<20); err != errOwnerProgressSnapshot || got != nil {
		t.Fatal("missing export timestamp accepted")
	}
	character.WellRested.RemainingSeconds = math.NaN()
	if got, err := encodeOwnerProgressSnapshot(character, now, 1<<20); err != errOwnerProgressSnapshot || got != nil {
		t.Fatal("encoding failure returned partial data or internal diagnostics")
	}
}

func TestOwnerProgressSnapshotNeverEmbedsPersistenceDTOs(t *testing.T) {
	visited := map[reflect.Type]bool{}
	var check func(reflect.Type)
	check = func(typ reflect.Type) {
		if visited[typ] {
			return
		}
		visited[typ] = true
		switch typ.Kind() {
		case reflect.Pointer, reflect.Slice, reflect.Array:
			check(typ.Elem())
		case reflect.Map:
			if typ.Key().Kind() != reflect.String {
				t.Fatal("unexpected export map key")
			}
			check(typ.Elem())
		case reflect.Struct:
			if typ == reflect.TypeFor[time.Time]() {
				return
			}
			if !strings.HasPrefix(typ.Name(), "owner") {
				t.Fatal("export embeds a persistence/raw DTO", typ)
			}
			for i := 0; i < typ.NumField(); i++ {
				field := typ.Field(i)
				if field.Tag.Get("json") == "" {
					t.Fatal("export lacks an explicit JSON field name", typ, field.Name)
				}
				check(field.Type)
			}
		case reflect.String, reflect.Int, reflect.Bool, reflect.Float64:
		default:
			t.Fatal("export contains opaque/unreviewed data", typ)
		}
	}
	check(reflect.TypeFor[ownerProgressSnapshot]())
}
