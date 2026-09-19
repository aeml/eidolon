package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"github.com/gorilla/websocket"
)

// Production message admission, two real sockets, real Mongo, full character
// saves and a process restart. Never permitted against an unlabelled live URI.
func TestAdminMutationsActualSocketsAndRestart(t *testing.T) {
	if os.Getenv("EIDOLON_ADMIN_DISPOSABLE_DATABASE") != "1" {
		t.Skip("requires disposable loopback Mongo and a built server")
	}
	uri, binary := os.Getenv("MONGO_URI"), os.Getenv("EIDOLON_RESOURCE_BINARY")
	if !regexp.MustCompile(`^mongodb://127\.0\.0\.1:[0-9]+/?$`).MatchString(uri) || !filepath.IsAbs(binary) {
		t.Fatal("requires isolated loopback Mongo and absolute binary")
	}
	repo, err := database.New(uri)
	if err != nil {
		t.Fatal(err)
	}
	defer repo.Close(context.Background())
	operator, member := fmt.Sprintf("admin-mutation-%d", time.Now().UnixNano()), fmt.Sprintf("member-mutation-%d", time.Now().UnixNano())
	for _, account := range []string{operator, member} {
		if err := repo.CreateUser(account, account+"@example.invalid", account+"-test-password"); err != nil {
			t.Fatal(err)
		}
		if err := repo.CreateCharacter(account, &database.Character{Name: account, Class: "Wizard", Level: 30, Gold: 400,
			ProgressionVersion: game.CurrentProgressionVersion, X: -1.25, Z: 200,
			Stats:     database.Stats{Strength: 10, Dexterity: 10, Intelligence: 30, Wisdom: 30, Vitality: 20},
			Resources: &database.CharacterResources{Version: 1, Health: 100, Mana: 50}}); err != nil {
			t.Fatal(err)
		}
	}
	if granted, err := repo.GrantAdminRole(operator, operator, "disposable_integration_fixture"); err != nil || !granted {
		t.Fatal(granted, err)
	}
	journal := t.TempDir()
	address, stop := compatStartServer(t, binary, uri, 501, "-save-journal-dir", journal)
	defer stop()
	a, _ := resourceLoginCharacter(t, address, operator, operator+"-test-password", "Wizard")
	b, _ := resourceLoginCharacter(t, address, member, member+"-test-password", "Wizard")
	request := func(conn *websocket.Conn, action string, fields map[string]any) adminMutationResult {
		t.Helper()
		resourceSend(t, conn, action, fields)
		var result adminMutationResult
		resourceReadMessage(t, conn, action+"_result", &result)
		return result
	}
	base := func(id string) map[string]any {
		return map[string]any{"id": id, "target": member, "reason": "Disposable endpoint verification", "confirmed": true}
	}
	gold := base("socket-gold-0000001")
	gold["amount"] = 123
	if result := request(b, MsgAdminGrantGold, gold); result.Success || result.Authorized || !result.Final {
		t.Fatal("ordinary account granted currency", result)
	}
	for i := 0; i < 2; i++ {
		if result := request(a, MsgAdminGrantGold, gold); !result.Success || !result.Final {
			t.Fatal("Gold request/replay failed", result)
		}
	}
	item := base("socket-item-0000001")
	item["item"], item["rarity"], item["level"], item["quantity"] = "iron-sword", "Rare", 30, 2
	if result := request(a, MsgAdminGrantItem, item); !result.Success || !result.Final {
		t.Fatal("item creation failed", result)
	}
	var inventory []game.Item
	resourceReadMessage(t, b, MsgInventory, &inventory)
	// The socket may still contain the initial inventory or the Gold refresh.
	for len(inventory) < 2 || inventory[0].ID == "" || inventory[0].Rarity != game.RarityRare {
		resourceReadMessage(t, b, MsgInventory, &inventory)
	}
	itemIDs := [2]string{inventory[0].ID, inventory[1].ID}
	for _, mode := range []string{"to-member", "bring-member", "town"} {
		fields := base("socket-teleport-" + mode)
		fields["destination"] = "player"
		if mode == "to-member" {
			fields["target"], fields["destinationPlayer"] = operator, member
		} else if mode == "bring-member" {
			fields["destinationPlayer"] = operator
		} else {
			fields["destination"] = "town"
		}
		if result := request(a, MsgAdminTeleport, fields); !result.Success || !result.Final {
			t.Fatal(mode, result)
		}
	}
	saved := resourceCloseAndWait(t, repo, b, member)
	resourceCloseAndWait(t, repo, a, operator)
	if saved.Gold != 523 || saved.Inventory[0].ID != itemIDs[0] || saved.Inventory[1].ID != itemIDs[1] || saved.InstanceID != "" {
		t.Fatal("mutations not saved exactly once")
	}
	stop()
	address, stopRestart := compatStartServer(t, binary, uri, 502, "-save-journal-dir", journal)
	defer stopRestart()
	a, _ = resourceLoginCharacter(t, address, operator, operator+"-test-password", "Wizard")
	// Shutdown legitimately journals all loaded characters once more. Compare
	// replay saves against the post-shutdown baseline, not the earlier disconnect.
	beforeReplay, err := repo.GetCharacter(member, member)
	if err != nil {
		t.Fatal(err)
	}
	// A completed receipt succeeds even with its recipient currently offline.
	for action, payload := range map[string]map[string]any{MsgAdminGrantGold: gold, MsgAdminGrantItem: item} {
		if result := request(a, action, payload); !result.Success || !result.Final {
			t.Fatal("restart replay failed", result)
		}
	}
	restored, err := repo.GetCharacter(member, member)
	if err != nil || restored.Gold != 523 || restored.Inventory[0].ID != itemIDs[0] || restored.Inventory[1].ID != itemIDs[1] || restored.LastSaveID != beforeReplay.LastSaveID {
		t.Fatal("restart replay changed grant, roll or save identity", err)
	}
	history, err := repo.ReadAdminActivity(database.AdminActivityQuery{Actor: operator})
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, event := range history.Entries {
		if isAdminMutation(event.Action) {
			counts[event.Action]++
			if event.Result != "success" || event.Reason != "Disposable endpoint verification" {
				t.Fatal("missing sanitized success audit with reason")
			}
		}
	}
	if counts[MsgAdminGrantGold] != 1 || counts[MsgAdminGrantItem] != 1 || counts[MsgAdminTeleport] != 3 {
		t.Fatal("missing or duplicated mutation audit", counts)
	}
	resourceCloseAndWait(t, repo, a, operator)
	t.Log("real two-account sockets: non-admin denial, Gold, canonical items, self/player/town teleports, inventory sync, saved restart and exact receipt/audit replay passed")
}
