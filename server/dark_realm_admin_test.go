package main

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestDarkRealmAdminBypassRechecksRoleAndAuditWithoutQuestRewards(t *testing.T) {
	for _, scenario := range []string{"administrator", "ordinary", "spoofed-payload", "bootstrap-only", "VIP-only", "role-error", "audit-unavailable", "revoked-during-audit", "role-error-during-audit", "replaced-during-audit", "closed", "level99", "distant", "dead"} {
		t.Run(scenario, func(t *testing.T) {
			restore := installChatTestState(t)
			defer restore()
			defer world.StopBackground()
			client := addChatTestClient("admin-dark-fixture", "")
			roles := &fakeAdminRoleStore{roles: map[string]bool{client.username: true, "another-admin": true}}
			bootstrap := ""
			if scenario == "bootstrap-only" {
				bootstrap = client.username
			}
			setAdminRoleTestState(t, roles, bootstrap)
			previousActivities := adminActivities
			activities := &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}}
			adminActivities = activities
			t.Cleanup(func() { adminActivities = previousActivities })
			p := world.Entities[client.playerID]
			portal := world.Entities["resonance-portal-1"]
			p.Level, p.Health, p.State, p.X, p.Z = 100, 100, "IDLE", portal.X, portal.Z+2
			p.Gold, p.Experience = 777, 321
			p.Quests = []game.Quest{{ID: "chronicle_01_bell_below", Accepted: true, Count: 1, MaxCount: 3}}
			quests := append([]game.Quest(nil), p.Quests...)
			switch scenario {
			case "ordinary", "spoofed-payload", "bootstrap-only":
				delete(roles.roles, client.username)
			case "VIP-only":
				delete(roles.roles, client.username)
				p.VIPUntil = time.Now().Add(time.Hour)
			case "role-error":
				roles.lookupErr = errors.New("synthetic role lookup failure")
			case "audit-unavailable":
				adminActivities = nil
			case "revoked-during-audit":
				activities.afterAppend = func() { delete(roles.roles, client.username) }
			case "role-error-during-audit":
				activities.afterAppend = func() { roles.lookupErr = errors.New("synthetic role lookup failure") }
			case "replaced-during-audit":
				activities.afterAppend = func() { activeSessions[client.username] = &Client{username: client.username} }
			case "closed":
				client.markTransportClosed()
			case "level99":
				p.Level = 99
			case "distant":
				p.X, p.Z = 1000, 1000
			case "dead":
				p.State, p.Health = "DEAD", 0
			}
			drainSentMessages(client.send)
			handleEnterDarkRealm(client, Message{Type: MsgEnterDarkRealm, Payload: json.RawMessage(`{"administrator":true,"playerId":"another-admin","questsComplete":true}`)})
			allowed := scenario == "administrator"
			if (p.InstanceID == game.DarkRealmInstanceID) != allowed {
				t.Fatal("administrator bypass did not use the current authenticated role and travel gates")
			}
			if !reflect.DeepEqual(quests, p.Quests) || p.Gold != 777 || p.Experience != 321 || game.DarkRealmEntryAllowed(p) {
				t.Fatal("administrator travel granted ordinary story access or changed rewards/progress")
			}
			if allowed {
				if len(activities.events) != 1 || activities.events[0].Action != darkRealmAdminAuditAction || activities.events[0].Actor != client.username {
					t.Fatal("administrator permission was not audited before travel")
				}
				assertRecoveryContextMessage(t, client, "")
			}
		})
	}
}
