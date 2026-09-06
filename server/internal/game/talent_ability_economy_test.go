package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"testing"
	"time"
)

// The same contract is read by Jest. A changed server definition or client
// prediction must fail against it instead of silently diverging at cast time.
func TestTalentEconomyCatalogMatchesSharedContract(t *testing.T) {
	type economy struct {
		Skill              string
		Cdr, ManaReduction float64
	}
	var classes map[string]struct {
		Prefix        string
		TechniqueMana float64
		Skills        []string
		Generic       map[string]economy
	}
	data, err := os.ReadFile("testdata/talent_economy.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &classes); err != nil {
		t.Fatal(err)
	}
	for class, catalog := range classes {
		for n := 1; n <= 40; n++ {
			want := catalog.Generic[strconv.Itoa(n)]
			if n <= 26 && n%2 == 0 {
				want = economy{Skill: catalog.Skills[n/2-1], Cdr: 0.03, ManaReduction: catalog.TechniqueMana}
			}
			id := fmt.Sprintf("%s_%02d", catalog.Prefix, n)
			def, ok := talentDefForID(class, id)
			if !ok {
				t.Fatalf("missing %s", id)
			}
			got := def.PerRank
			if got.SkillCdr != want.Cdr || -got.SkillManaCost != want.ManaReduction ||
				(want.Cdr != 0 || want.ManaReduction != 0) && got.SkillName != want.Skill {
				t.Fatalf("%s economy differs from client/server contract: %+v want %+v", id, got, want)
			}
		}
	}
}

func TestTalentEconomyChangesAuthoritativeCasts(t *testing.T) {
	for _, tc := range []struct {
		class, skill, technique, efficiency string
		mana, reducedMana                   int
		cooldown                            float64
	}{
		{"Fighter", "Charge", "FTR_02", "FTR_28", 20, 17, 5},
		{"Rogue", "Piercing Throw", "ROG_02", "", 15, 15, 1},
		{"Wizard", "Fireball", "WIZ_02", "WIZ_27", 30, 21, 2},
		{"Cleric", "Spirit Guardians", "CLR_02", "CLR_27", 40, 32, 10},
	} {
		t.Run(tc.class, func(t *testing.T) {
			for _, ranked := range []bool{false, true} {
				w := newTestWorld()
				p := newTestPlayer("economy", tc.class)
				p.Level = 100 // sufficient point budget for this prepared rank fixture
				p.CooldownReduction = 0.2
				wantMana, wantCooldown := tc.mana, tc.cooldown*0.8
				if ranked {
					p.TalentRanks[tc.technique] = 5
					if tc.efficiency != "" {
						p.TalentRanks[tc.efficiency] = 5
					}
					wantMana, wantCooldown = tc.reducedMana, wantCooldown*0.85
				}
				// Exactly the lawful cost must be sufficient; no mana cushion.
				p.Mana = wantMana
				w.AddEntity(p)
				result := w.PerformAbility(p.ID, 10, 0, "", tc.skill)
				if !result.Accepted || result.Mana != 0 || math.Abs(result.CooldownRemaining-wantCooldown) > 0.000001 {
					t.Fatalf("ranked=%t result=%+v; want accepted, zero mana and cooldown %.6f", ranked, result, wantCooldown)
				}
				if retry := w.PerformAbility(p.ID, 10, 0, "", tc.skill); retry.Accepted {
					t.Fatal("talent reduction must not bypass cooldown rejection")
				}
			}
		})
	}
}

func TestTalentEconomyDoesNotLeakAcrossSkillsOrClasses(t *testing.T) {
	p := newTestPlayer("economy", "Wizard")
	p.TalentRanks = map[string]int{"WIZ_02": 5, "CLR_27": 5}
	if got := resolveAbilityManaCost(p, "Fireball", 30); got != 27 {
		t.Fatalf("ranked Fireball cost = %d; want 27", got)
	}
	if got := resolveAbilityManaCost(p, "Teleport", 40); got != 40 {
		t.Fatalf("unrelated Teleport cost = %d; want 40", got)
	}
}

func TestTalentEconomyPreservesEquipmentRoundingAndFreeAbilities(t *testing.T) {
	p := newTestPlayer("economy", "Wizard")
	p.ActiveUniqueEffects = []string{"efficient"}
	p.TalentRanks = map[string]int{"WIZ_04": 5}
	if got := resolveAbilityManaCost(p, "Flame Whip", 35); got != 27 {
		t.Fatalf("equipment then talent rounding = %d; want 27", got)
	}
	p.SubType = "Fighter"
	p.TalentRanks = map[string]int{"FTR_28": 5}
	if got := resolveAbilityManaCost(p, "Berserker Edge", 0); got != 0 {
		t.Fatalf("free ability now costs %d", got)
	}
}

func TestTalentEconomyAppliesToTeleportSetChargeRecovery(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("charge-economy", "Wizard")
	p.Level = 100
	p.UnlockedSkills = []string{"Teleport"}
	p.TalentRanks = map[string]int{"WIZ_20": 5, "WIZ_30": 5}
	p.CooldownReduction = 0.2
	p.ActiveSetBonuses = map[string]map[string]int{"fixture": {"teleportCharges": 2}}
	w.AddEntity(p)
	for charge := 1; charge <= 2; charge++ {
		// Advance only the GCD test clock; neither charge nor recovery is granted.
		p.LastAbilityTime = time.Now().Add(-time.Second)
		before := time.Now()
		result := w.PerformAbility(p.ID, float64(charge*10), 0, "", "Teleport")
		wantCooldown := 0.0
		if charge == 2 {
			wantCooldown = 5.76
		}
		if !result.Accepted || math.Abs(result.CooldownRemaining-wantCooldown) > 0.000001 {
			t.Fatalf("charge %d result = %+v; want cooldown %v", charge, result, wantCooldown)
		}
		if p.TeleportCharges != 2-charge || math.Abs(p.TeleportChargeReadyAt.Sub(before).Seconds()-5.76) > 0.1 {
			t.Fatalf("charge %d: remaining=%d recovery=%v; want talent-adjusted 5.76s", charge, p.TeleportCharges, p.TeleportChargeReadyAt.Sub(before))
		}
	}
}
