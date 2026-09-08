package game

import "testing"

func TestPvPArenaLayoutExistsOnlyDuringRealMatch(t *testing.T) {
	first, second := &Entity{ID: "scene-a", Type: TypePlayer}, &Entity{ID: "scene-b", Type: TypePlayer}
	w := newPvPTestWorld(first, second)
	match := startTestPvPMatch(w, PvPModeDuel, []string{first.ID}, []string{second.ID})
	layout, ok := w.GetInstanceLayout(match.ID)
	if !ok || w.GetInstanceType(match.ID) != "pvp_arena" || len(layout.WalkRects) != 1 {
		t.Fatalf("active match has no renderable scene: %+v, %v", layout, ok)
	}
	floor := layout.WalkRects[0]
	if floor.Width != 50.5 || floor.Height != 34.5 {
		t.Fatalf("floor disagrees with player-center limits: %+v", floor)
	}
	layout.WalkRects[0].Width = 999
	next, _ := w.GetInstanceLayout(match.ID)
	if next.WalkRects[0].Width != 50.5 {
		t.Fatal("caller mutated shared arena geometry")
	}
	if _, ok := w.GetInstanceLayout("pvp-forged"); ok {
		t.Fatal("prefix alone authorized an arena")
	}
	w.ForfeitPvP(first.ID)
	if _, ok := w.GetInstanceLayout(match.ID); ok {
		t.Fatal("completed arena still exists")
	}
}
