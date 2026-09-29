package game

import (
	"fmt"
	"testing"
	"time"
)

func TestDungeonProgressionReceiptsMatchActualGrants(t *testing.T) {
	for _, mode := range []string{"solo-30", "solo-99", "solo-100", "party", "room"} {
		t.Run(mode, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			instanceID := "receipt-instance"
			layout := DungeonLayout{Rooms: []DungeonRoom{{Type: "normal", Width: 40, Height: 40}}}
			w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Layout: layout,
				Difficulty: DifficultyNormal, DungeonType: "tempest_spire", RunLevel: 100,
				RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
			players := []*Entity{}
			levels := map[string]int{}
			before := map[string]int{}
			for _, level := range []int{30, 99, 100} {
				if mode != "party" && mode != "room" && mode != fmt.Sprintf("solo-%d", level) {
					continue
				}
				p := newTestPlayer(fmt.Sprintf("receipt-%d", level), "Fighter")
				p.Level, p.MaxExperience = level, experienceRequiredForLevel(level)
				p.Experience = 0
				if level == 99 {
					p.Experience = p.MaxExperience - 50
				}
				p.ResonanceXP = ResonanceXPPerLevel - 25
				p.Inventory = make([]Item, MaxInventorySize)
				p.InstanceID = instanceID
				w.AddEntity(p)
				players = append(players, p)
				levels[p.ID], before[p.ID] = level, p.ResonanceXP
			}
			if mode == "party" {
				party := w.CreateParty(players[0].ID)
				for _, p := range players[1:] {
					if err := w.JoinParty(party.ID, p.ID); err != nil {
						t.Fatal(err)
					}
				}
			}
			type receipt struct {
				id       string
				total    int
				progress *ExperienceRewardReceipt
			}
			rewards := make(chan receipt, len(players))
			record := func(r receipt) {
				select {
				case rewards <- r:
				default:
					t.Errorf("unexpected extra reward summary: %+v", r)
				}
			}
			w.OnEvent = func(kind string, value interface{}) {
				if kind == "reward_summary" {
					r := value.(RewardSummaryEvent)
					record(receipt{r.PlayerID, r.XP, r.Progression})
				} else if kind == "room_clear_reward" {
					r := value.(DungeonRoomClearRewardEvent)
					record(receipt{r.PlayerID, r.XP, r.Progression})
				}
			}
			if mode == "room" {
				w.MarkDungeonRoomCleared(instanceID, 0)
			} else {
				// Keep this room occupied: this case measures the boss grant,
				// not a race between boss and automatic room-clear rewards.
				// The separate room case above checks the room grant itself.
				w.AddEntity(&Entity{ID: "receipt-room-guard", Type: TypeEnemy,
					SubType: "Goblin", Level: 100, Health: 100, MaxHealth: 100,
					State: "IDLE", InstanceID: instanceID})
				boss := &Entity{ID: "receipt-boss", Type: TypeEnemy, SubType: "RootboundWarden",
					Level: 100, Health: 1, MaxHealth: 1, State: "IDLE", InstanceID: instanceID}
				w.AddEntity(boss)
				boss.Mu.Lock()
				w.handleDeath(boss, players[0], nil)
				boss.Mu.Unlock()
			}
			seen := map[string]bool{}
			for range players {
				select {
				case r := <-rewards:
					if seen[r.id] || r.progress == nil || r.total <= 0 {
						t.Fatalf("missing or duplicate actual receipt: %+v", r)
					}
					seen[r.id] = true
					wantXP := r.total
					if levels[r.id] == 99 {
						wantXP = min(50, r.total)
					}
					if levels[r.id] == 100 {
						wantXP = 0
					}
					p := w.GetEntity(r.id)
					p.Mu.RLock()
					gained := p.ResonanceLevel*ResonanceXPPerLevel + p.ResonanceXP - before[r.id]
					p.Mu.RUnlock()
					if r.progress.XP != wantXP || r.progress.ResonanceXP != r.total-wantXP || gained != r.progress.ResonanceXP {
						t.Fatalf("receipt=%+v total=%d actual resonance=%d expected ordinary=%d", r.progress, r.total, gained, wantXP)
					}
				case <-time.After(5 * time.Second):
					t.Fatal("missing reward summary")
				}
			}
			if mode == "room" {
				w.MarkDungeonRoomCleared(instanceID, 0)
				if len(rewards) != 0 {
					t.Fatal("room replay repeated its reward")
				}
			}
		})
	}
}
