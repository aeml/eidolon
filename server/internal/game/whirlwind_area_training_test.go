package game

import (
	"fmt"
	"math"
	"testing"
	"time"
)

func TestWhirlwindAreaTrainingReachesPaidPulseTargets(t *testing.T) {
	for _, rank := range []int{0, 1, 5} {
		for _, generic := range []int{0, 5} {
			for _, runeID := range []string{"", "whirlwind_extended"} {
				t.Run(fmt.Sprintf("rank%d/general%d/%s", rank, generic, runeID), func(t *testing.T) {
					w, p, edge := directSkillWallFixture("Fighter", true)
					defer w.StopBackground()
					p.Level, p.UnlockedSkills = 100, []string{"Whirlwind"}
					p.BaseStats = InitialPlayerStats()
					p.BaseStats.Strength = 100
					p.TalentRanks = map[string]int{"FTR_04": rank, "FTR_33": generic, "FTR_38": generic}
					p.SkillRunes = map[string]string{"Whirlwind": runeID}
					p.RecalculateStats()
					p.Mana = p.MaxMana
					want := 6 * (1 + .02*float64(rank) + .05*float64(generic))
					oldX, oldZ := edge.X, edge.Z
					edge.X, edge.Z, edge.Radius = p.X, p.Z+want+.5-.001, .5
					w.Grid.Update(edge, oldX, oldZ)
					outside := &Entity{ID: "area-outside", Type: TypeEnemy, InstanceID: p.InstanceID,
						X: p.X, Z: p.Z - want - .5 - .001, Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
					center := &Entity{ID: "area-center", Type: TypeEnemy, InstanceID: p.InstanceID,
						X: p.X - .5, Z: p.Z, Radius: .5, State: "IDLE", Health: 10000, MaxHealth: 10000}
					w.AddEntity(outside)
					w.AddEntity(center)
					var accepted *AbilityEvent
					w.OnEvent = func(kind string, payload interface{}) {
						if event, ok := payload.(AbilityEvent); kind == "ability" && ok {
							accepted = &event
						}
					}
					mana, started := p.Mana, time.Now()
					result := w.PerformAbility(p.ID, p.X, p.Z, "", "Whirlwind")
					if !result.Accepted || p.Mana != mana-30 || center.Health >= 10000 {
						t.Fatalf("paid cast/positive pulse control failed: result=%+v mana=%d center=%d", result, p.Mana, center.Health)
					}
					if edge.Health >= 10000 || outside.Health != 10000 {
						t.Errorf("trained radius %.3f not consumed: edge=%d outside=%d", want, edge.Health, outside.Health)
					}
					if accepted == nil || math.Abs(accepted.Radius-want) > 1e-8 || accepted.Arc != 2*math.Pi || accepted.TargetX != p.X || accepted.TargetZ != p.Z {
						t.Fatalf("accepted cast lost footprint: %+v", accepted)
					}
					wantCooldown := 8 * (1 - p.CooldownReduction) * (1 - .03*float64(rank))
					if got := p.Cooldowns["Whirlwind"].Sub(started).Seconds(); got < wantCooldown || got > wantCooldown+.1 {
						t.Errorf("ordinary Technique cooldown changed: got=%v want=%v", got, wantCooldown)
					}
					// A live cast keeps its original footprint, whether later training
					// would make it smaller or larger. No new cast or readiness grant.
					p.TalentRanks = map[string]int{"FTR_04": 5 - rank, "FTR_33": 5 - generic, "FTR_38": 5 - generic}
					before := edge.Health
					w.updateWhirlwind(p, p.WhirlwindStartTime.Add(500*time.Millisecond), nil)
					if edge.Health >= before || outside.Health != 10000 {
						t.Errorf("later pulse lost cast-time footprint: edge=%d before=%d outside=%d", edge.Health, before, outside.Health)
					}
					w.updateWhirlwind(p, p.WhirlwindEndTime, nil)
					if p.WhirlwindActive || p.WhirlwindRadius != 0 {
						t.Fatal("expired cast retained area")
					}
				})
			}
		}
	}
}

func TestWhirlwindAreaLegacyAndInvalidSnapshots(t *testing.T) {
	for _, value := range []float64{0, -1, 5.9, 8.2, math.NaN(), math.Inf(1), math.Inf(-1)} {
		p := &Entity{WhirlwindRadius: value}
		if p.WhirlwindAreaRadius() != 6 {
			t.Errorf("invalid radius %v did not use baseline", value)
		}
	}
}

func TestWhirlwindAreaOrdinaryPurchaseAndBroadcastCopies(t *testing.T) {
	w, p, _ := directSkillWallFixture("Fighter", true)
	defer w.StopBackground()
	p.Level, p.UnlockedSkills = 100, []string{"Whirlwind"}
	p.TalentRanks = nil
	p.recomputeTalentPoints()
	available := p.TalentPoints
	for rank := 1; rank <= 5; rank++ {
		if _, ok, reason := w.PerformUnlockTalent(p.ID, "FTR_04"); !ok {
			t.Fatalf("purchase %d: %s", rank, reason)
		}
		if p.TalentRanks["FTR_04"] != rank || p.TalentPoints != available-rank {
			t.Fatal("purchase changed saved ID or point cost")
		}
	}
	if _, ok, _ := w.PerformUnlockTalent(p.ID, "FTR_04"); ok || p.TalentPoints != available-5 {
		t.Fatal("sixth rank spent points")
	}
	p.Mana = p.MaxMana
	if !w.PerformAbility(p.ID, p.X, p.Z, "", "Whirlwind").Accepted {
		t.Fatal("paid cast rejected")
	}
	for _, copied := range []*Entity{w.GetEntityCopy(p.ID), w.copyEntity(p), w.GetState()[p.ID]} {
		if math.Abs(copied.WhirlwindRadius-6.6) > 1e-8 {
			t.Fatal("purchased radius lost in broadcast")
		}
		if copied.WhirlwindHitTargets != nil || copied.WhirlwindDamageBudget != 0 {
			t.Fatal("broadcast leaked private pulse state")
		}
	}
}

func TestWhirlwindTrainedAreaStillRequiresDungeonLineOfSight(t *testing.T) {
	w, p, blocked := directSkillWallFixture("Fighter", false)
	defer w.StopBackground()
	p.UnlockedSkills = []string{"Whirlwind"}
	p.TalentRanks = map[string]int{"FTR_04": 5, "FTR_33": 5, "FTR_38": 5}
	p.SkillRunes = map[string]string{"Whirlwind": "whirlwind_extended"}
	before := blocked.Health
	if !w.PerformAbility(p.ID, p.X, p.Z, "", "Whirlwind").Accepted {
		t.Fatal("cast rejected")
	}
	if math.Abs(p.WhirlwindRadius-8.1) > 1e-8 {
		t.Fatal("not a fully trained cast")
	}
	for i := 1; i < 4; i++ {
		w.updateWhirlwind(p, p.WhirlwindStartTime.Add(time.Duration(i)*500*time.Millisecond), nil)
	}
	if blocked.Health != before {
		t.Fatal("trained footprint crossed dungeon wall")
	}
}
