package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"
	"google.golang.org/protobuf/proto"
)

func TestMagmaGroundReplicatesTypedFootprintWithoutPrivateBudgetFlags(t *testing.T) {
	field := &game.Entity{ID: "magma-wire", Type: game.TypeProjectile, SubType: "MagmaGround", OwnerID: "mage",
		InstanceID: "dungeon", X: 50001, Y: 0, Z: 50002, Radius: 5, Scale: 1, Damage: 29,
		ProjectileRuneID: "fireball_magma", ProjectileSkill: "Fireball", ZoneDamagePvPScaled: true, ZoneEndTime: time.Now().Add(3 * time.Second)}
	snapshot := entityToSnapshot(field)
	data, err := proto.Marshal(entityToProto(field))
	if err != nil {
		t.Fatal(err)
	}
	var received statepb.Entity
	if err := proto.Unmarshal(data, &received); err != nil {
		t.Fatal(err)
	}
	if received.SubType != "MagmaGround" || received.Type != "Projectile" || received.Scale != 1 || received.Y != 0 || received.OwnerId != "mage" {
		t.Fatal("wire lost typed stationary field footprint")
	}
	if snapshot.Scale != 1 {
		t.Fatal("delta snapshot lost the fixed field scale")
	}
	public, err := json.Marshal(entityToProto(field))
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"fireball_magma", "zoneDamagePvPScaled", "zoneEndTime"} {
		if strings.Contains(string(public), secret) {
			t.Fatalf("public field leaked private budget metadata%s", secret)
		}
	}
}
