package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

func TestActualBrowserFreshWalletThenEarnedRoomGold(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	node, evidence := os.Getenv("EIDOLON_ROOM_GOLD_BROWSER_NODE"), os.Getenv("EIDOLON_ROOM_GOLD_BROWSER_EVIDENCE")
	if !filepath.IsAbs(node) || !filepath.IsAbs(evidence) {
		t.Fatal("requires absolute browser Node and owned evidence paths")
	}
	type account struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Class    string `json:"characterClass"`
	}
	var accounts []account
	var fixtures []*database.Character
	var operations []database.DungeonRoomRewardOperation
	preparedWorld := game.NewWorld(nil)
	defer preparedWorld.StopBackground()
	for index := 0; index < 2; index++ {
		fixture, password := loadPreparedClassFixture(t, repo, 0, 40)
		fixture.Gold, fixture.EP, fixture.X, fixture.Z = 1000, 43, -1.25, 200
		fixture.Inventory = nil
		for i := 0; i < 25; i++ {
			fixture.Inventory = append(fixture.Inventory, database.Item{ID: fmt.Sprintf("room-gold-keep-%d", i), Name: "Prepared invested chest", Type: "ARMOR", Slot: "chest", Rarity: "Rare", Potency: 1, Stack: 1, MaxStack: 1, Value: 200, Level: 1, StatScaleVersion: game.ItemStatScaleVersion})
		}
		if index == 0 {
			fixture.Inventory[24] = database.Item{ID: "room-gold-sale", Name: "Prepared spare sword", Type: "WEAPON", Slot: "mainHand", Rarity: "Common", Value: 3, Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}
		}
		fixture.Stash = []database.Item{{ID: "room-gold-stash-keep", Name: "Prepared stored chest", Type: "ARMOR", Slot: "chest", Rarity: "Legendary", Stack: 1, MaxStack: 1, Level: 1, StatScaleVersion: game.ItemStatScaleVersion}}
		if err := repo.SaveCharacter(fixture.Name, fixture); err != nil {
			t.Fatal(err)
		}
		// Capture an actual server-calculated retained entitlement. Preparing
		// saved accounts/room records is fixture setup, not a combat claim.
		layout := game.DungeonLayout{Rooms: []game.DungeonRoom{{Type: "start", Width: 40, Height: 40}, {Type: "normal", Hook: "elite_ambush", X: 100, Width: 40, Height: 40}, {Type: "boss", X: 200, Width: 40, Height: 40}}}
		instance := &game.DungeonInstance{ID: "dungeon_room_gold_" + fixture.Name, Layout: layout, RunLevel: 40, DungeonType: "verdant_bastion_catacombs", Difficulty: game.DifficultyNormal,
			RoomState: game.NewDungeonRoomState(layout), PlayerRoomSummary: map[string]game.DungeonRoomSummary{}}
		preparedWorld.InstanceLayouts[instance.ID] = instance
		actor := &game.Entity{ID: "player-" + fixture.Name, Name: fixture.Name, Type: game.TypePlayer, Level: 40, Health: 10, InstanceID: instance.ID, ResonanceRanks: map[string]int{"fortune": 1}}
		preparedWorld.AddEntity(actor)
		op, err := preparedWorld.PrepareDungeonRoomReward(instance.ID, 1)
		if err != nil || len(op.Participants) != 1 || op.Participants[0].Gold != 175 || len(op.Participants[0].Items) != 1 {
			t.Fatal("unexpected actual prepared room entitlement", err)
		}
		if _, err := repo.PrepareDungeonRoomReward(op); err != nil {
			t.Fatal(err)
		}
		accounts = append(accounts, account{fixture.Name, password, fixture.Class})
		fixtures, operations = append(fixtures, fixture), append(operations, op)
	}
	encoded, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 17926, "-save-journal-dir", t.TempDir())
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 180*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, node, "node_modules/@playwright/test/cli.js", "test", "tests/e2e/vendor-room-reward-boundary.spec.js", "--workers=1", "--retries=0", "--output="+filepath.Join(evidence, "browser-results"))
	cmd.Dir = root
	cmd.Env = append(os.Environ(), "EIDOLON_E2E_ROOM_GOLD_BOUNDARY=1", "EIDOLON_E2E_ROOM_GOLD_ACCOUNTS="+string(encoded), "EIDOLON_E2E_ROOM_GOLD_EVIDENCE="+evidence,
		"EIDOLON_E2E_USERNAME="+accounts[0].Username, "EIDOLON_E2E_PASSWORD="+accounts[0].Password,
		"EIDOLON_E2E_USERNAME_SECONDARY="+accounts[1].Username, "EIDOLON_E2E_PASSWORD_SECONDARY="+accounts[1].Password,
		"EIDOLON_E2E_REGISTER=0", "EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome", "EIDOLON_E2E_WEB_PORT=4201", "EIDOLON_E2E_BASE_URL=http://127.0.0.1:4201",
		"EIDOLON_E2E_REUSE_SERVER=0", "EIDOLON_E2E_WS_URL=ws://"+address+"/ws", "EIDOLON_E2E_BACKEND_ORIGIN_IP=", "EIDOLON_E2E_HEADLESS=1", "CI=", "PLAYWRIGHT_NO_COPY_PROMPT=1")
	log, err := os.OpenFile(filepath.Join(evidence, "browser.log"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	cmd.Stdout, cmd.Stderr = log, log
	started := time.Now()
	runErr := cmd.Run()
	if err := log.Close(); err != nil {
		t.Fatal(err)
	}
	stop()
	sanitizeCtx, sanitizeCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer sanitizeCancel()
	sanitize := exec.CommandContext(sanitizeCtx, node, "scripts/sanitize-playwright-artifacts.mjs", evidence, filepath.Join(root, "playwright-report"))
	sanitize.Dir, sanitize.Env = root, cmd.Env
	if err := sanitize.Run(); err != nil {
		t.Fatal("browser artifact credential sanitation failed")
	}
	t.Log("native room Gold evidence credential sanitization completed")
	if runErr != nil {
		t.Fatalf("room Gold browser diagnostic failed; owned evidence=%s", evidence)
	}
	for index, fixture := range fixtures {
		op := operations[index]
		var earned game.Item
		if err := json.Unmarshal([]byte(op.Participants[0].Items[0]), &earned); err != nil {
			t.Fatal(err)
		}
		wantGold := fixture.Gold + op.Participants[0].Gold
		wantInventory := append([]database.Item{databaseItem(earned)}, fixture.Inventory[1:]...)
		wantStash := append(append([]database.Item{}, fixture.Stash...), fixture.Inventory[0])
		if index == 0 {
			wantGold += fixture.Inventory[24].Value
			wantInventory = append(append([]database.Item{}, fixture.Inventory[:24]...), databaseItem(earned))
			wantStash = fixture.Stash
		}
		saved, err := repo.GetCharacter(fixture.Name, fixture.Name)
		if err != nil || saved == nil || !saved.LastLogout.After(started) || saved.Gold != wantGold || saved.EP != fixture.EP || saved.XP != fixture.XP+op.Participants[0].XP ||
			!reflect.DeepEqual(saved.Equipment, fixture.Equipment) || !reflect.DeepEqual(saved.Inventory, wantInventory) || !reflect.DeepEqual(saved.Stash, wantStash) ||
			len(saved.Buyback) != 0 || len(saved.PendingBossLoot) != 0 || !database.DungeonRoomRewardCharacterReceiptMatches(saved, op) {
			if saved == nil {
				t.Fatal("room Gold saved character missing", err)
			}
			t.Fatalf("room Gold exact save mismatch: err=%v Gold=%d/%d EP=%d/%d XP=%d/%d logout=%t equipment=%t inventory=%t stash=%t buyback=%d pendingBoss=%d receipt=%t",
				err, saved.Gold, wantGold, saved.EP, fixture.EP, saved.XP, fixture.XP+op.Participants[0].XP,
				saved.LastLogout.After(started), reflect.DeepEqual(saved.Equipment, fixture.Equipment), reflect.DeepEqual(saved.Inventory, wantInventory), reflect.DeepEqual(saved.Stash, wantStash),
				len(saved.Buyback), len(saved.PendingBossLoot), database.DungeonRoomRewardCharacterReceiptMatches(saved, op))
		}
		record, err := repo.GetDungeonRoomReward(op.ID)
		if err != nil || record == nil || record.State != database.DungeonRoomRewardComplete || record.Fingerprint != op.Fingerprint {
			t.Fatal("saved entitlement did not complete its exact immutable record", err)
		}
	}
	t.Log("actual QA helpers verified exact bag credits plus separate earned175Gold; exact fresh login/Mongo receipts, original gear/bag/stash and economy verified")
}
