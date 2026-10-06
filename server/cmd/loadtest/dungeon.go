package main

import (
	"encoding/json"
	"math"
	"reflect"
	"strings"
	"time"

	"eidolon-server/internal/game"
)

// All fields share partyLoad.mu: no extra lock order or background worker.
type dungeonLoad struct {
	kind       string
	difficulty game.DungeonDifficulty
	level      int
	instance   string
	layout     game.DungeonLayout
	route      *dungeonRoute
	launched   bool
	launchAt   time.Time
	objective  int
	members    [10]dungeonLoadMember
}

type dungeonLoadMember struct {
	statusSent, statusReady, scene, entered, clear, exited bool
	dead, townScene, exitRequested                         bool
	recovering                                             bool
	pending                                                string
	sentAt                                                 time.Time
	summary                                                game.DungeonRoomSummary
	summaryKnown                                           bool
	reentries                                              uint64
	checkpointReturns                                      uint64
	spawn                                                  dungeonPoint
}

type dungeonLoadCounts struct{ entered, cleared, exited, rooms, bosses, reentries, checkpointReturns uint64 }

func newDungeonParty(credentials []BotCredentials, kind string, level int, difficulty string) *partyLoad {
	p := newPartyLoad(credentials, 0, 0)
	minimum, supported := game.DungeonEntryLevels()[kind]
	if !supported || level < minimum || game.ValidateDungeonEntrySelection(100, level, game.DungeonDifficulty(difficulty)) != nil {
		p.failed = true
	}
	p.dungeon = &dungeonLoad{kind: kind, difficulty: game.DungeonDifficulty(difficulty), level: level, objective: -2}
	return p
}

func (d *dungeonLoad) observe(p *partyLoad, index int, me Entity) {
	m := &d.members[index]
	if me.Health <= 0 || me.State == "DEAD" {
		m.dead = true
	}
	if me.InstanceID != "" {
		if !d.launched || d.instance != "" && me.InstanceID != d.instance {
			p.failAt(failureForeignInstance)
			return
		}
		if m.scene && me.InstanceID == d.instance {
			if (!m.entered || m.pending == "enter") && math.Hypot(me.X-m.spawn.x, me.Z-m.spawn.z) > 3 {
				p.failAt(failureCheckpointPosition)
				return
			}
			wasEntered := m.entered
			m.entered = true
			if m.pending == "enter" {
				if wasEntered {
					m.checkpointReturns++
				}
				m.pending = ""
				m.dead, m.townScene = false, false
				m.recovering = false
			}
		}
	} else if m.entered && !m.dead && !m.recovering && !m.exitRequested {
		p.failAt(failureUnexpectedTown)
	}
	if m.pending == "recover" && m.townScene && me.InstanceID == "" && me.Health > 0 && me.State != "DEAD" && math.Hypot(me.X+1.25, me.Z-200) <= 2 {
		m.pending = ""
	}
	if m.exitRequested && m.townScene && me.InstanceID == "" && me.Health > 0 && me.State != "DEAD" && math.Hypot(me.X+1.25, me.Z-200) <= 2 {
		m.exited, m.pending = true, ""
	}
}

func (d *dungeonLoad) summaryFor(p *partyLoad, index int, summary game.DungeonRoomSummary, initial bool) bool {
	m := &d.members[index]
	if len(summary.Rooms) != len(d.layout.Rooms) || summary.RunLevel != d.level || summary.Difficulty != string(d.difficulty) || summary.CurrentRoomIndex < -1 || summary.CurrentRoomIndex >= len(d.layout.Rooms) {
		p.failed = true
		return false
	}
	objective := -1
	for i, room := range summary.Rooms {
		want := d.layout.Rooms[i]
		if room.Index != i || room.X != want.X || room.Z != want.Z || room.Width != want.Width || room.Height != want.Height || room.Type != want.Type ||
			initial && !m.entered && want.Type != "start" && room.Cleared ||
			m.summaryKnown && m.summary.Rooms[i].Cleared && !room.Cleared {
			p.failed = true
			return false
		}
		if want.Type != "start" && !room.Cleared && objective == -1 {
			objective = i
		}
	}
	if summary.ObjectiveRoomIndex != objective {
		p.failed = true
		return false
	}
	if p.raid != nil && !p.raid.receiveCrystal(p, index, summary.Crystal, initial && !m.entered, objective == -1) {
		return false
	}
	m.summary, m.summaryKnown = summary, true
	if m.entered && objective == -1 && (p.raid == nil || p.raid.encounterObserved(index)) {
		m.clear = true
	}
	return true
}

func (d *dungeonLoad) receive(p *partyLoad, index int, message Message, now time.Time) bool {
	m := &d.members[index]
	switch message.Type {
	case "get_dungeon_status":
		var status struct {
			HasInstance *bool           `json:"hasInstance"`
			IsLeader    *bool           `json:"isLeader"`
			PlayerLevel int             `json:"playerLevel"`
			DungeonType string          `json:"dungeonType"`
			ActiveRun   json.RawMessage `json:"activeRun"`
		}
		if m.pending != "status" || json.Unmarshal(message.Payload, &status) != nil || status.HasInstance == nil || *status.HasInstance || status.IsLeader == nil || *status.IsLeader != (index == 0) || status.DungeonType != d.kind || len(status.ActiveRun) != 0 || status.PlayerLevel != p.members[index].state.Level || game.ValidateDungeonTypeEntry(status.PlayerLevel, d.kind) != nil || game.ValidateDungeonEntrySelection(status.PlayerLevel, d.level, d.difficulty) != nil {
			p.failed = true
			return false
		}
		m.statusReady, m.pending = true, ""
	case "enter_instance":
		var scene struct {
			InstanceID string                     `json:"instanceId"`
			Type       string                     `json:"type"`
			Layout     *game.DungeonLayout        `json:"layout"`
			RoomState  *game.DungeonRoomSummary   `json:"roomState"`
			Spawn      *struct{ X, Y, Z float64 } `json:"spawn"`
		}
		if json.Unmarshal(message.Payload, &scene) != nil {
			p.failed = true
			return false
		}
		if scene.InstanceID == "" && scene.Type == "overworld" {
			if !m.entered || !m.dead && !m.recovering && !m.exitRequested {
				p.failed = true
				return false
			}
			m.townScene, m.scene = true, false
			return true
		}
		if !d.launched || scene.Type != d.kind || !strings.HasPrefix(scene.InstanceID, "dungeon_") || len(scene.InstanceID) > 512 || scene.Layout == nil || scene.RoomState == nil || scene.Spawn == nil && (p.raid == nil || m.entered) || d.instance != "" && d.instance != scene.InstanceID || m.scene || m.entered && m.pending != "enter" {
			p.failed = true
			return false
		}
		if d.instance == "" {
			route, valid := newDungeonRoute(*scene.Layout)
			bosses := 0
			for _, room := range scene.Layout.Rooms {
				if room.Type == "boss" {
					bosses++
				}
			}
			if !valid || bosses == 0 {
				p.failed = true
				return false
			}
			d.instance, d.layout, d.route = scene.InstanceID, *scene.Layout, route
		} else if !reflect.DeepEqual(d.layout, *scene.Layout) {
			p.failed = true
			return false
		}
		if !d.summaryFor(p, index, *scene.RoomState, true) {
			return false
		}
		checkpoint := d.layout.Rooms[0]
		if m.entered {
			for i, room := range d.layout.Rooms[1:] {
				if !scene.RoomState.Rooms[i+1].Cleared {
					break
				}
				if room.Type == "boss" {
					checkpoint = room
				}
			}
		}
		if scene.Spawn == nil {
			// Fresh raid entry normally omits spawn. The server enters at room0;
			// validate the later own state, never invent or transmit a transform.
			scene.Spawn = &struct{ X, Y, Z float64 }{X: checkpoint.X, Z: checkpoint.Z}
		}
		if math.IsNaN(scene.Spawn.X) || math.IsNaN(scene.Spawn.Y) || math.IsNaN(scene.Spawn.Z) || math.IsInf(scene.Spawn.Y, 0) || math.Hypot(scene.Spawn.X-checkpoint.X, scene.Spawn.Z-checkpoint.Z) > .01 {
			p.failed = true
			return false
		}
		m.spawn = dungeonPoint{scene.Spawn.X, scene.Spawn.Z}
		m.scene = true
		d.observe(p, index, p.members[index].state)
	case "dungeon_room_state":
		// This message has no instance ID; only consume it while own state and
		// the acknowledged entry scene both bind it to this run.
		if !m.scene || p.members[index].state.InstanceID != d.instance {
			return true
		}
		var summary game.DungeonRoomSummary
		if json.Unmarshal(message.Payload, &summary) != nil {
			p.failed = true
			return false
		}
		return d.summaryFor(p, index, summary, false)
	default:
		return false
	}
	return true
}

// Return true only when ordinary class combat can proceed. Entry/return/exit
// requests are single-shot, never reset an existing run or fabricate checkpoints.
func (d *dungeonLoad) step(p *partyLoad, index int, me Entity, now time.Time, timeout time.Duration, request func(string, interface{}) error) bool {
	m := &d.members[index]
	issue := func(kind, pending string, payload interface{}) {
		m.pending, m.sentAt = pending, now
		if request(kind, payload) != nil {
			p.failAt(failureDungeonRequest)
		}
	}
	if m.pending != "" && now.Sub(m.sentAt) >= timeout {
		p.failAt(failureDungeonTimeout)
		return false
	}
	if !m.statusSent {
		m.statusSent = true
		if p.raid == nil {
			issue("get_dungeon_status", "status", map[string]string{"dungeonType": d.kind})
			return false
		}
		m.statusReady = true // Normal raid readiness/access, not regional status.
	}
	if !d.launched {
		for _, member := range d.members[:len(p.members)] {
			if !member.statusReady {
				return false
			}
		}
		if index == 0 {
			if p.raid != nil && !p.raid.admitEntry(index, now) {
				return false
			}
			d.launched, d.launchAt = true, now
			kind, payload := d.entryRequest(p)
			issue(kind, "enter", payload)
		}
		return false
	}
	if !m.entered && now.Sub(d.launchAt) >= timeout {
		p.failAt(failureInitialEntryTimeout)
		return false
	}
	if !m.entered || m.pending != "" || m.exited {
		return false
	}
	if me.InstanceID == "" {
		if !m.dead && !m.recovering && !m.exitRequested {
			p.failAt(failureUnexpectedTown)
			return false
		}
		if m.exitRequested {
			return false
		}
		if !m.townScene || me.MaxHealth <= 0 || me.MaxMana <= 0 || float64(me.Health)/float64(me.MaxHealth) < .9 || float64(me.Mana)/float64(me.MaxMana) < .9 {
			return false
		}
		if p.raid != nil && !p.raid.admitEntry(index, now) {
			return false
		}
		m.reentries++
		kind, payload := d.entryRequest(p)
		issue(kind, "enter", payload)
		return false
	}
	allClear := true
	for _, member := range d.members[:len(p.members)] {
		allClear = allClear && member.clear
	}
	if allClear {
		m.exitRequested = true
		issue("recall", "exit", nil) // Caller supplies the normal fresh movement nonce.
		return false
	}
	if me.MaxHealth > 0 && float64(me.Health)/float64(me.MaxHealth) < .25 || me.MaxMana > 0 && float64(me.Mana)/float64(me.MaxMana) < .15 {
		m.recovering = true
		issue("recall", "recover", nil)
		return false // Living recovery preserves bars; only ordinary town ticks restore them.
	}
	for i, member := range d.members[:len(p.members)] {
		if !member.entered || !member.scene || p.members[i].state.InstanceID != d.instance || p.members[i].state.Health <= 0 {
			return false
		}
	}
	if !d.members[0].summaryKnown {
		return false
	}
	objective := d.members[0].summary.ObjectiveRoomIndex
	if objective < 0 {
		if p.raid == nil {
			return false
		}
		objective = len(d.layout.Rooms) - 1 // Assault is not the repair finale.
	} // Wait for each other client's fresh clear view.
	if d.objective != objective {
		d.objective, p.target = objective, Entity{}
		room := d.layout.Rooms[objective]
		p.anchorX, p.anchorZ = room.X, room.Z
	}
	return true
}

func (d *dungeonLoad) entryRequest(p *partyLoad) (string, interface{}) {
	if p.raid != nil {
		return "raid_enter", map[string]string{"raidType": d.kind}
	}
	return "enter_dungeon", map[string]interface{}{"dungeonType": d.kind, "difficulty": string(d.difficulty), "runLevel": d.level}
}

func (p *partyLoad) dungeonCounts() dungeonLoadCounts {
	p.mu.Lock()
	defer p.mu.Unlock()
	var counts dungeonLoadCounts
	if p.dungeon == nil {
		return counts
	}
	d := p.dungeon
	for _, member := range d.members[:len(p.members)] {
		if member.entered {
			counts.entered++
		}
		if member.clear {
			counts.cleared++
		}
		if member.exited {
			counts.exited++
		}
		counts.reentries += member.reentries
		counts.checkpointReturns += member.checkpointReturns
	}
	if d.members[0].summaryKnown {
		for _, room := range d.members[0].summary.Rooms {
			if room.Type != "start" && room.Cleared {
				counts.rooms++
				if room.Type == "boss" {
					counts.bosses++
				}
			}
		}
	}
	return counts
}
