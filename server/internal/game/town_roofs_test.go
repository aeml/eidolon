package game

import (
	"math"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func TestEveryTownRoofSupportsAuthoritativeJumpWalkAndJumpDown(t *testing.T) {
	for _, placement := range townRoofs.placements {
		t.Run(placement.ID, func(t *testing.T) {
			w := newTestWorld()
			p := newTestPlayer("roof-walker", "Fighter")
			p.X, p.Z = placement.X-32, placement.Z
			p.MovementContext, p.RecoveryContextReady = "roof-session", true
			w.AddEntity(p)
			id, height, ok := townRoofs.sample(placement.X, placement.Z, placement.ID)
			if !ok || id != placement.ID {
				t.Fatal("authored center has no roof support")
			}
			if !w.StartPlayerJumpWithContext(p.ID, placement.X, 999999, placement.Z, "roof-session") {
				t.Fatal("reachable roof rejected")
			}
			if math.Abs(p.JumpTargetY-height) > 1e-6 {
				t.Fatal("jump trusted the client's height")
			}
			w.updateEntity(p, p.JumpDuration+.001, nil, &deferredActions{})
			if p.State != "IDLE" || p.SupportSurface != id || math.Abs(p.Y-height) > 1e-6 {
				t.Fatal("landing lost its roof")
			}
			nextX := p.X + .1
			_, nextHeight, ok := townRoofs.sample(nextX, p.Z, id)
			if !ok {
				t.Fatal("roof center cannot support a short step")
			}
			if !w.UpdatePlayerMovementWithContext(p.ID, nextX, 10000, p.Z, 0, "MOVING", 1, "roof-session") {
				t.Fatal("ordinary roof step rejected")
			}
			if p.SupportSurface != id || math.Abs(p.Y-nextHeight) > 1e-6 {
				t.Fatal("walking floated or trusted the supplied height")
			}
			x, z := p.X+20, p.Z
			for {
				if _, _, found := townRoofs.sample(x, z, ""); !found {
					break
				}
				x += 20
			}
			if !w.StartPlayerJumpWithContext(p.ID, x, 88888, z, "roof-session") {
				t.Fatal("jump down rejected")
			}
			if p.JumpTargetY != 0 {
				t.Fatal("jump down retained the departed roof height")
			}
			w.updateEntity(p, p.JumpDuration+.001, nil, &deferredActions{})
			if p.Y != 0 || p.SupportSurface != "" || p.State != "IDLE" {
				t.Fatal("jump down stranded roof ownership")
			}
		})
	}
}

func TestWalkingOverRoofEdgeFallsAndSavedSupportIsRecovered(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("saved-roof", "Cleric")
	roof := townRoofs.placements[0]
	id, height, ok := townRoofs.sample(roof.X, roof.Z, roof.ID)
	if !ok {
		t.Fatal("missing fixture roof")
	}
	p.X, p.Y, p.Z = roof.X, height, roof.Z
	p.MovementContext, p.RecoveryContextReady = "edge-session", true
	w.AddEntity(p)
	if p.SupportSurface != id || p.Y != height {
		t.Fatal("valid returning roof position was flattened")
	}
	started := time.Now()
	for step := 1; step < 30 && !p.roofFalling; step++ {
		context := "edge-session"
		if !w.updatePlayerMovementAt(p.ID, roof.X+float64(step)*.5, 90000, roof.Z, 0, "MOVING", uint64(step), &context, started.Add(time.Duration(step)*time.Second)) {
			t.Fatal("ordinary edge step failed")
		}
	}
	if p.SupportSurface != "" || !p.roofFalling || p.Y <= 0 || p.Y > height+.001 {
		t.Fatal("edge walk snapped instead of starting a fall")
	}
	for i := 0; i < 60; i++ {
		w.updateRoofFallLocked(p, .05)
	}
	if p.Y != 0 || p.roofFalling {
		t.Fatal("fall did not reach terrain")
	}
	forged := newTestPlayer("forged-floor", "Fighter")
	forged.X, forged.Y, forged.Z = roof.X, 700, roof.Z
	w.AddEntity(forged)
	if forged.Y != 0 || forged.SupportSurface != "" {
		t.Fatal("unmatched saved height became a roof")
	}
}

func TestRoofAndGroundMeleeCannotStrikeThroughRoof(t *testing.T) {
	w := newTestWorld()
	w.SafeZones = &SafeZoneRegistry{} // Exercise geometry, independently of town's normal combat protection.
	defer w.StopBackground()
	p := newTestPlayer("roof-melee", "Fighter")
	p.X, p.Z = -74, 130
	_, p.Y, _ = townRoofs.sample(p.X, p.Z, "")
	w.AddEntity(p)
	e := &Entity{ID: "below-roof", Type: TypeEnemy, SubType: "Skeleton", X: p.X, Z: p.Z, Health: 100, MaxHealth: 100, Scale: 1, Damage: 20}
	w.AddEntity(e)
	if !w.CanDamage(p, e) || !w.CanDamage(e, p) {
		t.Fatal("fixture protection would hide a reach failure")
	}
	if _, ok := w.PerformAttack(p.ID, e.ID); ok {
		t.Fatal("player melee reached through roof")
	}
	if _, ok := w.PerformAttack(e.ID, p.ID); ok {
		t.Fatal("enemy melee reached through roof")
	}
	beforePlayer, beforeEnemy := p.Health, e.Health
	w.applyAttackImpact(p.ID, e.ID, "", nil, 0)
	w.applyAttackImpact(e.ID, p.ID, "", nil, 0)
	if p.Health != beforePlayer || e.Health != beforeEnemy {
		t.Fatal("delayed impact bypassed roof separation")
	}
	p.SupportSurface = ""
	p.Y = 0
	w.applyAttackImpact(p.ID, e.ID, "", nil, 0)
	if e.Health == beforeEnemy {
		t.Fatal("ground contact control did not deal damage")
	}
}

func TestRoofLootKeepsItsFloorInFlatAndRaisedProfiles(t *testing.T) {
	for _, raised := range []bool{false, true} {
		t.Run(map[bool]string{false: "flat", true: "raised"}[raised], func(t *testing.T) {
			var field *worldElevationField
			if raised {
				var err error
				field, err = readWorldElevationCandidate()
				if err != nil {
					t.Fatal(err)
				}
			}
			w := newWorldWithElevation(nil, field)
			p := newTestPlayer("roof-dropper", "Rogue")
			p.X, p.Z = -74, 130
			id, height, _ := townRoofs.sample(p.X, p.Z, "")
			p.Y = height
			w.AddEntity(p)
			item := Item{ID: "roof-item", Name: "Roof item", Stack: 1, MaxStack: 1}
			loot := &Entity{ID: "roof-loot", Type: TypeLoot, X: p.X, Y: height + .5, Z: p.Z, LootItem: &item}
			w.AddEntity(loot)
			if loot.SupportSurface != id || loot.Y != height+.5 {
				t.Fatal("roof loot was dropped through its supporting surface")
			}
			ground := &Entity{ID: "ground-loot", Type: TypeLoot, X: p.X, Y: .5, Z: p.Z, LootItem: &item}
			w.AddEntity(ground)
			if ground.SupportSurface != "" || ground.Y != .5 {
				t.Fatal("ground loot was pulled onto an unrelated roof")
			}
		})
	}
}

func TestRoofDurableDropRestoreAndPickupKeepFloorAndCustody(t *testing.T) {
	w, source, recipient, item := groundItemFixture(t)
	for _, p := range []*Entity{source, recipient} {
		p.InstanceID, p.X, p.Z = "", -74, 130
		p.SupportSurface, p.Y, _ = townRoofs.sample(p.X, p.Z, "")
	}
	drop, err := w.PrepareDurableInventoryDrop(source.ID, 0, item.ID, 1)
	if err != nil || drop.Version != 3 || drop.Y != source.Y+.5 || drop.SupportSurface != source.SupportSurface {
		t.Fatal("roof drop did not freeze its authoritative floor", err)
	}
	if _, err := w.ApplyDurableGroundItem(drop); err != nil {
		t.Fatal(err)
	}
	available := time.Now().UTC().Truncate(time.Millisecond)
	if err := w.CompleteGroundItemProjection(drop, groundSavedReceipt(source), available); err != nil {
		t.Fatal(err)
	}
	fresh := newTestWorld()
	t.Cleanup(fresh.StopBackground)
	if err := fresh.RestoreGroundItemProjection(completedGroundRecord(drop, available), groundSavedReceipt(source)); err != nil {
		t.Fatal(err)
	}
	loot := fresh.GetEntityCopy(drop.LootID)
	if loot == nil || loot.Y != drop.Y || loot.SupportSurface != drop.SupportSurface || loot.LootItem.ID != item.ID {
		t.Fatal("cold roof projection lost floor or metadata")
	}
	recipient.Y, recipient.SupportSurface = 0, ""
	if _, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID); err == nil || w.GetEntityCopy(drop.LootID).GroundItemReservation != "" {
		t.Fatal("ground player picked up or reserved loot through the roof")
	}
	recipient.Y, recipient.SupportSurface = source.Y, source.SupportSurface
	pickup, err := w.PrepareDurableGroundPickup(recipient.ID, drop.LootID)
	if err != nil || pickup.Version != 3 || pickup.Y != drop.Y || pickup.SupportSurface != drop.SupportSurface {
		t.Fatal("roof pickup changed frozen floor", err)
	}
	if changed, err := w.ApplyDurableGroundItem(pickup); err != nil || !changed {
		t.Fatal(changed, err)
	}
	if err := w.CompleteGroundItemProjection(pickup, groundSavedReceipt(recipient), available); err != nil {
		t.Fatal(err)
	}
	if err := fresh.RestoreGroundItemProjection(completedGroundRecord(pickup, available), groundSavedReceipt(recipient)); err != nil {
		t.Fatal(err)
	}
	if fresh.GetEntityCopy(drop.LootID) != nil || recipient.Inventory[0].ID != item.ID || len(recipient.ItemDeliveryReceipts) != 0 {
		t.Fatal("saved roof pickup duplicated loot or grew legacy receipts")
	}
	if changed, err := recipient.ApplyGroundItemCharacterEffect(pickup); err != nil || changed {
		t.Fatal("roof replay repeated custody", err)
	}
	unknown := drop
	unknown.SupportSurface = "removed-roof"
	unknown.Fingerprint, _ = database.GroundItemFingerprint(unknown)
	if err := restoreGroundItemFloor(&Entity{}, unknown); err == nil {
		t.Fatal("unknown retained roof silently became ground loot")
	}
}
