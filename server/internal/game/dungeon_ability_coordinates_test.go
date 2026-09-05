package game

import (
	"math"
	"testing"
)

// Handler acceptance near the origin cannot catch an accidental overworld
// clamp. Exercise every selectable skill inside a registered offset dungeon.
// This is a coordinate contract, not proof of encounter/rune/VFX correctness.
func TestSelectableAbilitiesPreserveDungeonCoordinateContext(t *testing.T) {
	const origin = 20000.0
	for class, skills := range selectableAbilityContract() {
		for _, skill := range skills {
			t.Run(class+"/"+skill, func(t *testing.T) {
				w := newTestWorld()
				player := newTestPlayer("dungeon-caster", class)
				player.InstanceID = "dungeon_ability_coordinates"
				player.X, player.Z = origin, origin
				player.Mana, player.MaxMana = 10000, 10000
				player.Health, player.MaxHealth = 100, 1000
				player.UnlockedSkills = []string{skill}
				player.Stats = Stats{Strength: 30, Dexterity: 30, Intelligence: 30, Wisdom: 30, Vitality: 30}
				w.InstanceLayouts[player.InstanceID] = &DungeonInstance{
					ID:     player.InstanceID,
					Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: origin, Z: origin, Width: 200, Height: 200}}},
				}
				w.AddEntity(player)
				target := &Entity{ID: "dungeon-target", InstanceID: player.InstanceID, Type: TypeEnemy, SubType: "Skeleton",
					X: origin + 1, Z: origin + 1, Health: 100000, MaxHealth: 100000, State: "IDLE", Scale: 1}
				w.AddEntity(target)
				result := w.PerformAbility(player.ID, target.X, target.Z, target.ID, skill)
				if !result.Accepted {
					t.Fatalf("valid dungeon cast rejected: %+v", result)
				}
				w.Mu.RLock()
				defer w.Mu.RUnlock()
				for _, entity := range w.Entities {
					entity.Mu.RLock()
					owned := entity.ID == player.ID || entity.OwnerID == player.ID
					wrongContext := entity.InstanceID != player.InstanceID || math.Abs(entity.X-origin) > 100 || math.Abs(entity.Z-origin) > 100
					id := entity.ID
					entity.Mu.RUnlock()
					if owned && wrongContext {
						t.Fatalf("cast displaced player or owned entity %q outside its dungeon context", id)
					}
				}
			})
		}
	}
}
