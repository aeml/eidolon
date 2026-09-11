package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestFighterEffectDurationRanksReachPaidCasts(t *testing.T) {
	for _, tc := range []struct {
		skill, runeID string
		base          time.Duration
		deadline      func(*Entity, *Entity) time.Time
	}{
		{"Iron Fortress", "", 30 * time.Second, func(p, _ *Entity) time.Time { return p.IronFortressEndTime }},
		{"Iron Fortress", "ironfortress_extended", 45 * time.Second, func(p, _ *Entity) time.Time { return p.IronFortressEndTime }},
		{"Guardian Roar", "", 10 * time.Second, func(p, _ *Entity) time.Time { return p.GuardianRoarEndTime }},
		{"Berserker Edge", "", 15 * time.Second, func(p, _ *Entity) time.Time { return p.BerserkerModeEndTime }},
		{"Last Stand Rampage", "", 10 * time.Second, func(p, _ *Entity) time.Time { return p.LastStandEndTime }},
		{"Unbreakable Grip", "", time.Second, func(_, e *Entity) time.Time { return e.RootEndTime }},
		{"Juggernaut Charge", "", 5 * time.Second, func(_, e *Entity) time.Time { return e.SlowEndTime }},
		{"Earthshaker", "", 2 * time.Second, func(_, e *Entity) time.Time { return e.StunEndTime }},
		{"Earthshaker", "earthshaker_seismic", 4 * time.Second, func(_, e *Entity) time.Time { return e.StunEndTime }},
		{"Shield Slam", "shieldslam_fortify", 10 * time.Second, func(p, _ *Entity) time.Time { return p.ArcaneShieldEndTime }},
	} {
		for _, rank := range []int{0, 1, 5} {
			t.Run(fmt.Sprintf("%s/%s/rank%d", tc.skill, tc.runeID, rank), func(t *testing.T) {
				w, p, enemy := directSkillWallFixture("Fighter", true)
				defer w.StopBackground()
				p.Level, p.UnlockedSkills = 100, []string{tc.skill}
				p.BaseStats = InitialPlayerStats()
				p.TalentRanks = map[string]int{"FTR_30": rank, "FTR_37": rank}
				p.SkillRunes = map[string]string{tc.skill: tc.runeID}
				p.RecalculateStats()
				p.Mana, p.Health = p.MaxMana, p.MaxHealth/4
				mana, start := p.Mana, time.Now()
				result := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, tc.skill)
				end := time.Now()
				if !result.Accepted || (tc.skill != "Last Stand Rampage" && tc.skill != "Berserker Edge" && p.Mana >= mana) {
					t.Fatalf("ordinary paid ability failed: accepted=%v mana=%d->%d", result.Accepted, mana, p.Mana)
				}
				want := time.Duration(math.Round(float64(tc.base) * (1 + .07*float64(rank))))
				deadline := tc.deadline(p, enemy)
				if deadline.Before(start.Add(want)) || deadline.After(end.Add(want)) {
					t.Fatalf("duration=%v..%v want=%v", deadline.Sub(end), deadline.Sub(start), want)
				}
				p.TalentRanks = nil
				p.RecalculateStats()
				if !tc.deadline(p, enemy).Equal(deadline) {
					t.Fatal("existing timer changed when later training changed")
				}
			})
		}
	}
}

func TestFighterDurationPartyRecipientsUseCasterDeadline(t *testing.T) {
	for _, skill := range []string{"Guardian Roar", "Berserker Edge"} {
		t.Run(skill, func(t *testing.T) {
			w, p, enemy := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills = 100, []string{"Shield Slam", skill}
			p.BaseStats = InitialPlayerStats()
			p.TalentRanks = map[string]int{"FTR_30": 5, "FTR_37": 5}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			party := w.CreateParty(p.ID)
			if party == nil {
				t.Fatal("party creation failed")
			}
			members := make([]*Entity, 0, 3)
			for _, placement := range []string{"near", "far", "other-instance"} {
				member := newTestPlayer("duration-ally-"+placement, "Cleric")
				member.X, member.Z, member.InstanceID = p.X, p.Z, p.InstanceID
				if placement == "far" {
					member.X += 100
				}
				if placement == "other-instance" {
					member.InstanceID = "another-room"
				}
				w.AddEntity(member)
				if err := w.JoinParty(party.ID, member.ID); err != nil {
					t.Fatal(err)
				}
				members = append(members, member)
			}
			if skill == "Guardian Roar" {
				if result := w.PerformAbility(p.ID, enemy.X, enemy.Z, enemy.ID, "Shield Slam"); !result.Accepted {
					t.Fatal("paid combo opener failed")
				}
				// Advance only the GCD admission deadline, retaining the real opener
				// and combo window. The next actual cast must consume its combo.
				p.LastAbilityTime = time.Now().Add(-time.Second)
			}
			start := time.Now()
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", skill); !result.Accepted {
				t.Fatal("party support cast rejected")
			}
			end := time.Now()
			deadline := func(e *Entity) time.Time {
				if skill == "Guardian Roar" {
					return e.GuardianRoarEndTime
				}
				return e.BerserkerModeEndTime
			}
			want := 20250 * time.Millisecond // 15s combo/base, then +35% caster duration.
			if deadline(p).Before(start.Add(want)) || deadline(p).After(end.Add(want)) {
				t.Fatal("rune/combo and duration training did not compose at cast time")
			}
			if !deadline(members[0]).Equal(deadline(p)) {
				t.Fatal("nearby untrained recipient did not inherit the caster deadline")
			}
			if !deadline(members[1]).IsZero() || !deadline(members[2]).IsZero() {
				t.Fatal("duration training expanded party buff range or instance scope")
			}
		})
	}
}
