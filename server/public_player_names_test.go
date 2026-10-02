package main

import (
	"eidolon-server/internal/game"
	"testing"
)

func TestPublicNameSnapshotKeepsIdentityAndDetectsStationaryRename(t *testing.T) {
	w := game.NewWorld(nil)
	player := &game.Entity{ID: "player-original", Name: "original", Type: game.TypePlayer, State: "IDLE", Level: 1, PublicName: "Arcanis Dawn"}
	w.AddEntity(player)
	snapshot := entityToSnapshot(player)
	if snapshot.PublicName != "Arcanis Dawn" || entityToProto(player).Name != "Arcanis Dawn" {
		t.Fatal("public label absent from wire or delta baseline")
	}
	if !w.SetPlayerPublicName(player.ID, "Moon Keeper") || !hasEntityChanged(player, snapshot) {
		t.Fatal("stationary rename was not delta-visible")
	}
	copy := w.GetEntityCopy(player.ID)
	if copy.Name != "original" || copy.ID != "player-original" || copy.DisplayName() != "Moon Keeper" {
		t.Fatal("display correction changed ownership or was lost in snapshot", copy.Name, copy.ID, copy.PublicName)
	}
	if entityToProto(copy).Name != "Moon Keeper" {
		t.Fatal("detached protobuf lost public label")
	}
	w.SetPlayerPublicName(player.ID, "Third Label")
	if copy.DisplayName() != "Moon Keeper" {
		t.Fatal("public-name copy aliases live state")
	}
	w.AddEntity(&game.Entity{ID: "npc", Name: "Archmage Ilyra", Type: game.TypeNPC, PublicName: "ignored"})
	if w.SetPlayerPublicName("npc", "bad") || w.GetEntityCopy("npc").DisplayName() != "Archmage Ilyra" || w.SetPlayerPublicName("missing", "bad") || w.SetPlayerPublicName(player.ID, "") {
		t.Fatal("public-name update accepted invalid target")
	}
}
