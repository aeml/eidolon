package game

import (
	"fmt"
	"testing"
	"time"
)

func TestSpellFocusMasteryStoresTrainingForOnePaidSpell(t *testing.T) {
	for _, rank := range []int{0, 1, 5, 99, -1} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("focus-mastery", "Wizard")
			p.Level, p.Stats.Intelligence, p.Mana = 100, 0, 1000
			p.UnlockedSkills = []string{"Spell Focus", "Teleport", "Fireball"}
			p.TalentRanks = map[string]int{"WIZ_15": rank}
			w.AddEntity(p)
			cast := func(skill string) {
				p.LastAbilityTime = time.Now().Add(-time.Second)
				if result := w.PerformAbility(p.ID, p.X+10, p.Z, "", skill); !result.Accepted {
					t.Fatalf("%s rejected: %+v", skill, result)
				}
			}
			cast("Spell Focus")
			p.TalentRanks = map[string]int{"WIZ_15": 5}
			if rank > 0 {
				p.TalentRanks = nil
			}
			cast("Teleport")
			if !p.SpellFocusActive {
				t.Fatal("utility consumed charge")
			}
			p.Mana = 0
			p.LastAbilityTime = time.Now().Add(-time.Second)
			if result := w.PerformAbility(p.ID, 20, 0, "", "Fireball"); result.Accepted || !p.SpellFocusActive {
				t.Fatal("unaffordable spell consumed charge")
			}
			p.Mana = 1000
			cast("Fireball")
			want := 50 + 2*max(0, min(5, rank))
			if p.SpellFocusActive {
				t.Fatal("damage did not consume charge")
			}
			var projectile *Entity
			for _, entity := range w.Entities {
				if entity.OwnerID == p.ID && entity.ProjectileSkill == "Fireball" {
					projectile = entity
				}
			}
			if projectile == nil {
				t.Fatal("missing focused projectile")
			}
			if projectile.Damage != want {
				t.Fatalf("focused damage%d want%d", projectile.Damage, want)
			}
			delete(p.Cooldowns, "Fireball")
			cast("Fireball")
			count := 0
			for _, entity := range w.Entities {
				if entity != projectile && entity.OwnerID == p.ID && entity.ProjectileSkill == "Fireball" {
					count++
					if entity.Damage != 20 {
						t.Fatalf("charge applied twice: %d", entity.Damage)
					}
				}
			}
			if count != 1 {
				t.Fatalf("missing second paid projectile: %d", count)
			}
		})
	}
}

func TestSpellFocusMasteryComposesWithNextSkillAndRune(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("focus-composition", "Wizard")
	p.Level, p.Stats.Intelligence, p.Mana = 100, 0, 1000
	p.UnlockedSkills = []string{"Spell Focus", "Fireball"}
	p.TalentRanks = map[string]int{"WIZ_15": 5, "WIZ_01": 5}
	p.SkillRunes = map[string]string{"Fireball": "fireball_empowered"}
	w.AddEntity(p)
	if result := w.PerformAbility(p.ID, 10, 0, "", "Spell Focus"); !result.Accepted {
		t.Fatalf("Focus: %+v", result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, 10, 0, "", "Fireball"); !result.Accepted {
		t.Fatalf("Fireball: %+v", result)
	}
	for _, entity := range w.Entities {
		if entity.OwnerID == p.ID && entity.ProjectileSkill == "Fireball" {
			// Base20 * Fireball Mastery1.2 * stored Focus3 * empowered rune2.
			if entity.Damage != 144 {
				t.Fatalf("wrong composed damage: %d", entity.Damage)
			}
			if p.SpellFocusMultiplier != 0 {
				t.Fatal("consumed stored strength was retained")
			}
			return
		}
	}
	t.Fatal("missing actual empowered projectile")
}

func TestSpellFocusStoredMasteryExpiresOnWorldTick(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("focus-expiry", "Wizard")
	p.Level, p.Mana = 100, 1000
	p.UnlockedSkills = []string{"Spell Focus"}
	p.TalentRanks = map[string]int{"WIZ_15": 5}
	w.AddEntity(p)
	if result := w.PerformAbility(p.ID, 0, 0, "", "Spell Focus"); !result.Accepted {
		t.Fatalf("Focus: %+v", result)
	}
	p.SpellFocusEndTime = time.Now().Add(-time.Second)
	w.Update(.01)
	if p.SpellFocusActive || p.SpellFocusMultiplier != 0 || p.ActiveSpellFocusMultiplier() != 1 {
		t.Fatal("expired strength survived actual world tick")
	}
}
