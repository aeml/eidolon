package game

import (
	"testing"
	"time"
)

func newPvPTestWorld(players ...*Entity) *World {
	world := &World{
		Entities: make(map[string]*Entity), Parties: make(map[string]*Party), Grid: NewSpatialMap(50),
		PvP: NewPvPSystem(), OnPvPMatchComplete: func(PvPMatchResult) {},
	}
	for _, player := range players {
		if player.MaxHealth == 0 {
			player.MaxHealth, player.Health = 100, 100
		}
		world.Entities[player.ID] = player
		world.Grid.Add(player)
	}
	return world
}

func TestCombatRelationshipRequiresConsentForPlayerDamage(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer}
	second := &Entity{ID: "second", Type: TypePlayer}
	world := newPvPTestWorld(first, second)
	if got := world.CombatRelationship(first, second); got != RelationshipNeutral {
		t.Fatalf("unmatched players were %q, want neutral", got)
	}
	challenge, err := world.RequestDuel(first.ID, second.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := world.RespondDuel(second.ID, challenge.RequesterID, true); err != nil {
		t.Fatal(err)
	}
	if got := world.CombatRelationship(first, second); got != RelationshipHostile {
		t.Fatalf("duel opponents were %q, want hostile", got)
	}
}

func TestPvPDamageHasScalarAndBurstCap(t *testing.T) {
	attacker := &Entity{ID: "a", Type: TypePlayer}
	target := &Entity{ID: "b", Type: TypePlayer, MaxHealth: 1000}
	if got := ScalePvPDamage(attacker, target, 100); got != 65 {
		t.Fatalf("scaled damage = %d, want 65", got)
	}
	if got := ScalePvPDamage(attacker, target, 1000); got != 350 {
		t.Fatalf("burst-capped damage = %d, want 350", got)
	}
}

func TestDuelCompletionRestoresPlayersAndAwardsProfiles(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer, X: 1, Z: 2, MaxHealth: 100, Health: 100}
	second := &Entity{ID: "second", Type: TypePlayer, X: 3, Z: 4, MaxHealth: 100, Health: 100}
	world := newPvPTestWorld(first, second)
	_, _ = world.RequestDuel(first.ID, second.ID)
	match, err := world.RespondDuel(second.ID, first.ID, true)
	if err != nil {
		t.Fatal(err)
	}
	resolved, complete := world.RecordPvPDeath(second.ID, first.ID)
	if !complete || resolved.ID != match.ID {
		t.Fatalf("duel did not complete: %+v", resolved)
	}
	world.completePvPMatch(match.ID, false)
	if first.InstanceID != "" || second.InstanceID != "" || first.X != 1 || second.X != 3 {
		t.Fatalf("players were not restored: %+v %+v", first, second)
	}
	if profile := world.PvP.Profiles[first.ID]; profile.Wins != 1 || profile.Rating != 1025 || profile.Honor != 50 {
		t.Fatalf("winner profile incorrect: %+v", profile)
	}
}

func TestArenaQueueMatches1v1AndUsesBestOfThree(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer, MaxHealth: 100, Health: 100}
	second := &Entity{ID: "second", Type: TypePlayer, MaxHealth: 100, Health: 100}
	world := newPvPTestWorld(first, second)
	if match, err := world.JoinArenaQueue(first.ID, 1); err != nil || match != nil {
		t.Fatalf("first queue entry: %+v %v", match, err)
	}
	match, err := world.JoinArenaQueue(second.ID, 1)
	if err != nil || match == nil || match.FirstTo != 2 {
		t.Fatalf("arena match not formed: %+v %v", match, err)
	}
	if _, complete := world.RecordPvPDeath(second.ID, first.ID); complete {
		t.Fatal("arena completed after one round")
	}
	if _, complete := world.RecordPvPDeath(second.ID, first.ID); !complete {
		t.Fatal("arena did not complete at two wins")
	}
}

func TestArenaForfeitAppliesDeserterPenalty(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer, MaxHealth: 100, Health: 100}
	second := &Entity{ID: "second", Type: TypePlayer, MaxHealth: 100, Health: 100}
	world := newPvPTestWorld(first, second)
	_, _ = world.JoinArenaQueue(first.ID, 1)
	_, _ = world.JoinArenaQueue(second.ID, 1)
	world.ForfeitPvP(first.ID)
	if !time.Now().Before(world.PvP.DeserterUntil[first.ID]) {
		t.Fatal("forfeit did not apply deserter penalty")
	}
	if _, err := world.JoinArenaQueue(first.ID, 1); err == nil {
		t.Fatal("deserter re-entered arena queue")
	}
}

func TestPartyMembersRemainAlliesInside2v2(t *testing.T) {
	leader := &Entity{ID: "leader", Type: TypePlayer, PartyID: "party", MaxHealth: 100, Health: 100}
	ally := &Entity{ID: "ally", Type: TypePlayer, PartyID: "party", MaxHealth: 100, Health: 100}
	enemyA := &Entity{ID: "enemy-a", Type: TypePlayer, PartyID: "enemy-party", MaxHealth: 100, Health: 100}
	enemyB := &Entity{ID: "enemy-b", Type: TypePlayer, PartyID: "enemy-party", MaxHealth: 100, Health: 100}
	world := newPvPTestWorld(leader, ally, enemyA, enemyB)
	world.Parties["party"] = &Party{ID: "party", LeaderID: leader.ID, Members: []string{leader.ID, ally.ID}}
	world.Parties["enemy-party"] = &Party{ID: "enemy-party", LeaderID: enemyA.ID, Members: []string{enemyA.ID, enemyB.ID}}
	if _, err := world.JoinArenaQueue(leader.ID, 2); err != nil {
		t.Fatal(err)
	}
	if _, err := world.JoinArenaQueue(enemyA.ID, 2); err != nil {
		t.Fatal(err)
	}
	if world.CombatRelationship(leader, ally) != RelationshipAlly || world.CombatRelationship(leader, enemyA) != RelationshipHostile {
		t.Fatal("2v2 combat relationships are incorrect")
	}
}

func TestOpenWorldPvPRequiresMutualFlagOutsideSafeZone(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer, X: 300, Z: 200, State: "IDLE"}
	second := &Entity{ID: "second", Type: TypePlayer, X: 302, Z: 200, State: "IDLE"}
	world := newPvPTestWorld(first, second)
	if err := world.SetOpenWorldPvP(first.ID, true); err != nil {
		t.Fatal(err)
	}
	if world.CanDamage(first, second) {
		t.Fatal("one-sided flag enabled player damage")
	}
	if err := world.SetOpenWorldPvP(second.ID, true); err != nil {
		t.Fatal(err)
	}
	if !world.CanDamage(first, second) {
		t.Fatal("mutually flagged overworld players were not hostile")
	}
	if err := world.SetOpenWorldPvP(first.ID, false); err == nil {
		t.Fatal("player disabled PvP outside the safe zone")
	}
	first.X = 0
	if world.CanDamage(first, second) {
		t.Fatal("town safe zone allowed player damage")
	}
	if err := world.SetOpenWorldPvP(first.ID, false); err != nil {
		t.Fatalf("safe-zone disable failed: %v", err)
	}
}

func TestZeroRatingProfileIsNotResetInMemory(t *testing.T) {
	player := &Entity{ID: "player", Type: TypePlayer}
	world := newPvPTestWorld(player)
	world.SetPvPProfile(PvPProfile{PlayerID: player.ID, Rating: 0, Losses: 50})
	profile := world.PvPStatus(player.ID)["profile"].(PvPProfile)
	if profile.Rating != 0 || profile.Losses != 50 {
		t.Fatalf("zero-rating profile changed: %+v", profile)
	}
}
