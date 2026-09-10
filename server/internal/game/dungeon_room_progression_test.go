package game

import (
	"fmt"
	"reflect"
	"testing"
)

func TestDungeonRoomRewardImmediatelyAdvancesProgression(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, level := range []int{29, 39, 99, 100} {
			t.Run(fmt.Sprintf("%s/%d", class, level), func(t *testing.T) {
				w := newTestWorld()
				const instanceID = "room-progression"
				player := newTestPlayer("room-level-up", class)
				player.Level, player.MaxExperience = level, experienceRequiredForLevel(level)
				player.Experience = player.MaxExperience - 5
				if level == MaxPlayerLevel {
					player.Experience = player.MaxExperience
				}
				player.BaseStats = applyLevelGrowth(InitialPlayerStats(), level)
				player.SelectedBranch = "C"
				player.recomputeTalentPoints()
				w.UpdateUnlockedSkills(player)
				player.RecalculateStats()
				player.Health = 1
				player.InstanceID = instanceID
				w.AddEntity(player)
				layout := DungeonLayout{Rooms: []DungeonRoom{
					{X: 0, Z: 0, Width: 40, Height: 40, Type: "start"},
					{X: 100, Z: 0, Width: 40, Height: 40, Type: "normal"},
				}}
				w.InstanceLayouts[instanceID] = &DungeonInstance{ID: instanceID, Layout: layout,
					DungeonType: "verdant_bastion_catacombs", Difficulty: DifficultyNormal,
					RunLevel: 30, RoomState: NewDungeonRoomState(layout), PlayerRoomSummary: map[string]DungeonRoomSummary{}}
				var receipts []DungeonRoomClearRewardEvent
				w.OnEvent = func(kind string, value interface{}) {
					if kind == "room_clear_reward" {
						receipts = append(receipts, value.(DungeonRoomClearRewardEvent))
					}
				}
				w.MarkDungeonRoomCleared(instanceID, 1)
				if len(receipts) != 1 || receipts[0].XP != 300 || receipts[0].Gold != 90 {
					t.Fatalf("room budget changed: %+v", receipts)
				}
				wantLevel, wantXP, wantResonance := level+1, 295, 0
				if level >= 99 {
					wantLevel, wantXP = 100, experienceRequiredForLevel(100)
					wantResonance = 295
					if level == 100 {
						wantResonance = 300
					}
				}
				if player.Level != wantLevel || player.Experience != wantXP || player.ResonanceXP != wantResonance {
					t.Fatalf("room XP must advance immediately: got level=%d xp=%d resonance=%d; want %d/%d/%d",
						player.Level, player.Experience, player.ResonanceXP, wantLevel, wantXP, wantResonance)
				}
				if player.BaseStats != applyLevelGrowth(InitialPlayerStats(), wantLevel) {
					t.Fatal("room level-up did not apply the canonical class growth")
				}
				control := newTestPlayer("unlocked-control", class)
				control.Level, control.SelectedBranch = wantLevel, "C"
				control.recomputeTalentPoints()
				w.UpdateUnlockedSkills(control)
				if !reflect.DeepEqual(player.UnlockedSkills, control.UnlockedSkills) || player.TalentPoints != control.TalentPoints {
					t.Fatal("skills/talents lag behind the room-earned level")
				}
				if level < 100 && player.Health != player.MaxHealth {
					t.Fatal("room level-up omitted normal level-up healing")
				}
				if level == 100 && player.Health != 1 {
					t.Fatal("Resonance-only room payout incorrectly healed the player")
				}
				w.MarkDungeonRoomCleared(instanceID, 1)
				if len(receipts) != 1 || player.Level != wantLevel || player.Experience != wantXP || player.ResonanceXP != wantResonance || player.Gold != 90 {
					t.Fatal("duplicate room clear repeated progression or payment")
				}
			})
		}
	}
}
