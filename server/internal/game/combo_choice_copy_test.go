package game

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestComboChoiceDescriptionsMatchSharedContract(t *testing.T) {
	data, err := os.ReadFile("testdata/combo_choice_copy.json")
	if err != nil {
		t.Fatal(err)
	}
	var choices []struct{ ClassName, ID, First, Second, Description string }
	if err := json.Unmarshal(data, &choices); err != nil {
		t.Fatal(err)
	}
	for _, entry := range choices {
		combo := GetComboForSkills(entry.ClassName, entry.First, entry.Second)
		if combo == nil || combo.ID != entry.ID || combo.Description != entry.Description {
			t.Fatalf("combo copy differs: %+v want %+v", combo, entry)
		}
	}
}

func TestShadowDanceRearmsTrapWithoutBypassingAdmissionCooldowns(t *testing.T) {
	w, p, _ := directSkillWallFixture("Rogue", true)
	defer w.StopBackground()
	p.Level = 40
	w.PerformSelectBranch(p.ID, "C")
	p.Cooldowns["Tripwire"] = time.Now().Add(time.Minute)
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Cloak & Vanish"); !result.Accepted {
		t.Fatal("real combo opener failed", result)
	}
	mana := p.Mana
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Smoke Bomb"); result.Accepted || result.Reason != "global_cooldown" || p.Mana != mana {
		t.Fatal("combo incorrectly bypassed GCD", result)
	}
	// Advance only the fixture's GCD clock; normal dispatch still detects the
	// earned sequence. Existing skill cooldown must not be reset by the combo.
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Smoke Bomb"] = time.Now().Add(time.Second)
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Smoke Bomb"); result.Accepted || result.Reason != "cooldown" || p.Mana != mana {
		t.Fatal("combo incorrectly bypassed an existing skill cooldown", result)
	}
	p.Cooldowns["Smoke Bomb"] = time.Now().Add(-time.Millisecond)
	result := w.PerformAbility(p.ID, p.X, p.Z, "", "Smoke Bomb")
	if !result.Accepted || p.Mana != mana-35 || result.CooldownRemaining <= 0 || p.ActiveCombo != "" {
		t.Fatalf("combo should pay ordinary cost/cooldown and consume once: %+v mana=%d", result, p.Mana)
	}
	if !p.Cooldowns["Tripwire"].IsZero() {
		t.Fatal("combo did not rearm Tripwire")
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Smoke Bomb"] = time.Time{}
	until := time.Now().Add(time.Minute)
	p.Cooldowns["Tripwire"] = until
	mana = p.Mana
	result = w.PerformAbility(p.ID, p.X, p.Z, "", "Smoke Bomb")
	if !result.Accepted || p.Mana != mana-35 || result.CooldownRemaining <= 0 || p.Cooldowns["Tripwire"] != until {
		t.Fatal("next ordinary cast retained a consumed combo", result)
	}
}
