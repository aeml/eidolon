package game

import "testing"

func TestSpecializationSelectionRequiresLevel10ForEveryClass(t *testing.T) {
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		t.Run(class, func(t *testing.T) {
			w := newTestWorld()
			t.Cleanup(w.StopBackground)
			p := newTestPlayer("unlock-"+class, class)
			w.AddEntity(p)
			p.Level = 9
			for _, branch := range []string{"A", "B", "C"} {
				if _, ok := w.PerformSelectBranch(p.ID, branch); ok || p.SelectedBranch != "" {
					t.Fatal("specialization selected before level 10")
				}
			}
			p.Level = 10
			for _, branch := range []string{"A", "B", "C"} {
				if _, ok := w.PerformSelectBranch(p.ID, branch); !ok || p.SelectedBranch != branch || len(p.UnlockedSkills) != 2 {
					t.Fatal("level10 branch choice did not unlock its first skill", branch, p.UnlockedSkills)
				}
			}
			p.Level, p.SelectedBranch = 9, "A"
			if _, ok := w.PerformSelectBranch(p.ID, "B"); ok || p.SelectedBranch != "A" {
				t.Fatal("old pre10 branch was erased or changed")
			}
		})
	}
}
