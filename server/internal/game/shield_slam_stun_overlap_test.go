package game

import (
	"fmt"
	"testing"
	"time"
)

func TestPaidShieldSlamPreservesSeismicStunAndRespectsImmunity(t *testing.T) {
	for _, immune := range []bool{false, true} {
		t.Run(fmt.Sprintf("immune%v", immune), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{"Earthshaker", "Shield Slam"}
			p.BaseStats = InitialPlayerStats()
			p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
			p.SkillRunes = map[string]string{"Earthshaker": "earthshaker_seismic"}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			target.CCImmune = immune
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Earthshaker"); !result.Accepted {
				t.Fatal("paid Seismic opener rejected")
			}
			initial := target.StunEndTime
			if !immune && time.Until(initial) < 5*time.Second {
				t.Fatal("trained Seismic stun missing")
			}
			p.LastAbilityTime = time.Now().Add(-time.Second)
			health, mana := target.Health, p.Mana
			if result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam"); !result.Accepted || p.Mana >= mana || target.Health >= health {
				t.Fatal("paid Shield Slam damage missing")
			}
			if !target.StunEndTime.Equal(initial) || (immune && target.Stunned) {
				t.Fatal("Shield Slam shortened Seismic stun or bypassed immunity")
			}
		})
	}
}
