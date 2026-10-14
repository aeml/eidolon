package game

import (
	"fmt"
	"testing"
	"time"
)

func focusRuneFixture(t *testing.T, runeID string, rank int) (*World, *Entity, func(string) AbilityResult) {
	t.Helper()
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	p := newTestPlayer("focus-rune", "Wizard")
	p.Level, p.Mana, p.Stats.Intelligence = 100, 10000, 0
	p.SelectedBranch = "B"
	p.UnlockedSkills = getSkillsForBranch("Wizard", "B")
	p.SkillRunes = map[string]string{"Spell Focus": runeID}
	p.TalentRanks = map[string]int{"WIZ_15": rank}
	w.AddEntity(p)
	return w, p, func(skill string) AbilityResult {
		p.LastAbilityTime = time.Now().Add(-time.Second)
		return w.PerformAbility(p.ID, p.X+10, p.Z, "", skill)
	}
}

func requireFocusCast(t *testing.T, cast func(string) AbilityResult, skill string) {
	t.Helper()
	if result := cast(skill); !result.Accepted {
		t.Fatalf("%s rejected: %+v", skill, result)
	}
}

func TestFocusReservoirSplitsStoredBonusAcrossTwoPaidCasts(t *testing.T) {
	for _, rank := range []int{0, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p, cast := focusRuneFixture(t, spellFocusReservoir, rank)
			requireFocusCast(t, cast, "Spell Focus")
			want := 1.75 + .05*float64(rank)
			if p.ActiveSpellFocusCharges() != 2 || p.ActiveSpellFocusMultiplier() != want || p.Mana != 9970 {
				t.Fatalf("paid reserve: charges%d multiplier%g mana%d", p.ActiveSpellFocusCharges(), p.ActiveSpellFocusMultiplier(), p.Mana)
			}
			// Selected rune/training can change later; the paid cast remains fixed.
			p.SkillRunes["Spell Focus"] = spellFocusOverchannel
			p.TalentRanks = nil
			for index := 0; index < 3; index++ {
				delete(p.Cooldowns, "Fireball")
				previous := make(map[string]bool)
				for id := range w.Entities {
					previous[id] = true
				}
				requireFocusCast(t, cast, "Fireball")
				wantDamage := 20
				if index < 2 {
					wantDamage = int(20 * want)
				}
				count := 0
				for id, e := range w.Entities {
					if !previous[id] && e.OwnerID == p.ID && e.ProjectileSkill == "Fireball" {
						count++
						if e.Damage != wantDamage {
							t.Fatalf("cast%d damage%d want%d", index, e.Damage, wantDamage)
						}
					}
				}
				if count != 1 {
					t.Fatalf("cast%d projectiles%d", index, count)
				}
				if index == 0 {
					copy := w.GetEntityCopy(p.ID)
					if !copy.SpellFocusActive || copy.ActiveSpellFocusCharges() != 1 || copy.ActiveSpellFocusMultiplier() != want {
						t.Fatal("remaining paid charge lost in detached snapshot")
					}
				}
			}
			if p.SpellFocusActive || p.SpellFocusCharges != 0 || p.SpellFocusRuneID != "" || p.SpellFocusMultiplier != 0 {
				t.Fatal("spent reservoir survived third paid spell")
			}
		})
	}
}

func TestFocusReservoirConsumesOneChargeForAnEntireMissileVolley(t *testing.T) {
	w, p, cast := focusRuneFixture(t, spellFocusReservoir, 0)
	requireFocusCast(t, cast, "Spell Focus")
	requireFocusCast(t, cast, "Arcane Missiles")
	count := 0
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.ProjectileSkill == "Arcane Missiles" {
			count++
			if e.Damage != 26 {
				t.Fatalf("missile damage%d want26", e.Damage)
			}
		}
	}
	if count != 3 || !p.SpellFocusActive || p.ActiveSpellFocusCharges() != 1 {
		t.Fatalf("volley%d remaining%d", count, p.ActiveSpellFocusCharges())
	}
	requireFocusCast(t, cast, "Dragonfire Lance")
	if p.SpellFocusActive {
		t.Fatal("lance did not consume the second charge")
	}
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.ProjectileSkill == "Dragonfire Lance" && e.Damage != 175 {
			t.Fatalf("lance damage%d want175", e.Damage)
		}
	}
}

func TestFocusReservoirRejectedCastKeepsBothChargesAndExpiry(t *testing.T) {
	_, p, cast := focusRuneFixture(t, spellFocusReservoir, 0)
	requireFocusCast(t, cast, "Spell Focus")
	end := p.SpellFocusEndTime
	p.Mana = 0
	if result := cast("Fireball"); result.Accepted || p.ActiveSpellFocusCharges() != 2 || p.SpellFocusEndTime != end {
		t.Fatal("unaffordable spell consumed reserve")
	}
	if result := cast("Spell Focus"); result.Accepted || p.ActiveSpellFocusCharges() != 2 || p.SpellFocusEndTime != end {
		t.Fatal("rejected recast changed reserve")
	}
}

func TestFocusRuneTradesWardForBurstWithoutReplacingExistingProtection(t *testing.T) {
	for _, test := range []struct {
		runeID     string
		multiplier float64
		ward       int
	}{{spellFocusAegis, 1.9, 80}, {spellFocusOverchannel, 2.875, 0}} {
		t.Run(test.runeID, func(t *testing.T) {
			_, p, cast := focusRuneFixture(t, test.runeID, 0)
			requireFocusCast(t, cast, "Spell Focus")
			if p.ActiveSpellFocusMultiplier() != test.multiplier || p.ArcaneShieldHP != test.ward || p.ArcaneShieldActive != (test.ward > 0) {
				t.Fatalf("multiplier%g ward%d active%v", p.ActiveSpellFocusMultiplier(), p.ArcaneShieldHP, p.ArcaneShieldActive)
			}
			p.ArcaneShieldActive, p.ArcaneShieldHP = true, 333
			p.ArcaneShieldEndTime = time.Now().Add(20 * time.Second)
			end := p.ArcaneShieldEndTime
			delete(p.Cooldowns, "Spell Focus")
			requireFocusCast(t, cast, "Spell Focus")
			if p.ArcaneShieldHP != 333 || p.ArcaneShieldEndTime != end {
				t.Fatal("rune replaced or refreshed existing protection")
			}
		})
	}
}

func TestFocusReservoirClearsOnExpiryAndPvPRoundReset(t *testing.T) {
	w, p, cast := focusRuneFixture(t, spellFocusReservoir, 0)
	requireFocusCast(t, cast, "Spell Focus")
	p.SpellFocusEndTime = time.Now().Add(-time.Second)
	w.Update(.1)
	if p.SpellFocusActive || p.SpellFocusCharges != 0 || p.SpellFocusRuneID != "" {
		t.Fatal("expired reserve remained")
	}
	delete(p.Cooldowns, "Spell Focus")
	requireFocusCast(t, cast, "Spell Focus")
	clearPvPCombatStateLocked(p)
	if p.SpellFocusActive || p.SpellFocusCharges != 0 || p.SpellFocusRuneID != "" {
		t.Fatal("reserve crossed a PvP round boundary")
	}
}
