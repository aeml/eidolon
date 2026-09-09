package main

import (
	"fmt"
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
		manaSpent int
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
			manaSpent := 0
			if !dead && class == "Wizard" {
				beforeCast := townFixtureRead(t, connection, character, 0)
				resourceSend(t, connection, MsgAbility, AbilityPayload{SkillName: "Fireball"})
				var result game.AbilityResult
				resourceReadMessage(t, connection, MsgAbilityResult, &result)
				if !result.Accepted {
					t.Fatalf("real pre-shutdown cast failed: %+v", result)
				}
				manaSpent = 30
				afterCast := townFixtureRead(t, connection, character, manaSpent)
				if result.Mana < int(beforeCast.Mana)-30 || result.Mana > int(afterCast.Mana) {
					t.Fatalf("cast response mana outside exact recovery interval: %+v", result)
				}
				// The independent final formula subtracts the actual integer cost
				// from all online healing. It is valid only if no recovery was
				// discarded at the cap before this cast; enforce that precondition.
				if result.Mana+30 >= int(afterCast.MaxMana) {
					t.Fatal("prepared Wizard reached the mana cap before the cast; cannot infer discarded regen")
				}
				// The accepted cast already proves alive state and exact mana.
				// An immediate second probe legitimately hits global cooldown.
			} else {
				townFixtureProbe(t, connection, character)
			}
			fixtures = append(fixtures, prepared{character, password, manaSpent})
		}
	}
	stoppingAt := time.Now().Truncate(time.Millisecond)
	stop()
	for index, fixture := range fixtures {
		actual, err := repo.GetCharacter(fixture.character.Name, fixture.character.Name)
		if err != nil || actual == nil || actual.LastLogout.Before(stoppingAt) {
			t.Fatalf("shutdown lost live %s resources or final save: err=%v actual=%+v", fixture.character.Class, err, actual)
		}
		assertTownFixtureSave(t, fixture.character, actual, fixture.manaSpent)
		fixtures[index].character = actual
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
		townFixtureProbe(t, connection, character)
		actual := resourceCloseAndWait(t, repo, connection, character.Name)
		assertTownFixtureSave(t, character, actual, 0)
	}
	t.Log("eight live four-class alive/dead sockets drained at SIGINT; real cast, exact final Mongo resources and ordinary post-restart logins passed")
}
