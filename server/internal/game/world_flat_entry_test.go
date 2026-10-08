package game

import "testing"

func TestFlatTerrainRecoversRaisedReturningPlayers(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	for _, class := range []string{"Fighter", "Rogue", "Cleric", "Wizard"} {
		p := newTestPlayer("flat-returning-"+class, class)
		p.X, p.Y, p.Z = -102, 7, -340
		p.TargetX, p.TargetZ = p.X, p.Z
		p.Health, p.Mana, p.Gold, p.EP = 37, 13, 4567, 9
		w.AddEntity(p)
		if p.X != -102 || p.Y != 0 || p.Z != -340 || p.TargetX != p.X || p.TargetZ != p.Z {
			t.Fatal("flat entry retained obsolete surface height or changed horizontal position")
		}
		if p.Health != 37 || p.Mana != 13 || p.Gold != 4567 || p.EP != 9 {
			t.Fatal("flat height recovery changed character resources/currencies")
		}
	}
}

func TestFlatTerrainEntryPreservesOwnedHeights(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	for _, p := range []*Entity{
		{ID: "flat-casino", Type: TypePlayer, InstanceID: CasinoInstanceID, Y: 8},
		{ID: "flat-dungeon", Type: TypePlayer, InstanceID: "dungeon_test", Y: 8},
		{ID: "flat-jump", Type: TypePlayer, State: "JUMPING", Y: 8},
		{ID: "flat-service", Type: TypeNPC, Y: 8},
		{ID: "flat-projectile", Type: TypeProjectile, Y: 8},
		{ID: "flat-loot", Type: TypeLoot, Y: 8},
	} {
		w.recoverWorldEntryLocked(p)
		if p.Y != 8 {
			t.Fatalf("flat entry replaced owned height: %s", p.ID)
		}
	}
}
