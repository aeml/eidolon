package game

import (
	"os"
	"sync"
	"testing"
	"time"
)

// A bounded real-clock observation, opt-in to avoid adding repeated waiting to
// every CI run. Prepared gear and stationary controls do not prove a full clear.
func TestPreparedFourRoleCombatWindow(t *testing.T) {
	if os.Getenv("EIDOLON_ROLE_COMBAT_WINDOW") != "1" {
		t.Skip("explicit short party role observation only")
	}
	w := newTestWorld()
	defer w.StopBackground()
	const instance = "role-window"
	w.InstanceLayouts[instance] = &DungeonInstance{ID: instance, Difficulty: DifficultyNormal, RunLevel: 30,
		Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: 60000, Z: 60000, Width: 80, Height: 80}}}}
	w.spawnBossInInstance("RootboundWarden", 60000, 60000, instance, DifficultyNormal)
	boss := findOnlyEnemyForInstance(t, w, instance)
	players := []*Entity{}
	for i, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		p := preparedRoleBudgetPlayer(t, w, class, 30)
		if _, ok := w.PerformSelectBranch(p.ID, "A"); !ok {
			t.Fatal("normal specialization selection failed")
		}
		oldX, oldZ := p.X, p.Z
		p.InstanceID, p.X, p.Z = instance, 60002+float64(i)*2, 60000
		w.Grid.Update(p, oldX, oldZ)
		players = append(players, p)
	}
	party := w.CreateParty(players[0].ID)
	for _, player := range players[1:] {
		if err := w.JoinParty(party.ID, player.ID); err != nil {
			t.Fatal(err)
		}
	}
	var mu sync.Mutex
	damage, received, healing := map[string]int{}, map[string]int{}, map[string]int{}
	w.OnEvent = func(kind string, data interface{}) {
		mu.Lock()
		defer mu.Unlock()
		switch event := data.(type) {
		case DamageEvent:
			if event.TargetID == boss.ID {
				damage[event.SourceID] += event.Amount
			} else {
				received[event.TargetID] += event.Amount
			}
		case HealEvent:
			healing[event.SourceID] += event.Amount
		}
	}
	start, last := time.Now(), time.Now()
	for time.Since(start) < 12*time.Second {
		now := time.Now()
		w.Update(now.Sub(last).Seconds())
		last = now
		boss.Mu.RLock()
		bx, bz, alive := boss.X, boss.Z, boss.Health > 0
		boss.Mu.RUnlock()
		if !alive {
			break
		}
		for _, p := range players {
			if p.SubType != "Fighter" && time.Since(start) < time.Second {
				continue // Give the tank one opener, not an artificial threat grant.
			}
			if p.SubType == "Cleric" {
				var injured *Entity
				missing := 0
				for _, ally := range players {
					ally.Mu.RLock()
					loss := ally.MaxHealth - ally.Health
					living := ally.Health > 0 && ally.State != "DEAD"
					ally.Mu.RUnlock()
					if living && loss > missing {
						injured, missing = ally, loss
					}
				}
				if injured != nil && missing > 20 {
					injured.Mu.RLock()
					x, z := injured.X, injured.Z
					injured.Mu.RUnlock()
					w.PerformAbility(p.ID, x, z, injured.ID, "Healing Light")
				}
			} else {
				skills := map[string][]string{"Fighter": {"Shield Slam", "Whirlwind", "Iron Fortress"}, "Rogue": {"Piercing Throw"}, "Wizard": {"Fireball"}}[p.SubType]
				for _, skill := range skills {
					if result := w.PerformAbility(p.ID, bx, bz, boss.ID, skill); result.Accepted {
						break
					}
				}
				w.PerformAttack(p.ID, boss.ID)
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	w.StopBackground()
	mu.Lock()
	defer mu.Unlock()
	for _, p := range players {
		p.Mu.RLock()
		t.Logf("%s damage=%d received=%d healing=%d HP=%d/%d MP=%d/%d", p.SubType, damage[p.ID], received[p.ID], healing[p.ID], p.Health, p.MaxHealth, p.Mana, p.MaxMana)
		p.Mu.RUnlock()
		if p.SubType == "Cleric" {
			if healing[p.ID] <= 0 {
				t.Error("healer made no effective contribution")
			}
		} else if damage[p.ID] <= 0 {
			t.Errorf("%s dealt no actual damage", p.SubType)
		}
	}
	if received[players[0].ID] <= 0 {
		t.Error("tank was never under pressure")
	}
}
