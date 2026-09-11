package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestSpiritTrainedAreaSnapshotAndRealTicks(t *testing.T) {
	for _, skill := range []string{"Spirit Guardians", "Spirit Guardians Boost"} {
		for _, runeID := range []string{"", "spirits_expanded", "spirits_vengeful", "spirits_sanctuary"} {
			for _, rank := range []int{0, 1, 5} {
				t.Run(fmt.Sprintf("%s/%s/rank%d", skill, runeID, rank), func(t *testing.T) {
					w := newTestWorld()
					p := newTestPlayer("spirit-caster", "Cleric")
					p.InstanceID, p.X, p.Y, p.Z = "qa-spirit-area", 60000, 40, 60000
					p.Level, p.Stats.Wisdom = 100, 10
					p.TalentRanks, p.UnlockedSkills = map[string]int{"CLR_34": rank}, []string{skill}
					p.SkillRunes = map[string]string{"Spirit Guardians": runeID}
					w.AddEntity(p)
					radius := 16.0
					if skill == "Spirit Guardians Boost" {
						radius = 20
					}
					if runeID == "spirits_expanded" {
						radius *= 1.5
					}
					radius *= 1 + .03*float64(rank)
					for _, scale := range []float64{1, 4} {
						for _, outside := range []bool{false, true} {
							id := fmt.Sprintf("target-%v-%v", scale, outside)
							e := newTestPlayer(id, "Wizard")
							e.Type, e.InstanceID, e.X, e.Z, e.Scale = TypeEnemy, p.InstanceID, p.X+radius+1.25*scale-.01, p.Z, scale
							if outside {
								e.X += .02
							}
							w.AddEntity(e)
						}
					}
					var accepted *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							accepted = &event
						}
					}
					if !w.PerformAbility(p.ID, p.X+100, p.Z+100, "", skill).Accepted {
						t.Fatal("cast rejected")
					}
					if accepted == nil || math.Abs(accepted.Radius-radius) > 1e-8 || accepted.Arc != 2*math.Pi || accepted.TargetX != p.X || accepted.TargetZ != p.Z {
						t.Errorf("wrong accepted shape: %+v", accepted)
					}
					for _, snapshot := range []*Entity{w.GetEntityCopy(p.ID), w.copyEntity(p)} {
						if !snapshot.SpiritsActive || snapshot.SpiritsBoosted != (skill == "Spirit Guardians Boost") || snapshot.SpiritGuardiansRuneID != runeID {
							t.Error("copy dropped active variant")
						}
					}
					// Active area and rune are cast snapshots, not current build inference.
					p.TalentRanks, p.SkillRunes = nil, nil
					w.updateEntity(p, 0, nil, &deferredActions{})
					for _, scale := range []float64{1, 4} {
						for _, outside := range []bool{false, true} {
							e := w.GetEntity(fmt.Sprintf("target-%v-%v", scale, outside))
							if (e.Health < 500) == outside {
								t.Errorf("scale=%v outside=%v hp=%d", scale, outside, e.Health)
							}
						}
					}
					inside := w.GetEntity("target-1-false")
					hp := inside.Health
					oldX, oldZ := p.X, p.Z
					p.X -= 100
					w.Grid.Update(p, oldX, oldZ)
					p.LastSpiritTick = time.Now().Add(-time.Second)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if inside.Health != hp {
						t.Error("old cast center kept damaging after movement")
					}
					p.SpiritEndTime = time.Now().Add(-time.Second)
					w.updateEntity(p, 0, nil, &deferredActions{})
					if p.SpiritsActive || inside.Health != hp {
						t.Error("expired spirits remained active")
					}
				})
			}
		}
	}
}

func TestSpiritTrainedAreaRetainsSetHealingAndHostileProtection(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("spirit-healer", "Cleric")
	p.InstanceID, p.Level, p.Stats.Wisdom = "qa-spirit-heal", 100, 10
	p.TalentRanks, p.UnlockedSkills = map[string]int{"CLR_34": 5}, []string{"Spirit Guardians"}
	p.ActiveSetBonuses = map[string]map[string]int{"healing-set": {"spiritGuardiansHeal": 1}}
	w.AddEntity(p)
	for _, id := range []string{"ally", "opponent", "protected-opponent", "dead", "elsewhere"} {
		e := newTestPlayer(id, "Wizard")
		e.InstanceID, e.X, e.Health = p.InstanceID, 18.85, 100
		if id == "dead" {
			e.State = "DEAD"
		}
		if id == "elsewhere" {
			e.InstanceID = "qa-spirit-elsewhere"
		}
		if id == "protected-opponent" {
			e.InvulnerableEndTime = time.Now().Add(time.Minute)
		}
		w.AddEntity(e)
	}
	w.PvP.Matches["spirit-pvp"] = &PvPMatch{ID: "spirit-pvp", Status: PvPMatchActive, TeamA: []string{p.ID}, TeamB: []string{"opponent", "protected-opponent"}}
	w.PvP.MatchByPlayer[p.ID], w.PvP.MatchByPlayer["opponent"] = "spirit-pvp", "spirit-pvp"
	w.PvP.MatchByPlayer["protected-opponent"] = "spirit-pvp"
	if !w.PerformAbility(p.ID, 0, 0, "", "Spirit Guardians").Accepted {
		t.Fatal("cast rejected")
	}
	w.updateEntity(p, 0, nil, &deferredActions{})
	if w.GetEntity("ally").Health != 110 {
		t.Error("trained annulus lost set healing")
	}
	// A valid opponent takes the ordinary20-point pulse scaled to13 in PvP,
	// and must not also receive the ally-only set heal. Invulnerability, death
	// and other instances still protect their respective negative controls.
	if got := w.GetEntity("opponent").Health; got != 87 {
		t.Errorf("opponent damage/healing = %d HP, want87", got)
	}
	for _, id := range []string{"protected-opponent", "dead", "elsewhere"} {
		if w.GetEntity(id).Health != 100 {
			t.Errorf("changed protected %s", id)
		}
	}
}

func TestSpiritTrainedTicksRetainWallsAndComboVariant(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		w, p, target := directSkillWallFixture("Cleric", doorway)
		p.Stats.Wisdom = 10
		p.TalentRanks, p.UnlockedSkills = map[string]int{"CLR_34": 5}, []string{"Heaven's Trumpet", "Spirit Guardians"}
		if !w.PerformAbility(p.ID, p.X, p.Z, "", "Heaven's Trumpet").Accepted {
			t.Fatal("combo opener rejected")
		}
		p.LastAbilityTime = time.Now().Add(-time.Second)
		if !w.PerformAbility(p.ID, p.X, p.Z, "", "Spirit Guardians").Accepted {
			t.Fatal("combo closer rejected")
		}
		if !p.SpiritsBoosted || math.Abs(p.SpiritAreaRadius()-23) > 1e-8 {
			t.Fatal("combo radius ignored boosted state")
		}
		hp := target.Health
		w.updateEntity(p, 0, nil, &deferredActions{})
		if (target.Health < hp) != doorway {
			t.Errorf("doorway=%v periodic damage crossed cover", doorway)
		}
	}
}
