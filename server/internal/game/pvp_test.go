package game

import (
	"sync"
	"sync/atomic"
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

func startTestPvPMatch(w *World, mode string, teamA, teamB []string) *PvPMatch {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	return w.startPvPMatchLocked(mode, teamA, teamB)
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

func TestDuelCompletionRestoresPlayersWithoutRankedRewards(t *testing.T) {
	first := &Entity{ID: "first", Type: TypePlayer, X: 1, Z: 2, MaxHealth: 100, Health: 100}
	second := &Entity{ID: "second", Type: TypePlayer, X: 3, Z: 4, MaxHealth: 100, Health: 100}
	world := newPvPTestWorld(first, second)
	before := PvPProfile{PlayerID: first.ID, Rating: 1100, Wins: 4, Honor: 200, SeasonPoints: 12}
	var result PvPMatchResult
	world.OnPvPMatchComplete = func(value PvPMatchResult) { result = value }
	world.SetPvPProfile(before)
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
	if profile := world.PvP.Profiles[first.ID]; profile != before {
		t.Fatalf("practice duel changed ranked profile: %+v", profile)
	}
	if _, exists := world.PvP.Profiles[second.ID]; exists {
		t.Fatal("practice duel created a ranked loss profile")
	}
	if len(result.Profiles) != 0 || len(result.WinnerIDs) != 1 || len(result.LoserIDs) != 1 {
		t.Fatalf("practice result must notify both players without ranked records: %+v", result)
	}
}

func TestArena2v2ScoresOnlyAfterTeamElimination(t *testing.T) {
	a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
	c, d := &Entity{ID: "c", Type: TypePlayer}, &Entity{ID: "d", Type: TypePlayer}
	w := newPvPTestWorld(a, b, c, d)
	match := startTestPvPMatch(w, PvPModeArena2v2, []string{a.ID, b.ID}, []string{c.ID, d.ID})
	first, complete := w.RecordPvPDeath(c.ID, a.ID)
	if complete || first.ScoreA != 0 || first.Round != 1 {
		t.Fatalf("first team member death ended the round: %+v", first)
	}
	if repeated, _ := w.RecordPvPDeath(c.ID, b.ID); repeated != nil {
		t.Fatal("duplicate elimination was accepted")
	}
	if w.CanDamage(c, a) || w.CanDamage(a, c) || !w.CanDamage(d, a) {
		t.Fatal("elimination must suspend only the eliminated participant")
	}
	if opponents := w.PvPStatus(a.ID)["opponents"].([]string); len(opponents) != 1 || opponents[0] != d.ID {
		t.Fatal("client targeting included an eliminated opponent")
	}
	w.resetPvPRound(match.ID, 1)
	if current := w.PvPStatus(a.ID)["match"].(*PvPMatch); current.Round != 1 || len(current.Eliminated) != 1 {
		t.Fatal("a partial elimination allowed an early round reset")
	}
	wiped, complete := w.RecordPvPDeath(d.ID, b.ID)
	if complete || wiped.ScoreA != 1 || !wiped.RoundPending || wiped.Round != 1 {
		t.Fatalf("team wipe did not award exactly one round: %+v", wiped)
	}
	if w.CanDamage(a, d) {
		t.Fatal("combat remained enabled during intermission")
	}
	if opponents := w.PvPStatus(a.ID)["opponents"].([]string); len(opponents) != 0 {
		t.Fatal("client targeting remained hostile during intermission")
	}
	if duplicate, _ := w.RecordPvPDeath(a.ID, d.ID); duplicate != nil {
		t.Fatal("intermission awarded another elimination")
	}
	w.OnPvPMatchUpdate = func(updated *PvPMatch) {
		// Re-entrant status reads prove callbacks happen after world/PvP unlock.
		if current := w.PvPStatus(a.ID)["match"].(*PvPMatch); current.Round != updated.Round {
			t.Fatal("round reset callback published a stale snapshot")
		}
	}
	w.resetPvPRound(match.ID, 1)
	if current := w.PvPStatus(a.ID)["match"].(*PvPMatch); current.Round != 2 || current.RoundPending || len(current.Eliminated) != 0 || !w.CanDamage(c, a) {
		t.Fatal("round reset did not restore participants and combat")
	}
	if next, _ := w.RecordPvPDeath(c.ID, a.ID); next.ScoreA != 1 {
		t.Fatal("next round ended after one elimination")
	}
	w.resetPvPRound(match.ID, 1) // Stale callback from the previous round.
	if current := w.PvPStatus(a.ID)["match"].(*PvPMatch); current.Round != 2 || len(current.Eliminated) != 1 {
		t.Fatal("stale timer revived an eliminated participant")
	}
	if finished, complete := w.RecordPvPDeath(d.ID, b.ID); !complete || finished.ScoreA != 2 || len(finished.WinnerIDs) != 2 {
		t.Fatalf("second team wipe did not end best-of-three: %+v", finished)
	}
}

func TestArenaConcurrentEliminationIsRecordedOnce(t *testing.T) {
	w := newPvPTestWorld(&Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer})
	match := startTestPvPMatch(w, PvPModeArena1v1, []string{"a"}, []string{"b"})
	var accepted atomic.Int32
	var workers sync.WaitGroup
	for i := 0; i < 32; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			if recorded, _ := w.RecordPvPDeath("b", "a"); recorded != nil {
				accepted.Add(1)
			}
		}()
	}
	workers.Wait()
	if current := w.PvP.Matches[match.ID]; accepted.Load() != 1 || current.ScoreA != 1 || current.Status != PvPMatchActive {
		t.Fatalf("duplicate concurrent deaths altered score: %+v, accepted %d", current, accepted.Load())
	}
}

func TestPvPRecoveryCannotBypassMatchAndPracticeForfeitHasNoPenalty(t *testing.T) {
	for _, mode := range []string{PvPModeDuel, PvPModeArena1v1} {
		t.Run(mode, func(t *testing.T) {
			a, b := &Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}
			w := newPvPTestWorld(a, b)
			match := startTestPvPMatch(w, mode, []string{a.ID}, []string{b.ID})
			a.Health, a.State = 0, "DEAD"
			if err := w.PerformRespawn(a.ID); err == nil {
				t.Fatal("town respawn bypassed PvP recovery")
			}
			if err := w.PerformRecall(a.ID); err == nil {
				t.Fatal("town recall bypassed PvP forfeit")
			}
			if a.Health != 0 || a.InstanceID != match.ID {
				t.Fatal("rejected recovery mutated player")
			}
			w.ForfeitPvP(a.ID)
			if w.HasPvPMatch(a.ID) || a.InstanceID != "" || a.Health != a.MaxHealth {
				t.Fatal("forfeit did not restore player")
			}
			if mode == PvPModeDuel && (len(w.PvP.Profiles) != 0 || len(w.PvP.DeserterUntil) != 0) {
				t.Fatal("practice forfeit applied ranked rewards or deserter penalty")
			}
		})
	}
}

func TestArenaThreeRoundsAwardsBothTeamsOnce(t *testing.T) {
	w := newPvPTestWorld(&Entity{ID: "a", Type: TypePlayer}, &Entity{ID: "b", Type: TypePlayer}, &Entity{ID: "c", Type: TypePlayer}, &Entity{ID: "d", Type: TypePlayer})
	match := startTestPvPMatch(w, PvPModeArena2v2, []string{"a", "b"}, []string{"c", "d"})
	for round, defeated := range [][]string{{"a", "b"}, {"c", "d"}, {"a", "b"}} {
		attacker := "a"
		if defeated[0] == "a" {
			attacker = "c"
		}
		for _, id := range defeated {
			w.RecordPvPDeath(id, attacker)
		}
		if round < 2 {
			w.resetPvPRound(match.ID, round+1)
		}
	}
	w.completePvPMatch(match.ID, false)
	w.completePvPMatch(match.ID, false)
	for _, id := range []string{"a", "b", "c", "d"} {
		profile := w.PvP.Profiles[id]
		if id == "c" || id == "d" {
			if profile.Wins != 1 || profile.Rating != 1025 || profile.Honor != 50 || profile.SeasonPoints != 3 {
				t.Fatalf("winner rewards: %+v", profile)
			}
		} else if profile.Losses != 1 || profile.Rating != 980 || profile.Honor != 15 || profile.SeasonPoints != 1 {
			t.Fatalf("loser rewards: %+v", profile)
		}
	}
}

func TestArena2v2RealAttacksPreserveSurvivorAndAutomaticallyFinishMatch(t *testing.T) {
	players := make([]*Entity, 0, 4)
	for _, id := range []string{"a", "b", "c", "d"} {
		players = append(players, &Entity{ID: id, Type: TypePlayer, SubType: "Fighter", Damage: 100,
			MaxHealth: 100, Health: 100, MaxMana: 100, Mana: 100, AttackCooldown: 10 * time.Millisecond})
	}
	w := newPvPTestWorld(players...)
	results := make(chan PvPMatchResult, 1)
	w.OnPvPMatchComplete = func(result PvPMatchResult) { results <- result }
	match := startTestPvPMatch(w, PvPModeArena2v2, []string{"a", "b"}, []string{"c", "d"})
	waitFor := func(description string, predicate func() bool) {
		t.Helper()
		deadline := time.Now().Add(6 * time.Second)
		for time.Now().Before(deadline) {
			if predicate() {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatalf("timed out waiting for %s", description)
	}
	attackUntilEliminated := func(targetID string) {
		t.Helper()
		target := w.GetEntityCopy(targetID)
		// Position the fixture in melee range, but use the ordinary asynchronous
		// attack/damage/death pipeline; never edit health or force a kill. The
		// production opening/round invulnerability clocks expire naturally.
		w.Mu.Lock()
		attacker := w.Entities["a"]
		attacker.Mu.Lock()
		w.Grid.Remove(attacker)
		attacker.X, attacker.Z = target.X-1, target.Z
		w.Grid.Add(attacker)
		attacker.Mu.Unlock()
		w.Mu.Unlock()
		waitFor("opening protection", func() bool { return time.Now().After(w.GetEntityCopy(targetID).InvulnerableEndTime) })
		waitFor("normal attacks eliminating "+targetID, func() bool {
			if w.GetEntityCopy(targetID).State == "DEAD" {
				return true
			}
			w.PerformAttack("a", targetID)
			return false
		})
	}
	attackUntilEliminated("c")
	// Longer than the old erroneous first-death reset timer.
	time.Sleep(3200 * time.Millisecond)
	if current := w.PvPStatus("a")["match"].(*PvPMatch); current.Round != 1 || current.ScoreA != 0 || w.GetEntityCopy("c").State != "DEAD" || w.GetEntityCopy("d").Health != 100 {
		t.Fatalf("one real death changed the round or surviving teammate: %+v", current)
	}
	attackUntilEliminated("d")
	waitFor("automatic second round", func() bool {
		current := w.PvPStatus("a")["match"].(*PvPMatch)
		return current.Round == 2 && !current.RoundPending && w.GetEntityCopy("c").Health == 100
	})
	attackUntilEliminated("c")
	attackUntilEliminated("d")
	select {
	case result := <-results:
		if result.MatchID != match.ID || len(result.WinnerIDs) != 2 || len(result.Profiles) != 4 {
			t.Fatalf("incorrect combat result: %+v", result)
		}
	case <-time.After(6 * time.Second):
		t.Fatal("normal combat did not automatically complete the match")
	}
	for _, player := range players {
		snapshot := w.GetEntityCopy(player.ID)
		if snapshot.InstanceID != "" || snapshot.Health != snapshot.MaxHealth || w.HasPvPMatch(player.ID) {
			t.Fatal("combat result did not restore every participant")
		}
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
	world.resetPvPRound(match.ID, 1)
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
