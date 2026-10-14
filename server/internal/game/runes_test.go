package game

import "testing"

func TestRuneCatalogHasCanonicalClassCoverage(t *testing.T) {
	for _, classType := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		runes := GetAllRunesForClass(classType)
		want := 15
		if classType == "Wizard" || classType == "Fighter" || classType == "Rogue" {
			want = 39
		}
		if len(runes) != want {
			t.Fatalf("%s has %d runes, want %d", classType, len(runes), want)
		}
		seen := make(map[string]struct{}, len(runes))
		for _, runeDef := range runes {
			if runeDef.ID == "" || runeDef.Name == "" || runeDef.Skill == "" || runeDef.Description == "" {
				t.Fatalf("%s contains an incomplete rune: %+v", classType, runeDef)
			}
			if runeDef.UnlockLevel != 50 && runeDef.UnlockLevel != 70 && runeDef.UnlockLevel != 90 {
				t.Fatalf("%s rune %s has invalid unlock level %d", classType, runeDef.ID, runeDef.UnlockLevel)
			}
			if _, duplicate := seen[runeDef.ID]; duplicate {
				t.Fatalf("%s contains duplicate rune id %q", classType, runeDef.ID)
			}
			seen[runeDef.ID] = struct{}{}
			resolved, ok := GetRuneDef(runeDef.ID)
			if !ok || resolved != runeDef {
				t.Fatalf("GetRuneDef(%q) = %+v, %t; want %+v", runeDef.ID, resolved, ok, runeDef)
			}
		}
	}

	if runes := GetAllRunesForClass("Bard"); runes != nil {
		t.Fatalf("unknown class returned runes: %+v", runes)
	}
	if runeDef, ok := GetRuneDef("not_a_rune"); ok || runeDef != (SkillRuneDef{}) {
		t.Fatalf("unknown rune resolved: %+v, %t", runeDef, ok)
	}
}

func TestRuneFilteringHonorsSkillAndUnlockLevel(t *testing.T) {
	chargeRunes := GetRunesForSkill("Fighter", "Charge")
	if len(chargeRunes) != 3 {
		t.Fatalf("got %d Charge runes, want 3", len(chargeRunes))
	}
	for _, runeDef := range chargeRunes {
		if runeDef.Skill != "Charge" {
			t.Fatalf("unexpected Charge rune: %+v", runeDef)
		}
	}

	if got := len(GetUnlockedRunes("Wizard", 49)); got != 0 {
		t.Fatalf("level 49 unlocked %d runes, want 0", got)
	}
	if got := len(GetUnlockedRunes("Wizard", 50)); got != 13 {
		t.Fatalf("level 50 unlocked %d runes, want 13", got)
	}
	if got := len(GetUnlockedRunes("Wizard", 70)); got != 26 {
		t.Fatalf("level 70 unlocked %d runes, want 26", got)
	}
	if got := len(GetUnlockedRunes("Wizard", 90)); got != 39 {
		t.Fatalf("level 90 unlocked %d runes, want 39", got)
	}
}
