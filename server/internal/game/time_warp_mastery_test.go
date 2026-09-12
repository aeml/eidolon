package game

import (
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"
)

func TestTimeWarpMasteryExtendsPaidCasterAndRecipientDuration(t *testing.T) {
	for _, tc := range []struct {
		rank, general int
		duration      float64
	}{
		{0, 0, 8}, {1, 0, 8.32}, {5, 0, 9.6}, {99, 0, 9.6}, {-1, 0, 8}, {5, 5, 11.2},
	} {
		t.Run(fmt.Sprintf("rank%d/general%d", tc.rank, tc.general), func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p, ally := newTestPlayer("warp-mastery", "Wizard"), newTestPlayer("warp-recipient", "Fighter")
			p.Level, p.UnlockedSkills = 100, []string{"Time Warp"}
			p.TalentRanks = map[string]int{"WIZ_25": tc.rank, "WIZ_34": tc.general}
			ally.TalentRanks = map[string]int{"WIZ_25": 5, "WIZ_34": 5}
			for _, actor := range []*Entity{p, ally} {
				actor.InstanceID, actor.X, actor.Z = "warp-mastery", 60000, 60000
				if actor == ally {
					actor.X += 3
				}
				w.AddEntity(actor)
				actor.RecalculateStats()
			}
			mana, cdr, speed, allyCdr := p.Mana, p.CooldownReduction, ally.Speed, ally.CooldownReduction
			start := time.Now()
			result := w.PerformAbility(p.ID, p.X, p.Z, "", "Time Warp")
			if !result.Accepted || p.Mana != mana-50 {
				t.Fatalf("paid cast failed: %+v, mana %d -> %d", result, mana, p.Mana)
			}
			if got := p.Cooldowns["Time Warp"].Sub(start).Seconds(); math.Abs(got-60*(1-cdr)) > .1 {
				t.Fatalf("Mastery changed cooldown: %.3f", got)
			}
			for _, actor := range []*Entity{p, ally} {
				if got := actor.TimeWarpEndTime.Sub(start).Seconds(); !actor.TimeWarpActive || math.Abs(got-tc.duration) > .1 {
					t.Errorf("%s duration %.3f active %v, want %.3f", actor.ID, got, actor.TimeWarpActive, tc.duration)
				}
			}
			if math.Abs(ally.Speed-speed*1.5) > 1e-8 || math.Abs(ally.CooldownReduction-math.Min(.8, allyCdr+.2)) > 1e-8 {
				t.Fatal("duration Mastery changed haste strength")
			}
			deadline := ally.TimeWarpEndTime
			p.TalentRanks = nil
			ally.RecalculateStats()
			if !ally.TimeWarpEndTime.Equal(deadline) {
				t.Fatal("rank changes rewrote the stored deadline")
			}
			ally.TimeWarpEndTime = time.Now().Add(-time.Millisecond)
			w.updateEntity(ally, 0, nil, &deferredActions{})
			if ally.TimeWarpActive || math.Abs(ally.Speed-speed) > 1e-8 || math.Abs(ally.CooldownReduction-allyCdr) > 1e-8 {
				t.Fatal("actual expiry did not restore recipient stats")
			}
		})
	}
}

func TestTimeWarpMasteryIsDurationOnlyAndDoesNotExtendOtherWizardBuffs(t *testing.T) {
	p := newTestPlayer("warp-mastery-scope", "Wizard")
	p.TalentRanks = map[string]int{"WIZ_25": 5}
	bonus := p.GetSkillBonus("Time Warp")
	if math.Abs(bonus.SkillDuration-.2) > 1e-8 || bonus.SkillDamage != 0 {
		t.Fatalf("Mastery must expose duration, not phantom damage: %+v", bonus)
	}
	for _, skill := range []string{"Spell Focus", "Arcane Shield", "Teleport", "Scorch Beam"} {
		if bonus := p.GetSkillBonus(skill); bonus.SkillDuration != 0 || bonus.SkillDamage != 0 {
			t.Fatalf("Time Warp Mastery leaked into %s: %+v", skill, bonus)
		}
	}
}

func TestSkillBonusClampsEveryTalentToItsDefinedMaximum(t *testing.T) {
	for _, class := range []struct{ name, prefix string }{{"Wizard", "WIZ"}, {"Fighter", "FTR"}, {"Cleric", "CLR"}, {"Rogue", "ROG"}} {
		for n := 1; n <= 40; n++ {
			id := fmt.Sprintf("%s_%02d", class.prefix, n)
			def, ok := talentDefForID(class.name, id)
			if !ok {
				t.Fatalf("missing definition for %s", id)
			}
			p := &Entity{SubType: class.name, TalentRanks: map[string]int{id: def.MaxRank}}
			want := p.GetSkillBonus(def.PerRank.SkillName)
			p.TalentRanks[id] = 99
			if got := p.GetSkillBonus(def.PerRank.SkillName); !reflect.DeepEqual(got, want) {
				t.Errorf("%s exceeds its defined maximum: %+v, want %+v", id, got, want)
			}
			if p.TalentRanks[id] != 99 {
				t.Fatal("read-only bonus calculation mutated saved ranks")
			}
			p.TalentRanks[id] = -1
			if got := p.GetSkillBonus(def.PerRank.SkillName); !reflect.DeepEqual(got, TalentBonus{}) {
				t.Errorf("negative rank applied for %s: %+v", id, got)
			}
		}
	}
}
