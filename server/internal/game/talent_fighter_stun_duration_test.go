package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestTalentFighterShieldSlamStunDuration(t *testing.T) {
	for _, runeID := range []string{"", "shieldslam_concussion", "shieldslam_reverberation", "shieldslam_fortify"} {
		for rank := 0; rank <= 5; rank++ {
			for _, talent := range []string{"FTR_30", "FTR_37", "composed", "FTR_5"} {
				t.Run(fmt.Sprintf("%s/%s/rank%d", runeID, talent, rank), func(t *testing.T) {
					w := newTestWorld()
					defer w.StopBackground()
					p := newTestPlayer("duration-caster", "Fighter")
					p.Level, p.InstanceID, p.X, p.Z = 100, "qa-fighter-stun", 60000, 60000
					p.BaseStats = InitialPlayerStats()
					p.UnlockedSkills = []string{"Shield Slam"}
					p.TalentRanks = map[string]int{talent: rank}
					bonus := 0.0
					switch talent {
					case "FTR_30":
						bonus = .04 * float64(rank)
					case "FTR_37":
						bonus = .03 * float64(rank)
					case "composed":
						p.TalentRanks = map[string]int{"FTR_30": rank, "FTR_37": rank}
						bonus = .07 * float64(rank)
					}
					p.SkillRunes = map[string]string{"Shield Slam": runeID}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					w.AddEntity(p)
					target := &Entity{ID: "duration-enemy", Type: TypeEnemy, InstanceID: p.InstanceID,
						State: "IDLE", Health: 10000, MaxHealth: 10000, Scale: 1, X: p.X + 2, Z: p.Z}
					w.AddEntity(target)
					base := 1500 * time.Millisecond
					if runeID == "shieldslam_concussion" {
						base += time.Second
					}
					want := time.Duration(math.Round(float64(base) * (1 + bonus)))
					mana, start := p.Mana, time.Now()
					result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Shield Slam")
					end := time.Now()
					if !result.Accepted || p.Mana != mana-25 || !target.Stunned || target.Health >= target.MaxHealth {
						t.Fatalf("paid damaging stun failed: accepted=%v mana=%d stunned=%v hp=%d", result.Accepted, p.Mana, target.Stunned, target.Health)
					}
					if target.StunEndTime.Before(start.Add(want)) || target.StunEndTime.After(end.Add(want)) {
						t.Fatalf("duration=%v..%v want=%v", target.StunEndTime.Sub(end), target.StunEndTime.Sub(start), want)
					}
					if math.Abs(result.CooldownRemaining-6*(1-p.CooldownReduction)) > 1e-8 {
						t.Fatalf("stun training altered cooldown: %v", result.CooldownRemaining)
					}
					deadline := target.StunEndTime
					p.TalentRanks = nil
					p.RecalculateStats()
					if target.StunEndTime != deadline {
						t.Fatal("existing target timer must be a cast snapshot")
					}
				})
			}
		}
	}
}
