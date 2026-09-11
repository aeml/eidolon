package game

import (
	"testing"
	"time"
)

// Exercise the actual AI admission and delayed impact, not a substitute hit.
func TestBossSlamHonorsImpactDefenses(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	cases := []struct {
		name    string
		prepare func(*Entity)
		rune    string
		shield  bool
		want    int
	}{
		{name: "ordinary", want: 800},
		{name: "half armor", prepare: func(p *Entity) { p.Defense = 40 }, want: 820},
		{name: "invulnerable", prepare: func(p *Entity) { p.InvulnerableEndTime = time.Now().Add(time.Minute) }, want: 1000},
		{name: "expired invulnerability", prepare: func(p *Entity) { p.InvulnerableEndTime = time.Now().Add(-time.Second) }, want: 800},
		{name: "sanctuary", prepare: func(p *Entity) { p.SanctuaryDamageReduction = true; p.SanctuaryEndTime = time.Now().Add(time.Minute) }, want: 840},
		{name: "consecrated sanctuary", prepare: func(p *Entity) { p.ConsecratedSanctuaryEndTime = time.Now().Add(time.Minute) }, want: 860},
		{name: "overlapping sanctuary", prepare: func(p *Entity) {
			p.SanctuaryDamageReduction = true
			p.SanctuaryEndTime = time.Now().Add(time.Minute)
			p.ConsecratedSanctuaryEndTime = time.Now().Add(time.Minute)
		}, want: 860},
		{name: "guardian", prepare: func(p *Entity) {
			p.DivineInterventionGuardian = true
			p.DivineInterventionGuardTime = time.Now().Add(time.Minute)
		}, want: 900},
		{name: "shield", shield: true, want: 950},
		{name: "invulnerable shield", shield: true, prepare: func(p *Entity) { p.InvulnerableEndTime = time.Now().Add(time.Minute) }, want: 1000},
		{name: "reflective shield", shield: true, rune: "arcaneshield_reflective", want: 950},
		{name: "explosive shield", shield: true, rune: "arcaneshield_explosive", want: 950},
	}
	players := make([]*Entity, 0, len(cases))
	for _, tc := range cases {
		p := newTestPlayer(tc.name, "Wizard")
		p.Level, p.X, p.Z, p.InstanceID = 100, 60000, 60000, "dungeon_slam"
		p.Health, p.MaxHealth, p.Defense, p.Stats.Intelligence = 1000, 1000, 0, 10
		w.AddEntity(p)
		if tc.prepare != nil {
			tc.prepare(p)
		}
		if tc.shield {
			p.UnlockedSkills = []string{"Arcane Shield"}
			p.SkillRunes = map[string]string{"Arcane Shield": tc.rune}
			mana := p.Mana
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Arcane Shield"); !result.Accepted || p.Mana != mana-40 || p.ArcaneShieldHP != 150 {
				t.Fatalf("%s: paid shield setup failed: %+v", tc.name, result)
			}
		}
		players = append(players, p)
	}
	boss := &Entity{ID: "slam-boss", Type: TypeEnemy, SubType: "DemonOrc", Level: 30,
		X: 60001, Z: 60000, SpawnX: 60001, SpawnZ: 60000, InstanceID: "dungeon_slam",
		Scale: 4, State: "IDLE", Health: 10000, MaxHealth: 10000, Damage: 200}
	w.AddEntity(boss)
	w.updateEntity(boss, .033, players, &deferredActions{})
	if boss.LastSpecialAttack.IsZero() {
		t.Fatal("AI did not admit slam")
	}
	w.backgroundWork.SealWhenIdle()
	w.StopBackground()
	for i, tc := range cases {
		p := players[i]
		if p.Health != tc.want {
			t.Errorf("%s: HP=%d, want %d", tc.name, p.Health, tc.want)
		}
		if tc.shield && tc.name != "invulnerable shield" && (p.ArcaneShieldActive || p.ArcaneShieldHP != 0) {
			t.Errorf("%s: depleted shield remained", tc.name)
		}
		if tc.name == "invulnerable shield" && (!p.ArcaneShieldActive || p.ArcaneShieldHP != 150) {
			t.Error("invulnerability consumed shield capacity")
		}
	}
	if boss.Health != 10000-45-150 {
		t.Errorf("shield rune retaliation: boss HP=%d, want 9805", boss.Health)
	}
}

func TestBossSlamShieldRetaliationSharesPartyCredit(t *testing.T) {
	for _, runeID := range []string{"arcaneshield_reflective", "arcaneshield_explosive"} {
		t.Run(runeID, func(t *testing.T) {
			w := newTestWorld()
			defer w.StopBackground()
			const instanceID = "dungeon_slam_credit"
			w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, DungeonType: "verdant_bastion_catacombs"}
			caster := newTestPlayer("slam-wizard", "Wizard")
			ally := newTestPlayer("distant-downed-ally", "Cleric")
			for _, p := range []*Entity{caster, ally} {
				p.Level, p.Experience, p.MaxExperience = 30, 0, experienceRequiredForLevel(30)
				p.X, p.Z, p.InstanceID, p.Defense = 60000, 60000, instanceID, 0
				p.Quests = []Quest{{ID: "slam-retaliation", Type: "KILL", Target: "DemonOrc", MaxCount: 2, Accepted: true}}
				w.AddEntity(p)
			}
			ally.X, ally.Health, ally.State = 61000, 0, "DEAD"
			party := w.CreateParty(caster.ID)
			if err := w.JoinParty(party.ID, ally.ID); err != nil {
				t.Fatal(err)
			}
			caster.UnlockedSkills = []string{"Arcane Shield"}
			caster.SkillRunes = map[string]string{"Arcane Shield": runeID}
			caster.Stats.Intelligence = 10
			if result := w.PerformAbility(caster.ID, caster.X, caster.Z, "", "Arcane Shield"); !result.Accepted {
				t.Fatal(result)
			}
			boss := &Entity{ID: "retaliation-boss", Type: TypeEnemy, SubType: "DemonOrc", Level: 30,
				X: 60001, Z: 60000, SpawnX: 60001, SpawnZ: 60000, InstanceID: instanceID,
				Scale: 4, State: "IDLE", Health: 30, MaxHealth: 30, Damage: 200}
			w.AddEntity(boss)
			w.updateEntity(boss, .033, []*Entity{caster}, &deferredActions{})
			if boss.LastSpecialAttack.IsZero() {
				t.Fatal("AI did not admit slam")
			}
			w.backgroundWork.SealWhenIdle()
			w.StopBackground()
			if boss.State != "DEAD" {
				t.Fatal("shield retaliation did not kill boss")
			}
			for _, p := range []*Entity{caster, ally} {
				q := questByID(t, p, "slam-retaliation")
				if q.Count != 1 || q.Completed || p.Experience <= 0 || p.Gold <= 0 {
					t.Fatalf("%s: missing exact shared unclaimed reward: count=%d complete=%v XP=%d Gold=%d", p.SubType, q.Count, q.Completed, p.Experience, p.Gold)
				}
			}
		})
	}
}
