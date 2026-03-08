package game

import "testing"

func TestGenerateRandomGemByLevelSetsIcon(t *testing.T) {
	gem := GenerateRandomGemByLevel(1, false)
	if gem == nil {
		t.Fatal("expected gem to be generated")
	}
	if gem.Icon == "" {
		t.Fatal("expected generated gem to have an icon path")
	}
	if gem.Icon[:18] != "assets/icons/gems/" {
		t.Fatalf("unexpected icon path %q", gem.Icon)
	}
}

func TestRecalculateStatsAppliesSocketedGemBonuses(t *testing.T) {
	e := &Entity{
		Type:    TypePlayer,
		SubType: "Wizard",
		Level:   1,
		BaseStats: Stats{
			Strength:     10,
			Dexterity:    10,
			Intelligence: 10,
			Wisdom:       10,
			Vitality:     10,
		},
		Equipment: map[string]Item{
			"mainHand": {
				Stats: map[string]int{"damage": 10},
				Gems: []SocketedGem{
					{Type: GemRuby, Quality: GemFlawed, Stats: GemStats(GemRuby, GemFlawed)},
					{Type: GemSapphire, Quality: GemFlawed, Stats: GemStats(GemSapphire, GemFlawed)},
					{Type: GemEmerald, Quality: GemFlawed, Stats: GemStats(GemEmerald, GemFlawed)},
					{Type: GemTopaz, Quality: GemFlawed, Stats: GemStats(GemTopaz, GemFlawed)},
					{Type: GemDiamond, Quality: GemFlawed, Stats: GemStats(GemDiamond, GemFlawed)},
					{Type: GemOnyx, Quality: GemFlawed, Stats: GemStats(GemOnyx, GemFlawed)},
					{Type: GemOpal, Quality: GemFlawed, Stats: GemStats(GemOpal, GemFlawed)},
				},
			},
		},
	}

	e.RecalculateStats()

	if e.FireDamageBonus <= 0 {
		t.Fatalf("expected fire damage bonus, got %f", e.FireDamageBonus)
	}
	if e.CritChanceBonus <= 0 {
		t.Fatalf("expected crit chance bonus, got %f", e.CritChanceBonus)
	}
	if e.HealingDoneBonus <= 0 {
		t.Fatalf("expected healing done bonus, got %f", e.HealingDoneBonus)
	}
	if e.LifestealBonus <= 0 {
		t.Fatalf("expected lifesteal bonus, got %f", e.LifestealBonus)
	}
	if e.AllResistBonus <= 0 {
		t.Fatalf("expected all resist bonus, got %f", e.AllResistBonus)
	}
	if e.CooldownReduction <= 0.1 {
		t.Fatalf("expected cdr bonus to increase cooldown reduction, got %f", e.CooldownReduction)
	}
	if e.ManaRegen <= 5.0 {
		t.Fatalf("expected mana regen bonus, got %f", e.ManaRegen)
	}
	if e.Speed <= 9.6 {
		t.Fatalf("expected move speed bonus, got %f", e.Speed)
	}
}
