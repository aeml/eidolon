package game

import (
	"math"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

func adminTeleportFixture() (*World, *Entity, *Entity) {
	w := NewWorld(nil)
	p := &Entity{ID: "player-operator", Name: "operator", Type: TypePlayer, Health: 17, Mana: 9, State: "IDLE", X: 40, Z: 250, Gold: 50}
	a := &Entity{ID: "player-member", Name: "member", Type: TypePlayer, Health: 100, State: "IDLE", X: 50, Z: 250}
	w.AddEntity(p)
	w.AddEntity(a)
	return w, p, a
}

func TestAdminTeleportPlayerLandingReceiptResourcesAndMovementFence(t *testing.T) {
	w, p, a := adminTeleportFixture()
	plan, err := w.PlanAdminTeleport(p.ID, "player", a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if math.Hypot(plan.X-a.X, plan.Z-a.Z) < 2.5 || math.Hypot(plan.X-a.X, plan.Z-a.Z) > 7.01 {
		t.Fatal("landing overlaps destination player or is too far away")
	}
	p.Cooldowns = map[string]time.Time{"Charge": time.Now().Add(time.Minute)}
	p.WellRestedSeconds = 123
	id, fingerprint := database.AdminOperationID("operator", "teleport-request-001"), strings.Repeat("a", 64)
	found, changed, err := w.ApplyDurableAdminTeleport(p.ID, id, fingerprint, plan)
	if err != nil || !found || !changed {
		t.Fatal(found, changed, err)
	}
	if p.X != plan.X || p.Z != plan.Z || p.Health != 17 || p.Mana != 9 || p.Gold != 50 || p.WellRestedSeconds != 123 || len(p.Cooldowns) != 1 || !p.UnjournaledSave {
		t.Fatal("teleport changed build/resources or lacked save pin")
	}
	if w.UpdatePlayerMovementWithContext(p.ID, 40, 0, 250, 0, "MOVING", 1, "") {
		t.Fatal("departed movement context overwrote teleport")
	}
	p.X, p.State, p.Health = 75, "DEAD", 0
	if _, changed, err = w.ApplyDurableAdminTeleport(p.ID, id, fingerprint, plan); err != nil || changed || p.X != 75 {
		t.Fatal("receipt replay moved or revived character", err)
	}
	if _, _, err = w.ApplyDurableAdminTeleport(p.ID, id, strings.Repeat("b", 64), plan); err == nil {
		t.Fatal("conflicting receipt accepted")
	}
}

func TestAdminTeleportRejectsStaleBusyAndPrivateInstanceTargets(t *testing.T) {
	for _, change := range []func(*Entity){
		func(p *Entity) { p.Health = 0 }, func(p *Entity) { p.Disconnected = true },
		func(p *Entity) { p.State = "JUMPING" }, func(p *Entity) { p.Stunned = true },
		func(p *Entity) { p.Rooted = true }, func(p *Entity) { p.IsCharging = true },
		func(p *Entity) { p.CasinoSeat = &CasinoSeatSession{} },
	} {
		w, p, a := adminTeleportFixture()
		change(p)
		if _, err := w.PlanAdminTeleport(p.ID, "player", a.ID); err == nil {
			t.Fatal("unavailable recipient accepted")
		}
	}
	w, p, a := adminTeleportFixture()
	plan, err := w.PlanAdminTeleport(p.ID, "player", a.ID)
	if err != nil {
		t.Fatal(err)
	}
	a.X += 10
	if _, changed, err := w.ApplyDurableAdminTeleport(p.ID, database.AdminOperationID("operator", "teleport-request-001"), strings.Repeat("a", 64), plan); err == nil || changed || p.X != 40 {
		t.Fatal("stale destination moved recipient")
	}
	a.InstanceID = "dungeon_other"
	if _, err := w.PlanAdminTeleport(p.ID, "player", a.ID); err == nil {
		t.Fatal("teleport bypassed private dungeon entry")
	}
	a.InstanceID, a.CasinoVIPFloor, a.Y = CasinoInstanceID, true, 8
	if _, err := w.PlanAdminTeleport(p.ID, "player", a.ID); err == nil {
		t.Fatal("teleport bypassed VIP guard")
	}
}

func TestAdminTeleportCanonicalObstructionsAndNonfiniteLandings(t *testing.T) {
	w, p, _ := adminTeleportFixture()
	w.Mu.Lock()
	defer w.Mu.Unlock()
	for _, plan := range []AdminTeleportPlan{
		{X: -16, Z: 193},   // Current stash, not the old asset position.
		{X: -22, Z: 185},   // Rotated Trading House.
		{X: 0, Z: 178.35},  // Closed casino facade door.
		{X: 800, Z: 200},   // Dungeon entrance circle.
		{X: 150, Z: 211.7}, // Chronicle cottage rear wall.
		{X: math.NaN(), Z: 200}, {X: 0, Z: math.Inf(1)}, {X: 4000, Z: 200},
		{X: 2000, Z: -1400},                                          // Outside actual four-realm floor envelope.
		{Instance: CasinoInstanceID, X: -30, Z: 120},                 // Blackjack table.
		{Instance: CasinoInstanceID, X: 0, Z: 100},                   // Public guard.
		{Instance: CasinoInstanceID, VIP: true, Y: 8, X: 55, Z: 170}, // Outside full-floor bounds.
	} {
		if w.adminLandingClearLocked(plan, p.ID) {
			t.Fatalf("blocked/nonfinite landing accepted: %+v", plan)
		}
	}
	if !w.adminLandingClearLocked(AdminTeleportPlan{X: -1.25, Z: 200}, p.ID) {
		t.Fatal("town recall landing rejected")
	}
}

func TestAdminTeleportSamePartyDungeonUsesCanonicalFloor(t *testing.T) {
	w, p, a := adminTeleportFixture()
	w.Grid.Remove(p)
	w.Grid.Remove(a)
	p.InstanceID, a.InstanceID, p.PartyID, a.PartyID = "dungeon_admin_test", "dungeon_admin_test", "party", "party"
	p.X, p.Z, a.X, a.Z = 80000, 20000, 80010, 20000
	w.Grid.Add(p)
	w.Grid.Add(a)
	w.storeDungeonInstance(p.InstanceID, &DungeonInstance{ID: p.InstanceID, Layout: DungeonLayout{WalkRects: []DungeonWalkRect{{X: 80000, Z: 20000, Width: 40, Height: 40}}}})
	plan, err := w.PlanAdminTeleport(p.ID, "player", a.ID)
	if err != nil || plan.Instance != p.InstanceID {
		t.Fatal("same-party dungeon destination failed", err)
	}
	plan.X = 90000
	if _, changed, err := w.ApplyDurableAdminTeleport(p.ID, database.AdminOperationID("operator", "teleport-request-001"), strings.Repeat("a", 64), plan); err == nil || changed {
		t.Fatal("invalid dungeon landing applied")
	}
	a.PartyID = "different"
	if _, err := w.PlanAdminTeleport(p.ID, "player", a.ID); err == nil {
		t.Fatal("different party accepted")
	}
}

func TestAdminTeleportDarkRealmRetainsEntryAndDurableGuards(t *testing.T) {
	for _, scenario := range []string{"allowed", "outside", "underlevel", "unrepaired", "level-changed", "receipt-replay"} {
		t.Run(scenario, func(t *testing.T) {
			w, p, a := adminTeleportFixture()
			w.Grid.Remove(p)
			w.Grid.Remove(a)
			p.Level, p.Quests = 100, darkRealmEligiblePlayer("prerequisites").Quests
			p.InstanceID, a.InstanceID = DarkRealmInstanceID, DarkRealmInstanceID
			p.X, p.Z, a.X, a.Z = 40000, 40800, 40030, 40800
			// Shared world visitors need no party, but must enter normally.
			if scenario == "outside" {
				p.InstanceID = ""
			}
			if scenario == "underlevel" {
				p.Level = 99
			}
			if scenario == "unrepaired" {
				p.Quests = nil
			}
			w.Grid.Add(p)
			w.Grid.Add(a)
			plan, err := w.PlanAdminTeleport(p.ID, "player", a.ID)
			if scenario == "outside" || scenario == "underlevel" || scenario == "unrepaired" {
				if err == nil {
					t.Fatal("teleport bypassed personal expedition entry")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if scenario == "level-changed" {
				p.Level = 99
			}
			id, fingerprint := database.AdminOperationID("operator", "dark-realm-teleport-001"), strings.Repeat("d", 64)
			_, changed, err := w.ApplyDurableAdminTeleport(p.ID, id, fingerprint, plan)
			if scenario == "level-changed" {
				if err == nil || changed || p.X != 40000 {
					t.Fatal("stale eligibility applied")
				}
				return
			}
			if err != nil || !changed || p.X != plan.X || p.Z != plan.Z || p.InstanceID != DarkRealmInstanceID || p.Health != 17 || p.Mana != 9 || p.Gold != 50 {
				t.Fatal("shared realm move failed or changed resources", err)
			}
			if scenario == "receipt-replay" {
				p.X, p.Level = 40050, 99
				if _, changed, err := w.ApplyDurableAdminTeleport(p.ID, id, fingerprint, plan); err != nil || changed || p.X != 40050 {
					t.Fatal("durable replay moved player", err)
				}
			}
		})
	}
}

func TestAdminTeleportDarkRealmFloorAndDiscoveryWalls(t *testing.T) {
	w, p, _ := adminTeleportFixture()
	w.Mu.Lock()
	defer w.Mu.Unlock()
	for _, plan := range []AdminTeleportPlan{
		{Instance: DarkRealmInstanceID, X: 39650, Z: 40800}, // Void between districts.
		{Instance: DarkRealmInstanceID, X: 40000, Z: 40800, Y: 8},
		{Instance: DarkRealmInstanceID, X: 40000, Z: 40800, VIP: true},
	} {
		if w.adminLandingClearLocked(plan, p.ID) {
			t.Fatal("invalid expedition landing accepted", plan)
		}
	}
	for _, box := range adminLandingColliders.DarkRealm.Boxes {
		if box[5] > 1.3 {
			continue
		}
		if w.adminLandingClearLocked(AdminTeleportPlan{Instance: DarkRealmInstanceID, X: box[0], Z: box[1]}, p.ID) {
			t.Fatal("landing inside discovery wall accepted", box)
		}
	}
	if !w.adminLandingClearLocked(AdminTeleportPlan{Instance: DarkRealmInstanceID, X: 40000, Z: 40800}, p.ID) {
		t.Fatal("clear camp landing rejected")
	}
}
