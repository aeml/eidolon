package main

import (
	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"encoding/json"
	"testing"

	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func cosmeticRequest(offer game.CosmeticOffer) Message {
	payload, _ := json.Marshal(map[string]interface{}{"id": offer.ID, "confirmed": true, "priceEP": offer.PriceEP})
	return Message{Type: MsgBuyCosmetic, Payload: payload}
}

func cosmeticHandlerPlayer(t *testing.T) (*Client, *testCharacterCommitter, string) {
	t.Helper()
	c, committer, dir := epWalletFixture(t)
	p := world.Entities[c.playerID]
	p.X, p.Z, p.EP = 12, 185, 100
	return c, committer, dir
}

func cosmeticResponse(t *testing.T, c *Client) struct {
	Success, Pending bool
	EP               int
	PlayerID         string
} {
	t.Helper()
	var msg Message
	var result struct {
		Success, Pending bool
		EP               int
		PlayerID         string
	}
	select {
	case data := <-c.send:
		if err := json.Unmarshal(data, &msg); err != nil || msg.Type != MsgCosmeticVendorResult {
			t.Fatal("missing cosmetic response", string(data), err)
		}
		if err := json.Unmarshal(msg.Payload, &result); err != nil {
			t.Fatal(err)
		}
	default:
		t.Fatal("cosmetic response not sent")
	}
	return result
}

func TestCosmeticVendorHandlerCommitsEPAndUnlockBeforeSuccess(t *testing.T) {
	c, committer, _ := cosmeticHandlerPlayer(t)
	offer := game.CosmeticCatalogue()[0]
	c.handleCosmeticVendor(cosmeticRequest(offer))
	response := cosmeticResponse(t, c)
	if response.PlayerID != c.playerID || !response.Success || response.Pending || response.EP != 75 || committer.saved.EP != 75 || committer.saved.Gold != 3_000_000 || committer.saved.AppearanceCollection[game.AppearanceKey(offer.Appearance)].BaseName != offer.Name {
		t.Fatal("cosmetic acknowledgement without durable debit/unlock", response)
	}
	c.handleCosmeticVendor(cosmeticRequest(offer))
	if replay := cosmeticResponse(t, c); replay != response {
		t.Fatal("duplicate charged EP again", replay)
	}
	// The real appearance travels through existing protobuf fields, not a new
	// stat item. Other clients can render it without visiting the vendor first.
	p := world.Entities[c.playerID]
	p.Equipment = map[string]game.Item{"chest": {ID: "real-armor", Name: "Plate Mail", Slot: "chest", Type: game.ItemArmor, Stats: map[string]int{"defense": 99}}}
	if err := world.SelectAppearance(c.playerID, "chest", game.AppearanceKey(offer.Appearance)); err != nil {
		t.Fatal(err)
	}
	wire, err := proto.Marshal(entityToProto(world.GetEntityCopy(c.playerID)))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(wire, &decoded); err != nil || decoded.Appearances["chest"].BaseName != offer.Name || decoded.Equipment["chest"].Name != "Plate Mail" || decoded.Equipment["chest"].Stats["defense"] != 99 {
		t.Fatal("cosmetic replication changed or omitted combat gear", err)
	}
}

func TestFullOutfitWardrobePersistsAndReplicatesWithoutReplacingGear(t *testing.T) {
	c, committer, _ := cosmeticHandlerPlayer(t)
	var offer game.CosmeticOffer
	for _, candidate := range game.CosmeticCatalogue() {
		if candidate.Kind == "outfit" {
			offer = candidate
			break
		}
	}
	if offer.ID == "" {
		t.Fatal("missing complete outfit offer")
	}
	c.handleCosmeticVendor(cosmeticRequest(offer))
	if response := cosmeticResponse(t, c); !response.Success || response.Pending {
		t.Fatal("outfit unlock did not commit", response)
	}
	p := world.Entities[c.playerID]
	p.Equipment = map[string]game.Item{
		"chest":    {ID: "real-armor", Name: "Plate Mail", Slot: "chest", Type: game.ItemArmor, Stats: map[string]int{"defense": 99}},
		"mainHand": {ID: "real-sword", Name: "Iron Sword", Slot: "mainHand", Type: game.ItemWeapon},
	}
	hand := game.EquipmentAppearance{BaseName: "Iron Sword", Slot: "mainHand", Rarity: game.RarityCommon}
	p.Appearances = map[string]game.EquipmentAppearance{"mainHand": hand}
	payload, _ := json.Marshal(map[string]string{"slot": "outfit", "key": game.AppearanceKey(offer.Appearance)})
	c.handleWardrobe(Message{Type: MsgSelectAppearance, Payload: payload})
	var response Message
	if err := json.Unmarshal(<-c.send, &response); err != nil || response.Type != MsgWardrobeResult {
		t.Fatal("missing wardrobe response", err)
	}
	var result struct{ Success bool }
	if err := json.Unmarshal(response.Payload, &result); err != nil || !result.Success {
		t.Fatal("garment selection failed", err)
	}
	if committer.saved.Appearances["outfit"].Slot != "outfit" || committer.saved.Appearances["mainHand"].BaseName != hand.BaseName || committer.saved.Equipment["chest"].ID != "real-armor" {
		t.Fatal("garment selection was not durably saved with original gear")
	}
	saved, err := json.Marshal(committer.saved)
	if err != nil {
		t.Fatal(err)
	}
	var reloaded database.Character
	if err := json.Unmarshal(saved, &reloaded); err != nil || reloaded.Appearances["outfit"].BaseName != offer.Name {
		t.Fatal("garment selection did not survive character serialization", err)
	}
	wire, err := proto.Marshal(entityToProto(world.GetEntityCopy(c.playerID)))
	if err != nil {
		t.Fatal(err)
	}
	var decoded statepb.Entity
	if err := proto.Unmarshal(wire, &decoded); err != nil || decoded.Appearances["outfit"].BaseName != offer.Name || decoded.Appearances["mainHand"].BaseName != hand.BaseName || decoded.Equipment["chest"].Stats["defense"] != 99 {
		t.Fatal("remote garment replication lost independent gear or hand look", err)
	}
}

func TestCosmeticVendorPendingSaveRecoversBothSidesWithoutResaleItem(t *testing.T) {
	c, committer, dir := cosmeticHandlerPlayer(t)
	offer := game.CosmeticCatalogue()[0]
	characterSaveCommitter = &epFailAfterPreflight{delegate: committer}
	c.handleCosmeticVendor(cosmeticRequest(offer))
	if response := cosmeticResponse(t, c); response.Success || !response.Pending {
		t.Fatal("unsaved cosmetic claimed success", response)
	}
	world = nil
	var err error
	characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	characterSaveCommitter = committer
	failedCharacterSaves.users = map[string]bool{}
	if err := retryPendingCharacterSaves(); err != nil {
		t.Fatal(err)
	}
	if committer.saved.EP != 75 || committer.saved.AppearanceCollection[game.AppearanceKey(offer.Appearance)].BaseName != offer.Name || committer.saved.Gold != 3_000_000 || len(committer.saved.Inventory) != 0 || len(committer.saved.Stash) != 0 {
		t.Fatal("recovery lost cosmetic/debit or created a resale item")
	}
}
