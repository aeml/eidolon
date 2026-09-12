package game

import (
	"testing"
	"time"
)

func TestFortressReceivingMitigationAndShieldOrder(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		name                   string
		active                 bool
		end                    time.Time
		shield                 int
		wantDamage, wantShield int
	}{
		{"active", true, now.Add(time.Second), 0, 80, 0},
		{"inactive", false, now.Add(time.Second), 0, 100, 0},
		{"expired", true, now, 0, 100, 0},
		{"missing deadline", true, time.Time{}, 0, 100, 0},
		{"shield after reduction", true, now.Add(time.Second), 50, 30, 0},
		{"shield retains remainder", true, now.Add(time.Second), 100, 0, 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := &Entity{Type: TypePlayer, SubType: "Fighter", IronFortressActive: tc.active,
				IronFortressEndTime: tc.end, ArcaneShieldActive: tc.shield > 0, ArcaneShieldHP: tc.shield,
				ArcaneShieldEndTime: now.Add(time.Minute)}
			got := resolveImpactDefenseLocked(p, 100, now)
			if got.damage != tc.wantDamage || p.ArcaneShieldHP != tc.wantShield {
				t.Fatalf("damage=%d shield=%d want%d/%d", got.damage, p.ArcaneShieldHP, tc.wantDamage, tc.wantShield)
			}
		})
	}
}

func TestPaidFortressMitigatesActualWardenImpactWithCurrentArmor(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("fortress-impact", "Fighter")
	p.InstanceID, p.X, p.Z = "fortress-impact", 60000, 60000
	w.AddEntity(p)
	w.SetPlayerLevel(p.ID, 30)
	for _, base := range BaseItems {
		if base.Name == "Plate Mail" {
			p.Equipment = map[string]Item{"chest": *createItem(base, RarityCommon, 1, 0, 30)}
		}
	}
	p.RecalculateStats()
	p.UnlockedSkills = []string{"Iron Fortress"}
	p.Health, p.Mana = p.MaxHealth, p.MaxMana
	mana := p.Mana
	if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Iron Fortress"); !result.Accepted || mana-p.Mana != 40 {
		t.Fatalf("paid cast %+v", result)
	}
	profile := dungeonEnemyCombatProfile("RootboundWarden", 30, DifficultyNormal, dungeonRankBoss, 2.5)
	enemy := &Entity{ID: "warden-impact", Type: TypeEnemy, SubType: "RootboundWarden", InstanceID: p.InstanceID,
		X: p.X + 7, Z: p.Z, Scale: 4, State: "IDLE", Health: profile.Health, MaxHealth: profile.MaxHealth, Damage: profile.Damage}
	w.AddEntity(enemy)
	before := p.Health
	w.applyAttackImpact(enemy.ID, p.ID, p.InstanceID, nil, 0)
	want := (profile.Damage - p.Defense/2) * 80 / 100
	if before-p.Health != want {
		t.Fatalf("real paid impact=%d want%d", before-p.Health, want)
	}
}

func TestFortressMitigationComposesWithOtherProtection(t *testing.T) {
	now := time.Now()
	p := &Entity{Type: TypePlayer, IronFortressActive: true, IronFortressEndTime: now.Add(time.Second),
		ConsecratedSanctuaryEndTime: now.Add(time.Second), DivineInterventionGuardian: true,
		DivineInterventionGuardTime: now.Add(time.Second)}
	if got := resolveImpactDefenseLocked(p, 100, now).damage; got != 28 {
		t.Fatalf("composed damage=%d want28", got)
	}
}
