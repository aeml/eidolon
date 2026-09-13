package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

func TestLoadoutPersistenceRoundTripOwnsItsReferences(t *testing.T) {
	p := &game.Entity{EquipmentLoadouts: []game.EquipmentLoadout{{Name: "Tank", Class: "Fighter", Equipment: map[string]string{"mainHand": "earned-sword"}, Hotbar: []string{"Charge", "", "", ""}}}}
	p.EquipmentLoadouts[0].Build = &game.LoadoutBuild{Branch: "A", TalentRanks: map[string]int{"FTR_01": 1}, SkillRunes: map[string]string{"Charge": "charge_momentum"}}
	p.SavedHotbar = []string{"", "Charge", "", ""}
	snapshot := characterSnapshot("hero", p, time.Now())
	bytes, err := bson.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if err := bson.Unmarshal(bytes, snapshot); err != nil {
		t.Fatal(err)
	}
	loaded := gameLoadouts(snapshot.EquipmentLoadouts)
	if !reflect.DeepEqual(snapshot.SavedHotbar, p.SavedHotbar) {
		t.Fatal("saved skill bar lost")
	}
	if !reflect.DeepEqual(loaded, p.EquipmentLoadouts) {
		t.Fatal("character save lost loadouts")
	}
	loaded[0].Equipment["mainHand"] = "mutated"
	loaded[0].Build.TalentRanks["FTR_01"] = 9
	if p.EquipmentLoadouts[0].Build.TalentRanks["FTR_01"] != 1 {
		t.Fatal("build snapshot aliases live ranks")
	}
	snapshot.EquipmentLoadouts[0].Hotbar[0] = "mutated"
	if p.EquipmentLoadouts[0].Equipment["mainHand"] != "earned-sword" || p.EquipmentLoadouts[0].Hotbar[0] != "Charge" {
		t.Fatal("save aliases live preset")
	}
	if gameLoadouts(nil) != nil {
		t.Fatal("legacy save invented presets")
	}
}

func TestLoadoutInitialJoinAndResumePublishesSavedBar(t *testing.T) {
	_, _ = setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	c := newLevelCommandClient()
	p := newLevelCommandPlayer(c.playerID)
	p.SubType, p.SelectedBranch = "Fighter", "A"
	p.UnlockedSkills = []string{"Charge", "Whirlwind"}
	p.SavedHotbar = []string{"", "Whirlwind", "", "Charge"}
	world.AddEntity(p)
	for i := 0; i < 2; i++ {
		sendInitialPlayerState(c, p, "")
		found := false
		for _, message := range drainSentMessages(c.send) {
			if message.Type != MsgLoadoutResult {
				continue
			}
			var response loadoutResponse
			if err := json.Unmarshal(message.Payload, &response); err != nil {
				t.Fatal(err)
			}
			if !response.Restored || response.Build.Branch != "A" || !reflect.DeepEqual(response.Hotbar, p.SavedHotbar) {
				t.Fatal("initial snapshot did not restore bar and build")
			}
			found = true
		}
		if !found {
			t.Fatal("join/resume omitted loadout snapshot")
		}
	}
}

func TestLoadoutHandlerAcknowledgesDurabilityAndReportsPendingSave(t *testing.T) {
	_, committer := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	p := &game.Entity{ID: "player-hero", Type: game.TypePlayer, SubType: "Fighter", Level: 30, Z: 200, Health: 10, Mana: 3,
		BaseStats: game.Stats{Vitality: 10, Intelligence: 10}, Equipment: map[string]game.Item{}, Inventory: make([]game.Item, 2)}
	world.AddEntity(p)
	c := &Client{username: "hero", playerID: p.ID, send: make(chan []byte, 10)}
	read := func() loadoutResponse {
		t.Helper()
		for len(c.send) > 0 {
			var msg Message
			if err := json.Unmarshal(<-c.send, &msg); err != nil {
				t.Fatal(err)
			}
			if msg.Type != MsgLoadoutResult {
				continue
			}
			var response loadoutResponse
			if err := json.Unmarshal(msg.Payload, &response); err != nil {
				t.Fatal(err)
			}
			return response
		}
		t.Fatal("no owner loadout response")
		return loadoutResponse{}
	}
	c.handleEquipmentLoadout(Message{Type: MsgSaveLoadout, Payload: json.RawMessage(`{"index":0,"name":"Town","hotbar":["Charge"]}`)})
	if response := read(); !response.Success || committer.saved == nil || len(committer.saved.EquipmentLoadouts) != 3 {
		t.Fatal("save acknowledged without persisted preset")
	}
	committer.fail = errors.New("database unavailable")
	c.handleEquipmentLoadout(Message{Type: MsgApplyLoadout, Payload: json.RawMessage(`{"index":0}`)})
	if response := read(); response.Success || !response.Applied || response.Hotbar[0] != "Charge" {
		t.Fatal("pending save concealed live applied state or claimed durability")
	}
	pending, err := characterSaveJournal.Read(c.username)
	if err != nil || pending == nil {
		t.Fatal("pending loadout not retained for recovery")
	}
	committer.fail = nil
	if err := retryPendingCharacterSaveLocked(c.username); err != nil {
		t.Fatal(err)
	}
	if len(committer.saved.EquipmentLoadouts) != 3 {
		t.Fatal("recovery lost presets")
	}
}
