package game

import (
	"encoding/json"
	"math"
	"os"
	"testing"
	"time"
)

type fireballRuneContract struct {
	Rune            string
	Damage, Bounces int
	Speed, Cooldown float64
}

func fireballRuneContracts(t *testing.T) []fireballRuneContract {
	t.Helper()
	data, err := os.ReadFile("testdata/fireball_runes.json")
	if err != nil {
		t.Fatal(err)
	}
	var rows []fireballRuneContract
	if err := json.Unmarshal(data, &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) != 4 {
		t.Fatal("base Fireball and all three earned rune choices required")
	}
	return rows
}

func TestFireballRunePaidCastContract(t *testing.T) {
	for _, row := range fireballRuneContracts(t) {
		t.Run(row.Rune, func(t *testing.T) {
			w, p, target := precisionRuneFixture(t, "Fireball", row.Rune)
			result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, "Fireball")
			if !result.Accepted || p.Mana != 9970 {
				t.Fatalf("unpaid/rejected cast %+v", result)
			}
			if cd := time.Until(p.Cooldowns["Fireball"]).Seconds(); math.Abs(cd-row.Cooldown) > .1 {
				t.Fatalf("cooldown %g want%g", cd, row.Cooldown)
			}
			count := 0
			for _, e := range w.Entities {
				if e.OwnerID != p.ID || e.ProjectileSkill != "Fireball" {
					continue
				}
				count++
				if e.Damage != row.Damage || e.ProjectileBounces != row.Bounces || e.ProjectileRuneID != row.Rune || math.Abs(math.Hypot(e.VelX, e.VelZ)-row.Speed) > 1e-6 {
					t.Fatalf("wrong paid projectile %+v", e)
				}
			}
			if count != 1 {
				t.Fatalf("projectiles%d want1", count)
			}
		})
	}
}

func TestEmpoweredFireballRoundsTrainingBeforeRuneAndSpendsOneStoredCharge(t *testing.T) {
	w, p, target := precisionRuneFixture(t, "Fireball", "fireball_empowered")
	p.Stats.Intelligence = 1
	p.TalentRanks = map[string]int{"WIZ_01": 1}
	p.SkillRunes["Spell Focus"] = spellFocusOverchannel
	requireFocusCast(t, func(skill string) AbilityResult {
		p.LastAbilityTime = time.Now().Add(-time.Second)
		return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill)
	}, "Spell Focus")
	p.LastAbilityTime = time.Now().Add(-time.Second)
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Fireball")
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.SubType == "Fireball" && e.Damage != 130 {
			t.Fatalf("damage%d want130: truncate trained/focused65.78 then double", e.Damage)
		}
	}
	if p.SpellFocusActive || p.ActiveSpellFocusCharges() != 0 {
		t.Fatal("Focus was not spent exactly once")
	}
}

func ownedMagmaGround(t *testing.T, w *World, ownerID string) *Entity {
	t.Helper()
	var found *Entity
	for _, e := range w.Entities {
		if e.OwnerID == ownerID && e.SubType == "MagmaGround" && e.ProjectileRuneID == "fireball_magma" {
			if found != nil {
				t.Fatal("duplicate Magma fields from one impact")
			}
			found = e
		}
	}
	if found == nil {
		t.Fatal("paid Magma hit did not publish a ground field")
	}
	return found
}

func TestMagmaGroundStaysAtImpactAndInheritsBudgetWithoutRerolling(t *testing.T) {
	w, p, first := precisionRuneFixture(t, "Fireball", "fireball_magma")
	p.CritChanceBonus = 1
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, first.X, first.Z, first.ID, skill) }, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, first)
	field := ownedMagmaGround(t, w, p.ID)
	if field.Damage != 33 || field.Radius != 5 || field.Scale != 1 || math.Abs(field.ZoneEndTime.Sub(field.CreatedAt).Seconds()-3) > 1e-6 {
		t.Fatal("wrong captured field budget/lifetime/footprint")
	}
	copy := w.GetEntityCopy(field.ID)
	if copy.ZoneEndTime != field.ZoneEndTime || copy.ZoneDamagePvPScaled != field.ZoneDamagePvPScaled {
		t.Fatal("detached field copy lost its private deadline/budget flag")
	}
	oldX, oldZ := first.X, first.Z
	first.X, first.Z = field.X+16, field.Z
	w.Grid.Update(first, oldX, oldZ)
	newcomer := &Entity{ID: "magma-entrant", Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", InstanceID: p.InstanceID, X: field.X + 1, Z: field.Z, Health: 1000, MaxHealth: 1000, CCImmune: true}
	w.AddEntity(newcomer)
	p.CritChanceBonus = 0
	p.Stats.Intelligence = 10000
	p.SkillRunes["Fireball"] = "fireball_empowered"
	before := first.Health
	for i := 0; i < 3; i++ {
		field.LastAttackTime = time.Now().Add(-2 * time.Second)
		w.updateEntity(field, 0, nil, &deferredActions{})
	}
	if newcomer.Health != 901 || first.Health != before || first.Bleeding || newcomer.Bleeding {
		t.Fatalf("field did not stay put or rerolled: entrant%d departed%d", newcomer.Health, first.Health)
	}
	field.ZoneEndTime = time.Now().Add(-time.Millisecond)
	deferred := &deferredActions{}
	w.updateEntity(field, 0, nil, deferred)
	if newcomer.Health != 901 || len(deferred.removals) != 1 || deferred.removals[0] != field.ID {
		t.Fatal("expired field still damaged or did not retire")
	}
}

func TestFireballChainRetainsThreeHalfDamageBouncesWithoutRepeatDirectHits(t *testing.T) {
	w, p, first := precisionRuneFixture(t, "Fireball", "fireball_chain")
	oldX, oldZ := first.X, first.Z
	first.X = p.X + 5
	w.Grid.Update(first, oldX, oldZ)
	foes := []*Entity{first}
	for i, offset := range []float64{17, 29, 41} {
		e := &Entity{ID: []string{"chain-second", "chain-third", "chain-fourth"}[i], Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", InstanceID: p.InstanceID, X: p.X + offset, Z: p.Z, Health: 100000, MaxHealth: 100000}
		w.AddEntity(e)
		foes = append(foes, e)
	}
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, first.X, first.Z, first.ID, skill) }, "Fireball")
	var projectile *Entity
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.SubType == "Fireball" {
			projectile = e
		}
	}
	if projectile == nil {
		t.Fatal("paid chain projectile missing")
	}
	p.Stats.Intelligence = 10000
	p.SkillRunes["Fireball"] = "fireball_empowered"
	direct := map[string]int{}
	for step := 0; step < 400; step++ {
		before := map[string]int{}
		for _, target := range foes {
			before[target.ID] = target.Health
		}
		deferred := &deferredActions{}
		w.updateEntity(projectile, .02, nil, deferred)
		for _, target := range foes {
			if projectile.HitList[target.ID] {
				if _, seen := direct[target.ID]; !seen {
					direct[target.ID] = before[target.ID] - target.Health
				}
			}
		}
		if len(deferred.removals) > 0 {
			break
		}
	}
	if len(direct) != 4 || projectile.ProjectileBounces != 0 {
		t.Fatalf("chain ended early or repeated hits: %v", direct)
	}
	for i, target := range foes {
		want := 50
		if i == 0 {
			want = 100
		}
		if direct[target.ID] != want {
			t.Fatalf("direct hit%d damage%d want%d", i, direct[target.ID], want)
		}
	}
}

func TestMagmaRealLifetimeProducesThreePulsesThenRetires(t *testing.T) {
	w, p, target := precisionRuneFixture(t, "Fireball", "fireball_magma")
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, target)
	field := ownedMagmaGround(t, w, p.ID)
	before := target.Health
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(4 * time.Second)
	defer deadline.Stop()
	for {
		select {
		case <-ticker.C:
			deferred := &deferredActions{}
			w.updateEntity(field, .02, nil, deferred)
			if len(deferred.removals) > 0 {
				if got := before - target.Health; got != 3*field.Damage {
					t.Fatalf("real lifetime delivered%d damage want%d", got, 3*field.Damage)
				}
				return
			}
		case <-deadline.C:
			t.Fatal("Magma failed to retire at its three-second deadline")
		}
	}
}

func TestMagmaAbsorbedHitDoesNotCreateAFreeDamageField(t *testing.T) {
	w, p, target := abilityDefenseDuel(t, "Wizard", "Fireball", "")
	p.Stats.Intelligence = 40
	p.SkillRunes = map[string]string{"Fireball": "fireball_magma"}
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, target)
	for _, e := range w.Entities {
		if e.OwnerID == p.ID && e.ProjectileRuneID == "fireball_magma" && e.SubType == "MagmaGround" {
			t.Fatal("absorbed hit created a free field")
		}
	}
	if target.Health != target.MaxHealth || target.ArcaneShieldHP != 535 {
		t.Fatal("primary paid shield did not absorb the65PvP damage once")
	}
}

func TestMagmaPulsePaysCurrentShieldWithoutRerollingOutgoingDamage(t *testing.T) {
	w, p, target := abilityDefenseDuel(t, "Wizard", "Fireball", "")
	p.Stats.Intelligence = 40
	p.SkillRunes = map[string]string{"Fireball": "fireball_magma"}
	target.ArcaneShieldActive = false
	target.ArcaneShieldHP = 0
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, target)
	field := ownedMagmaGround(t, w, p.ID)
	target.ArcaneShieldActive = true
	target.ArcaneShieldHP = 4
	target.ArcaneShieldEndTime = time.Now().Add(10 * time.Second)
	p.CritChanceBonus = 1
	p.Stats.Intelligence = 10000
	before := target.Health
	w.updateEntity(field, 0, nil, &deferredActions{})
	if field.Damage != 10 || before-target.Health != 6 || target.ArcaneShieldHP != 0 {
		t.Fatal("stored10damagePvP pulse bypassed or multiplied the4point shield budget")
	}
}

func TestMagmaPulsesDoNotConsumeRemainingReservoirCharge(t *testing.T) {
	w, p, target := precisionRuneFixture(t, "Fireball", "fireball_magma")
	p.SkillRunes["Spell Focus"] = spellFocusReservoir
	cast := func(skill string) AbilityResult {
		p.LastAbilityTime = time.Now().Add(-time.Second)
		return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill)
	}
	requireFocusCast(t, cast, "Spell Focus")
	requireFocusCast(t, cast, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, target)
	field := ownedMagmaGround(t, w, p.ID)
	if field.Damage != 29 || p.ActiveSpellFocusCharges() != 1 {
		t.Fatal("paid175hit did not inherit its29pulse budget while spending one charge")
	}
	for i := 0; i < 3; i++ {
		field.LastAttackTime = time.Now().Add(-2 * time.Second)
		w.updateEntity(field, 0, nil, &deferredActions{})
	}
	if p.ActiveSpellFocusCharges() != 1 || p.ActiveSpellFocusMultiplier() != 1.75 {
		t.Fatal("field pulses borrowed another Focus charge")
	}
}

func TestFireballChainChoosesNearestReachableTargetInsteadOfSolidCover(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		name := "wall"
		if doorway {
			name = "doorway"
		}
		t.Run(name, func(t *testing.T) {
			w, p, beyond := directSkillWallFixture("Wizard", doorway)
			t.Cleanup(w.StopBackground)
			oldX, oldZ := beyond.X, beyond.Z
			beyond.Z = p.Z + 3
			w.Grid.Update(beyond, oldX, oldZ)
			p.SkillRunes = map[string]string{"Fireball": "fireball_chain"}
			first := &Entity{ID: "chain-cover-first", Type: TypeEnemy, State: "IDLE", InstanceID: p.InstanceID, X: p.X + .5, Z: p.Z, Health: 10000, MaxHealth: 10000}
			fallback := &Entity{ID: "chain-cover-visible", Type: TypeEnemy, State: "IDLE", InstanceID: p.InstanceID, X: p.X - 4, Z: p.Z, Health: 10000, MaxHealth: 10000}
			w.AddEntity(first)
			w.AddEntity(fallback)
			requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, first.X, first.Z, first.ID, skill) }, "Fireball")
			advancePaidProjectileUntilHit(t, w, p, first)
			var projectile *Entity
			for _, e := range w.Entities {
				if e.OwnerID == p.ID && e.SubType == "Fireball" {
					projectile = e
				}
			}
			if projectile == nil || projectile.ProjectileBounces != 2 {
				t.Fatal("first chain hit did not redirect once")
			}
			if (projectile.VelX > 0) != doorway {
				t.Fatal("chain preferred the enemy behind solid cover over a visible fallback")
			}
		})
	}
}

func TestMagmaInheritsResolvedHitBeforeDivineInterventionHealing(t *testing.T) {
	w, p, target := abilityDefenseDuel(t, "Wizard", "Fireball", "")
	p.Stats.Intelligence = 40
	p.SkillRunes = map[string]string{"Fireball": "fireball_magma"}
	target.ArcaneShieldActive = false
	target.ArcaneShieldHP = 0
	target.Health = 10
	target.DivineInterventionActive = true
	target.DivineInterventionEndTime = time.Now().Add(10 * time.Second)
	requireFocusCast(t, func(skill string) AbilityResult { return w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill) }, "Fireball")
	advancePaidProjectileUntilHit(t, w, p, target)
	field := ownedMagmaGround(t, w, p.ID)
	if target.Health != 150 || target.State == "DEAD" || field.Damage != 10 {
		t.Fatal("death save erased or inflated the65damagePvP hit budget")
	}
	w.updateEntity(field, 0, nil, &deferredActions{})
	if target.Health != 140 {
		t.Fatal("field did not retain its10point resolved-hit budget")
	}
}
