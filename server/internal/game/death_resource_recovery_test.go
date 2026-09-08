package game

import (
	"testing"
	"time"
)

func TestDeathRecoveryRestoresManaWithoutResettingTrainingOrCooldowns(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, state := range []string{"DEAD", "IDLE"} {
			t.Run(class+"/"+state, func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("dead-caster", class)
				p.Health, p.Mana, p.State = 0, 7, state
				if state == "DEAD" {
					p.Health = 1 // A lagging bar must not override the authoritative death state.
				}
				p.hpRegenRemainder, p.manaRegenRemainder = .75, .9
				p.HpRegen, p.ManaRegen = .1, .2
				p.Gold, p.SkillPoints = 1234, 2
				lastCast := time.Now()
				p.LastAbilityTime, p.AbilityCooldown = lastCast, 10*time.Second
				p.Cooldowns["trained ability"] = lastCast
				w.AddEntity(p)
				if err := w.PerformRespawn(p.ID); err != nil {
					t.Fatal(err)
				}
				if p.Health != p.MaxHealth || p.Mana != p.MaxMana || p.State != "IDLE" || p.InstanceID != "" ||
					p.hpRegenRemainder != 0 || p.manaRegenRemainder != 0 {
					t.Fatal("death did not recover both resources cleanly in town")
				}
				if p.HpRegen != .1 || p.ManaRegen != .2 || p.Gold != 1234 || p.SkillPoints != 2 ||
					p.LastAbilityTime != lastCast || p.AbilityCooldown != 10*time.Second || p.Cooldowns["trained ability"] != lastCast {
					t.Fatal("death recovery changed passive rates, assets or ability cooldowns")
				}
				// A repeated or living unstuck request cannot refill spent mana.
				p.Mana, p.manaRegenRemainder = 11, .25
				if err := w.PerformRespawn(p.ID); err != nil {
					t.Fatal(err)
				}
				if p.Mana != 11 || p.manaRegenRemainder != .25 {
					t.Fatal("living unstuck refilled mana")
				}
			})
		}
	}
}

func TestRecallAndRejectedRecoveryDoNotRefillMana(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("living-caster", "Wizard")
	p.Mana = 7
	w.AddEntity(p)
	if err := w.PerformRecall(p.ID); err != nil || p.Mana != 7 {
		t.Fatalf("recall refilled mana or failed: %v", err)
	}
	p.State, p.Health, p.MovementContext = "DEAD", 0, "same-context"
	if err := w.PerformRespawn(p.ID, "same-context"); err == nil || p.Mana != 7 || p.Health != 0 {
		t.Fatal("rejected respawn changed resources")
	}
}

func TestPvPDeathCannotUseTownManaRecovery(t *testing.T) {
	a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
	w := newPvPTestWorld(a, b)
	startTestPvPMatch(w, PvPModeArena1v1, []string{a.ID}, []string{b.ID})
	a.State, a.Health, a.Mana, a.MaxMana = "DEAD", 0, 7, 200
	if err := w.PerformRespawn(a.ID); err == nil || a.Mana != 7 || a.Health != 0 {
		t.Fatal("arena death bypassed match recovery to refill resources")
	}
}
