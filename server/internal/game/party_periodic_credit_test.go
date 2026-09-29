package game

import (
	"testing"
	"time"
)

// Prepared lethal targets check attribution and recipient rules, not combat
// pacing or the ability unlocks needed to apply a status in a normal build.
func TestPartyPeriodicAndSummonKillsShareOwnerCredit(t *testing.T) {
	for _, source := range []string{"seraph", "poison", "bleed"} {
		t.Run(source, func(t *testing.T) {
			w, owner, seraph, target := paidSeraphFixture(t, nil)
			defer w.StopBackground()
			w.InstanceLayouts[owner.InstanceID].DungeonType = "verdant_bastion_catacombs"
			target.Health, target.Level = 1, 30
			members := []*Entity{owner}
			for _, name := range []string{"downed", "offline", "other-run"} {
				p := newTestPlayer("periodic-"+name, "Fighter")
				p.InstanceID, p.X, p.Z = owner.InstanceID, owner.X+1000, owner.Z
				p.Level, p.MaxExperience = 30, experienceRequiredForLevel(30)
				if name == "downed" {
					p.State, p.Health = "DEAD", 0
					p.Experience = p.MaxExperience - 1
				} else if name == "offline" {
					p.Disconnected = true
				} else {
					p.InstanceID = "other-run"
				}
				w.AddEntity(p)
				members = append(members, p)
			}
			party := w.CreateParty(owner.ID)
			for _, p := range members {
				if p != owner {
					if err := w.JoinParty(party.ID, p.ID); err != nil {
						t.Fatal(err)
					}
				}
				p.Quests = []Quest{{ID: "periodic-credit", Type: "KILL", Target: "Skeleton", Accepted: true, MaxCount: 2}}
			}
			now := time.Now()
			if source == "seraph" {
				w.updateEntity(seraph, .05, nil, &deferredActions{})
			} else {
				target.Mu.Lock()
				if source == "poison" {
					target.Poisoned, target.PoisonSourceID, target.PoisonDamage = true, owner.ID, 100
					target.PoisonEndTime = now.Add(time.Minute)
					w.tickPoisonLocked(target, now, &deferredActions{})
					w.tickPoisonLocked(target, now.Add(time.Second), &deferredActions{})
				} else {
					target.Bleeding, target.BleedSourceID, target.BleedDamage = true, owner.ID, 100
					target.BleedEndTime = now.Add(time.Minute)
					w.tickBleedLocked(target, now, &deferredActions{})
					w.tickBleedLocked(target, now.Add(time.Second), &deferredActions{})
				}
				target.Mu.Unlock()
			}
			w.StopBackground()
			if target.State != "DEAD" {
				t.Fatal("prepared target survived")
			}
			if members[1].Level <= 30 || members[1].Health != 0 || members[1].State != "DEAD" {
				t.Fatal("downed ally must gain its level without receiving a resurrection heal")
			}
			for i, p := range members {
				q := questByID(t, p, "periodic-credit")
				if i < 2 {
					if q.Count != 1 || q.Completed || p.Gold <= 0 || p.Experience+p.ResonanceXP <= 0 {
						t.Fatalf("eligible member missing owner-attributed reward: %s", p.ID)
					}
				} else if q.Count != 0 || p.Gold != 0 || p.Experience != 0 || p.ResonanceXP != 0 {
					t.Fatalf("absent member received reward: %s", p.ID)
				}
			}
		})
	}
}
