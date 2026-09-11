package game

import (
	"math"
	"testing"
	"time"
)

func TestPaidEnemyRootAndSlowLifecycle(t *testing.T) {
	for _, tc := range []struct{ class, skill, runeID string }{
		{"Wizard", "Gravity Well", "gravitywell_blackhole"},
		{"Fighter", "Juggernaut Charge", ""},
	} {
		t.Run(tc.skill, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			p := newTestPlayer("control-caster", tc.class)
			p.Level, p.InstanceID, p.X, p.Z = 100, "qa-control-lifecycle", 60000, 60000
			p.BaseStats = InitialPlayerStats()
			p.UnlockedSkills = []string{tc.skill}
			p.SkillRunes = map[string]string{tc.skill: tc.runeID}
			p.RecalculateStats()
			p.Mana = p.MaxMana
			w.AddEntity(p)
			e := &Entity{ID: "control-enemy", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
				State: "IDLE", Level: 30, BaseStats: InitialPlayerStats(), Health: 10000, MaxHealth: 10000,
				X: p.X + 8, Z: p.Z, SpawnX: p.X + 8, SpawnZ: p.Z, Scale: 1, Radius: 1.25, Speed: 8, BaseSpeed: 8}
			w.AddEntity(e)
			mana := p.Mana
			result := w.PerformAbility(p.ID, e.X, e.Z, "", tc.skill)
			root := tc.skill == "Gravity Well"
			if !result.Accepted || p.Mana >= mana || !e.Slowed || e.SlowFactor <= 0 || e.Rooted != root || e.Health >= 10000 {
				t.Fatalf("paid damaging control failed: accepted=%v slow=%v factor=%v root=%v hp=%d", result.Accepted, e.Slowed, e.SlowFactor, e.Rooted, e.Health)
			}
			x, z := e.X, e.Z
			w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
			wantMove := 8 * (1 - e.SlowFactor) * .25
			if root {
				wantMove = 0
			}
			if moved := math.Hypot(e.X-x, e.Z-z); math.Abs(moved-wantMove) > 1e-6 {
				t.Errorf("active crowd control moved=%v want=%v", moved, wantMove)
			}
			e.RootEndTime, e.SlowEndTime = time.Now().Add(-time.Millisecond), time.Now().Add(-time.Millisecond)
			x, z = e.X, e.Z
			w.updateEntity(e, .25, []*Entity{p}, &deferredActions{})
			if e.Rooted || e.Slowed || e.SlowFactor != 0 || math.Abs(e.Speed-8) > 1e-6 {
				t.Errorf("expired control retained: root=%v slow=%v factor=%v speed=%v", e.Rooted, e.Slowed, e.SlowFactor, e.Speed)
			}
			if moved := math.Hypot(e.X-x, e.Z-z); math.Abs(moved-2) > 1e-6 {
				t.Errorf("post-expiry normal pursuit moved=%v want=2", moved)
			}
		})
	}
}

func TestRootSlowOverlapAndRoamingExpiry(t *testing.T) {
	for _, order := range []string{"root-first", "slow-first", "together"} {
		t.Run(order, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			e := &Entity{ID: "root-roamer", Type: TypeEnemy, SubType: "Skeleton", InstanceID: "qa-root-roam",
				State: "IDLE", X: 60000, Z: 60000, SpawnX: 60000, SpawnZ: 60000, TargetX: 60010, TargetZ: 60000,
				Health: 100, MaxHealth: 100, BaseStats: InitialPlayerStats(), BaseSpeed: 8,
				Rooted: true, RootEndTime: time.Now().Add(time.Minute),
				Slowed: true, SlowFactor: .6, SlowEndTime: time.Now().Add(time.Minute)}
			e.RecalculateStats()
			w.AddEntity(e)
			step := func(want float64) {
				t.Helper()
				x, z := e.X, e.Z
				w.updateEntity(e, .25, nil, &deferredActions{})
				if moved := math.Hypot(e.X-x, e.Z-z); math.Abs(moved-want) > 1e-6 {
					t.Fatalf("movement=%v want=%v root=%v slow=%v speed=%v", moved, want, e.Rooted, e.Slowed, e.Speed)
				}
			}
			step(0)
			past := time.Now().Add(-time.Millisecond)
			if order != "slow-first" {
				e.RootEndTime = past
			}
			if order != "root-first" {
				e.SlowEndTime = past
			}
			step(map[string]float64{"root-first": .8, "slow-first": 0, "together": 2}[order])
			e.RootEndTime, e.SlowEndTime = past, past
			step(2)
			if e.Rooted || e.Slowed || e.SlowFactor != 0 || e.Speed != 8 {
				t.Fatal("expired control did not restore authored speed and clear flags")
			}
		})
	}
}

func TestRootPermitsOrdinaryEnemyAttackInRange(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("root-attack-target", "Fighter")
	p.X, p.Z, p.InstanceID = 60000, 60000, "qa-root-attack"
	w.AddEntity(p)
	e := &Entity{ID: "root-attacker", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
		X: p.X + 2, Z: p.Z, State: "IDLE", Health: 100, MaxHealth: 100,
		Rooted: true, RootEndTime: time.Now().Add(time.Minute), AttackCooldown: time.Hour}
	w.AddEntity(e)
	if _, ok := w.PerformAttack(e.ID, p.ID); !ok {
		t.Fatal("root must prevent movement, not silence attacks already in range")
	}
}

func TestRootSlowSeraphFollowingAndLifetime(t *testing.T) {
	for _, mode := range []string{"root", "slow", "expired-control", "expired-summon"} {
		t.Run(mode, func(t *testing.T) {
			w, owner, seraph, target := paidSeraphFixture(t, nil)
			defer w.StopBackground()
			target.State = "DEAD"
			owner.X = seraph.X + 10
			owner.Z = seraph.Z
			seraph.Rooted, seraph.Slowed = mode != "slow", true
			seraph.RootEndTime, seraph.SlowEndTime = time.Now().Add(time.Minute), time.Now().Add(time.Minute)
			seraph.SlowFactor = .5
			if mode == "expired-control" {
				seraph.RootEndTime, seraph.SlowEndTime = time.Now().Add(-time.Millisecond), time.Now().Add(-time.Millisecond)
			}
			if mode == "expired-summon" {
				seraph.CreatedAt = time.Now().Add(-seraph.SummonDuration - time.Second)
			}
			x, z := seraph.X, seraph.Z
			deferred := &deferredActions{}
			w.updateEntity(seraph, .25, []*Entity{owner}, deferred)
			want := map[string]float64{"root": 0, "slow": .75, "expired-control": 1.5, "expired-summon": 0}[mode]
			if moved := math.Hypot(seraph.X-x, seraph.Z-z); math.Abs(moved-want) > 1e-6 {
				t.Fatalf("summon moved=%v want=%v", moved, want)
			}
			if containsPlayer(deferred.removals, seraph.ID) != (mode == "expired-summon") {
				t.Fatal("control changed summon lifetime cleanup")
			}
		})
	}
}

func TestPaidRootAndSlowRespectControlImmunity(t *testing.T) {
	for _, skill := range []string{"Gravity Well", "Juggernaut Charge"} {
		t.Run(skill, func(t *testing.T) {
			class := "Wizard"
			if skill == "Juggernaut Charge" {
				class = "Fighter"
			}
			w, p, target := directSkillWallFixture(class, true)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills, p.Mana = 100, []string{skill}, 200
			p.SkillRunes = map[string]string{"Gravity Well": "gravitywell_blackhole"}
			target.CCImmune = true
			health := target.Health
			result := w.PerformAbility(p.ID, target.X, target.Z, "", skill)
			if !result.Accepted || p.Mana >= 200 || target.Health >= health {
				t.Fatal("control immunity must not prevent paid damaging cast")
			}
			if target.Rooted || target.Slowed || !target.RootEndTime.IsZero() || !target.SlowEndTime.IsZero() {
				t.Fatal("cast applied control to immune target")
			}
		})
	}
}
