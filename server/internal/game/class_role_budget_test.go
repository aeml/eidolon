package game

import (
	"fmt"
	"testing"
)

// Prepared, attainable role rolls, not earned loot or a timed dungeon clear.
// Reuse the same item generator/affix selector as the accepted party fixtures.
func preparedRoleBudgetPlayer(t *testing.T, w *World, class string, level int) *Entity {
	t.Helper()
	p := newTestPlayer("role-"+class, class)
	w.AddEntity(p)
	if _, ok := w.SetPlayerLevel(p.ID, level); !ok {
		t.Fatal("level preparation failed")
	}
	armor := []string{"Silk Hood", "Robes", "Silk Skirt", "Sandals", "Silk Gloves", "Velvet Mantle", "Silk Sash"}
	if class == "Fighter" {
		armor = []string{"Iron Helm", "Plate Mail", "Plate Greaves", "Iron Boots", "Iron Gauntlets", "Steel Pauldrons", "Plated Girdle"}
	} else if class == "Rogue" {
		armor = []string{"Leather Cap", "Leather Tunic", "Leather Pants", "Leather Boots", "Leather Gloves", "Reinforced Spaulders", "Studded Belt"}
	}
	weapon := map[string]string{"Fighter": "Iron Sword", "Rogue": "Steel Dagger", "Wizard": "Wooden Staff", "Cleric": "Cleric Mace"}[class]
	offhand := "Spell Tome"
	if class == "Fighter" || class == "Rogue" {
		offhand = "Wooden Shield"
	}
	for _, name := range append(armor, weapon, offhand, "Gold Ring", "Pendant", "Amulet of Power", "Orb of Mana") {
		found := false
		for _, base := range BaseItems {
			if base.Name != name {
				continue
			}
			found = true
			rarity := RarityUncommon
			if base.Slot == "mainHand" || base.Slot == "offHand" || base.Slot == "chest" || base.Slot == "legs" || name == "Amulet of Power" {
				rarity = RarityRare
			}
			item := partyFixtureRoleItemAtLevel(t, base, rarity, partyFixturePrimaryStats[class], level)
			slot := base.Slot
			if slot == "ring" {
				slot = "ring1"
			}
			if slot == "trinket" {
				slot = "trinket1"
				if name == "Orb of Mana" {
					slot = "trinket2"
				}
			}
			p.Equipment[slot] = *item
			if slot == "ring1" {
				second := *item
				second.ID += "-second"
				p.Equipment["ring2"] = second
			}
			break
		}
		if !found {
			t.Fatalf("missing role item %s", name)
		}
	}
	if len(p.Equipment) != 14 {
		t.Fatal("incomplete role gear")
	}
	p.RecalculateStats()
	p.Health, p.Mana = p.MaxHealth, p.MaxMana
	return p
}

func TestPreparedFourClassRoleResourceBudgets(t *testing.T) {
	for _, level := range []int{30, 60, 70, 100} {
		t.Run(fmt.Sprint(level), func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			party := make(map[string]*Entity)
			for i, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
				p := preparedRoleBudgetPlayer(t, w, class, level)
				oldX, oldZ := p.X, p.Z
				p.X, p.Z = 60000, 60000+float64(i)*.5
				w.Grid.Update(p, oldX, oldZ)
				party[class] = p
			}
			tank := party["Fighter"]
			for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
				p := party[class]
				skill := map[string]string{"Fighter": "Shield Slam", "Rogue": "Piercing Throw", "Wizard": "Fireball", "Cleric": "Healing Light"}[class]
				p.UnlockedSkills = []string{skill}
				enemy := &Entity{ID: "budget-" + class, Type: TypeEnemy, SubType: "Skeleton", State: "IDLE", X: p.X + 3, Z: p.Z, Health: 1000000, MaxHealth: 1000000}
				w.AddEntity(enemy)
				target := enemy
				if class == "Cleric" {
					tank.Health = 1 // Measure actual healing without an overheal ceiling.
					target = tank
				}
				before, mana := target.Health, p.Mana
				result := w.PerformAbility(p.ID, target.X, target.Z, target.ID, skill)
				if !result.Accepted || p.Mana >= mana || result.CooldownRemaining <= 0 {
					t.Fatalf("%s role cast failed: %+v", class, result)
				}
				// Advance only emitted projectiles, not enemies, resource regen or
				// a fabricated campaign clock. Record actual damage, not a tooltip.
				for step := 0; step < 40 && target.Health == before; step++ {
					projectiles := []*Entity{}
					for _, entity := range w.Entities {
						if entity.Type == TypeProjectile && entity.OwnerID == p.ID {
							projectiles = append(projectiles, entity)
						}
					}
					for _, projectile := range projectiles {
						w.updateEntity(projectile, .05, nil, &deferredActions{})
					}
				}
				amount := before - target.Health
				if class == "Cleric" {
					amount = -amount
				}
				cost := mana - p.Mana
				if amount <= 0 || cost <= 0 || p.HpRegen <= 0 || p.ManaRegen <= 0 {
					t.Fatalf("%s did not deliver its role", class)
				}
				t.Logf("%s: HP=%d MP=%d armor=%d basic=%d/%.2fs %s amount=%d cost=%d cooldown=%.2fs casts/bar=%d regenMP/s=%.2f empty-to-cast=%.1fs threat=%.0f",
					class, p.MaxHealth, p.MaxMana, p.Defense, p.Damage, p.AttackSpeed, skill, amount, cost, result.CooldownRemaining, mana/cost, p.ManaRegen, float64(cost)/p.ManaRegen, enemy.Threat[p.ID])
				w.RemoveEntity(enemy.ID)
			}
		})
	}
}
