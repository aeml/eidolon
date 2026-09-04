package game

import (
	"testing"
	"time"
)

func TestGetComboForSkillsResolvesEachClassCatalog(t *testing.T) {
	tests := []struct {
		class       string
		firstSkill  string
		secondSkill string
		wantID      string
	}{
		{class: "Fighter", firstSkill: "Charge", secondSkill: "Whirlwind", wantID: "momentum_strike"},
		{class: "Rogue", firstSkill: "Cloak & Vanish", secondSkill: "Backstab", wantID: "ambush"},
		{class: "Wizard", firstSkill: "Gravity Well", secondSkill: "Fireball", wantID: "implosion"},
		{class: "Cleric", firstSkill: "Divine Intervention", secondSkill: "Healing Light", wantID: "mass_revival"},
	}

	for _, tt := range tests {
		t.Run(tt.class, func(t *testing.T) {
			combo := GetComboForSkills(tt.class, tt.firstSkill, tt.secondSkill)
			if combo == nil {
				t.Fatalf("expected %s combo", tt.wantID)
			}
			if combo.ID != tt.wantID || combo.Class != tt.class {
				t.Fatalf("got combo %+v, want id=%q class=%q", combo, tt.wantID, tt.class)
			}
		})
	}
}

func TestGetComboForSkillsRequiresOrderedKnownPair(t *testing.T) {
	tests := []struct {
		name        string
		class       string
		firstSkill  string
		secondSkill string
	}{
		{name: "unknown class", class: "Bard", firstSkill: "Charge", secondSkill: "Whirlwind"},
		{name: "reversed pair", class: "Fighter", firstSkill: "Whirlwind", secondSkill: "Charge"},
		{name: "mixed pair", class: "Wizard", firstSkill: "Gravity Well", secondSkill: "Backstab"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if combo := GetComboForSkills(tt.class, tt.firstSkill, tt.secondSkill); combo != nil {
				t.Fatalf("unexpected combo: %+v", combo)
			}
		})
	}
}

func TestComboWindowRemainsThreeSeconds(t *testing.T) {
	if ComboWindow != 3*time.Second {
		t.Fatalf("got combo window %s, want 3s", ComboWindow)
	}
}
