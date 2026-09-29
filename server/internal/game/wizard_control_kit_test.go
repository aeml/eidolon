package game

import (
	"slices"
	"testing"
	"time"
)

func TestEveryWizardComboBelongsToALearnedBranch(t *testing.T) {
	covered := map[string]bool{}
	for _, combo := range wizardCombos {
		reachable := false
		for _, branch := range []string{"A", "B", "C"} {
			skills := getSkillsForBranch("Wizard", branch)
			if slices.Contains(skills, combo.FirstSkill) && slices.Contains(skills, combo.SecondSkill) {
				reachable, covered[branch] = true, true
			}
		}
		if !reachable {
			t.Fatalf("unlearnable Wizard combo: %+v", combo)
		}
	}
	if len(covered) != 3 {
		t.Fatal("Wizard branch missing a combo", covered)
	}
}

func TestPyromancerTimeBurnUsesItsOwnLearnedKit(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("pyro-sequence", "Wizard")
	p.Level = 40
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "A")
	if result := w.PerformAbility(p.ID, p.X+8, p.Z, "", "Flame Tornado"); !result.Accepted {
		t.Fatal(result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, p.X+8, p.Z, "", "Inferno Cataclysm"); !result.Accepted {
		t.Fatal(result)
	}
	for _, entity := range w.Entities {
		if entity.OwnerID == p.ID && entity.ProjectileSkill == "Inferno Cataclysm" {
			if !entity.ZoneDoubleTick || p.ActiveCombo != "" {
				t.Fatal("learned sequence did not consume its faster-tick payoff")
			}
			return
		}
	}
	t.Fatal("no Cataclysm zone created")
}

func TestControlTimeWarpReprisesOnlyOwnMobilityAndGravity(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("control-reprise", "Wizard")
	p.Level = 40
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "C")
	ally := newTestPlayer("reprise-ally", "Wizard")
	w.AddEntity(ally)
	until := time.Now().Add(time.Minute)
	for _, e := range []*Entity{p, ally} {
		e.Cooldowns["Teleport"], e.Cooldowns["Gravity Well"], e.Cooldowns["Arcane Shield"] = until, until, until
	}
	p.TeleportChargeReadyAt = until
	before := p.Mana
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Time Warp"); !result.Accepted {
		t.Fatal(result)
	}
	if p.Mana != before-50 || !p.Cooldowns["Time Warp"].After(time.Now()) || p.Cooldowns["Arcane Shield"] != until {
		t.Fatal("reprise changed its price or unrelated cooldowns")
	}
	if _, exists := p.Cooldowns["Teleport"]; exists {
		t.Fatal("Teleport still cooling down")
	}
	if _, exists := p.Cooldowns["Gravity Well"]; exists {
		t.Fatal("Gravity Well still cooling down")
	}
	if !p.TeleportChargeReadyAt.IsZero() || ally.Cooldowns["Teleport"] != until || ally.Cooldowns["Gravity Well"] != until {
		t.Fatal("charge refresh or party scope wrong")
	}
	if result := w.PerformAbility(p.ID, p.X+2, p.Z, "", "Teleport"); result.Accepted || result.Reason != "global_cooldown" {
		t.Fatal("reprise bypassed GCD", result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	if result := w.PerformAbility(p.ID, p.X+2, p.Z, "", "Teleport"); !result.Accepted {
		t.Fatal("refreshed Teleport rejected", result)
	}
}

func TestRejectedTimeWarpCannotRefreshControlKit(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("control-rejected", "Wizard")
	p.Level, p.Mana = 40, 0
	w.AddEntity(p)
	w.PerformSelectBranch(p.ID, "C")
	until := time.Now().Add(time.Minute)
	p.Cooldowns["Teleport"], p.Cooldowns["Gravity Well"] = until, until
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Time Warp"); result.Accepted {
		t.Fatal("unaffordable reprise accepted")
	}
	if p.Cooldowns["Teleport"] != until || p.Cooldowns["Gravity Well"] != until {
		t.Fatal("rejected reprise refreshed skills")
	}
}
