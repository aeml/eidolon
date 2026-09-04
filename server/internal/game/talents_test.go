package game

import (
	"fmt"
	"testing"
)

func TestTalentDefinitionsCoverEveryClassSlot(t *testing.T) {
	tests := []struct {
		class  string
		prefix string
	}{
		{class: "Fighter", prefix: "FTR_"},
		{class: "Rogue", prefix: "ROG_"},
		{class: "Wizard", prefix: "WIZ_"},
		{class: "Cleric", prefix: "CLR_"},
	}

	for _, tt := range tests {
		t.Run(tt.class, func(t *testing.T) {
			for slot := 1; slot <= 40; slot++ {
				id := fmt.Sprintf("%s%02d", tt.prefix, slot)
				def, ok := talentDefForID(tt.class, id)
				if !ok || def.MaxRank != 5 {
					t.Fatalf("talent %s resolved to %+v, %t", id, def, ok)
				}
			}
		})
	}
}

func TestTalentIDsNormalizeAndRejectCrossClassData(t *testing.T) {
	canonical, ok := CanonicalizeTalentID("Cleric", "CLR_1")
	if !ok || canonical != "CLR_01" {
		t.Fatalf("canonical id = %q, %t; want CLR_01", canonical, ok)
	}
	if _, ok := CanonicalizeTalentID("Cleric", "WIZ_01"); ok {
		t.Fatal("accepted a cross-class talent")
	}
	if rank, ok := NormalizeTalentRank("Fighter", "FTR_01", 99); !ok || rank != 5 {
		t.Fatalf("normalized rank = %d, %t; want 5, true", rank, ok)
	}
	if _, ok := NormalizeTalentRank("Fighter", "FTR_01", 0); ok {
		t.Fatal("accepted zero talent rank")
	}
}

func TestNormalizeTalentRanksMergesLegacyIDsAtHighestRank(t *testing.T) {
	entity := &Entity{
		SubType: "Cleric",
		TalentRanks: map[string]int{
			"CLR_1":  2,
			"CLR_01": 4,
			"WIZ_01": 5,
			"CLR_99": 5,
		},
	}

	entity.NormalizeTalentRanks()
	if len(entity.TalentRanks) != 1 || entity.TalentRanks["CLR_01"] != 4 {
		t.Fatalf("normalized talent ranks = %+v", entity.TalentRanks)
	}
}

func TestGetSkillBonusSeparatesSkillSpecificTalents(t *testing.T) {
	entity := &Entity{
		SubType: "Wizard",
		TalentRanks: map[string]int{
			"WIZ_01": 2,
			"WIZ_02": 3,
			"WIZ_28": 1,
		},
	}

	fireball := entity.GetSkillBonus("Fireball")
	if fireball.SkillDamage != 0.08 || fireball.SkillCdr != 0.09 || fireball.SkillManaCost != -0.06 || fireball.AddCdr != 0.015 {
		t.Fatalf("unexpected Fireball talent bonus: %+v", fireball)
	}
	meteor := entity.GetSkillBonus("Meteor Drop")
	if meteor.SkillDamage != 0 || meteor.SkillCdr != 0 || meteor.AddCdr != 0.015 {
		t.Fatalf("unexpected Meteor Drop talent bonus: %+v", meteor)
	}
}

func TestTalentPointBudgetStartsAtLevelFiveAndSubtractsRanks(t *testing.T) {
	entity := &Entity{SubType: "Fighter", Level: 4, TalentRanks: map[string]int{}}
	if got := entity.maxTalentPoints(); got != 0 {
		t.Fatalf("level 4 max talent points = %d, want 0", got)
	}
	entity.Level = 25
	entity.TalentRanks = map[string]int{"FTR_01": 2, "FTR_02": 1}
	entity.recomputeTalentPoints()
	if entity.TalentPoints != 2 {
		t.Fatalf("available talent points = %d, want 2", entity.TalentPoints)
	}
}
