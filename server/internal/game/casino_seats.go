package game

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"time"
)

const CasinoReconnectGrace = time.Minute

// Coordinates belong exclusively to the permanent shared casino scene.
// The venue renderer consumes this catalog; clients never supply seat transforms.
type CasinoSeatPosition struct {
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Rotation float64 `json:"rotation"`
	ExitX    float64 `json:"exitX"`
	ExitZ    float64 `json:"exitZ"`
}

type CasinoTable struct {
	ID             string               `json:"id"`
	Name           string               `json:"name"`
	Game           string               `json:"game"`
	Floor          string               `json:"floor"`
	X              float64              `json:"x"`
	Z              float64              `json:"z"`
	Seats          []CasinoSeatPosition `json:"seats"`
	MinimumPlayers int                  `json:"minimumPlayers"`
}

func CasinoTables() []CasinoTable {
	tables := []CasinoTable{
		{ID: "public-blackjack", Name: "Lanternhold Blackjack", Game: "blackjack", Floor: "public", X: -18, Z: 176, MinimumPlayers: 1},
		{ID: "public-poker", Name: "Fourfold Hold'em", Game: "poker", Floor: "public", X: 18, Z: 176, MinimumPlayers: 2},
		{ID: "public-blackjack-earth", Name: "Orun's Stone Table", Game: "blackjack", Floor: "public", X: -18, Z: 155, MinimumPlayers: 1},
		{ID: "public-blackjack-air", Name: "Aeral's High Table", Game: "blackjack", Floor: "public", X: 18, Z: 155, MinimumPlayers: 1},
		{ID: "public-blackjack-fire", Name: "Pyralis's Hearth Table", Game: "blackjack", Floor: "public", X: -18, Z: 194, MinimumPlayers: 1},
		{ID: "public-blackjack-water", Name: "Neris's Pearl Table", Game: "blackjack", Floor: "public", X: 18, Z: 194, MinimumPlayers: 1},
	}
	for i := range tables {
		for seat := 0; seat < 6; seat++ {
			angle := float64(seat) * math.Pi / 3
			dx, dz := math.Sin(angle), math.Cos(angle)
			tables[i].Seats = append(tables[i].Seats, CasinoSeatPosition{X: tables[i].X + dx*2.2, Z: tables[i].Z + dz*2.2, Rotation: angle + math.Pi, ExitX: tables[i].X + dx*3.4, ExitZ: tables[i].Z + dz*3.4})
		}
	}
	for i, machine := range SlotMachines() {
		theme, x := machine.Theme, []float64{-26, -17, 17, 26}[i]
		tables = append(tables, CasinoTable{ID: "public-slots-" + theme, Name: machine.Name, Game: "slots", Floor: "public", X: x, Z: 135, MinimumPlayers: 1,
			Seats: []CasinoSeatPosition{{X: x, Z: 137, Rotation: math.Pi, ExitX: x, ExitZ: 138.2}}})
	}
	return tables
}

func IsCasinoBlackjackTable(id string) bool {
	for _, table := range CasinoTables() {
		if table.ID == id {
			return table.Game == "blackjack"
		}
	}
	return false
}

// Seat claims live on the character, not in a second ownership map. World.Mu
// serializes claims; the normal entity removal/scene lifecycle releases them.
// Private session IDs fence delayed actions after leaving and taking another seat.
type CasinoSeatSession struct {
	TableID         string  `json:"tableId"`
	Seat            int     `json:"seat"`
	SessionID       string  `json:"sessionId"`
	ExitX           float64 `json:"exitX"`
	ExitZ           float64 `json:"exitZ"`
	Ready           bool    `json:"ready"`
	readyRevision   string
	connectionEpoch uint64
}

func cloneCasinoSeat(seat *CasinoSeatSession) *CasinoSeatSession {
	if seat == nil {
		return nil
	}
	copy := *seat
	return &copy
}

type CasinoOccupant struct {
	PlayerID      string    `json:"playerId"`
	Name          string    `json:"name"`
	TableID       string    `json:"tableId"`
	Seat          int       `json:"seat"`
	Connected     bool      `json:"connected"`
	Ready         bool      `json:"ready"`
	ReservedUntil time.Time `json:"reservedUntil,omitempty"`
}

type CasinoPresence struct {
	Tables      []CasinoTable                `json:"tables"`
	Occupants   []CasinoOccupant             `json:"occupants"`
	YourSeat    *CasinoSeatSession           `json:"yourSeat"`
	Preparation map[string]CasinoPreparation `json:"preparation"`
}

// Preparation is not a wager or a running game. Consent belongs to the exact
// connected roster; a later round engine must still validate its own stakes.
type CasinoPreparation struct {
	Revision       string `json:"revision"`
	Phase          string `json:"phase"`
	Connected      int    `json:"connected"`
	Ready          int    `json:"ready"`
	MinimumPlayers int    `json:"minimumPlayers"`
}

// Caller holds World.Mu, but no entity locks. Hashing the private seat identities
// gives clients an opaque roster revision without disclosing anyone else's token.
func (w *World) casinoPreparationLocked() map[string]CasinoPreparation {
	type member struct {
		Seat      int
		Session   string
		Epoch     uint64
		Connected bool
	}
	rosters := map[string][]member{}
	for _, player := range w.Entities {
		player.Mu.RLock()
		if s := player.CasinoSeat; s != nil {
			rosters[s.TableID] = append(rosters[s.TableID], member{s.Seat, s.SessionID, s.connectionEpoch, !player.Disconnected})
		}
		player.Mu.RUnlock()
	}
	result := map[string]CasinoPreparation{}
	for _, table := range CasinoTables() {
		members := rosters[table.ID]
		sort.Slice(members, func(i, j int) bool { return members[i].Seat < members[j].Seat })
		encoded, _ := json.Marshal(members)
		digest := sha256.Sum256(append([]byte(table.ID+":"), encoded...))
		p := CasinoPreparation{Revision: hex.EncodeToString(digest[:]), Phase: "preparing", MinimumPlayers: table.MinimumPlayers}
		for _, m := range members {
			if m.Connected {
				p.Connected++
			}
		}
		if p.Connected < table.MinimumPlayers {
			p.Phase = "waiting_players"
		}
		if p.Connected < len(members) {
			p.Phase = "waiting_reconnect"
		}
		result[table.ID] = p
	}
	for _, player := range w.Entities {
		player.Mu.Lock()
		if s := player.CasinoSeat; s != nil {
			p := result[s.TableID]
			if player.Disconnected || s.readyRevision != p.Revision {
				s.Ready = false
			}
			if s.Ready {
				p.Ready++
			}
			result[s.TableID] = p
		}
		player.Mu.Unlock()
	}
	for id, p := range result {
		if p.Phase == "preparing" && p.Ready == p.Connected {
			p.Phase = "ready"
		}
		result[id] = p
	}
	return result
}

// Caller holds both World.Mu and player.Mu. Never restore an old town coordinate
// over an already completed scene transition or death.
func (w *World) releaseCasinoSeatLocked(player *Entity) {
	seat := player.CasinoSeat
	if seat == nil {
		return
	}
	player.CasinoSeat = nil
	if player.InstanceID != CasinoInstanceID || player.State == "DEAD" || player.Health <= 0 {
		return
	}
	oldX, oldZ := player.X, player.Z
	player.X, player.Y, player.Z = seat.ExitX, 0, seat.ExitZ
	player.State = "IDLE"
	player.TargetX, player.TargetZ = player.X, player.Z
	player.TargetID = ""
	player.VelX, player.VelZ = 0, 0
	setRecoveryMovementContextLocked(player, "casino-exit:"+seat.SessionID)
	if w.Grid != nil {
		w.Grid.Update(player, oldX, oldZ)
	}
}

func (w *World) pruneCasinoSeatsLocked(now time.Time) {
	for _, player := range w.Entities {
		if player.Type != TypePlayer {
			continue
		}
		player.Mu.Lock()
		if player.CasinoSeat != nil && (player.InstanceID != CasinoInstanceID || player.Health <= 0 || player.State == "DEAD" ||
			(player.Disconnected && !now.Before(player.DisconnectedAt.Add(CasinoReconnectGrace)))) {
			w.releaseCasinoSeatLocked(player)
		}
		player.Mu.Unlock()
	}
}

func (w *World) TakeCasinoSeat(playerID, tableID string, seatIndex int, now time.Time) (*CasinoSeatSession, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	// Run after the player lock is released, even when nobody polls between a
	// join and leave. Old readiness must not revive when the roster shrinks back.
	defer w.casinoPreparationLocked()
	w.pruneCasinoSeatsLocked(now)
	var table *CasinoTable
	for _, candidate := range CasinoTables() {
		if candidate.ID == tableID {
			copy := candidate
			table = &copy
			break
		}
	}
	if table == nil || seatIndex < 0 || seatIndex >= len(table.Seats) {
		return nil, errors.New("choose an existing casino seat")
	}
	player := w.Entities[playerID]
	if player == nil {
		return nil, errors.New("player not found")
	}
	if w.TradeByPlayer[playerID] != "" {
		return nil, errors.New("finish your trade before sitting")
	}
	// Check every live/reserved owner under the same world lock as acquisition.
	for _, other := range w.Entities {
		if other.Type != TypePlayer {
			continue
		}
		other.Mu.RLock()
		occupied := other.ID != playerID && other.CasinoSeat != nil && other.CasinoSeat.TableID == tableID && other.CasinoSeat.Seat == seatIndex
		other.Mu.RUnlock()
		if occupied {
			return nil, errors.New("that seat is occupied or reserved for a reconnect")
		}
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.Disconnected {
		return nil, errors.New("player is disconnected")
	}
	if player.CasinoSeat != nil {
		if player.CasinoSeat.TableID == tableID && player.CasinoSeat.Seat == seatIndex {
			return cloneCasinoSeat(player.CasinoSeat), nil
		}
		return nil, errors.New("leave your current seat first")
	}
	if player.Type != TypePlayer || player.Disconnected || player.Health <= 0 || player.InstanceID != CasinoInstanceID || !w.inSafeZone(player) ||
		(player.State != "IDLE" && player.State != "MOVING") || player.IsCharging || player.Stunned || player.Rooted || player.WhirlwindActive || now.Before(player.MoveLockUntil) {
		return nil, errors.New("finish your current action before sitting in the casino")
	}
	position := table.Seats[seatIndex]
	dx, dz := player.X-position.ExitX, player.Z-position.ExitZ
	if !finiteCoordinate(player.X) || !finiteCoordinate(player.Y) || !finiteCoordinate(player.Z) || math.Abs(player.Y) > 0.8 || dx*dx+dz*dz > 2.2*2.2 {
		return nil, errors.New("walk up to the seat first")
	}
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	session := &CasinoSeatSession{TableID: tableID, Seat: seatIndex, SessionID: hex.EncodeToString(nonce[:]), ExitX: position.ExitX, ExitZ: position.ExitZ}
	oldX, oldZ := player.X, player.Z
	player.CasinoSeat = session
	player.X, player.Y, player.Z = position.X, 0, position.Z
	player.Rotation = position.Rotation
	player.State = "SEATED"
	player.TargetX, player.TargetZ = player.X, player.Z
	player.TargetID = ""
	player.VelX, player.VelZ = 0, 0
	setRecoveryMovementContextLocked(player, "casino-seat:"+session.SessionID)
	if w.Grid != nil {
		w.Grid.Update(player, oldX, oldZ)
	}
	return cloneCasinoSeat(session), nil
}

func (w *World) ChangeCasinoSeat(playerID, sessionID, action string, ready bool, now time.Time, revision string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneCasinoSeatsLocked(now)
	preparation := w.casinoPreparationLocked()
	player := w.Entities[playerID]
	if player == nil {
		return errors.New("player not found")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if player.CasinoSeat == nil || player.CasinoSeat.SessionID != sessionID || player.Disconnected {
		return errors.New("seat session changed; refresh the table")
	}
	switch action {
	case "leave":
		w.releaseCasinoSeatLocked(player)
	case "ready":
		p := preparation[player.CasinoSeat.TableID]
		if revision == "" || revision != p.Revision {
			return errors.New("table membership changed; review the table before readying")
		}
		player.CasinoSeat.Ready = ready
		player.CasinoSeat.readyRevision = revision
	default:
		return errors.New("unsupported seated action")
	}
	return nil
}

func (w *World) CasinoPresenceFor(playerID string, now time.Time) CasinoPresence {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	w.pruneCasinoSeatsLocked(now)
	presence := CasinoPresence{Tables: CasinoTables(), Occupants: []CasinoOccupant{}, Preparation: w.casinoPreparationLocked()}
	for _, player := range w.Entities {
		if player.Type != TypePlayer {
			continue
		}
		player.Mu.RLock()
		if seat := player.CasinoSeat; seat != nil {
			occupant := CasinoOccupant{PlayerID: player.ID, Name: player.Name, TableID: seat.TableID, Seat: seat.Seat, Connected: !player.Disconnected, Ready: seat.Ready}
			if player.Disconnected {
				occupant.ReservedUntil = player.DisconnectedAt.Add(CasinoReconnectGrace)
			}
			presence.Occupants = append(presence.Occupants, occupant)
			if player.ID == playerID {
				presence.YourSeat = cloneCasinoSeat(seat)
			}
		}
		player.Mu.RUnlock()
	}
	return presence
}
