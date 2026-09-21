package game

import (
	"errors"
	"math"
	"time"
)

// The expedition is a permanent shared world scene. Only the Nexus dungeon
// and the King's raid are party-owned runs with the usual logout expiry.
const DarkRealmInstanceID = "dark-realm"
const DarkRealmInstanceType = "dark_realm"
const darkRealmWizardID = "story-wizard-dark-realm"

type DarkRealmDistrict struct {
	ID, Name, Description string
	Room                  DungeonRoom
}

// Authored geography, not randomized dungeon rooms. The camp is the one safe
// area; the four districts form a connected circuit with a return route.
func DarkRealmDistricts() []DarkRealmDistrict {
	return []DarkRealmDistrict{
		{"resonant_foothold", "Resonant Foothold", "Maelin's four lanterns hold a small piece of Eidolon against the silence.",
			DungeonRoom{X: 40000, Z: 40800, Width: 180, Height: 180, Type: "start", Color: 0x596d8c}},
		{"unwritten_shore", "The Unwritten Shore", "Boats arrive without passengers' names. Someone has built shelters from their abandoned letters.",
			DungeonRoom{X: 40000, Z: 40400, Width: 500, Height: 500, Type: "normal", Color: 0x535b78}},
		{"tithe_of_names", "The Tithe of Names", "A royal archive preserves every oath of protection, but none of the names beneath them.",
			DungeonRoom{X: 39300, Z: 40400, Width: 500, Height: 500, Type: "normal", Color: 0x696078}},
		{"stillwater_foundry", "Stillwater Foundry", "Four stolen elemental currents turn memories into fuel for a city that cannot change.",
			DungeonRoom{X: 39300, Z: 39700, Width: 500, Height: 500, Type: "normal", Color: 0x77645b}},
		{"city_without_tomorrow", "The City Without Tomorrow", "No house burns and no child grows older. The royal bells announce the same morning.",
			DungeonRoom{X: 40000, Z: 39700, Width: 500, Height: 500, Type: "normal", Color: 0x665a80}},
	}
}

var darkRealmCanonicalLayout = buildDarkRealmLayout()

func DarkRealmLayout() DungeonLayout { return cloneDungeonLayout(darkRealmCanonicalLayout) }

func buildDarkRealmLayout() DungeonLayout {
	layout := DungeonLayout{}
	for _, district := range DarkRealmDistricts() {
		appendDungeonRoom(&layout, district.Room)
	}
	for _, edge := range [][2]int{{0, 1}, {1, 2}, {2, 3}, {3, 4}, {4, 1}} {
		connectDungeonRooms(&layout, edge[0], edge[1], 60)
	}
	return layout
}

// Caller owns the entity lock (or supplies a detached snapshot). Existing
// Nexus/finale veterans retain access even if an old save lacks earlier records.
// Nothing here grants completion, changes quoted rewards, or bypasses level100.
func DarkRealmEntryAllowed(player *Entity) bool {
	if player == nil || player.Type != TypePlayer || player.Level < 100 {
		return false
	}
	crystals, nexus, king := ChronicleAccessStatus(player)
	return crystals || nexus || king
}

func darkRealmCamp() SafeZone {
	room := DarkRealmDistricts()[0].Room
	return SafeZone{ID: "resonant-foothold", Name: "Resonant Foothold", InstanceID: DarkRealmInstanceID,
		MinX: room.X - 70, MaxX: room.X + 70, MinZ: room.Z - 70, MaxZ: room.Z + 70}
}

func (w *World) spawnDarkRealmCamp() {
	w.AddEntity(&Entity{ID: darkRealmWizardID, Type: TypeNPC, SubType: "StoryWizard",
		Name: "Archmage Ilyra · Resonant Projection", InstanceID: DarkRealmInstanceID,
		X: 40012, Z: 40800, SpawnX: 40012, SpawnZ: 40800, Y: .5, State: "IDLE", Scale: 1})
}

// Run after saved quests/level have loaded but before inserting the character
// into the spatial grid. Shared-world logout does not reset district progress;
// private Nexus/raid saves still use the separate fifteen-minute rule.
func RestoreDarkRealmPosition(player *Entity) {
	if player == nil || player.InstanceID != DarkRealmInstanceID {
		return
	}
	if !DarkRealmEntryAllowed(player) {
		player.InstanceID, player.X, player.Y, player.Z = "", -1.25, 0, 200
	} else {
		inside := false
		if finiteCoordinate(player.X) && finiteCoordinate(player.Z) {
			for _, rect := range darkRealmCanonicalLayout.WalkRects {
				inside = inside || pointInWalkRect(rect, player.X, player.Z)
			}
		}
		if !inside {
			camp := darkRealmCanonicalLayout.Rooms[0]
			player.X, player.Z = camp.X, camp.Z
		}
		player.Y = 0
	}
	player.TargetX, player.TargetZ = player.X, player.Z
}

// Called by the forthcoming guide/portal interaction. Keep the transition
// server-owned: a party leader's unlock must not carry an ineligible member in.
func (w *World) EnterDarkRealm(playerID string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	p := w.Entities[playerID]
	if p == nil {
		return errors.New("player unavailable")
	}
	p.Mu.Lock()
	defer p.Mu.Unlock()
	if !DarkRealmEntryAllowed(p) {
		return errors.New("reach level 100 and restore all four crystals before entering the Dark Realm")
	}
	if p.InstanceID == DarkRealmInstanceID {
		return nil
	}
	if p.InstanceID != "" || p.Health <= 0 || p.State == "DEAD" || p.Disconnected ||
		p.CasinoSeat != nil || p.IsCharging || p.Stunned || p.Rooted ||
		(p.State != "IDLE" && p.State != "MOVING") || time.Now().Before(p.MoveLockUntil) || w.TradeByPlayer[playerID] != "" {
		return errors.New("finish your current action before entering the Dark Realm")
	}
	guide := w.Entities["dungeon-npc-1"]
	if guide == nil || guide.Type != TypeNPC || guide.InstanceID != "" ||
		!finiteCoordinate(p.X) || !finiteCoordinate(p.Z) || math.Hypot(p.X-guide.X, p.Z-guide.Z) > 10 {
		return errors.New("speak to the Dungeon Guide in Lanternhold first")
	}
	landing := DarkRealmDistricts()[0].Room
	w.Grid.Remove(p)
	p.InstanceID, p.X, p.Y, p.Z = DarkRealmInstanceID, landing.X, 0, landing.Z
	p.TargetX, p.TargetZ, p.State = p.X, p.Z, "IDLE"
	resetSceneMovementLocked(p)
	setRecoveryMovementContextLocked(p, "")
	w.Grid.Add(p)
	return nil
}
