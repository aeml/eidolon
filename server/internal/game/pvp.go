package game

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"
)

const (
	PvPModeDuel     = "duel"
	PvPModeArena1v1 = "arena_1v1"
	PvPModeArena2v2 = "arena_2v2"

	PvPMatchActive   = "active"
	PvPMatchComplete = "complete"
)

type CombatRelationship string

const (
	RelationshipSelf    CombatRelationship = "self"
	RelationshipAlly    CombatRelationship = "ally"
	RelationshipHostile CombatRelationship = "hostile"
	RelationshipNeutral CombatRelationship = "neutral"
)

type DuelChallenge struct {
	RequesterID string    `json:"requesterId"`
	TargetID    string    `json:"targetId"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

type PvPOrigin struct {
	InstanceID string  `json:"instanceId"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Z          float64 `json:"z"`
}

type PvPMatch struct {
	ID        string               `json:"id"`
	Mode      string               `json:"mode"`
	TeamA     []string             `json:"teamA"`
	TeamB     []string             `json:"teamB"`
	ScoreA    int                  `json:"scoreA"`
	ScoreB    int                  `json:"scoreB"`
	FirstTo   int                  `json:"firstTo"`
	Round     int                  `json:"round"`
	Status    string               `json:"status"`
	StartedAt time.Time            `json:"startedAt"`
	EndsAt    time.Time            `json:"endsAt"`
	Origins   map[string]PvPOrigin `json:"-"`
	WinnerIDs []string             `json:"winnerIds,omitempty"`
}

type PvPProfile struct {
	PlayerID     string    `json:"playerId"`
	Rating       int       `json:"rating"`
	Wins         int       `json:"wins"`
	Losses       int       `json:"losses"`
	Honor        int       `json:"honor"`
	SeasonPoints int       `json:"seasonPoints"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type PvPMatchResult struct {
	MatchID   string       `json:"matchId"`
	Mode      string       `json:"mode"`
	WinnerIDs []string     `json:"winnerIds"`
	LoserIDs  []string     `json:"loserIds"`
	Profiles  []PvPProfile `json:"profiles"`
	Forfeit   bool         `json:"forfeit"`
}

type arenaQueueEntry struct {
	Players  []string
	QueuedAt time.Time
}

type PvPSystem struct {
	mu            sync.RWMutex
	Challenges    map[string]DuelChallenge
	Queues        map[int][]arenaQueueEntry
	Matches       map[string]*PvPMatch
	MatchByPlayer map[string]string
	Profiles      map[string]PvPProfile
	DeserterUntil map[string]time.Time
	OpenWorldFlag map[string]bool
	now           func() time.Time
}

func NewPvPSystem() *PvPSystem {
	return &PvPSystem{
		Challenges: make(map[string]DuelChallenge), Queues: map[int][]arenaQueueEntry{1: {}, 2: {}},
		Matches: make(map[string]*PvPMatch), MatchByPlayer: make(map[string]string),
		Profiles: make(map[string]PvPProfile), DeserterUntil: make(map[string]time.Time), OpenWorldFlag: make(map[string]bool), now: time.Now,
	}
}

func (w *World) CombatRelationship(source, target *Entity) CombatRelationship {
	if source == nil || target == nil {
		return RelationshipNeutral
	}
	if source.ID == target.ID {
		return RelationshipSelf
	}
	if source.InstanceID != target.InstanceID {
		return RelationshipNeutral
	}
	if source.Type == TypePlayer && target.Type == TypeEnemy || source.Type == TypeEnemy && target.Type == TypePlayer {
		return RelationshipHostile
	}
	if source.Type == TypePlayer && (target.Type == TypeNPC || target.Type == TypeForge || target.Type == TypeStash || target.Type == TypeTradingHouse) {
		return RelationshipAlly
	}
	if source.Type == TypePlayer && target.Type == TypePlayer {
		if source.PartyID != "" && source.PartyID == target.PartyID {
			return RelationshipAlly
		}
		if w.PvP != nil && w.PvP.areOpponents(source.ID, target.ID) {
			return RelationshipHostile
		}
		if w.PvP != nil && w.PvP.areOpenWorldOpponents(source, target) {
			return RelationshipHostile
		}
		return RelationshipNeutral
	}
	return RelationshipNeutral
}

func (w *World) CanDamage(source, target *Entity) bool {
	return w.CombatRelationship(source, target) == RelationshipHostile
}

const overworldPvPSafeZoneRadius = 125.0

func inOverworldPvPSafeZone(entity *Entity) bool {
	if entity == nil || entity.InstanceID != "" {
		return false
	}
	return math.Hypot(entity.X, entity.Z-200) <= overworldPvPSafeZoneRadius
}

func (system *PvPSystem) areOpenWorldOpponents(first, second *Entity) bool {
	if first == nil || second == nil || first.InstanceID != "" || second.InstanceID != "" || inOverworldPvPSafeZone(first) || inOverworldPvPSafeZone(second) {
		return false
	}
	system.mu.RLock()
	defer system.mu.RUnlock()
	return system.OpenWorldFlag[first.ID] && system.OpenWorldFlag[second.ID]
}

func (w *World) SetOpenWorldPvP(playerID string, enabled bool) error {
	w.Mu.RLock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer || player.Disconnected || player.State == "DEAD" || player.InstanceID != "" {
		w.Mu.RUnlock()
		return errors.New("open-world PvP can only be changed while alive in the overworld")
	}
	inSafeZone := inOverworldPvPSafeZone(player)
	w.Mu.RUnlock()
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	if w.PvP.MatchByPlayer[playerID] != "" || w.PvP.playerQueuedLocked(playerID) {
		return errors.New("leave the PvP match or queue first")
	}
	if !enabled && !inSafeZone && w.PvP.OpenWorldFlag[playerID] {
		return errors.New("return to the town PvP safe zone to disable your flag")
	}
	w.PvP.OpenWorldFlag[playerID] = enabled
	return nil
}

func (system *PvPSystem) areOpponents(first, second string) bool {
	system.mu.RLock()
	defer system.mu.RUnlock()
	matchID := system.MatchByPlayer[first]
	if matchID == "" || system.MatchByPlayer[second] != matchID {
		return false
	}
	match := system.Matches[matchID]
	return match != nil && match.Status == PvPMatchActive && playersOnOpposingTeams(match, first, second)
}

func playersOnOpposingTeams(match *PvPMatch, first, second string) bool {
	return containsPlayer(match.TeamA, first) && containsPlayer(match.TeamB, second) || containsPlayer(match.TeamB, first) && containsPlayer(match.TeamA, second)
}

func containsPlayer(players []string, playerID string) bool {
	for _, candidate := range players {
		if candidate == playerID {
			return true
		}
	}
	return false
}

func (w *World) RequestDuel(requesterID, targetID string) (DuelChallenge, error) {
	w.Mu.RLock()
	requester, target := w.Entities[requesterID], w.Entities[targetID]
	if requester == nil || target == nil || requester.Type != TypePlayer || target.Type != TypePlayer || requester.Disconnected || target.Disconnected {
		w.Mu.RUnlock()
		return DuelChallenge{}, errors.New("duel player is unavailable")
	}
	valid := requester.InstanceID == "" && target.InstanceID == "" && requester.State != "DEAD" && target.State != "DEAD" && math.Hypot(requester.X-target.X, requester.Z-target.Z) <= 15
	w.Mu.RUnlock()
	if requesterID == targetID || !valid {
		return DuelChallenge{}, errors.New("duels require two nearby players in the town safe zone")
	}
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	if w.PvP.MatchByPlayer[requesterID] != "" || w.PvP.MatchByPlayer[targetID] != "" {
		return DuelChallenge{}, errors.New("a player is already in PvP")
	}
	challenge := DuelChallenge{RequesterID: requesterID, TargetID: targetID, ExpiresAt: w.PvP.now().Add(30 * time.Second)}
	w.PvP.Challenges[targetID] = challenge
	return challenge, nil
}

func (w *World) RespondDuel(targetID, requesterID string, accepted bool) (*PvPMatch, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	challenge, ok := w.PvP.Challenges[targetID]
	if !ok || challenge.RequesterID != requesterID || w.PvP.now().After(challenge.ExpiresAt) {
		return nil, errors.New("duel challenge not found or expired")
	}
	delete(w.PvP.Challenges, targetID)
	if !accepted {
		return nil, nil
	}
	for _, playerID := range []string{requesterID, targetID} {
		player := w.Entities[playerID]
		if player == nil || player.Disconnected || player.InstanceID != "" || player.State == "DEAD" || w.PvP.MatchByPlayer[playerID] != "" {
			return nil, errors.New("duel player is no longer available")
		}
	}
	return w.startPvPMatchLocked(PvPModeDuel, []string{requesterID}, []string{targetID}), nil
}

func (w *World) JoinArenaQueue(playerID string, teamSize int) (*PvPMatch, error) {
	if teamSize != 1 && teamSize != 2 {
		return nil, errors.New("arena size must be 1 or 2")
	}
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil || player.Type != TypePlayer || player.Disconnected || player.InstanceID != "" || player.State == "DEAD" {
		return nil, errors.New("player is not available for arena queue")
	}
	players := []string{playerID}
	if teamSize == 2 {
		if player.PartyID == "" {
			return nil, errors.New("2v2 queue requires a two-player party")
		}
		party := w.Parties[player.PartyID]
		if party == nil {
			return nil, errors.New("party not found")
		}
		_, leaderID, members := party.GetSnapshot()
		if leaderID != playerID || len(members) != 2 {
			return nil, errors.New("party leader must queue an exact two-player party")
		}
		players = append([]string(nil), members...)
		sort.Strings(players)
	}
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	now := w.PvP.now()
	for _, queuedID := range players {
		queuedPlayer := w.Entities[queuedID]
		if queuedPlayer == nil || queuedPlayer.Disconnected || queuedPlayer.InstanceID != "" || w.PvP.MatchByPlayer[queuedID] != "" {
			return nil, errors.New("team member is unavailable")
		}
		if now.Before(w.PvP.DeserterUntil[queuedID]) {
			return nil, errors.New("arena deserter penalty is active")
		}
		if w.PvP.playerQueuedLocked(queuedID) {
			return nil, errors.New("player is already queued")
		}
	}
	queue := append(w.PvP.Queues[teamSize], arenaQueueEntry{Players: players, QueuedAt: now})
	if len(queue) < 2 {
		w.PvP.Queues[teamSize] = queue
		return nil, nil
	}
	first, second := queue[0], queue[1]
	w.PvP.Queues[teamSize] = queue[2:]
	mode := PvPModeArena1v1
	if teamSize == 2 {
		mode = PvPModeArena2v2
	}
	return w.startPvPMatchLocked(mode, first.Players, second.Players), nil
}

func (system *PvPSystem) playerQueuedLocked(playerID string) bool {
	for _, queue := range system.Queues {
		for _, entry := range queue {
			if containsPlayer(entry.Players, playerID) {
				return true
			}
		}
	}
	return false
}

func (w *World) startPvPMatchLocked(mode string, teamA, teamB []string) *PvPMatch {
	now := w.PvP.now()
	match := &PvPMatch{
		ID: fmt.Sprintf("pvp-%d", now.UnixNano()), Mode: mode,
		TeamA: append([]string(nil), teamA...), TeamB: append([]string(nil), teamB...),
		FirstTo: 1, Round: 1, Status: PvPMatchActive, StartedAt: now, EndsAt: now.Add(10 * time.Minute), Origins: make(map[string]PvPOrigin),
	}
	if mode != PvPModeDuel {
		match.FirstTo = 2
	}
	for teamIndex, team := range [][]string{teamA, teamB} {
		for memberIndex, playerID := range team {
			player := w.Entities[playerID]
			w.Grid.Remove(player)
			match.Origins[playerID] = PvPOrigin{InstanceID: player.InstanceID, X: player.X, Y: player.Y, Z: player.Z}
			player.InstanceID = match.ID
			player.X = -8 + float64(teamIndex)*16
			player.Z = -3 + float64(memberIndex)*6
			player.Y = 0
			player.Health = player.MaxHealth
			player.Mana = player.MaxMana
			player.State = "IDLE"
			player.InvulnerableEndTime = now.Add(3 * time.Second)
			w.Grid.Add(player)
			w.PvP.MatchByPlayer[playerID] = match.ID
		}
	}
	w.PvP.Matches[match.ID] = match
	return copyPvPMatch(match)
}

func copyPvPMatch(match *PvPMatch) *PvPMatch {
	if match == nil {
		return nil
	}
	copyMatch := *match
	copyMatch.TeamA = append([]string(nil), match.TeamA...)
	copyMatch.TeamB = append([]string(nil), match.TeamB...)
	copyMatch.WinnerIDs = append([]string(nil), match.WinnerIDs...)
	copyMatch.Origins = make(map[string]PvPOrigin, len(match.Origins))
	for id, origin := range match.Origins {
		copyMatch.Origins[id] = origin
	}
	return &copyMatch
}

func ScalePvPDamage(source, target *Entity, damage int) int {
	if source == nil || target == nil || source.Type != TypePlayer || target.Type != TypePlayer || damage <= 0 {
		return damage
	}
	damage = damage * 65 / 100
	cap := target.MaxHealth * 35 / 100
	if cap < 1 {
		cap = 1
	}
	if damage > cap {
		damage = cap
	}
	if damage < 1 {
		damage = 1
	}
	return damage
}

func (w *World) RecordPvPDeath(targetID, attackerID string) (*PvPMatch, bool) {
	if w.PvP == nil {
		return nil, false
	}
	w.PvP.mu.Lock()
	defer w.PvP.mu.Unlock()
	match := w.PvP.Matches[w.PvP.MatchByPlayer[targetID]]
	if match == nil || match.Status != PvPMatchActive || !playersOnOpposingTeams(match, targetID, attackerID) {
		return nil, false
	}
	if containsPlayer(match.TeamA, targetID) {
		match.ScoreB++
	} else {
		match.ScoreA++
	}
	complete := match.ScoreA >= match.FirstTo || match.ScoreB >= match.FirstTo
	if complete {
		match.Status = PvPMatchComplete
		if match.ScoreA > match.ScoreB {
			match.WinnerIDs = append([]string(nil), match.TeamA...)
		} else {
			match.WinnerIDs = append([]string(nil), match.TeamB...)
		}
	} else {
		match.Round++
	}
	return copyPvPMatch(match), complete
}

func (w *World) ResolvePvPDeath(targetID, attackerID string) {
	match, complete := w.RecordPvPDeath(targetID, attackerID)
	if match == nil {
		return
	}
	if w.OnPvPMatchUpdate != nil {
		w.OnPvPMatchUpdate(match)
	}
	if complete {
		go func() {
			time.Sleep(2 * time.Second)
			w.completePvPMatch(match.ID, false)
		}()
		return
	}
	go func() {
		time.Sleep(3 * time.Second)
		w.resetPvPRound(match.ID)
	}()
}

func (w *World) resetPvPRound(matchID string) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.PvP.mu.RLock()
	match := w.PvP.Matches[matchID]
	if match == nil || match.Status != PvPMatchActive {
		w.PvP.mu.RUnlock()
		return
	}
	teamA := append([]string(nil), match.TeamA...)
	teamB := append([]string(nil), match.TeamB...)
	w.PvP.mu.RUnlock()
	now := time.Now()
	for teamIndex, team := range [][]string{teamA, teamB} {
		for memberIndex, playerID := range team {
			player := w.Entities[playerID]
			if player == nil {
				continue
			}
			w.Grid.Remove(player)
			player.X = -8 + float64(teamIndex)*16
			player.Z = -3 + float64(memberIndex)*6
			player.Health = player.MaxHealth
			player.Mana = player.MaxMana
			player.State = "IDLE"
			player.InvulnerableEndTime = now.Add(2 * time.Second)
			w.Grid.Add(player)
		}
	}
}

func (w *World) ForfeitPvP(playerID string) {
	if w.PvP == nil || playerID == "" {
		return
	}
	w.PvP.mu.Lock()
	match := w.PvP.Matches[w.PvP.MatchByPlayer[playerID]]
	if match == nil || match.Status != PvPMatchActive {
		w.PvP.removeFromQueuesLocked(playerID)
		w.PvP.mu.Unlock()
		return
	}
	if containsPlayer(match.TeamA, playerID) {
		match.WinnerIDs = append([]string(nil), match.TeamB...)
	} else {
		match.WinnerIDs = append([]string(nil), match.TeamA...)
	}
	match.Status = PvPMatchComplete
	w.PvP.DeserterUntil[playerID] = w.PvP.now().Add(5 * time.Minute)
	matchID := match.ID
	w.PvP.mu.Unlock()
	w.completePvPMatch(matchID, true)
}

func (system *PvPSystem) removeFromQueuesLocked(playerID string) {
	for size, queue := range system.Queues {
		filtered := queue[:0]
		for _, entry := range queue {
			if !containsPlayer(entry.Players, playerID) {
				filtered = append(filtered, entry)
			}
		}
		system.Queues[size] = filtered
	}
}

func (w *World) completePvPMatch(matchID string, forfeit bool) {
	w.Mu.Lock()
	w.PvP.mu.Lock()
	match := w.PvP.Matches[matchID]
	if match == nil || match.Status != PvPMatchComplete {
		w.PvP.mu.Unlock()
		w.Mu.Unlock()
		return
	}
	winners := append([]string(nil), match.WinnerIDs...)
	if len(winners) == 0 {
		// A completed match must always have a winner. Treat a malformed result as
		// cancelled and restore everyone without awarding rating or currency.
		for _, playerID := range append(append([]string(nil), match.TeamA...), match.TeamB...) {
			if player := w.Entities[playerID]; player != nil {
				w.Grid.Remove(player)
				origin := match.Origins[playerID]
				player.InstanceID, player.X, player.Y, player.Z = origin.InstanceID, origin.X, origin.Y, origin.Z
				player.Health, player.Mana, player.State = player.MaxHealth, player.MaxMana, "IDLE"
				w.Grid.Add(player)
			}
			delete(w.PvP.MatchByPlayer, playerID)
		}
		delete(w.PvP.Matches, matchID)
		w.PvP.mu.Unlock()
		w.Mu.Unlock()
		return
	}
	losers := append([]string(nil), match.TeamA...)
	if containsPlayer(match.TeamA, winners[0]) {
		losers = append([]string(nil), match.TeamB...)
	}
	profiles := make([]PvPProfile, 0, len(winners)+len(losers))
	for _, playerID := range append(append([]string(nil), winners...), losers...) {
		profile, exists := w.PvP.Profiles[playerID]
		if !exists {
			profile = PvPProfile{PlayerID: playerID, Rating: 1000}
		}
		if containsPlayer(winners, playerID) {
			profile.Wins++
			profile.Rating += 25
			profile.Honor += 50
			profile.SeasonPoints += 3
		} else {
			profile.Losses++
			profile.Rating -= 20
			if profile.Rating < 0 {
				profile.Rating = 0
			}
			profile.Honor += 15
			profile.SeasonPoints++
		}
		profile.UpdatedAt = time.Now().UTC()
		w.PvP.Profiles[playerID] = profile
		profiles = append(profiles, profile)
		if player := w.Entities[playerID]; player != nil {
			w.Grid.Remove(player)
			origin := match.Origins[playerID]
			player.InstanceID, player.X, player.Y, player.Z = origin.InstanceID, origin.X, origin.Y, origin.Z
			player.Health, player.Mana, player.State = player.MaxHealth, player.MaxMana, "IDLE"
			player.InvulnerableEndTime = time.Now().Add(3 * time.Second)
			w.Grid.Add(player)
		}
		delete(w.PvP.MatchByPlayer, playerID)
	}
	delete(w.PvP.Matches, matchID)
	result := PvPMatchResult{MatchID: match.ID, Mode: match.Mode, WinnerIDs: winners, LoserIDs: losers, Profiles: profiles, Forfeit: forfeit}
	w.PvP.mu.Unlock()
	w.Mu.Unlock()
	if w.OnPvPMatchComplete != nil {
		w.OnPvPMatchComplete(result)
	}
}

func (w *World) UpdatePvP(now time.Time) {
	if w.PvP == nil {
		return
	}
	w.PvP.mu.Lock()
	for targetID, challenge := range w.PvP.Challenges {
		if now.After(challenge.ExpiresAt) {
			delete(w.PvP.Challenges, targetID)
		}
	}
	expiredMatches := make([]string, 0)
	for matchID, match := range w.PvP.Matches {
		if match.Status == PvPMatchActive && now.After(match.EndsAt) {
			match.Status = PvPMatchComplete
			if match.ScoreA >= match.ScoreB {
				match.WinnerIDs = append([]string(nil), match.TeamA...)
			} else {
				match.WinnerIDs = append([]string(nil), match.TeamB...)
			}
			expiredMatches = append(expiredMatches, matchID)
		}
	}
	w.PvP.mu.Unlock()
	for _, matchID := range expiredMatches {
		w.completePvPMatch(matchID, false)
	}
}

func (w *World) PvPStatus(playerID string) map[string]interface{} {
	status := map[string]interface{}{"queued": 0}
	if w.PvP == nil {
		return status
	}
	playerSnapshot := w.GetEntityCopy(playerID)
	w.PvP.mu.RLock()
	defer w.PvP.mu.RUnlock()
	profile, exists := w.PvP.Profiles[playerID]
	if !exists {
		profile = PvPProfile{PlayerID: playerID, Rating: 1000}
	}
	status["profile"] = profile
	status["openWorldFlagged"] = w.PvP.OpenWorldFlag[playerID]
	if playerSnapshot != nil {
		status["inSafeZone"] = inOverworldPvPSafeZone(playerSnapshot)
	}
	if challenge, ok := w.PvP.Challenges[playerID]; ok {
		status["challenge"] = challenge
	}
	if match := w.PvP.Matches[w.PvP.MatchByPlayer[playerID]]; match != nil {
		status["match"] = copyPvPMatch(match)
		opponents := append([]string(nil), match.TeamA...)
		if containsPlayer(match.TeamA, playerID) {
			opponents = append([]string(nil), match.TeamB...)
		}
		status["opponents"] = opponents
	}
	for size, queue := range w.PvP.Queues {
		for _, entry := range queue {
			if containsPlayer(entry.Players, playerID) {
				status["queued"] = size
			}
		}
	}
	if until := w.PvP.DeserterUntil[playerID]; time.Now().Before(until) {
		status["deserterUntil"] = until
	}
	return status
}

func (w *World) SetPvPProfile(profile PvPProfile) {
	if w.PvP == nil || profile.PlayerID == "" {
		return
	}
	w.PvP.mu.Lock()
	w.PvP.Profiles[profile.PlayerID] = profile
	w.PvP.mu.Unlock()
}

func (w *World) constrainPvPPoint(instanceID string, x, z float64) (float64, float64, bool) {
	if w.PvP == nil || instanceID == "" {
		return x, z, false
	}
	w.PvP.mu.RLock()
	match := w.PvP.Matches[instanceID]
	w.PvP.mu.RUnlock()
	if match == nil {
		return x, z, false
	}
	return math.Max(-24, math.Min(24, x)), math.Max(-16, math.Min(16, z)), true
}
