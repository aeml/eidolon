package main

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func adminMutationFixture(t *testing.T) (*Client, *fakeAdminRoleStore, *schedulerOperationStore, *testCharacterCommitter, *game.Entity) {
	t.Helper()
	_, committer := setupCharacterJournalTest(t)
	c, roles := adminReadFixture(t)
	store, _ := adminSchedulerFixture(t, 0)
	player := &game.Entity{ID: "player-recipient", Name: "recipient", Type: game.TypePlayer,
		SubType: "Wizard", Level: 30, Health: 17, Mana: 9, Gold: 100, State: "IDLE", X: 40, Z: 250}
	world.AddEntity(player)
	activeSessions["recipient"] = &Client{username: "recipient", playerID: player.ID, send: make(chan []byte, 50)}
	return c, roles, store, committer, player
}

func adminMutationReply(t *testing.T, c *Client, kind, payload string) adminMutationResult {
	t.Helper()
	c.handleMessage(Message{Type: kind, Payload: json.RawMessage(payload)})
	for _, message := range drainSentMessages(c.send) {
		if message.Type == kind+"_result" {
			var result adminMutationResult
			if err := json.Unmarshal(message.Payload, &result); err != nil {
				t.Fatal(err)
			}
			return result
		}
	}
	t.Fatal("missing administration result")
	return adminMutationResult{}
}

func TestAdminMutationDispatcherGoldReplayConflictAndFreshRole(t *testing.T) {
	c, roles, store, committer, player := adminMutationFixture(t)
	for i := 0; i < 2; i++ {
		if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); !result.Success || !result.Authorized || !result.Final {
			t.Fatal(result)
		}
	}
	if player.Gold != 200 || len(committer.ids) != 1 || store.finishes != 1 || len(store.ops) != 1 {
		t.Fatal("replay repeated grant, save or audit")
	}
	for _, op := range store.ops {
		if op.Audit.Actor != "operator" || op.Audit.Target != "recipient" || op.Audit.Reason != "Restore verified lost reward" || op.Audit.Summary != "Granted 100 Gold." {
			t.Fatal("incorrect audit identity or change summary")
		}
	}
	conflict := strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":200`, 1)
	if result := adminMutationReply(t, c, MsgAdminGrantGold, conflict); result.Success || !strings.Contains(result.Message, "different operation") {
		t.Fatal(result)
	}
	delete(roles.roles, "operator")
	if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); result.Success || result.Authorized {
		t.Fatal("role revocation ignored on replay", result)
	}
	if player.Gold != 200 || len(committer.ids) != 1 || store.finishes != 1 {
		t.Fatal("rejection changed character or duplicated original audit")
	}
}

func TestAdminMutationAdmissionRejectionKeepsCorrelatedRetryIdentity(t *testing.T) {
	c, _, _, _, _ := adminMutationFixture(t)
	c.sendInboundRejection(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(adminGoldRequestFixture)}, "message rate limit exceeded")
	messages := drainSentMessages(c.send)
	if len(messages) != 1 || messages[0].Type != MsgAdminGrantGold+"_result" {
		t.Fatal("admission rejection lost operation correlation")
	}
	var result adminMutationResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil || result.ID != "request-123456789" || result.Success || result.Authorized || result.Final {
		t.Fatal("admission rejection invented authority or a final stored decision", result, err)
	}
}

func TestAdminRejectedMutationSurvivesActivityStoreOutage(t *testing.T) {
	for _, mode := range []string{"malformed", "role-lookup", "operation-lookup", "conflicting-id"} {
		t.Run(mode, func(t *testing.T) {
			c, roles, operations, committer, player := adminMutationFixture(t)
			dir, activity := sessionActivityFixture(t)
			payload := adminGoldRequestFixture
			switch mode {
			case "malformed":
				payload = strings.Replace(payload, `"amount":100`, `"amount":100,"actor":"forged"`, 1)
			case "role-lookup":
				roles.lookupErr = errors.New("private role-store error")
			case "operation-lookup":
				operations.getErr = errors.New("private operation-store error")
			case "conflicting-id":
				if result := adminMutationReply(t, c, MsgAdminGrantGold, payload); !result.Success {
					t.Fatal(result)
				}
				payload = strings.Replace(payload, `"amount":100`, `"amount":200`, 1)
			}
			gold, saves := player.Gold, len(committer.ids)
			activity.appendErr = errors.New("private activity-store error")
			result := adminMutationReply(t, c, MsgAdminGrantGold, payload)
			if result.Success || player.Gold != gold || len(committer.ids) != saves || strings.Contains(result.Message, "private") {
				t.Fatal("rejected request mutated character or exposed storage details", result)
			}
			if mode == "operation-lookup" && (!result.Pending || result.Final || !result.Authorized || result.ID != "request-123456789" || len(operations.ops) != 0) {
				t.Fatal("lookup failure lost retry identity or invented a completed operation", result)
			}
			pending, err := adminActivityJournal.Pending(50)
			if err != nil || len(pending) != 1 {
				t.Fatal("rejected operation lost its audit during database outage", pending, err)
			}
			event := pending[0]
			if event.Actor != "operator" || event.Target != "recipient" || event.Action != MsgAdminGrantGold ||
				event.RequestID != "request-123456789" || event.Result == "success" || event.At.IsZero() ||
				strings.Contains(event.Summary, "private") || strings.Contains(event.Summary, "forged") {
				t.Fatal("rejected audit lost its sanitized server identity", event)
			}
			adminActivityJournal, err = database.OpenAdminActivityJournal(dir)
			if err != nil {
				t.Fatal(err)
			}
			activity.appendErr = nil
			if err := retryPendingAdminActivity(); err != nil {
				t.Fatal(err)
			}
			if err := retryPendingAdminActivity(); err != nil {
				t.Fatal(err)
			}
			if len(activity.events) != 1 || !reflect.DeepEqual(activity.events[0], event) {
				t.Fatal("recovery changed or duplicated the rejected audit", activity.events)
			}
		})
	}
}

func TestAdminRejectedMutationFailsClosedWhenBothActivityStoresFail(t *testing.T) {
	c, _, _, committer, player := adminMutationFixture(t)
	dir, activity := sessionActivityFixture(t)
	activity.appendErr = errors.New("private database failure")
	if err := os.Rename(dir, dir+"-unavailable"); err != nil {
		t.Fatal(err)
	}
	payload := strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"actor":"forged"`, 1)
	result := adminMutationReply(t, c, MsgAdminGrantGold, payload)
	if result.Success || result.Authorized || result.Final || player.Gold != 100 || len(committer.ids) != 0 ||
		result.Message != "Administration activity storage is unavailable. Nothing was changed." || len(activity.events) != 0 {
		t.Fatal("unrecorded rejection acknowledged or changed character", result)
	}
}

func TestAdminMutationLookupFailureDoesNotReplaceOriginalOperation(t *testing.T) {
	for _, alreadyApplied := range []bool{false, true} {
		t.Run(map[bool]string{false: "new", true: "replay"}[alreadyApplied], func(t *testing.T) {
			c, _, operations, committer, player := adminMutationFixture(t)
			_, activity := sessionActivityFixture(t)
			if alreadyApplied {
				if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); !result.Success {
					t.Fatal(result)
				}
			}
			gold, saves, finishes := player.Gold, len(committer.ids), operations.finishes
			operations.getErr = errors.New("private lookup error")
			result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture)
			if result.Success || result.Final || !result.Pending || player.Gold != gold || len(committer.ids) != saves || operations.finishes != finishes {
				t.Fatal("unverified operation changed or finalized", result)
			}
			if len(activity.events) != 1 || activity.events[0].Result != "error" || activity.events[0].RequestID != result.ID {
				t.Fatal("lookup failure missing its correlated error audit", activity.events)
			}
			operations.getErr = nil
			for i := 0; i < 2; i++ {
				if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); !result.Success || !result.Final || result.Pending {
					t.Fatal("same request could not recover", result)
				}
			}
			if player.Gold != 200 || len(committer.ids) != 1 || operations.finishes != 1 || len(operations.ops) != 1 || len(activity.events) != 1 {
				t.Fatal("lookup recovery repeated a grant, save or audit")
			}
		})
	}
}

func TestAdminMutationConcurrentDuplicatesAndCrossedAccounts(t *testing.T) {
	c, roles, store, committer, player := adminMutationFixture(t)
	var group sync.WaitGroup
	for i := 0; i < 3; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			c.handleMessage(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(adminGoldRequestFixture)})
		}()
	}
	group.Wait()
	if len(drainSentMessages(c.send)) != 3 || player.Gold != 200 || store.finishes != 1 || len(committer.ids) != 1 {
		t.Fatal("concurrent identical requests repeated a grant/save/audit")
	}
	roles.roles["recipient"] = true
	c.playerID = "player-operator"
	operator := &game.Entity{ID: c.playerID, Name: c.username, Type: game.TypePlayer, State: "IDLE", Health: 100, Gold: 1}
	world.AddEntity(operator)
	done := make(chan struct{}, 2)
	go func() {
		c.handleMessage(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(strings.Replace(adminGoldRequestFixture, "request-123456789", "request-crossed-001", 1))})
		done <- struct{}{}
	}()
	go func() {
		activeSessions["recipient"].handleMessage(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(strings.Replace(adminGoldRequestFixture, `"recipient"`, `"operator"`, 1))})
		done <- struct{}{}
	}()
	for i := 0; i < 2; i++ {
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Fatal("crossed administration account locks deadlocked")
		}
	}
	if operator.Gold != 101 || player.Gold != 300 || len(committer.ids) != 3 || store.finishes != 3 {
		t.Fatal("crossed requests did not save exactly once each")
	}
}

func TestAdminMutationUnauthorizedForgedAndRoleFailureCannotGrant(t *testing.T) {
	for _, mode := range []string{"ordinary", "qa-only", "bootstrap-only", "lookup-error", "forged-actor", "replaced"} {
		t.Run(mode, func(t *testing.T) {
			c, roles, store, committer, player := adminMutationFixture(t)
			payload := adminGoldRequestFixture
			switch mode {
			case "ordinary", "qa-only", "bootstrap-only":
				delete(roles.roles, "operator")
				adminBootstrapUsernames["operator"] = struct{}{}
			case "lookup-error":
				roles.lookupErr = errors.New("private database error")
			case "forged-actor":
				payload = strings.Replace(payload, `"amount":100`, `"amount":100,"actor":"operator"`, 1)
			case "replaced":
				activeSessions[c.username] = &Client{username: c.username}
			}
			result := adminMutationReply(t, c, MsgAdminGrantGold, payload)
			if result.Success || result.Authorized || strings.Contains(result.Message, "private") || player.Gold != 100 || len(committer.ids) != 0 {
				t.Fatal("unauthorized mutation or private diagnostic exposure", result)
			}
			if mode == "ordinary" {
				if replay := adminMutationReply(t, c, MsgAdminGrantGold, payload); !replay.Final || replay.Message != result.Message {
					t.Fatal("denied replay did not return the recorded decision", replay)
				}
				if store.finishes != 1 || len(store.ops) != 1 {
					t.Fatal("denial replay inserted another audit")
				}
			}
		})
	}
}

func TestAdminMutationPersistenceFailuresArePendingNotExtraGrants(t *testing.T) {
	c, _, store, committer, player := adminMutationFixture(t)
	committer.fail = errors.New("save failed")
	if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); result.Success || !result.Pending || result.Final {
		t.Fatal(result)
	}
	if player.Gold != 200 || store.finishes != 0 {
		t.Fatal("incorrect in-memory grant or early audit")
	}
	committer.fail, store.finishErr = nil, errors.New("audit failed")
	if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); result.Success || !result.Pending {
		t.Fatal(result)
	}
	store.finishErr = nil
	if result := adminMutationReply(t, c, MsgAdminGrantGold, adminGoldRequestFixture); !result.Success || !result.Final {
		t.Fatal(result)
	}
	if player.Gold != 200 || len(committer.ids) != 2 {
		t.Fatal("save/audit retry duplicated grant or save")
	}
}

func TestAdminMutationItemsAndAtomicInventoryRejection(t *testing.T) {
	for _, full := range []bool{false, true} {
		t.Run(map[bool]string{false: "delivery", true: "full"}[full], func(t *testing.T) {
			c, _, store, committer, player := adminMutationFixture(t)
			if full {
				for i := 0; i < game.MaxInventorySize; i++ {
					player.Inventory = append(player.Inventory, game.Item{ID: "occupied", Stack: 1, MaxStack: 1})
				}
			}
			request := `{"id":"request-123456789","target":"recipient","reason":"Restore gear","confirmed":true,"item":"iron-sword","rarity":"Rare","level":70,"quantity":2}`
			result := adminMutationReply(t, c, MsgAdminGrantItem, request)
			if result.Success == full || !result.Final || !result.Authorized {
				t.Fatal(result)
			}
			if full {
				if len(committer.ids) != 0 || len(player.AdminOperationReceipts) != 0 {
					t.Fatal("rejected item grant partially committed")
				}
				return
			}
			first := player.Inventory[0].ID
			adminMutationReply(t, c, MsgAdminGrantItem, request)
			if len(committer.ids) != 1 || store.finishes != 1 || player.Inventory[0].ID != first || player.Inventory[1].Rarity != game.RarityRare || player.Inventory[1].Level != 70 {
				t.Fatal("item replay rerolled or duplicated delivery")
			}
		})
	}
}

func TestAdminMutationTeleportTownSyncAndReplay(t *testing.T) {
	c, _, store, committer, player := adminMutationFixture(t)
	request := `{"id":"request-123456789","target":"recipient","reason":"Unstick player","confirmed":true,"destination":"town"}`
	if result := adminMutationReply(t, c, MsgAdminTeleport, request); !result.Success || !result.Final {
		t.Fatal(result)
	}
	messages := drainSentMessages(activeSessions["recipient"].send)
	var scene bool
	for _, message := range messages {
		if message.Type == MsgEnterInstance {
			var payload struct {
				Type  string                    `json:"type"`
				Spawn struct{ X, Y, Z float64 } `json:"spawn"`
			}
			if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Type != "overworld" || payload.Spawn.X != player.X || payload.Spawn.Y != player.Y || payload.Spawn.Z != player.Z {
				t.Fatal("incorrect authoritative scene landing", err)
			}
			scene = true
		}
	}
	if !scene || player.X != -1.25 || player.Z != 200 || committer.saved.X != player.X || committer.saved.Z != player.Z {
		t.Fatal("teleport did not save and synchronize scene")
	}
	player.X, player.Z = 40, 250
	adminMutationReply(t, c, MsgAdminTeleport, request)
	if player.X != 40 || store.finishes != 1 || len(committer.ids) != 1 || len(drainSentMessages(activeSessions["recipient"].send)) != 0 {
		t.Fatal("completed teleport replay moved/saved/notified recipient")
	}
}

func TestAdminMutationDeniesTeleportBetweenUnrelatedPlayersAndOfflineRecipient(t *testing.T) {
	for _, offline := range []bool{false, true} {
		t.Run(map[bool]string{false: "unrelated", true: "offline"}[offline], func(t *testing.T) {
			c, _, store, committer, player := adminMutationFixture(t)
			if offline {
				delete(activeSessions, "recipient")
			}
			request := `{"id":"request-123456789","target":"recipient","reason":"Unstick player","confirmed":true,"destination":"player","destinationPlayer":"third-party"}`
			result := adminMutationReply(t, c, MsgAdminTeleport, request)
			if result.Success || !result.Final || len(committer.ids) != 0 || player.X != 40 || store.finishes != 1 {
				t.Fatal(result)
			}
			for _, op := range store.ops {
				if op.State != database.AdminOperationComplete || op.Audit.Result != "denied" {
					t.Fatal("rejection was not durably recorded")
				}
			}
		})
	}
}
