package game

import (
	"math"
	"strings"
	"testing"
)

func TestDungeonPatternsHaveDifferentSafePositionsAndExactEdges(t *testing.T) {
	for _, tc := range []struct {
		boss                     string
		count                    int
		safeX, safeZ, hitX, hitZ float64
	}{
		{"GravenColossus", 3, 10, 10, 20, 0},
		{"TideboundTyrant", 1, 0, 20, 4, 0},
		{"AshenImperator", 3, 14, 0, 0, 17},
		{"TempestSovereign", 6, 0, 0, 22, 0},
		{"UmbraPrime", 1, 25, 0, 0, 0},
	} {
		boss := &Entity{SubType: tc.boss, X: 60000, Z: 60000, Scale: 4}
		circles, hint := dungeonBossImpactPattern(boss, 60004, 60000)
		if len(circles) != tc.count || hint == "" || insideBossImpactPattern(60000+tc.safeX, 60000+tc.safeZ, circles) || !insideBossImpactPattern(60000+tc.hitX, 60000+tc.hitZ, circles) {
			t.Fatalf("%s pattern has no intended escape/hit: %+v", tc.boss, circles)
		}
		for _, circle := range circles {
			if !insideBossImpactPattern(circle.X+circle.Radius, circle.Z, []bossImpactCircle{circle}) || insideBossImpactPattern(circle.X+circle.Radius+.01, circle.Z, []bossImpactCircle{circle}) {
				t.Fatal("hit footprint disagrees with displayed radius")
			}
			if math.IsNaN(circle.X) || circle.Radius <= 0 {
				t.Fatal("invalid telegraph")
			}
		}
	}
}

// Short real AI/impact observation with a four-role prepared party, not a
// dungeon-clear receipt. Full earned campaign runs remain final stabilization.
func TestDungeonFissurePreparedPartyCanMoveOutBeforeActualImpact(t *testing.T) {
	w := newTestWorld()
	t.Cleanup(w.StopBackground)
	const instanceID = "prepared-fissure"
	w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Difficulty: DifficultyNormal, RunLevel: 30}
	w.spawnBossInInstance("RootboundWarden", 60000, 60000, instanceID, DifficultyNormal)
	boss := findOnlyEnemyForInstance(t, w, instanceID)
	players := make([]*Entity, 0, 4)
	before := make([]int, 0, 4)
	for _, class := range []string{"Fighter", "Cleric", "Wizard", "Rogue"} {
		p := newTestPlayer("prepared-"+class, class)
		w.AddEntity(p)
		w.SetPlayerLevel(p.ID, 30)
		p.Equipment = make(map[string]Item)
		armor := []string{"Silk Hood", "Robes", "Silk Skirt", "Sandals", "Silk Gloves", "Velvet Mantle", "Silk Sash"}
		if class == "Fighter" {
			armor = []string{"Iron Helm", "Plate Mail", "Plate Greaves", "Iron Boots", "Iron Gauntlets", "Steel Pauldrons", "Plated Girdle"}
		}
		if class == "Rogue" {
			armor = []string{"Leather Cap", "Leather Tunic", "Leather Pants", "Leather Boots", "Leather Gloves", "Reinforced Spaulders", "Studded Belt"}
		}
		weapon := map[string]string{"Fighter": "Iron Sword", "Rogue": "Steel Dagger", "Wizard": "Wooden Staff", "Cleric": "Cleric Mace"}[class]
		offhand := "Spell Tome"
		if class == "Fighter" || class == "Rogue" {
			offhand = "Wooden Shield"
		}
		names := append(armor, weapon, offhand, "Gold Ring", "Pendant", "Amulet of Power", "Orb of Mana")
		for _, name := range names {
			for _, base := range BaseItems {
				if base.Name == name {
					rarity := RarityUncommon
					if base.Slot == "mainHand" || base.Slot == "offHand" || base.Slot == "chest" || base.Slot == "legs" || name == "Amulet of Power" {
						rarity = RarityRare
					}
					item := partyFixtureRoleItem(t, base, rarity, partyFixturePrimaryStats[class])
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
			}
		}
		if len(p.Equipment) != 14 {
			t.Fatalf("incomplete prepared %s equipment: %d", class, len(p.Equipment))
		}
		p.RecalculateStats()
		p.Health = p.MaxHealth
		p.InstanceID, p.X, p.Z = instanceID, 60002, 60000
		players = append(players, p)
		before = append(before, p.Health)
		if len(players) == 1 {
			w.CreateParty(p.ID)
		} else if err := w.JoinParty(players[0].PartyID, p.ID); err != nil {
			t.Fatal(err)
		}
	}
	telegraphs := make([]TelegraphEvent, 0, 3)
	tankHits := 0
	w.OnEvent = func(kind string, value interface{}) {
		if kind == "telegraph" {
			telegraphs = append(telegraphs, value.(TelegraphEvent))
		}
		if kind == "damage" && value.(DamageEvent).TargetID == players[0].ID {
			tankHits++
		}
	}
	w.updateEntity(boss, .033, players, &deferredActions{})
	if len(telegraphs) != 3 || telegraphs[0].Silent || !telegraphs[1].Silent || !strings.Contains(telegraphs[0].Hint, "sideways") {
		t.Fatalf("missing one-callout fissure warning: %+v", telegraphs)
	}
	// The healer, mage and rogue leave through the marked line's side. The
	// geared tank deliberately stays in two overlapping circles: only one hit.
	for i, p := range players {
		p.Mu.Lock()
		if i == 0 {
			p.X = 60005
		} else {
			p.Z += 15
		}
		p.Mu.Unlock()
	}
	w.backgroundWork.SealWhenIdle()
	w.StopBackground()
	if tankHits != 1 {
		t.Fatalf("overlapping fissures caused %d hits, want one", tankHits)
	}
	for i, p := range players {
		if i == 0 && (p.Health >= before[i] || p.Health <= 0) {
			t.Fatal("prepared tank should take and survive the impact")
		}
		if i > 0 && p.Health != before[i] {
			t.Fatalf("%s was hit outside the advertised footprint", p.SubType)
		}
	}
}
