package game

import (
	"fmt"
	"testing"
	"time"
)

// Prepared role-appropriate Uncommon/Rare gear, actual earned-level branch
// unlocks and one mana bar. This is an admission/resource check, NOT a timed
// combat simulation, earned progression, or a proof of subjective game feel.
func TestAllLearnedClassKitsAtProgressionBreakpoints(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, branch := range []string{"A", "B", "C"} {
			for _, level := range []int{10, 20, 30, 40, 100} {
				t.Run(fmt.Sprintf("%s/%s/%d", class, branch, level), func(t *testing.T) {
					w := newTestWorld()
					t.Cleanup(w.StopBackground)
					p := preparedRoleBudgetPlayer(t, w, class, level)
					if _, ok := w.PerformSelectBranch(p.ID, branch); !ok {
						t.Fatal("normal branch selection rejected")
					}
					wantCount := min(5, level/10+1)
					if len(p.UnlockedSkills) != wantCount {
						t.Fatalf("wrong learned kit: %v", p.UnlockedSkills)
					}
					enemy := &Entity{ID: "kit-budget-enemy", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE",
						X: 60000, Z: 60002, Health: 1000000, MaxHealth: 1000000, BaseStats: Stats{Vitality: 100000}, CCImmune: true}
					w.AddEntity(enemy)
					startMana, totalCost := p.Mana, 0
					for _, skill := range p.UnlockedSkills {
						// Settle movement and then prepare the next close-range aim;
						// only the GCD is advanced between distinct paid actions.
						for step := 0; step < 10 && p.IsCharging; step++ {
							w.updateEntity(p, .05, nil, &deferredActions{})
						}
						oldX, oldZ := p.X, p.Z
						p.X, p.Z = 60000, 60000
						w.Grid.Update(p, oldX, oldZ)
						p.LastAbilityTime = time.Now().Add(-time.Second)
						target := enemy
						if skill == "Healing Light" || skill == "Divine Intervention" {
							target = p
						}
						mana := p.Mana
						cost := resolveAbilityManaCost(p, skill, -1)
						result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill)
						if !result.Accepted || cost < 0 || p.Mana != mana-cost || result.CooldownRemaining <= 0 {
							t.Fatalf("learned %s failed at ordinary health: %+v; mana %d -> %d", skill, result, mana, p.Mana)
						}
						totalCost += mana - p.Mana
					}
					t.Logf("kit=%v HP=%d MP=%d paidCost=%d remaining=%d armor=%d basic=%d/%.2fs",
						p.UnlockedSkills, p.MaxHealth, startMana, totalCost, p.Mana, p.Defense, p.Damage, p.AttackSpeed)
				})
			}
		}
	}
}
