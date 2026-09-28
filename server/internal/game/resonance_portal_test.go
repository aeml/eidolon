package game

import (
	"math"
	"reflect"
	"testing"
)

func TestResonancePortalRegistrySpawn(t *testing.T) {
	w := newTestWorld()
	w.spawnResonancePortal()
	w.spawnDungeonNPC()
	w.spawnQuestNPC()
	w.spawnDarkRealmCamp()
	for _, id := range []string{"resonance-portal", "dungeon-guide", "story-wizard", "story-wizard-dark-realm"} {
		location := worldLocation(id)
		entity := w.Entities[location.EntityID]
		if entity == nil || entity.Type != TypeNPC || entity.X != location.X || entity.Z != location.Z || entity.InstanceID != location.InstanceID {
			t.Fatalf("registry/spawn mismatch: %s", id)
		}
	}
}

func TestResonancePortalEntryPersonalGateAndRange(t *testing.T) {
	for _, mode := range []string{"eligible", "edge", "distant", "missing", "wrong-type", "wrong-instance", "nan-portal", "nan-player", "level99", "unclaimed", "dead", "stunned", "veteran"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			w.spawnResonancePortal()
			location := worldLocation("resonance-portal")
			p := darkRealmEligiblePlayer("portal-traveler")
			p.X, p.Z, p.PartyID = location.X, location.Z+2, "portal-party"
			other := newTestPlayer("ineligible-party-member", "Fighter")
			other.X, other.Z, other.PartyID = p.X, p.Z, p.PartyID
			w.AddEntity(p)
			w.AddEntity(other)
			switch mode {
			case "edge":
				p.Z = location.Z + 10
			case "distant":
				p.Z = location.Z + 10.01
			case "missing":
				delete(w.Entities, location.EntityID)
			case "wrong-type":
				w.Entities[location.EntityID].Type = TypeEnemy
			case "wrong-instance":
				w.Entities[location.EntityID].InstanceID = "other"
			case "nan-portal":
				w.Entities[location.EntityID].X = math.NaN()
			case "nan-player":
				p.X = math.NaN()
			case "level99":
				p.Level = 99
			case "unclaimed":
				p.Quests[0].Completed = false
				p.Quests[0].Accepted = true
				p.Quests[0].Count = 1
			case "dead":
				p.Health = 0
			case "stunned":
				p.Stunned = true
			case "veteran":
				p.Quests = []Quest{{ID: ChronicleGateOpenedID, Accepted: true}}
			}
			quests := append([]Quest(nil), p.Quests...)
			err := w.EnterDarkRealm(p.ID)
			allowed := mode == "eligible" || mode == "edge" || mode == "veteran"
			if (err == nil) != allowed || (p.InstanceID == DarkRealmInstanceID) != allowed {
				t.Fatalf("entry mismatch: %v", err)
			}
			if !reflect.DeepEqual(quests, p.Quests) || other.InstanceID != "" {
				t.Fatal("portal changed progress or carried party member")
			}
			if allowed {
				RestoreDarkRealmPosition(p)
				if p.InstanceID != DarkRealmInstanceID {
					t.Fatal("reconnect lost eligible expedition")
				}
				if err := w.PerformRecall(p.ID); err != nil || p.InstanceID != "" {
					t.Fatalf("return failed: %v", err)
				}
			}
		})
	}
}
