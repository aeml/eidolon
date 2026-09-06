package game

import "testing"

// This matrix checks authoritative damage and instance isolation at the actual
// boss body's contact boundary and regional coordinate offsets. It does not
// replace player-control/VFX checks, boss phase runs or level-appropriate balance.
func TestRegionalBossesTakeClassSkillsAndRunesAtBodyContact(t *testing.T) {
	casts := []struct{ class, skill, rune string }{
		{"Fighter", "Whirlwind", ""}, {"Fighter", "Whirlwind", "whirlwind_bladestorm"},
		{"Fighter", "Shield Slam", ""},
		{"Cleric", "Radiant Strike", ""}, {"Cleric", "Radiant Strike", "radiantstrike_smite"},
		{"Wizard", "Fireball", ""}, {"Wizard", "Fireball", "fireball_magma"}, {"Wizard", "Fireball", "fireball_chain"},
		{"Rogue", "Piercing Throw", ""}, {"Rogue", "Piercing Throw", "piercingthrow_ricochet"},
	}
	for _, kind := range replayDungeonTypes {
		_, _, bosses := dungeonEncounterCatalog(kind)
		origin := fallbackDungeonLayout(kind).Rooms[0]
		for _, bossType := range bosses {
			for _, cast := range casts {
				t.Run(kind+"/"+bossType+"/"+cast.class+"/"+cast.skill+"/"+cast.rune, func(t *testing.T) {
					w := newTestWorld()
					instanceID := "regional-skill-matrix"
					w.storeDungeonInstance(instanceID, &DungeonInstance{ID: instanceID, Difficulty: DifficultyNormal, RunLevel: 100,
						Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: origin.X, Z: origin.Z, Width: 200, Height: 200}}}})
					w.spawnBossInInstance(bossType, origin.X, origin.Z, instanceID, DifficultyNormal)
					boss := findOnlyEnemyForInstance(t, w, instanceID)
					foreign := w.GetEntityCopy(boss.ID)
					foreign.ID, foreign.InstanceID = "foreign-boss", "other-instance"
					w.AddEntity(foreign)
					player := newTestPlayer("regional-caster", cast.class)
					player.Level = 100
					player.InstanceID = instanceID
					player.X, player.Z = boss.X-boss.ReplicatedBodyRadius()-player.ReplicatedBodyRadius()-0.05, boss.Z
					player.UnlockedSkills = []string{cast.skill}
					player.SkillRunes = map[string]string{cast.skill: cast.rune}
					player.Stats = Stats{Strength: 50, Dexterity: 50, Intelligence: 50, Wisdom: 50}
					w.AddEntity(player)
					manaBefore := player.Mana
					result := w.PerformAbility(player.ID, boss.X, boss.Z, boss.ID, cast.skill)
					if !result.Accepted {
						t.Fatalf("body-contact cast rejected: %+v", result)
					}
					if player.Mana >= manaBefore || result.CooldownRemaining <= 0 {
						t.Fatalf("cast failed to consume mana/cooldown: %+v", result)
					}
					for step := 0; step < 60 && boss.Health == boss.MaxHealth; step++ {
						projectiles := make([]*Entity, 0)
						for _, entity := range w.Entities {
							if entity.Type == TypeProjectile && entity.OwnerID == player.ID {
								projectiles = append(projectiles, entity)
							}
						}
						for _, projectile := range projectiles {
							deferred := &deferredActions{}
							w.updateEntity(projectile, 0.05, nil, deferred)
						}
					}
					if boss.Health >= boss.MaxHealth {
						t.Fatal("accepted skill never damaged the boss")
					}
					if foreign.Health != foreign.MaxHealth {
						t.Fatal("skill damaged a boss in another instance")
					}
				})
			}
		}
	}
}
