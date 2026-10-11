package game

import (
	"reflect"
	"testing"
)

func TestDungeonTownReturnUsesLatestClearedBossCheckpoint(t *testing.T) {
	for _, scenario := range []struct{ profile, action string }{
		{FlatTerrainProfile, "recall"}, {FlatTerrainProfile, "respawn"},
		{RaisedEarthTerrainProfile, "recall"}, {RaisedEarthTerrainProfile, "respawn"},
	} {
		t.Run(scenario.profile+"/"+scenario.action, func(t *testing.T) {
			w, err := NewWorldWithTerrainProfile(nil, scenario.profile)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("checkpoint-return", "Fighter")
			w.AddEntity(p)
			id := w.CreateDungeon("checkpoint-party", "molten_core", DifficultyNormal, 70)
			instance, _ := w.getDungeonInstance(id)
			bosses := []int{}
			for i, room := range instance.Layout.Rooms {
				if room.Type == "boss" {
					bosses = append(bosses, i)
				}
			}
			for _, checkpoint := range append([]int{0}, bosses[:2]...) {
				if err := w.EnterInstance(p.ID, id); err != nil {
					t.Fatal(err)
				}
				for i := 1; i <= checkpoint; i++ {
					instance.RoomState.Rooms[i] = DungeonRoomProgress{Explored: true, Cleared: true, Rewarded: true}
				}
				if scenario.action == "recall" {
					if err := w.PerformRecall(p.ID); err != nil {
						t.Fatal(err)
					}
				} else {
					p.Health, p.State = 0, "DEAD"
					if err := w.PerformRespawn(p.ID); err != nil {
						t.Fatal(err)
					}
				}
				if p.InstanceID != "" || p.Y != 0 || p.X != -1.25 || p.Z != 200 {
					t.Fatal("dungeon recovery did not land on the flat Lanternhold floor")
				}
				progress := append([]DungeonRoomProgress(nil), instance.RoomState.Rooms...)
				gold, xp, hp, mana := p.Gold, p.Experience, p.Health, p.Mana
				if err := w.EnterInstance(p.ID, id); err != nil {
					t.Fatal(err)
				}
				room := instance.Layout.Rooms[checkpoint]
				if p.InstanceID != id || p.Y != 0 || p.X != room.X || p.Z != room.Z || p.TargetX != room.X || p.TargetZ != room.Z {
					t.Fatalf("return did not use cleared boss checkpoint %d", checkpoint)
				}
				if p.Gold != gold || p.Experience != xp || p.Health != hp || p.Mana != mana {
					t.Fatal("checkpoint return changed resources or rewards")
				}
				for i := range progress {
					// Entry may mark its landing explored; clear/reward state cannot change.
					if instance.RoomState.Rooms[i].Cleared != progress[i].Cleared || instance.RoomState.Rooms[i].Rewarded != progress[i].Rewarded {
						t.Fatal("checkpoint return changed encounter progress")
					}
				}
				p.X += 5
				p.TargetX = p.X + 2
				x, targetX := p.X, p.TargetX
				if err := w.EnterInstance(p.ID, id); err != nil || p.X != x || p.TargetX != targetX {
					t.Fatal("duplicate entry moved a member already inside")
				}
			}
		})
	}
}

func TestDungeonCheckpointRequiresContiguousClearedRoute(t *testing.T) {
	layout := DungeonLayout{Rooms: []DungeonRoom{
		{Type: "start"}, {Type: "normal", X: 100}, {Type: "boss", X: 200},
		{Type: "normal", X: 300}, {Type: "boss", X: 400},
	}}
	instance := &DungeonInstance{Layout: layout, RoomState: NewDungeonRoomState(layout)}
	for _, check := range []struct {
		cleared []int
		want    int
	}{
		{nil, 0}, {[]int{1}, 0}, {[]int{2}, 0}, {[]int{1, 2, 4}, 2}, {[]int{1, 2, 3, 4}, 4},
	} {
		instance.RoomState = NewDungeonRoomState(layout)
		for _, i := range check.cleared {
			instance.RoomState.Rooms[i].Cleared = true
		}
		if got := dungeonReturnRoom(instance); !reflect.DeepEqual(got, layout.Rooms[check.want]) {
			t.Fatalf("cleared=%v got=%+v want room%d", check.cleared, got, check.want)
		}
	}
	instance.RoomState = nil
	if got := dungeonReturnRoom(instance); got != layout.Rooms[0] {
		t.Fatal("missing progress must use entrance")
	}
}
