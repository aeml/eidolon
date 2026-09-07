package game

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"testing"
	"time"
)

func TestTalentDurationDefinitions(t *testing.T) {
	data, err := os.ReadFile("testdata/talent_duration.json")
	if err != nil {
		t.Fatal(err)
	}
	var entries []struct {
		ID, Skill string
		PerRank   float64
	}
	if err := json.Unmarshal(data, &entries); err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatal("expected two Wizard duration entries")
	}
	for _, entry := range entries {
		def, ok := talentDefForID("Wizard", entry.ID)
		if !ok || def.MaxRank != 5 || def.PerRank.SkillName != entry.Skill || def.PerRank.SkillDuration != entry.PerRank {
			t.Fatalf("duration contract drift for %s: %+v", entry.ID, def)
		}
	}
}

func TestTalentDurationWizardBuffCasts(t *testing.T) {
	for _, tc := range []struct {
		skill string
		base  float64
		end   func(*Entity) time.Time
	}{
		{"Spell Focus", 15, func(p *Entity) time.Time { return p.SpellFocusEndTime }},
		{"Arcane Shield", 20, func(p *Entity) time.Time { return p.ArcaneShieldEndTime }},
		{"Time Warp", 8, func(p *Entity) time.Time { return p.TimeWarpEndTime }},
	} {
		for _, rank := range []int{0, 5} {
			t.Run(fmt.Sprintf("%s/rank%d", tc.skill, rank), func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("duration", "Wizard")
				p.Level, p.UnlockedSkills = 100, []string{tc.skill}
				p.TalentRanks["WIZ_34"] = rank
				w.AddEntity(p)
				start := time.Now()
				result := w.PerformAbility(p.ID, 0, 0, "", tc.skill)
				want := tc.base * (1 + .04*float64(rank))
				if got := tc.end(p).Sub(start).Seconds(); !result.Accepted || math.Abs(got-want) > .1 {
					t.Fatalf("accepted=%t duration=%.3f; want %.3f", result.Accepted, got, want)
				}
			})
		}
	}
}

func TestTalentDurationArcaneShieldCompositionAndExpiry(t *testing.T) {
	for _, tc := range []struct {
		name  string
		ranks map[string]int
		rune  string
		want  float64
	}{
		{"baseline", nil, "", 20},
		{"stability", map[string]int{"WIZ_32": 5}, "", 25},
		{"extended", map[string]int{"WIZ_32": 5}, "arcaneshield_extended", 37.5},
		{"additive ranks after rune", map[string]int{"WIZ_32": 5, "WIZ_34": 5}, "arcaneshield_extended", 43.5},
		{"unrelated and wrong class", map[string]int{"WIZ_22": 5, "CLR_30": 5}, "", 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("duration-shield", "Wizard")
			p.Level, p.UnlockedSkills = 100, []string{"Arcane Shield"}
			p.TalentRanks = tc.ranks
			p.SkillRunes = map[string]string{"Arcane Shield": tc.rune}
			w.AddEntity(p)
			start := time.Now()
			result := w.PerformAbility(p.ID, 0, 0, "", "Arcane Shield")
			if got := p.ArcaneShieldEndTime.Sub(start).Seconds(); !result.Accepted || math.Abs(got-tc.want) > .1 {
				t.Fatalf("accepted=%t duration=%.3f want %.3f", result.Accepted, got, tc.want)
			}
			if p.ArcaneShieldHP != 100+5*p.Stats.Intelligence {
				t.Fatal("duration ranks must not change absorb capacity")
			}
			// Move only the test clock relative to the actual cast deadline. Ranks
			// are removed mid-buff to prove duration is snapshotted, not re-applied.
			p.TalentRanks = nil
			p.ArcaneShieldEndTime = p.ArcaneShieldEndTime.Add(-time.Duration((tc.want - 1) * float64(time.Second)))
			w.updateEntity(p, 0, nil, &deferredActions{})
			if !p.ArcaneShieldActive || p.ArcaneShieldHP <= 0 {
				t.Fatal("shield expired before its ranked deadline")
			}
			p.ArcaneShieldEndTime = p.ArcaneShieldEndTime.Add(-2 * time.Second)
			w.updateEntity(p, 0, nil, &deferredActions{})
			if p.ArcaneShieldActive || p.ArcaneShieldHP != 0 {
				t.Fatal("shield survived its deadline")
			}
		})
	}
}

func TestTalentDurationTimeWarpUsesCasterSnapshotForAllies(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("duration-caster", "Wizard")
	p.Level, p.UnlockedSkills = 100, []string{"Time Warp"}
	p.TalentRanks["WIZ_34"] = 5
	ally := newTestPlayer("duration-ally", "Wizard")
	ally.X = 3
	ally.TalentRanks["WIZ_34"] = 0
	w.AddEntity(p)
	w.AddEntity(ally)
	start := time.Now()
	result := w.PerformAbility(p.ID, 0, 0, "", "Time Warp")
	if !result.Accepted || !ally.TimeWarpActive || !ally.TimeWarpEndTime.Equal(p.TimeWarpEndTime) ||
		math.Abs(ally.TimeWarpEndTime.Sub(start).Seconds()-9.6) > .1 {
		t.Fatalf("result=%+v caster=%v ally=%v", result, p.TimeWarpEndTime, ally.TimeWarpEndTime)
	}
	if result.CooldownRemaining != 60 {
		t.Fatal("duration must not change Time Warp's own cooldown")
	}
}

func TestTalentDurationWizardTargetStatuses(t *testing.T) {
	for _, tc := range []struct {
		skill, rune string
		base        float64
		end         func(*Entity) time.Time
	}{
		{"Gravity Well", "gravitywell_blackhole", 2, func(e *Entity) time.Time { return e.RootEndTime }},
		{"Gravity Well", "", 3, func(e *Entity) time.Time { return e.SlowEndTime }},
		{"Flame Whip", "", 3, func(e *Entity) time.Time { return e.StunEndTime }},
		{"Scorch Beam", "", 5, func(e *Entity) time.Time { return e.ArmorReductionEndTime }},
	} {
		for _, rank := range []int{0, 5} {
			t.Run(fmt.Sprintf("%s/%s/rank%d", tc.skill, tc.rune, rank), func(t *testing.T) {
				w := newTestWorld()
				p := newTestPlayer("duration-attacker", "Wizard")
				p.Level, p.UnlockedSkills = 100, []string{tc.skill}
				p.TalentRanks["WIZ_34"] = rank
				p.SkillRunes = map[string]string{tc.skill: tc.rune}
				e := &Entity{ID: "duration-enemy", Type: TypeEnemy, SubType: "Skeleton", X: 5,
					Health: 10000, MaxHealth: 10000, State: "IDLE", Radius: 1.25}
				w.AddEntity(p)
				w.AddEntity(e)
				start := time.Now()
				result := w.PerformAbility(p.ID, 5, 0, e.ID, tc.skill)
				want := tc.base * (1 + .04*float64(rank))
				if got := tc.end(e).Sub(start).Seconds(); !result.Accepted || math.Abs(got-want) > .1 {
					t.Fatalf("accepted=%t duration=%.3f want %.3f", result.Accepted, got, want)
				}
			})
		}
	}
}

func TestTalentDurationTeleportPhase(t *testing.T) {
	for _, rank := range []int{0, 5} {
		w := newTestWorld()
		p := newTestPlayer("duration-phase", "Wizard")
		p.Level, p.UnlockedSkills = 100, []string{"Teleport"}
		p.TalentRanks["WIZ_34"] = rank
		p.SkillRunes = map[string]string{"Teleport": "teleport_phase"}
		w.AddEntity(p)
		start := time.Now()
		result := w.PerformAbility(p.ID, 5, 0, "", "Teleport")
		if got, want := p.InvulnerableEndTime.Sub(start).Seconds(), 1+.04*float64(rank); !result.Accepted || math.Abs(got-want) > .1 {
			t.Fatalf("rank=%d accepted=%t phase duration=%.3f want %.3f", rank, result.Accepted, got, want)
		}
	}
}
