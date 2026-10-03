package main

import (
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestBossLootPersistenceKeepsOpaquePayloadAndAtomicCollectionAcrossJournalReopen(t *testing.T) {
	dir, committer := setupCharacterJournalTest(t)
	player := &game.Entity{ID: "player-boss-save", Name: "boss-save", Type: game.TypePlayer, SubType: "Rogue", Gold: 77, EP: 43,
		Level: 100, Health: 30, MaxHealth: 100, Mana: 20, MaxMana: 50, State: "IDLE", Inventory: make([]game.Item, game.MaxInventorySize),
		Quests:          []game.Quest{{ID: "earned-boss", Type: "KILL", Count: 1, MaxCount: 1, Accepted: true}},
		PendingBossLoot: []string{`{"id":"original-blade","name":"Original","type":"WEAPON","stack":1,"maxStack":1,"level":100,"potency":7,"stats":{"damage":73}}`}}
	for index := range player.Inventory {
		player.Inventory[index] = game.Item{ID: fmt.Sprintf("owned-%d", index), Name: "Owned", Stack: 1, MaxStack: 1}
	}
	image := characterSnapshot(player.Name, player, time.Now())
	unknown := `{"id":"future","stack":1,"maxStack":1,"futureArt":{"retain":"verbatim"}}`
	image.PendingBossLoot = append(image.PendingBossLoot, unknown)
	encoded, err := bson.Marshal(image)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip database.Character
	if err := bson.Unmarshal(encoded, &roundTrip); err != nil || !reflect.DeepEqual(roundTrip.PendingBossLoot, image.PendingBossLoot) {
		t.Fatal("BSON normalization erased opaque future boss metadata", err)
	}
	image.PendingBossLoot = image.PendingBossLoot[:1]
	player.PendingBossLoot[0] = "changed external actor"
	committer.fail = errors.New("rejected character save")
	if err := persistCharacterSnapshot(image.Name, image); err == nil {
		t.Fatal("rejected boss retention save was acknowledged")
	}
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := characterSaveJournal.Read(image.Name)
	if err != nil || pending == nil {
		t.Fatal("original rolled item lost its real filesystem journal", err)
	}
	retained, err := pending.Character()
	if err != nil || len(retained.PendingBossLoot) != 1 || retained.PendingBossLoot[0] != image.PendingBossLoot[0] || retained.Gold != 77 || retained.EP != 43 || retained.Quests[0].Count != 1 {
		t.Fatal("reopened image lost exact queue or unrelated values", err)
	}
	player.PendingBossLoot = append([]string(nil), retained.PendingBossLoot...)
	player.Inventory[0] = game.Item{}
	if count, err := player.CollectPendingBossLootLocked(10); count != 1 || err != nil {
		t.Fatal("fresh retained queue could not collect after freeing space", err)
	}
	after := characterSnapshot(player.Name, player, time.Now())
	if err := persistCharacterSnapshot(after.Name, after); err == nil {
		t.Fatal("rejected item collection was acknowledged")
	}
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err = characterSaveJournal.Read(after.Name)
	if err != nil || pending == nil {
		t.Fatal(err)
	}
	collected, err := pending.Character()
	if err != nil || len(collected.PendingBossLoot) != 0 || collected.Inventory[0].ID != "original-blade" || collected.Inventory[0].Potency != 7 || collected.Inventory[0].Stats["damage"] != 73 || collected.EP != 43 {
		t.Fatal("collection journal separated bag credit from queue removal", err)
	}
	committer.fail = nil
	if err := retryPendingCharacterSaves(); err != nil || len(committer.saved.PendingBossLoot) != 0 || committer.saved.Inventory[0].ID != "original-blade" {
		t.Fatal("fresh replay failed to recover the complete collection image", err)
	}
}
