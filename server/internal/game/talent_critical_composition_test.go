package game

import (
	"math"
	"math/rand"
	"os"
	"testing"
	"time"
)

func TestBackstabCriticalSourcesComposeOnce(t *testing.T) {
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	for _, tc := range []struct {
		name, rune       string
		combo, equipment bool
		armor            int
	}{
		{name: "ordinary"},
		{name: "equipment", equipment: true},
		{name: "combo", combo: true},
		{name: "combo equipment", combo: true, equipment: true},
		{name: "rune", rune: "backstab_ambush"},
		{name: "rune equipment", rune: "backstab_ambush", equipment: true},
		{name: "all sources", rune: "backstab_ambush", combo: true, equipment: true},
		{name: "armored combo", combo: true, armor: 20},
		{name: "armored all sources", rune: "backstab_ambush", combo: true, equipment: true, armor: 20},
		{name: "eviscerate combo", rune: "backstab_eviscerate", combo: true, equipment: true, armor: 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			w.Entities, w.Grid = make(map[string]*Entity), NewSpatialMap(50)
			p := newTestPlayer("composition-rogue", "Rogue")
			p.InstanceID, p.Level = "qa-critical-composition", 100
			p.UnlockedSkills = []string{"Backstab", "Cloak & Vanish"}
			p.SkillRunes = map[string]string{"Backstab": tc.rune}
			p.Rotation = math.Pi // No independent behind-target multiplier.
			w.AddEntity(p)
			target := &Entity{ID: "composition-target", Type: TypeEnemy, InstanceID: p.InstanceID,
				X: 2, Health: 10000, MaxHealth: 10000, Defense: tc.armor, State: "IDLE"}
			w.AddEntity(target)
			if tc.combo {
				mana := p.Mana
				if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Cloak & Vanish"); !result.Accepted || p.Mana >= mana {
					t.Fatalf("paid combo opener failed: %+v", result)
				}
				// Advance only the GCD; normal dispatch still recognizes its own
				// recorded Cloak history and activates/consumes the combo.
				p.LastAbilityTime = time.Now().Add(-time.Second)
			}
			p.Damage, p.CritChanceBonus = 100, 0
			if tc.equipment {
				p.CritChanceBonus = 1
			}
			armor := tc.armor
			if tc.rune == "backstab_eviscerate" {
				armor -= armor / 2
			}
			want := 150 - armor
			if tc.combo || tc.equipment || tc.rune == "backstab_ambush" {
				want *= 2
			}
			rand.Seed(2)
			if roll := rand.Float64(); roll >= .5 {
				t.Fatalf("invalid rune proc fixture: %v", roll)
			}
			rand.Seed(2)
			mana := p.Mana
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Backstab")
			if !result.Accepted || p.Mana >= mana {
				t.Fatalf("paid Backstab failed: %+v", result)
			}
			if got := target.MaxHealth - target.Health; got != want {
				t.Errorf("damage=%d want=%d (one critical after armor)", got, want)
			}
			if p.ActiveCombo != "" {
				t.Errorf("combo not consumed: %q", p.ActiveCombo)
			}
		})
	}
}

func TestFireballSplashAppliesRecipientModifiersOnce(t *testing.T) {
	for _, tc := range []struct {
		name                                                                                   string
		critical, fire, primaryMark, splashMark, combo, primarySlow, splashSlow, wall, doorway bool
	}{
		{name: "baseline"},
		{name: "critical", critical: true},
		{name: "fire bonus", fire: true},
		{name: "critical and fire", critical: true, fire: true},
		{name: "primary weakness only", primaryMark: true},
		{name: "secondary weakness only", splashMark: true},
		{name: "combo primary slowed", combo: true, primarySlow: true},
		{name: "combo secondary slowed", combo: true, splashSlow: true},
		{name: "all modifiers", critical: true, fire: true, primaryMark: true, splashMark: true, combo: true, primarySlow: true, splashSlow: true},
		{name: "dungeon wall", wall: true},
		{name: "dungeon doorway", wall: true, doorway: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := newTestWorld()
			w.Entities, w.Grid = make(map[string]*Entity), NewSpatialMap(50)
			p := newTestPlayer("splash-caster", "Wizard")
			p.InstanceID, p.Level, p.Stats.Intelligence = "dungeon_splash_composition", 100, 40
			if tc.critical {
				p.CritChanceBonus = 1
			}
			if tc.fire {
				p.FireDamageBonus = .5
			}
			// Isolate per-recipient Implosion consumption from Gravity Well's
			// separate damage/slow application; Fireball dispatch consumes it.
			if tc.combo {
				p.ActiveCombo = "fireball_well_boost"
			}
			w.AddEntity(p)
			primary := &Entity{ID: "splash-primary", Type: TypeEnemy, InstanceID: p.InstanceID,
				X: 8, Health: 10000, MaxHealth: 10000, State: "IDLE", MarkWeakness: tc.primaryMark, MarkWeaknessFactor: .5, Slowed: tc.primarySlow}
			secondary := &Entity{ID: "splash-secondary", Type: TypeEnemy, InstanceID: p.InstanceID,
				X: 8, Z: 6, Health: 10000, MaxHealth: 10000, State: "IDLE", MarkWeakness: tc.splashMark, MarkWeaknessFactor: .5, Slowed: tc.splashSlow}
			outsider := &Entity{ID: "splash-other-instance", Type: TypeEnemy, InstanceID: "unrelated-instance",
				X: 8, Z: 6, Health: 10000, MaxHealth: 10000, State: "IDLE"}
			w.AddEntity(primary)
			w.AddEntity(secondary)
			w.AddEntity(outsider)
			if tc.wall {
				rects := []DungeonWalkRect{{X: 0, Z: 0, Width: 30, Height: 4}, {X: 0, Z: 6, Width: 30, Height: 4}}
				if tc.doorway {
					rects = append(rects, DungeonWalkRect{X: 8, Z: 3, Width: 4, Height: 4})
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{ID: p.InstanceID, Layout: DungeonLayout{WalkRects: rects}})
			}
			mana := p.Mana
			if result := w.PerformAbility(p.ID, primary.X, primary.Z, primary.ID, "Fireball"); !result.Accepted || p.Mana >= mana {
				t.Fatalf("paid Fireball failed: %+v", result)
			}
			var projectile *Entity
			for _, e := range w.Entities {
				if e.Type == TypeProjectile {
					projectile = e
				}
			}
			if projectile == nil || projectile.Damage != 100 {
				t.Fatal("expected ordinary 100-damage Fireball projectile")
			}
			for step := 0; step < 20 && primary.Health == primary.MaxHealth; step++ {
				w.updateEntity(projectile, .05, nil, &deferredActions{})
			}
			wantPrimary, wantSplash := 100, 40
			if tc.combo && tc.primarySlow {
				wantPrimary *= 2
			}
			if tc.combo && tc.splashSlow {
				wantSplash *= 2
			}
			if tc.critical {
				wantPrimary *= 2
				wantSplash *= 2
			}
			if tc.primaryMark {
				wantPrimary = wantPrimary * 3 / 2
			}
			if tc.splashMark {
				wantSplash = wantSplash * 3 / 2
			}
			if tc.fire {
				wantPrimary = wantPrimary * 3 / 2
				wantSplash = wantSplash * 3 / 2
			}
			if tc.wall && !tc.doorway {
				wantSplash = 0
			}
			if got := primary.MaxHealth - primary.Health; got != wantPrimary {
				t.Errorf("direct=%d want=%d", got, wantPrimary)
			}
			if got := secondary.MaxHealth - secondary.Health; got != wantSplash {
				t.Errorf("splash=%d want=%d", got, wantSplash)
			}
			if outsider.Health != outsider.MaxHealth {
				t.Error("splash escaped its instance")
			}
		})
	}
}

func TestCriticalGuaranteePreservesIndependentLuckyProc(t *testing.T) {
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	var seed int64
	for seed = 1; seed < 1000; seed++ {
		rand.Seed(seed)
		if rand.Float64() < .1 {
			break
		}
	}
	if seed == 1000 {
		t.Fatal("could not establish lucky fixture")
	}
	p := &Entity{Type: TypePlayer, SubType: "Rogue", CritChanceBonus: 1, ActiveUniqueEffects: []string{"lucky"}}
	target := &Entity{Type: TypeEnemy, Health: 1000, MaxHealth: 1000}
	rand.Seed(seed)
	damage, critical := calculateFinalDamageWithCritical(p, target, 100, "physical", "Backstab", true)
	if damage != 400 || !critical {
		t.Fatalf("independent lucky plus one ordinary critical: damage=%d critical=%v", damage, critical)
	}
}

func TestGenericCriticalTalentsReachActualBasicAttackImpact(t *testing.T) {
	t.Setenv("GODEBUG", os.Getenv("GODEBUG")+",randseednop=0")
	for _, tc := range []struct{ class, talent string }{
		{"Rogue", "ROG_32"}, {"Rogue", "ROG_39"}, {"Fighter", "FTR_39"}, {"Wizard", "WIZ_39"},
	} {
		for _, rank := range []int{0, 1, 5} {
			t.Run(tc.talent+"/"+string(rune('0'+rank)), func(t *testing.T) {
				w := newTestWorld()
				w.Entities, w.Grid = make(map[string]*Entity), NewSpatialMap(50)
				p := newTestPlayer("basic-critical-caster", tc.class)
				p.InstanceID, p.Damage, p.CritChanceBonus = "qa-basic-critical", 100, .60
				p.TalentRanks = map[string]int{tc.talent: rank}
				// A named Backstab Technique must not boost a Rogue basic attack.
				if tc.class == "Rogue" {
					p.TalentRanks["ROG_04"] = 5
				}
				target := &Entity{ID: "basic-critical-target", Type: TypeEnemy, InstanceID: p.InstanceID,
					X: 2, Health: 10000, MaxHealth: 10000, Defense: 20, State: "IDLE"}
				w.AddEntity(p)
				w.AddEntity(target)
				var events []DamageEvent
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "damage" {
						events = append(events, value.(DamageEvent))
					}
				}
				rand.Seed(1)
				// Execute the production post-delay path synchronously, including
				// its real private attacker snapshot, armor and authoritative event.
				w.applyAttackImpact(p.ID, target.ID, p.InstanceID, nil, 0)
				want := 80
				if rank > 0 {
					want *= 2
				}
				if got := target.MaxHealth - target.Health; got != want {
					t.Errorf("rank=%d damage=%d want=%d", rank, got, want)
				}
				if len(events) != 1 || events[0].Amount != want || events[0].SourceID != p.ID || events[0].TargetID != target.ID || events[0].InstanceID != p.InstanceID {
					t.Errorf("authoritative basic damage event mismatch: %+v", events)
				}
			})
		}
	}
}
