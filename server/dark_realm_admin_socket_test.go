package main

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
)

// Existing explicitly disposable loopback harness; no live account is altered.
func TestDarkRealmAdministratorActualTravelAndRestart(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	operator := fmt.Sprintf("dark-admin-%d", time.Now().UnixNano())
	member := fmt.Sprintf("dark-member-%d", time.Now().UnixNano())
	for _, name := range []string{operator, member} {
		if err := repo.CreateUser(name, name+"@example.invalid", name+"-test-password"); err != nil {
			t.Fatal(err)
		}
		if err := repo.SetFirstCharacter(name, &database.Character{Name: name, Class: "Wizard", Level: 100,
			ProgressionVersion: game.CurrentProgressionVersion, X: 28, Z: 237, Gold: 777, XP: 321,
			LastDailyQuest: time.Now(), Stats: database.Stats{Strength: 10, Dexterity: 10, Intelligence: 30, Wisdom: 30, Vitality: 20},
			Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50},
			Quests:    []database.Quest{{ID: "chronicle_01_bell_below", Accepted: true, Count: 1, MaxCount: 3}},
		}); err != nil {
			t.Fatal(err)
		}
	}
	if granted, err := repo.GrantAdminRole(operator, operator, "disposable_integration_fixture"); err != nil || !granted {
		t.Fatal(granted, err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 801, "-save-journal-dir", journal)
	defer stop()
	b, _ := resourceLoginCharacter(t, address, member, member+"-test-password", "Wizard")
	// Establish normal admission normalization before attributing changes to travel.
	memberBaseline := resourceCloseAndWait(t, repo, b, member)
	b, _ = resourceLoginCharacter(t, address, member, member+"-test-password", "Wizard")
	resourceSend(t, b, MsgEnterDarkRealm, map[string]any{"administrator": true, "playerId": operator})
	resourceReadMessage(t, b, MsgError, nil)
	ordinary := resourceCloseAndWait(t, repo, b, member)
	if ordinary.InstanceID != "" || ordinary.Gold != memberBaseline.Gold || ordinary.XP != memberBaseline.XP || !reflect.DeepEqual(ordinary.Quests, memberBaseline.Quests) {
		t.Fatalf("ordinary travel changed normalized state: instance=%q gold=%d/%d xp=%d/%d questsEqual=%v", ordinary.InstanceID,
			ordinary.Gold, memberBaseline.Gold, ordinary.XP, memberBaseline.XP, reflect.DeepEqual(ordinary.Quests, memberBaseline.Quests))
	}
	a, _ := resourceLoginCharacter(t, address, operator, operator+"-test-password", "Wizard")
	initial := resourceCloseAndWait(t, repo, a, operator)
	a, _ = resourceLoginCharacter(t, address, operator, operator+"-test-password", "Wizard")
	resourceSend(t, a, MsgEnterDarkRealm, map[string]any{})
	scene := resourceReadScene(t, a)
	if scene.InstanceID != game.DarkRealmInstanceID || scene.Type != game.DarkRealmInstanceType {
		t.Fatal("administrator socket did not enter the shared Dark Realm", scene)
	}
	wellRestedReadActor(t, a, operator, func(e *statepb.Entity) bool { return e.InstanceId == game.DarkRealmInstanceID })
	saved := resourceCloseAndWait(t, repo, a, operator)
	if saved.InstanceID != game.DarkRealmInstanceID || saved.Gold != initial.Gold || saved.XP != initial.XP || !reflect.DeepEqual(saved.Quests, initial.Quests) {
		t.Fatal("administrator travel failed to save or changed story/rewards")
	}
	stop()
	address, stopAgain := compatStartServer(t, binary, uri, 802, "-save-journal-dir", journal)
	defer stopAgain()
	a, _ = resourceLoginCharacter(t, address, operator, operator+"-test-password", "Wizard")
	wellRestedReadActor(t, a, operator, func(e *statepb.Entity) bool { return e.InstanceId == game.DarkRealmInstanceID })
	resumed := resourceCloseAndWait(t, repo, a, operator)
	if resumed.InstanceID != game.DarkRealmInstanceID || !reflect.DeepEqual(resumed.Quests, saved.Quests) || resumed.Gold != saved.Gold || resumed.XP != saved.XP {
		t.Fatal("administrator restart lost travel access or altered earned progress")
	}
	history, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: operator, Action: darkRealmAdminAuditAction})
	if err != nil || len(history.Entries) != 1 || history.Entries[0].Result != "success" {
		t.Fatal("administrator permission audit did not survive restart", err)
	}
}
