package game

import (
	"math"
	"testing"
)

// This is a prepared level-100 functional fixture budget, not evidence that an
// ungeared level-30 character can clear a dungeon. Read the real emitted spell
// and charged mana so the browser preparation cannot rely on an invented buff.
func TestWizardPreparedDungeonFireballEconomy(t *testing.T) {
	for _, tc := range []struct {
		name     string
		rank     int
		rune     string
		damage   int
		cooldown float64
	}{
		{"untrained", 0, "", 258, 1},
		{"mastery_and_empowered", 5, "fireball_empowered", 618, 2.5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("prepared-wizard", "Wizard")
			w.AddEntity(p)
			if _, ok := w.SetPlayerLevel(p.ID, 100); !ok {
				t.Fatal("level fixture failed")
			}
			p.TalentRanks["WIZ_01"] = tc.rank
			p.recomputeTalentPoints()
			p.SkillRunes = map[string]string{"Fireball": tc.rune}
			p.RecalculateStats()
			mana := p.Mana
			result := w.PerformAbility(p.ID, 10, 0, "", "Fireball")
			if !result.Accepted || p.Mana != mana-30 {
				t.Fatalf("Fireball must consume ordinary 30 mana: %+v, before=%d after=%d", result, mana, p.Mana)
			}
			if math.Abs(result.CooldownRemaining-tc.cooldown) > 1e-9 {
				t.Fatalf("rune must retain its cooldown tradeoff: %+v", result)
			}
			if p.TalentPoints != 20-tc.rank || p.Damage != 29 || math.Abs(p.ManaRegen-1.09) > 1e-9 ||
				math.Abs(p.HpRegen-2.08) > 1e-9 {
				t.Fatalf("training changed unrelated stats: points=%d damage=%d hpRegen=%f manaRegen=%f",
					p.TalentPoints, p.Damage, p.HpRegen, p.ManaRegen)
			}
			projectiles := 0
			for _, entity := range w.Entities {
				if entity.OwnerID != p.ID || entity.ProjectileSkill != "Fireball" {
					continue
				}
				projectiles++
				if entity.Damage != tc.damage {
					t.Fatalf("actual projectile damage=%d, expected=%d", entity.Damage, tc.damage)
				}
			}
			if projectiles != 1 {
				t.Fatalf("expected one actual Fireball, got %d", projectiles)
			}
			t.Logf("mana=%d full-bar casts=%d raw projectile damage=%d full-bar raw damage=%d basic damage=%d basic interval=%s empty-to-one-cast=%.2fs",
				mana, mana/30, tc.damage, mana/30*tc.damage, p.Damage, p.AttackCooldown, 30/p.ManaRegen)
		})
	}
}
