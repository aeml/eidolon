package game

import (
	"fmt"
	"math"
	"testing"
)

func TestShatteringChargePaidImpactTrainingAndBodyEdge(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		t.Run(fmt.Sprint(rank), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", true)
			defer w.StopBackground()
			w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: []DungeonWalkRect{
				{X: 50000, Z: 50000, Width: 500, Height: 500},
			}}})
			p.Level, p.UnlockedSkills, p.Mana, p.Damage, p.CritChanceBonus = 100, []string{"Shattering Charge"}, 1000, 100, 0
			p.TalentRanks = map[string]int{"FTR_21": rank, "FTR_22": rank, "FTR_33": rank, "FTR_38": rank}
			startX, endX := p.X, p.X+20
			radius := 16 * (1 + .07*float64(rank))
			oldX := target.X
			target.X = endX + radius + entityVisualRadius(target) - .001
			w.Grid.Update(target, oldX, target.Z)
			outside := &Entity{ID: "shattering-outside", Type: TypeEnemy, InstanceID: p.InstanceID,
				X: target.X + .002, Z: target.Z, State: "IDLE", Scale: target.Scale, Health: 10000, MaxHealth: 10000}
			w.AddEntity(outside)
			if result := w.PerformAbility(p.ID, endX, p.Z, "", "Shattering Charge"); !result.Accepted || p.Mana != 970 {
				t.Fatalf("paid cast failed: %+v mana=%d", result, p.Mana)
			}
			w.updateEntity(p, .1, nil, &deferredActions{})
			if math.Abs(p.X-startX-5) > 1e-8 || target.Health != 10000 || target.ArmorReduction != 0 {
				t.Fatal("travel moved at the wrong speed or applied an early impact")
			}
			w.updateEntity(p, .3, nil, &deferredActions{})
			want := int(float64(p.Damage) * 1.5 * 1.3 * (1 + .04*float64(rank) + .02*float64(rank)))
			if p.IsCharging || p.X != endX || 10000-target.Health != want || target.ArmorReduction != 5 {
				t.Fatalf("impact charging=%v position=%v damage=%d want=%d armorBreak=%d", p.IsCharging, p.X, 10000-target.Health, want, target.ArmorReduction)
			}
			if outside.Health != 10000 || outside.ArmorReduction != 0 {
				t.Fatal("impact exceeded trained radius plus recipient body edge")
			}
		})
	}
}

func TestChargeImpactCannotDamageOrBreakArmorAcrossDungeonWall(t *testing.T) {
	for _, skill := range []string{"Charge", "Shattering Charge"} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/doorway%v", skill, doorway), func(t *testing.T) {
				w, p, target := directSkillWallFixture("Fighter", doorway)
				defer w.StopBackground()
				p.UnlockedSkills, p.Mana = []string{skill}, 1000
				if result := w.PerformAbility(p.ID, target.X, target.Z, "", skill); !result.Accepted {
					t.Fatalf("charge should travel up to its legal landing: %+v", result)
				}
				w.updateEntity(p, 1, nil, &deferredActions{})
				if p.IsCharging || (target.Health < 10000) != doorway || (target.ArmorReduction > 0) != (doorway && skill == "Shattering Charge") {
					t.Fatalf("wall impact charging=%v HP=%d armorBreak=%d", p.IsCharging, target.Health, target.ArmorReduction)
				}
			})
		}
	}
}

func TestChargeShockwaveCannotPushAcrossDungeonWall(t *testing.T) {
	for _, doorway := range []bool{false, true} {
		t.Run(fmt.Sprint(doorway), func(t *testing.T) {
			w, p, target := directSkillWallFixture("Fighter", doorway)
			defer w.StopBackground()
			p.Level, p.UnlockedSkills, p.Mana = 100, []string{"Charge"}, 1000
			p.SkillRunes = map[string]string{"Charge": "charge_shockwave"}
			before := target.X
			if result := w.PerformAbility(p.ID, p.X, p.Z, "", "Charge"); !result.Accepted {
				t.Fatalf("paid shockwave rejected: %+v", result)
			}
			w.updateEntity(p, .1, nil, &deferredActions{})
			want := before
			if doorway {
				want += 4
			}
			if math.Abs(target.X-want) > 1e-8 {
				t.Fatalf("shockwave x=%v want=%v", target.X, want)
			}
		})
	}
}
