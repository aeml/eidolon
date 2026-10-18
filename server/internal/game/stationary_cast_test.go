package game

import (
	"testing"
	"time"
)

func TestRecallCastRequiresDeadlineAndCannotReplay(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("cast-owner", "Fighter")
	p.X, p.Z, p.Health, p.Mana = 300, 200, 80, 7
	w.AddEntity(p)
	id, err := w.BeginStationaryCast(p.ID, "recall", "fresh", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := w.CompleteRecallCast(p.ID, id, "fresh"); err == nil || p.X != 300 || p.MovementContext != "" {
		t.Fatal("early cast teleported", err)
	}
	if _, err := w.BeginStationaryCast(p.ID, "recall", "different", time.Now()); err == nil {
		t.Fatal("duplicate action replaced active cast")
	}
	w.CancelStationaryCast(p.ID, id)
	id, err = w.BeginStationaryCast(p.ID, "recall", "fresh", time.Now().Add(-StationaryCastDuration))
	if err != nil {
		t.Fatal(err)
	}
	if err := w.CompleteRecallCast(p.ID, id, "wrong"); err == nil {
		t.Fatal("changed destination context accepted")
	}
	if err := w.CompleteRecallCast(p.ID, id, "fresh"); err != nil {
		t.Fatal(err)
	}
	if p.X != -1.25 || p.Z != 200 || p.Health != 80 || p.Mana != 7 || p.MovementContext != "fresh" {
		t.Fatal("recall changed resources or failed arrival")
	}
	if err := w.CompleteRecallCast(p.ID, id, "fresh"); err == nil {
		t.Fatal("completed token replayed")
	}
}

func TestStationaryCastInvalidation(t *testing.T) {
	for _, name := range []string{"walk away and return", "moving intent", "jump", "dead", "health zero", "disconnected", "instance", "charge", "stun", "vertical displacement"} {
		t.Run(name, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("cast-owner", "Fighter")
			p.X, p.Z = 300, 200
			w.AddEntity(p)
			id, err := w.BeginStationaryCast(p.ID, "recall", "fresh", time.Now().Add(-StationaryCastDuration))
			if err != nil {
				t.Fatal(err)
			}
			switch name {
			case "walk away and return":
				w.UpdatePlayerMovement(p.ID, 301, 0, 200, 0, "MOVING", 1)
				w.UpdatePlayerMovement(p.ID, 300, 0, 200, 0, "IDLE", 2)
			case "moving intent":
				w.UpdatePlayerMovement(p.ID, 300, 0, 200, 0, "MOVING", 1)
			case "jump":
				if !w.StartPlayerJump(p.ID, 310, 0, 200) {
					t.Fatal("fixture jump rejected")
				}
			case "dead":
				p.State = "DEAD"
			case "health zero":
				p.Health = 0
			case "disconnected":
				p.Disconnected = true
			case "instance":
				p.InstanceID = "another-scene"
			case "charge":
				p.IsCharging = true
			case "stun":
				p.Stunned = true
			case "vertical displacement":
				p.Y++
			}
			if w.StationaryCastActive(p.ID, id) {
				t.Fatal("invalid cast remained active")
			}
			if err := w.CompleteRecallCast(p.ID, id, "fresh"); err == nil {
				t.Fatal("cancelled cast teleported")
			}
		})
	}
}

func TestStationaryIdlePacketsDoNotCancelCast(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("cast-owner", "Cleric")
	p.X, p.Z = 300, 200
	w.AddEntity(p)
	id, err := w.BeginStationaryCast(p.ID, "recall", "fresh", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !w.UpdatePlayerMovement(p.ID, 300, 0, 200, 1, "IDLE", 1) || !w.StationaryCastActive(p.ID, id) {
		t.Fatal("idle rotation packet cancelled cast")
	}
	w.CancelStationaryCast(p.ID, id+1)
	if !w.StationaryCastActive(p.ID, id) {
		t.Fatal("stale callback cancelled newer owner")
	}
}

func TestOldCastCleanupCannotCancelReplacementCharacter(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("replaced-owner", "Fighter")
	w.AddEntity(p)
	old, err := w.BeginStationaryCast(p.ID, "recall", "old", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	replacement := newTestPlayer(p.ID, "Fighter")
	w.AddEntity(replacement)
	current, err := w.BeginStationaryCast(p.ID, "recall", "current", time.Now())
	if err != nil || current == old {
		t.Fatal("replacement reused the retired cast's ownership", err)
	}
	w.CancelStationaryCast(p.ID, old)
	if !w.StationaryCastActive(p.ID, current) {
		t.Fatal("old connection cleanup cancelled its replacement's cast")
	}
}

func TestChronicleCastDoesNotRecordUntilFinished(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("cast-owner", "Wizard")
	chapter := ChronicleInvestigationCatalog()[0]
	site := chapter.Sites[0]
	p.X, p.Z = site.X, site.Z
	p.Quests = []Quest{{ID: chapter.ID, Type: "INVESTIGATE", Accepted: true, MaxCount: 1}}
	w.AddEntity(p)
	w.AddEntity(&Entity{ID: site.EntityID, Type: TypeNPC, SubType: "ChronicleSite", X: site.X, Z: site.Z})
	if err := w.ValidateChronicleInspection(p.ID, site.EntityID); err != nil || p.Quests[0].Count != 0 {
		t.Fatal("validation granted evidence", err)
	}
	id, err := w.BeginStationaryCast(p.ID, "chronicle_inspect", site.EntityID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.CompleteChronicleInspectionCast(p.ID, site.EntityID, id); err == nil || p.Quests[0].Count != 0 {
		t.Fatal("early inspection granted credit")
	}
	w.CancelStationaryCast(p.ID, id)
	id, err = w.BeginStationaryCast(p.ID, "chronicle_inspect", site.EntityID, time.Now().Add(-StationaryCastDuration))
	if err != nil {
		t.Fatal(err)
	}
	receipt, err := w.CompleteChronicleInspectionCast(p.ID, site.EntityID, id)
	if err != nil || !receipt.Recorded || p.Quests[0].Count != 1 || p.Quests[0].Completed {
		t.Fatal("finished cast failed or paid a quest", err)
	}
	if _, err := w.CompleteChronicleInspectionCast(p.ID, site.EntityID, id); err == nil {
		t.Fatal("inspection cast replayed")
	}
}

func TestQuestObjectPickupCastReservesNothingBeforeCompletion(t *testing.T) {
	w, _, p, _ := groundItemFixture(t)
	item := Item{ID: "chronicle-item-cast", Name: "Cast evidence", Stack: 1, MaxStack: 20, Type: "MATERIAL", Slot: "material", Rarity: RarityUncommon}
	loot := &Entity{ID: "quest-cast-object", Type: TypeLoot, X: p.X, Z: p.Z, InstanceID: p.InstanceID, LootItem: &item, LootTime: time.Now()}
	w.AddEntity(loot)
	if err := w.ValidateQuestObjectPickup(p.ID, loot.ID); err != nil {
		t.Fatal(err)
	}
	if loot.GroundItemReservation != "" || p.Inventory[0].ID != "" {
		t.Fatal("validation reserved or granted quest object")
	}
	id, err := w.BeginStationaryCast(p.ID, "quest_pickup", loot.ID, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.CompleteQuestObjectPickupCast(p.ID, loot.ID, id); err == nil || loot.GroundItemReservation != "" {
		t.Fatal("early pickup reserved quest object")
	}
	w.CancelStationaryCast(p.ID, id)
	id, err = w.BeginStationaryCast(p.ID, "quest_pickup", loot.ID, time.Now().Add(-StationaryCastDuration))
	if err != nil {
		t.Fatal(err)
	}
	op, err := w.CompleteQuestObjectPickupCast(p.ID, loot.ID, id)
	if err != nil || op.ID == "" || loot.GroundItemReservation != op.ID || p.Inventory[0].ID != "" {
		t.Fatal("completed cast bypassed existing durable pickup reservation", err)
	}
	if _, err := w.CompleteQuestObjectPickupCast(p.ID, loot.ID, id); err == nil {
		t.Fatal("pickup token replayed")
	}
}
