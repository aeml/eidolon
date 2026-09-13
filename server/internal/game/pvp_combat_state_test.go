package game

import (
	"testing"
	"time"
)

func TestArenaRoundsClearCombatEffectsAndRestoreOriginalCooldownDeadlines(t *testing.T) {
	a := &Entity{ID: "a", Type: TypePlayer, Level: 1, BaseStats: Stats{Vitality: 10, Wisdom: 10, Intelligence: 10}, Health: 23, Mana: 7,
		WellRestedSeconds: 60, Gold: 19}
	a.RecalculateStats()
	b := &Entity{ID: "b", Type: TypePlayer}
	w := newPvPTestWorld(a, b)
	deadline := time.Now().Add(time.Minute)
	a.Cooldowns = map[string]time.Time{"Fireball": deadline}
	a.LastAbilityTime = deadline.Add(-time.Minute)
	match := startTestPvPMatch(w, PvPModeArena1v1, []string{a.ID}, []string{b.ID})
	if len(a.Cooldowns) != 0 || !a.LastAbilityTime.IsZero() {
		t.Fatal("entry did not reset arena cooldowns")
	}
	a.Slowed, a.Poisoned, a.SpiritsActive, a.HealingLightHoTActive = true, true, true, true
	a.SlowFactor, a.PoisonDamage, a.HealingLightHoTTicksRemaining = .5, 25, 5
	a.ArcaneShieldActive, a.ArcaneShieldHP, a.CCImmune = true, 100, true
	a.ActiveCombo, a.ActiveComboEndTime = "old combo", deadline
	a.Cooldowns = map[string]time.Time{"Fireball": deadline.Add(time.Hour)}
	projectile := &Entity{ID: "old-projectile", Type: TypeProjectile, InstanceID: match.ID}
	other := &Entity{ID: "unrelated-projectile", Type: TypeProjectile, InstanceID: "other-dungeon"}
	w.Entities[projectile.ID], w.Entities[other.ID] = projectile, other
	w.Grid.Add(projectile)
	w.Grid.Add(other)
	w.PvP.Matches[match.ID].RoundPending = true
	w.resetPvPRound(match.ID, 1)
	if a.Slowed || a.Poisoned || a.SpiritsActive || a.HealingLightHoTActive || a.ArcaneShieldActive || a.CCImmune || a.ActiveCombo != "" || len(a.Cooldowns) != 0 || a.Health != a.MaxHealth {
		t.Fatal("old combat state leaked into next round")
	}
	if w.Entities[projectile.ID] != nil || w.Entities[other.ID] == nil {
		t.Fatal("ephemera cleanup escaped the exact match")
	}
	a.Cooldowns = map[string]time.Time{"Fireball": deadline.Add(time.Hour)}
	w.ForfeitPvP(a.ID)
	if !a.Cooldowns["Fireball"].Equal(deadline) || !a.LastAbilityTime.Equal(deadline.Add(-time.Minute)) || a.Health != 23 || a.Mana != 7 || a.PvPReturn != nil {
		t.Fatal("exit lost original deadlines/resources")
	}
	if a.WellRestedSeconds != 60 || a.Gold != 19 {
		t.Fatal("combat cleanup changed persistent resources")
	}
}
