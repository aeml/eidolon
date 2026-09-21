package game

import (
	"math"
	"reflect"
	"testing"
)

func darkRealmEligiblePlayer(id string) *Entity {
	p := newTestPlayer(id, "Wizard")
	p.Level, p.X, p.Z = 100, 0, 240
	for _, id := range []string{ChronicleEarthRestoredID, ChronicleWaterRestoredID, ChronicleFireRestoredID, ChronicleAirRestoredID} {
		p.Quests = append(p.Quests, Quest{ID: id, Completed: true})
	}
	return p
}

func TestDarkRealmAuthoredCircuit(t *testing.T) {
	layout := DarkRealmLayout()
	if err := ValidateDungeonLayout(layout); err != nil {
		t.Fatal(err)
	}
	if len(layout.Rooms) != 5 || len(layout.Corridors) != 5 {
		t.Fatal("camp, four districts and connected return route required")
	}
	seen := map[string]bool{}
	for _, district := range DarkRealmDistricts() {
		if district.ID == "" || seen[district.ID] || district.Name == "" || district.Description == "" {
			t.Fatal("district lacks a unique authored identity")
		}
		seen[district.ID] = true
	}
	layout.Rooms[0].X = -1
	if DarkRealmLayout().Rooms[0].X == -1 {
		t.Fatal("caller mutated shared geography")
	}
	camp := darkRealmCamp()
	if safeZoneAt([]SafeZone{camp}, DarkRealmInstanceID, 40000, 40800) == "" ||
		safeZoneAt([]SafeZone{camp}, "", 40000, 40800) != "" ||
		safeZoneAt([]SafeZone{camp}, DarkRealmInstanceID, 40000, 40400) != "" {
		t.Fatal("only the expedition camp may be safe")
	}
}

func TestDarkRealmEntryRequiresPersonalLevelAndCompletedRepairs(t *testing.T) {
	p := darkRealmEligiblePlayer("realm-gates")
	if !DarkRealmEntryAllowed(p) || DarkRealmEntryAllowed(nil) {
		t.Fatal("entry eligibility")
	}
	for i := range p.Quests {
		p.Quests[i].Completed, p.Quests[i].Accepted, p.Quests[i].Count = false, true, 1
		if DarkRealmEntryAllowed(p) {
			t.Fatal("an unclaimed repair must not unlock the realm")
		}
		p.Quests[i].Completed = true
	}
	p.Level = 99
	if DarkRealmEntryAllowed(p) {
		t.Fatal("crystal repairs bypassed level100")
	}
	for _, milestone := range []string{ChronicleGateOpenedID, ChronicleDarkKingID} {
		p.Level, p.Quests = 100, []Quest{{ID: milestone, Completed: true}}
		if !DarkRealmEntryAllowed(p) {
			t.Fatal("lost veteran access")
		}
		p.Level = 99
		if DarkRealmEntryAllowed(p) {
			t.Fatal("veteran milestone bypassed level100")
		}
	}
}

func TestDarkRealmMovementAndProjectilesShareFloorsWithoutDungeonLifecycle(t *testing.T) {
	w := newTestWorld()
	if w.isDungeonInstance(DarkRealmInstanceID) {
		t.Fatal("shared realm must not acquire dungeon expiry or room rewards")
	}
	// Shore to Archive is a real road. The diagonal to the Foundry crosses
	// empty space and cannot be used as a movement/attack shortcut.
	if _, _, blocked := w.firstDungeonWallHit(DarkRealmInstanceID, 40000, 40400, 39300, 40400); blocked {
		t.Fatal("authored road blocked")
	}
	if _, _, blocked := w.firstDungeonWallHit(DarkRealmInstanceID, 40000, 40400, 39300, 39700); !blocked {
		t.Fatal("projectile crossed the void between districts")
	}
	p := &Entity{InstanceID: DarkRealmInstanceID, X: 40000, Z: 40400}
	x, z, constrained := w.constrainDungeonMovementDestination(p, 39300, 39700)
	if !constrained || (x == 39300 && z == 39700) {
		t.Fatal("dash skipped a district boundary")
	}
	x, z, constrained = w.constrainPlayerPointToDungeon(DarkRealmInstanceID, 0, 0)
	if !constrained || x == 0 || z == 0 {
		t.Fatal("position remained outside the shared floors")
	}
	rects := w.dungeonWalkRectsSnapshot(DarkRealmInstanceID)
	rects[0].X = -1
	if w.dungeonWalkRectsSnapshot(DarkRealmInstanceID)[0].X == -1 {
		t.Fatal("attack snapshot mutated the shared world")
	}
}

func TestDarkRealmTransitionSharedAndDoesNotGrantProgress(t *testing.T) {
	w := newTestWorld()
	w.AddEntity(&Entity{ID: "dungeon-npc-1", Type: TypeNPC, X: 0, Z: 240})
	for _, id := range []string{"realm-solo", "realm-party-member"} {
		p := darkRealmEligiblePlayer(id)
		p.PartyID = "party-" + id
		w.AddEntity(p)
		quests := append([]Quest(nil), p.Quests...)
		hp, mp, gold, xp := p.Health, p.Mana, p.Gold, p.Experience
		if err := w.EnterDarkRealm(id); err != nil {
			t.Fatal(err)
		}
		if p.InstanceID != DarkRealmInstanceID || p.X != 40000 || p.Z != 40800 || len(w.InstanceLayouts) != 0 {
			t.Fatal("entry must not create a party-owned dungeon")
		}
		if !w.inSafeZone(p) || w.GetInstanceType(p.InstanceID) != DarkRealmInstanceType {
			t.Fatal("camp must use ordinary safe-zone recovery in a shared scene")
		}
		if layout, ok := w.GetInstanceLayout(p.InstanceID); !ok || len(layout.Rooms) != 5 {
			t.Fatal("shared scene missing from reconnect layout lookup")
		}
		if !reflect.DeepEqual(quests, p.Quests) || hp != p.Health || mp != p.Mana || gold != p.Gold || xp != p.Experience {
			t.Fatal("entry changed earned progress/resources")
		}
		p.X += 5
		if err := w.EnterDarkRealm(id); err != nil || p.X != 40005 {
			t.Fatal("duplicate entry moved an existing visitor")
		}
		if err := w.PerformRecall(id); err != nil || p.InstanceID != "" {
			t.Fatal("shared scene cannot return to town", err)
		}
	}
}

func TestDarkRealmRestorePreservesEarnedStateAndEnforcesAccess(t *testing.T) {
	for _, mode := range []string{"eligible", "outside", "nan", "underlevel", "unrepaired", "other-instance"} {
		t.Run(mode, func(t *testing.T) {
			p := darkRealmEligiblePlayer("realm-restore")
			p.InstanceID, p.X, p.Y, p.Z = DarkRealmInstanceID, 39300, 99, 39700
			p.Health, p.Mana, p.Gold, p.Experience = 17, 9, 1234, 56
			switch mode {
			case "outside":
				p.X = 0
			case "nan":
				p.X = math.NaN()
			case "underlevel":
				p.Level = 99
			case "unrepaired":
				p.Quests[0].Completed = false
			case "other-instance":
				p.InstanceID = "dungeon_existing"
			}
			quests := append([]Quest(nil), p.Quests...)
			RestoreDarkRealmPosition(p)
			if !reflect.DeepEqual(quests, p.Quests) || p.Health != 17 || p.Mana != 9 || p.Gold != 1234 || p.Experience != 56 {
				t.Fatal("restore altered earned progress/resources")
			}
			switch mode {
			case "underlevel", "unrepaired":
				if p.InstanceID != "" || p.X != -1.25 || p.Z != 200 {
					t.Fatal("saved location bypassed access gate")
				}
			case "outside", "nan":
				if p.InstanceID != DarkRealmInstanceID || p.X != 40000 || p.Z != 40800 {
					t.Fatal("invalid position did not recover at the foothold")
				}
			case "eligible":
				if p.InstanceID != DarkRealmInstanceID || p.X != 39300 || p.Z != 39700 || p.Y != 0 {
					t.Fatal("valid district position lost")
				}
			case "other-instance":
				if p.InstanceID != "dungeon_existing" || p.Y != 99 {
					t.Fatal("changed private dungeon recovery")
				}
			}
		})
	}
}

func TestDarkRealmWizardRequiresLocalManualConversation(t *testing.T) {
	w := newTestWorld()
	p := darkRealmEligiblePlayer("realm-wizard")
	p.MaxExperience = experienceRequiredForLevel(100)
	p.Quests = nil
	for _, q := range chronicleQuestCatalog() {
		if q.ID == ChronicleGateOpenedID {
			p.Quests = append(p.Quests, q)
			break
		}
		q.Accepted, q.Completed, q.Count = true, true, q.MaxCount
		p.Quests = append(p.Quests, q)
	}
	p.InstanceID, p.X, p.Z = DarkRealmInstanceID, 40040, 40800
	w.AddEntity(p)
	if _, ok := w.PerformAcceptQuest(p.ID, ChronicleGateOpenedID); ok {
		t.Fatal("remote wizard conversation accepted")
	}
	p.X = 40012
	if _, ok := w.PerformAcceptQuest(p.ID, ChronicleGateOpenedID); !ok {
		t.Fatal("expedition wizard cannot offer the current story chapter")
	}
	if _, ok := w.PerformCompleteQuest(p.ID, ChronicleGateOpenedID); ok {
		t.Fatal("unfinished objective rewarded")
	}
	for i := range p.Quests {
		if p.Quests[i].ID == ChronicleGateOpenedID {
			p.Quests[i].Count = 1
		}
	}
	if _, ok := w.PerformCompleteQuest(p.ID, ChronicleGateOpenedID); !ok {
		t.Fatal("local manual turn-in rejected")
	}
	gold, resonance := p.Gold, p.ResonanceXP
	if _, ok := w.PerformCompleteQuest(p.ID, ChronicleGateOpenedID); ok || p.Gold != gold || p.ResonanceXP != resonance {
		t.Fatal("duplicate reward accepted")
	}
	if questByID(t, p, ChronicleDarkKingID).Accepted {
		t.Fatal("next chapter auto-accepted")
	}
	p.InstanceID = ""
	if _, ok := w.PerformAcceptQuest(p.ID, ChronicleDarkKingID); ok {
		t.Fatal("same coordinates in another scene bypassed proximity")
	}
}

func TestDarkRealmRejectsRemoteDeadBusyAndOtherInstances(t *testing.T) {
	for name, change := range map[string]func(*Entity){
		"remote":       func(p *Entity) { p.X = 100 },
		"nan":          func(p *Entity) { p.X = math.NaN() },
		"dead":         func(p *Entity) { p.Health, p.State = 0, "DEAD" },
		"dungeon":      func(p *Entity) { p.InstanceID = "dungeon_earned" },
		"stunned":      func(p *Entity) { p.Stunned = true },
		"jumping":      func(p *Entity) { p.State = "JUMPING" },
		"disconnected": func(p *Entity) { p.Disconnected = true },
	} {
		t.Run(name, func(t *testing.T) {
			w := newTestWorld()
			w.AddEntity(&Entity{ID: "dungeon-npc-1", Type: TypeNPC, Z: 240})
			p := darkRealmEligiblePlayer(name)
			change(p)
			w.AddEntity(p)
			instance := p.InstanceID
			if w.EnterDarkRealm(p.ID) == nil || p.InstanceID != instance {
				t.Fatal("invalid transition accepted")
			}
		})
	}
}
