package main

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

// Eight ordinary sockets remain connected at SIGINT. The real server must
// retire/drain them and persist authoritative bars before exiting normally.
// A fresh process then hydrates every character, not an in-memory resume.
func TestResourceActualShutdownWithLiveCharacters(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	dir := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 40, "-save-journal-dir", dir)
	type prepared struct {
		character *database.Character
		password  string
	}
	var fixtures []prepared
	for _, class := range []string{"Fighter", "Rogue", "Wizard", "Cleric"} {
		for _, dead := range []bool{false, true} {
			name := fmt.Sprintf("shutdown-%s-%d", class, time.Now().UnixNano())
			password := name + "-prepared-only"
			hp, mana := 17, 0
			if dead {
				hp = 0
			} else if class == "Wizard" {
				mana = 100
			}
			character := &database.Character{Name: name, Class: class, Level: 30, Gold: 1234,
				ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200,
				LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 10},
				Resources: &database.CharacterResources{Version: 1, Health: hp, Mana: mana, Dead: dead}}
			if err := repo.CreateUser(name, name+"@example.invalid", password); err != nil {
				t.Fatal(err)
			}
			if err := repo.SetFirstCharacter(name, character); err != nil {
				t.Fatal(err)
			}
			connection, _ := resourceLoginCharacter(t, address, name, password, class)
			if !dead && class == "Wizard" {
				resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
				var result game.AbilityResult
				resourceReadMessage(t, connection, MsgAbilityResult, &result)
				if !result.Accepted || result.Mana != 70 {
					t.Fatalf("real pre-shutdown cast failed: %+v", result)
				}
				character.Resources.Mana = 70
			}
			resourceProbe(t, connection, character.Resources.Mana, dead)
			fixtures = append(fixtures, prepared{character, password})
		}
	}
	stoppingAt := time.Now().Truncate(time.Millisecond)
	stop()
	for _, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.character.Name, fixture.character.Name)
		if err != nil || actual.LastLogout.Before(stoppingAt) || !reflect.DeepEqual(actual.Resources, fixture.character.Resources) || actual.Gold != 1234 || actual.Level != 30 {
			t.Fatalf("shutdown lost live %s resources or final save: err=%v actual=%+v", fixture.character.Class, err, actual)
		}
	}
	journal, err := database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	if users, err := journal.PendingUsers(); err != nil || len(users) != 0 {
		t.Fatal("healthy shutdown left uncommitted saves")
	}
	address, stopRecovered := compatStartServer(t, binary, uri, 41, "-save-journal-dir", dir)
	defer stopRecovered()
	for _, fixture := range fixtures {
		character := fixture.character
		connection, _ := resourceLoginCharacter(t, address, character.Name, fixture.password, character.Class)
		resourceProbe(t, connection, character.Resources.Mana, character.Resources.Dead)
		actual := resourceCloseAndWait(t, repo, connection, character.Name)
		if !reflect.DeepEqual(actual.Resources, character.Resources) || actual.Gold != 1234 {
			t.Fatal("fresh-process login lost final live shutdown state")
		}
	}
	t.Log("eight live four-class alive/dead sockets drained at SIGINT; real cast, exact final Mongo resources and ordinary post-restart logins passed")
}
