package game

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDungeonBossBodyContactAllowsRealMeleeAttacks(t *testing.T) {
	bosses := []string{
		"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel",
		"Cindermaw", "ScorchedTwins", "ForgemasterPyrax", "ObsidianGuardian", "LordInfernax",
		"Windshear", "Stormcallers", "RocMatriarch", "ThunderlordKaelix", "Zephyrion",
		"TiderendLeviathan", "DrownedChoir", "AbyssalGoliath", "MaelstromWarden", "Thalorath",
		"DissonantHerald", "NullArchitect", "EidolonDevourer", "UmbraPrime",
		"GravenColossus", "TideboundTyrant", "AshenImperator", "TempestSovereign",
	}
	for _, bossType := range bosses {
		for _, class := range []string{"Fighter", "Cleric"} {
			t.Run(bossType+"/"+class, func(t *testing.T) {
				w := NewWorld(nil)
				w.InstanceLayouts["boss-contact"] = &DungeonInstance{ID: "boss-contact", Difficulty: DifficultyNormal, RunLevel: 30}
				w.spawnBossInInstance(bossType, 20000, 20000, "boss-contact", DifficultyNormal)
				boss := findOnlyEnemyForInstance(t, w, "boss-contact")
				player := newTestPlayer("contact-player", class)
				player.InstanceID = "boss-contact"
				player.X = boss.X - boss.ReplicatedBodyRadius() - player.ReplicatedBodyRadius() - 0.05
				player.Z = boss.Z
				player.AttackCooldown = 0
				w.AddEntity(player)
				damage := make(chan struct{}, 1)
				w.OnEvent = func(kind string, _ interface{}) {
					if kind == "damage" {
						damage <- struct{}{}
					}
				}
				if _, accepted := w.PerformAttack(player.ID, boss.ID); !accepted {
					t.Fatal("melee attack rejected at the replicated collision boundary")
				}
				select {
				case <-damage:
				case <-time.After(2 * time.Second):
					t.Fatal("accepted attack did not resolve damage")
				}
				boss.Mu.RLock()
				defer boss.Mu.RUnlock()
				if boss.Health >= boss.MaxHealth {
					t.Fatal("real attack did not reduce boss health")
				}
			})
		}
	}
}

func TestBodyRadiusSurvivesBothEntitySnapshotPaths(t *testing.T) {
	w := NewWorld(nil)
	for _, explicit := range []float64{0, 2.75} {
		e := &Entity{ID: "body-copy", Type: TypeEnemy, Scale: 4, Radius: explicit}
		w.AddEntity(e)
		want := 5.0
		if explicit > 0 {
			want = explicit
		}
		for _, snapshot := range []*Entity{w.GetEntityCopy(e.ID), w.copyEntity(e)} {
			if snapshot.BodyRadius != want || snapshot.ReplicatedBodyRadius() != want {
				t.Fatalf("lost authoritative body radius: got=%f want=%f", snapshot.BodyRadius, want)
			}
			encoded, err := json.Marshal(snapshot)
			if err != nil {
				t.Fatal(err)
			}
			var wire struct {
				BodyRadius float64 `json:"bodyRadius"`
			}
			if err := json.Unmarshal(encoded, &wire); err != nil || wire.BodyRadius != want {
				t.Fatalf("JSON body radius=%f err=%v", wire.BodyRadius, err)
			}
		}
	}
}

func TestFighterDungeonSkillsDamageLargeBossesAtBodyContact(t *testing.T) {
	for _, bossType := range []string{"RootboundWarden", "BriarMatron", "RustboundColossus", "HollowSentinel"} {
		for _, skill := range []string{"Whirlwind", "Shield Slam"} {
			t.Run(bossType+"/"+skill, func(t *testing.T) {
				w := NewWorld(nil)
				instanceID := "dungeon_skill_contact"
				w.storeDungeonInstance(instanceID, &DungeonInstance{ID: instanceID, Difficulty: DifficultyNormal, RunLevel: 30})
				w.spawnBossInInstance(bossType, 20000, 20000, instanceID, DifficultyNormal)
				boss := findOnlyEnemyForInstance(t, w, instanceID)
				player := newTestPlayer("contact-fighter", "Fighter")
				player.InstanceID = instanceID
				player.UnlockedSkills = []string{skill}
				player.X = boss.X - boss.ReplicatedBodyRadius() - player.ReplicatedBodyRadius() - 0.05
				player.Z = boss.Z
				w.AddEntity(player)
				result := w.PerformAbility(player.ID, boss.X, boss.Z, boss.ID, skill)
				if !result.Accepted || boss.Health >= boss.MaxHealth {
					t.Fatalf("body-contact skill failed: accepted=%v reason=%s health=%d/%d", result.Accepted, result.Reason, boss.Health, boss.MaxHealth)
				}
			})
		}
	}
}
