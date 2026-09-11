package game

import (
	"fmt"
	"testing"
)

func TestTeleportWarpTrainingAtBothEndpoints(t *testing.T) {
	for _, trained := range []bool{false, true} {
		for _, rune := range []string{"", "teleport_warp"} {
			t.Run(fmt.Sprintf("trained%v/rune%s", trained, rune), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("warp-caster", "Wizard")
				p.Level, p.InstanceID, p.X, p.Z = 100, "warp-training", 60000, 60000
				p.Stats.Intelligence = 10
				p.SpellFocusActive = true
				p.SpellFocusMultiplier = 3
				p.UnlockedSkills, p.SkillRunes = []string{"Teleport"}, map[string]string{"Teleport": rune}
				if trained {
					p.TalentRanks = map[string]int{"WIZ_19": 5, "WIZ_36": 5, "WIZ_38": 5}
				}
				w.AddEntity(p)
				for _, offset := range []float64{0, 12} {
					for _, distance := range []float64{3, 5.75, 6.3} {
						e := &Entity{ID: fmt.Sprintf("enemy-%v-%v", offset, distance), Type: TypeEnemy,
							SubType: "Skeleton", InstanceID: p.InstanceID, X: p.X + offset, Z: p.Z + distance,
							Scale: 1, State: "IDLE", Health: 2000, MaxHealth: 2000}
						w.AddEntity(e)
					}
				}
				mana := p.Mana
				result := w.PerformAbility(p.ID, p.X+12, p.Z, "", "Teleport")
				if !result.Accepted || p.Mana != mana-40 || p.X != 60012 || p.Z != 60000 {
					t.Fatalf("paid teleport failed: %+v at %v,%v mana%d", result, p.X, p.Z, p.Mana)
				}
				if !p.SpellFocusActive {
					t.Fatal("utility rune consumed Spell Focus")
				}
				if p.SpellFocusMultiplier != 3 {
					t.Fatal("utility rune changed the trained Focus charge")
				}
				for _, offset := range []float64{0, 12} {
					for _, distance := range []float64{3, 5.75, 6.3} {
						e := w.GetEntity(fmt.Sprintf("enemy-%v-%v", offset, distance))
						want := 0
						if rune != "" && (distance == 3 || (trained && distance == 5.75)) {
							want = 25
							if trained {
								want = 30
							}
						}
						if got := e.MaxHealth - e.Health; got != want {
							t.Errorf("endpoint%v distance%v damage%d want%d", offset, distance, got, want)
						}
						if e.Threat[p.ID] != float64(want) {
							t.Errorf("endpoint%v distance%v threat%v want%d", offset, distance, e.Threat[p.ID], want)
						}
					}
				}
			})
		}
	}
}

func TestTeleportWarpCannotDamageThroughDungeonWalls(t *testing.T) {
	for _, burstZ := range []float64{60000, 60008} {
		for _, doorway := range []bool{false, true} {
			t.Run(fmt.Sprintf("burst%v/doorway%v", burstZ, doorway), func(t *testing.T) {
				w := newTestWorld()
				defer w.StopBackground()
				p := newTestPlayer("warp-wall-caster", "Wizard")
				p.Level, p.InstanceID, p.X, p.Z = 100, "warp-wall", 60009, 60000
				p.Stats.Intelligence = 10
				p.UnlockedSkills, p.SkillRunes = []string{"Teleport"}, map[string]string{"Teleport": "teleport_warp"}
				rects := []DungeonWalkRect{{X: 60000, Z: 60000, Width: 20, Height: 30},
					{X: 60022, Z: 60000, Width: 20, Height: 30}}
				if doorway {
					rects = append(rects, DungeonWalkRect{X: 60011, Z: burstZ, Width: 4, Height: 4})
				}
				w.storeDungeonInstance(p.InstanceID, &DungeonInstance{Layout: DungeonLayout{WalkRects: rects}})
				w.AddEntity(p)
				e := &Entity{ID: "across-wall", Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
					X: 60012, Z: burstZ, Scale: 1, State: "IDLE", Health: 2000, MaxHealth: 2000}
				w.AddEntity(e)
				if result := w.PerformAbility(p.ID, p.X, p.Z+8, "", "Teleport"); !result.Accepted {
					t.Fatalf("in-room teleport rejected: %+v", result)
				}
				want := 0
				if doorway {
					want = 25
				}
				if got := e.MaxHealth - e.Health; got != want || e.Threat[p.ID] != float64(want) {
					t.Fatalf("wall damage%d threat%v want%d", got, e.Threat[p.ID], want)
				}
			})
		}
	}
}

func TestTeleportWarpOverlapAndExcludedTargets(t *testing.T) {
	w := newTestWorld()
	defer w.StopBackground()
	p := newTestPlayer("warp-overlap", "Wizard")
	p.Level, p.InstanceID, p.X, p.Z = 100, "warp-overlap", 60000, 60000
	p.Stats.Intelligence = 10
	p.TalentRanks = map[string]int{"WIZ_19": 5}
	p.UnlockedSkills, p.SkillRunes = []string{"Teleport"}, map[string]string{"Teleport": "teleport_warp"}
	w.AddEntity(p)
	for _, id := range []string{"enemy", "friendly", "dead", "other-instance"} {
		e := &Entity{ID: id, Type: TypeEnemy, SubType: "Skeleton", InstanceID: p.InstanceID,
			X: p.X + 3, Z: p.Z, Scale: 1, State: "IDLE", Health: 2000, MaxHealth: 2000}
		switch id {
		case "friendly":
			e.Type, e.SubType = TypePlayer, "Cleric"
		case "dead":
			e.State = "DEAD"
		case "other-instance":
			e.InstanceID = "another-warp"
		}
		w.AddEntity(e)
	}
	if result := w.PerformAbility(p.ID, p.X+6, p.Z, "", "Teleport"); !result.Accepted {
		t.Fatalf("overlap cast rejected: %+v", result)
	}
	for _, id := range []string{"enemy", "friendly", "dead", "other-instance"} {
		e := w.GetEntity(id)
		want := 0
		if id == "enemy" {
			want = 60 // One30damage impact at each endpoint, never a compounded buff.
		}
		if got := e.MaxHealth - e.Health; got != want || e.Threat[p.ID] != float64(want) {
			t.Errorf("%s damage%d threat%v want%d", id, got, e.Threat[p.ID], want)
		}
	}
}
