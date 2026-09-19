package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"go.mongodb.org/mongo-driver/bson"
)

type adminRecoveryStore struct {
	op          database.AdminOperation
	character   *database.Character
	finishError error
	finishes    int
}

func (s *adminRecoveryStore) GetAdminOperation(id string) (*database.AdminOperation, error) {
	if s.op.ID != id {
		return nil, nil
	}
	copy := s.op
	copy.Payload = bytes.Clone(copy.Payload)
	return &copy, nil
}
func (s *adminRecoveryStore) PrepareAdminOperation(op database.AdminOperation) (*database.AdminOperation, error) {
	s.op = op
	return s.GetAdminOperation(op.ID)
}
func (s *adminRecoveryStore) FinishAdminOperation(id, hash string, audit database.AdminActivity) (*database.AdminOperation, error) {
	s.finishes++
	if s.finishError != nil {
		return nil, s.finishError
	}
	if id != s.op.ID || hash != s.op.Fingerprint {
		return nil, database.ErrAdminOperationConflict
	}
	s.op.State, s.op.Audit = database.AdminOperationComplete, audit
	return s.GetAdminOperation(id)
}
func (s *adminRecoveryStore) PendingAdminOperations(_ string, _ int) ([]database.AdminOperation, error) {
	if s.op.State == database.AdminOperationComplete {
		return nil, nil
	}
	return []database.AdminOperation{s.op}, nil
}
func (s *adminRecoveryStore) GetCharacter(_, _ string) (*database.Character, error) {
	if s.character == nil {
		return nil, errors.New("missing character")
	}
	data, err := bson.Marshal(s.character)
	if err != nil {
		return nil, err
	}
	var character database.Character
	err = bson.Unmarshal(data, &character)
	return &character, err
}

type adminRecoveryCommitter struct {
	delegate *testCharacterCommitter
	store    *adminRecoveryStore
}

func (c *adminRecoveryCommitter) CommitCharacterSave(name string, character *database.Character, id string) error {
	if err := c.delegate.CommitCharacterSave(name, character, id); err != nil {
		return err
	}
	c.store.character = character
	return nil
}

func setupAdminRecovery(t *testing.T, grant game.AdminGrant) (*adminRecoveryStore, *testCharacterCommitter) {
	t.Helper()
	_, committer := setupCharacterJournalTest(t)
	old := adminOperations
	t.Cleanup(func() { adminOperations = old })
	payload, err := json.Marshal(grant)
	if err != nil {
		t.Fatal(err)
	}
	audit, err := database.NewAdminActivity("operator", "recipient", grant.Action, "request-123456789", "success", "Granted requested reward.", time.Now(), 90)
	if err != nil {
		t.Fatal(err)
	}
	store := &adminRecoveryStore{op: database.AdminOperation{Version: 1,
		ID: database.AdminOperationID("operator", "request-123456789"), Fingerprint: strings.Repeat("a", 64),
		Actor: "operator", Target: "recipient", RequestID: "request-123456789", Action: grant.Action,
		Payload: payload, State: database.AdminOperationPending, Audit: audit}}
	adminOperations = store
	characterSaveCommitter = &adminRecoveryCommitter{delegate: committer, store: store}
	return store, committer
}

func TestAdminGrantSaveAndAuditFailuresNeverDuplicateGold(t *testing.T) {
	store, committer := setupAdminRecovery(t, game.AdminGrant{Action: MsgAdminGrantGold, Amount: 10})
	world = game.NewWorld(nil)
	player := &game.Entity{ID: "player-recipient", Name: "recipient", Type: game.TypePlayer, SubType: "Wizard",
		Level: 30, Health: 17, Mana: 0, Gold: 100, State: "IDLE"}
	world.AddEntity(player)
	committer.fail = errors.New("save unavailable")
	if _, err := completeAdminOperationLocked(store.op); err == nil {
		t.Fatal("failed save reported success")
	}
	if player.Gold != 110 || store.finishes != 0 {
		t.Fatal("incorrect mutation or premature audit")
	}
	pending, err := characterSaveJournal.Read("recipient")
	if err != nil || pending == nil {
		t.Fatal("grant lost full save journal", err)
	}
	snapshot, err := pending.Character()
	if err != nil || snapshot.Gold != 110 || snapshot.AdminOperationReceipts[store.op.ID] != store.op.Fingerprint || snapshot.Resources.Mana != 0 {
		t.Fatal("journal did not couple grant, receipt and resources", err)
	}
	player.Gold += 5 // Newer live gameplay state must survive pending-save replay.
	committer.fail = nil
	store.finishError = errors.New("audit unavailable")
	if _, err := completeAdminOperationLocked(store.op); err == nil {
		t.Fatal("audit failure reported success")
	}
	if committer.saved.Gold != 115 || len(committer.ids) != 2 {
		t.Fatal("recovery duplicated grant or replaced newer state")
	}
	store.finishError = nil
	completed, err := completeAdminOperationLocked(store.op)
	if err != nil || completed.State != database.AdminOperationComplete || len(committer.ids) != 2 {
		t.Fatal("audit retry resaved character", err)
	}
	finishes := store.finishes
	if _, err := completeAdminOperationLocked(store.op); err != nil || len(committer.ids) != 2 || store.finishes != finishes {
		t.Fatal("completed replay performed work", err)
	}
	encoded, _ := json.Marshal(world.GetEntityCopy(player.ID))
	if bytes.Contains(encoded, []byte(store.op.ID)) || bytes.Contains(encoded, []byte(store.op.Fingerprint)) {
		t.Fatal("admin receipts exposed over network")
	}
}

func TestAdminGrantRestartReplaysFullSnapshotBeforeIntent(t *testing.T) {
	store, committer := setupAdminRecovery(t, game.AdminGrant{Action: MsgAdminGrantGold, Amount: 10})
	store.character = &database.Character{Name: "recipient", Gold: 100, Level: 30, Resources: &database.CharacterResources{Version: 1, Health: 17, Mana: 0},
		WellRested: &database.CharacterWellRested{Version: 1, RemainingSeconds: 123}, Equipment: map[string]database.Item{"head": {ID: "earned", Stats: map[string]int{"vitality": 7}}}}
	before, _ := store.GetCharacter("recipient", "recipient")
	committer.fail = errors.New("save unavailable")
	if _, err := completeAdminOperationLocked(store.op); err == nil {
		t.Fatal("failed save acknowledged")
	}
	if store.character.Gold != 100 {
		t.Fatal("offline in-memory mutation escaped before commit")
	}
	// Lose process-only failure state. Recovery must read the durable full save
	// before loading the character; replaying the pending intent then pays once.
	failedCharacterSaves.users = make(map[string]bool)
	committer.fail = nil
	if _, err := completeAdminOperationLocked(store.op); err != nil {
		t.Fatal(err)
	}
	after := store.character
	if after.Gold != 110 || after.AdminOperationReceipts[store.op.ID] != store.op.Fingerprint ||
		!reflect.DeepEqual(after.Equipment, before.Equipment) || !reflect.DeepEqual(after.Resources, before.Resources) || !reflect.DeepEqual(after.WellRested, before.WellRested) {
		t.Fatal("offline recovery duplicated grant or lost unrelated full-character state")
	}
}

func TestAdminItemRecoveryUsesFirstPlanAndRejectsDeadOrFullWithoutSave(t *testing.T) {
	items, err := game.GenerateAdminItems(game.AdminItemSpec{Item: "iron-sword", Rarity: game.RarityRare, Level: 70, Quantity: 2})
	if err != nil {
		t.Fatal(err)
	}
	for _, state := range []string{"alive", "dead", "full"} {
		t.Run(state, func(t *testing.T) {
			store, committer := setupAdminRecovery(t, game.AdminGrant{Action: MsgAdminGrantItem, Items: items})
			store.character = &database.Character{Name: "recipient", Gold: 100, Resources: &database.CharacterResources{Version: 1, Health: 17}}
			if state == "dead" {
				store.character.Resources.Dead = true
			}
			if state == "full" {
				for i := 0; i < game.MaxInventorySize; i++ {
					store.character.Inventory = append(store.character.Inventory, database.Item{ID: "occupied", Stack: 1, MaxStack: 1})
				}
			}
			captured := store.op
			captured.Payload = []byte(`{"action":"admin_grant_item","items":[]}`)
			completed, err := completeAdminOperationLocked(captured)
			if err != nil {
				t.Fatal(err)
			}
			if state != "alive" {
				if completed.Audit.Result != "denied" || len(committer.ids) != 0 || len(store.character.AdminOperationReceipts) != 0 {
					t.Fatal("rejected grant partially saved")
				}
				return
			}
			if completed.Audit.Result != "success" || len(committer.ids) != 1 || store.character.Inventory[0].ID != items[0].ID || store.character.Inventory[1].ID != items[1].ID {
				t.Fatal("durable item plan was rerolled or replaced")
			}
		})
	}
}
