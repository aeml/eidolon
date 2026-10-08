package game

import (
	"reflect"
	"testing"
)

func TestDarkRealmAdministratorRestoreDoesNotGrantStoryProgress(t *testing.T) {
	for _, mode := range []string{"administrator", "ordinary", "underlevel", "outside", "other-instance"} {
		t.Run(mode, func(t *testing.T) {
			p := newTestPlayer("administrator-restore", "Wizard")
			p.Level = 100
			p.InstanceID, p.X, p.Y, p.Z = DarkRealmInstanceID, 39300, 99, 39700
			p.Quests = []Quest{{ID: "chronicle_01_bell_below", Accepted: true, Count: 1, MaxCount: 3}}
			p.Health, p.Mana, p.Gold, p.Experience = 17, 9, 1234, 56
			quests := append([]Quest(nil), p.Quests...)
			switch mode {
			case "underlevel":
				p.Level = 99
			case "outside":
				p.X = 0
			case "other-instance":
				p.InstanceID = "dungeon_existing"
			}
			if mode == "ordinary" {
				RestoreDarkRealmPosition(p)
			} else {
				RestoreDarkRealmPositionForAdministrator(p)
			}
			if !reflect.DeepEqual(quests, p.Quests) || p.Health != 17 || p.Mana != 9 || p.Gold != 1234 || p.Experience != 56 || DarkRealmEntryAllowed(p) {
				t.Fatal("administrator restore changed earned state or ordinary story eligibility")
			}
			switch mode {
			case "ordinary", "underlevel":
				if p.InstanceID != "" || p.X != -1.25 || p.Z != 200 {
					t.Fatal("saved position bypassed a retained requirement")
				}
			case "outside":
				if p.InstanceID != DarkRealmInstanceID || p.X != 40000 || p.Y != 0 || p.Z != 40800 {
					t.Fatal("invalid administrator position did not recover at camp")
				}
			case "administrator":
				if p.InstanceID != DarkRealmInstanceID || p.X != 39300 || p.Y != 0 || p.Z != 39700 {
					t.Fatal("valid administrator district position was lost")
				}
			case "other-instance":
				if p.InstanceID != "dungeon_existing" || p.Y != 99 {
					t.Fatal("administrator restore changed another instance")
				}
			}
		})
	}
}
