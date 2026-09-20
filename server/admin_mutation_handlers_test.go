package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
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

func TestAdminMutationAdmissionRejectionIsAuditedAndBoundsFurtherPackets(t *testing.T) {
	for _, mode := range []string{"rate", "oversized", "anonymous"} {
		t.Run(mode, func(t *testing.T) {
			c, _, operations, committer, player := adminMutationFixture(t)
			dir, activity := sessionActivityFixture(t)
			activity.appendErr = errors.New("private database outage")
			payload := adminGoldRequestFixture
			if mode == "oversized" {
				payload = strings.Repeat("private", adminMutationPayloadLimit)
			} else if mode == "anonymous" {
				c.username = ""
			} else {
				c.messageRates = map[string]*messageRateBucket{MsgAdminGrantGold: {tokens: 0, updated: time.Now().Add(time.Hour)}}
			}
			msg := Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(payload)}
			c.handleMessage(msg)
			if !c.transportClosed.Load() {
				t.Fatal("audit-producing protocol violation left its connection active")
			}
			for i := 0; i < 100; i++ {
				c.handleMessage(msg)
			}
			pending, err := adminActivityJournal.Pending(50)
			if err != nil || player.Gold != 100 || len(operations.ops) != 0 || len(committer.ids) != 0 {
				t.Fatal("admission rejection mutated gameplay or failed storage", err)
			}
			if mode == "anonymous" {
				if len(pending) != 0 {
					t.Fatal("anonymous packet was attributed to an account", pending)
				}
				return
			}
			if len(pending) != 1 || pending[0].Actor != "operator" || pending[0].Result != "denied" ||
				strings.Contains(pending[0].Summary, "private") {
				t.Fatal("admission audit missing, duplicated or unsanitized", pending)
			}
			if mode == "rate" && (pending[0].RequestID != "request-123456789" || pending[0].Target != "recipient") {
				t.Fatal("bounded valid request lost its correlation", pending)
			}
			if mode == "oversized" && (pending[0].RequestID != "invalid-request" || pending[0].Target != "" || pending[0].Reason != "") {
				t.Fatal("oversized body was parsed into activity", pending)
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
			if len(activity.events) != 1 || !reflect.DeepEqual(activity.events[0], pending[0]) {
				t.Fatal("admission audit changed across restart/replay", activity.events)
			}
		})
	}
}

func TestAdminMutationAdmissionClosesRealWebSocket(t *testing.T) {
	c, _, operations, committer, player := adminMutationFixture(t)
	_, activity := sessionActivityFixture(t)
	activity.appendErr = errors.New("database unavailable")
	c.messageRates = map[string]*messageRateBucket{MsgAdminGrantGold: {tokens: 0, updated: time.Now().Add(time.Hour)}}
	done := make(chan error, 1)
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			done <- err
			return
		}
		defer conn.Close()
		c.conn = conn
		_, frame, err := conn.ReadMessage()
		if err != nil {
			done <- err
			return
		}
		msg, err := decodeInboundMessage(frame)
		if err == nil {
			c.handleMessage(msg)
		}
		done <- err
	}))
	defer server.Close()
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if err := conn.WriteJSON(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(adminGoldRequestFixture)}); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if _, _, err := conn.ReadMessage(); err == nil || websocket.IsUnexpectedCloseError(err) == false {
		t.Fatal("violating transport was not actually closed", err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("admission handler did not terminate")
	}
	pending, err := adminActivityJournal.Pending(50)
	if err != nil || len(pending) != 1 || !c.transportClosed.Load() || player.Gold != 100 || len(operations.ops) != 0 || len(committer.ids) != 0 {
		t.Fatal("socket rejection lost its durable event or changed gameplay", pending, err)
	}
}

func TestAdminRejectedMutationSurvivesActivityStoreOutage(t *testing.T) {
	for _, mode := range []string{"malformed", "replaced-connection", "role-lookup", "operation-lookup", "conflicting-id",
		"missing-role-service", "missing-operation-service", "character-persistence", "character-plan",
		"admin-recovery", "casino-recovery", "trading-recovery", "prepare-failed", "prepare-ambiguous"} {
		t.Run(mode, func(t *testing.T) {
			c, roles, operations, committer, player := adminMutationFixture(t)
			dir, activity := sessionActivityFixture(t)
			payload := adminGoldRequestFixture
			switch mode {
			case "replaced-connection":
				activeSessions[c.username] = &Client{username: c.username, send: make(chan []byte, 10)}
			case "malformed":
				payload = strings.Replace(payload, `"amount":100`, `"amount":100,"actor":"forged"`, 1)
			case "role-lookup":
				roles.lookupErr = errors.New("private role-store error")
			case "operation-lookup":
				operations.getErr = errors.New("private operation-store error")
			case "missing-role-service":
				adminRoles = nil
			case "missing-operation-service":
				adminOperations = nil
			case "character-persistence":
				characterSaveCommitter = nil
			case "character-plan":
				world.RemoveEntity(player.ID) // Offline lookup fails in this fixture.
			case "admin-recovery":
				trackAdminOperation(database.AdminOperation{ID: "previous-intent", Target: "recipient",
					Audit: database.AdminActivity{Result: "success"}})
			case "casino-recovery":
				oldDB, oldCache, oldAvailable := db, blackjackCached, blackjackAvailable
				t.Cleanup(func() { db, blackjackCached, blackjackAvailable = oldDB, oldCache, oldAvailable })
				db = nil
				blackjackCached = &database.BlackjackTableRecord{TableID: publicBlackjackTable, Version: 2,
					Pending: &database.BlackjackTransfer{ID: "casino:round:bet", PlayerID: player.ID, Currency: "gold", Amount: -10}}
			case "prepare-failed", "prepare-ambiguous":
				operations.prepareErr = errors.New("private preparation failure")
				operations.insertBeforeError = mode == "prepare-ambiguous"
			case "trading-recovery":
				world.Trading.Auctions["pending-auction"] = &game.Auction{ID: "pending-auction", SellerID: "player-seller",
					Status: game.AuctionActive, Bid: 1, EndTime: time.Now().Add(time.Hour)}
				if _, err := world.Trading.PrepareAuctionBid("pending-auction", player, 10); err != nil {
					t.Fatal(err)
				}
				characterSaveCommitter = nil
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
			if mode == "trading-recovery" && !strings.Contains(event.Summary, "trading funds") {
				t.Fatal("did not exercise trading recovery rejection", event)
			}
			if mode == "replaced-connection" && (event.Result != "denied" ||
				!strings.Contains(event.Summary, "connection is no longer active") || len(operations.ops) != 0) {
				t.Fatal("stale connection created an operation or lost its rejection", event)
			}
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
	if sessionActivityJournalHealthy() || !c.transportClosed.Load() || len(unjournaledActivity.events) != 1 {
		t.Fatal("unpersisted rejection was lost, reported healthy or left an audit producer active")
	}
	var original database.AdminActivity
	for _, event := range unjournaledActivity.events {
		original = event
	}
	for i := 0; i < 100; i++ {
		c.handleMessage(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(payload)})
	}
	if len(unjournaledActivity.events) != 1 || persistUnjournaledActivity() == nil {
		t.Fatal("failed storage allowed unbounded events or an unsafe clean shutdown")
	}
	if err := os.Rename(dir+"-unavailable", dir); err != nil {
		t.Fatal(err)
	}
	activity.appendErr = nil
	if err := retryPendingAdminActivity(); err != nil {
		t.Fatal(err)
	}
	if err := retryPendingAdminActivity(); err != nil {
		t.Fatal(err)
	}
	if !sessionActivityJournalHealthy() || len(activity.events) != 1 || !reflect.DeepEqual(activity.events[0], original) ||
		player.Gold != 100 || len(committer.ids) != 0 {
		t.Fatal("recovered rejection duplicated or changed, or mutated character", activity.events)
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
