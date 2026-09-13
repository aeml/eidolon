package game

import (
	"fmt"
	"math"
	"time"
)

const PublicEventPeriod = 10 * time.Minute

type PublicEventSite struct {
	ID        string  `json:"id"`
	Realm     string  `json:"realm"`
	Title     string  `json:"title"`
	Lore      string  `json:"lore"`
	Objective string  `json:"objective"`
	X         float64 `json:"x"`
	Z         float64 `json:"z"`
	Level     int     `json:"level"`
	Enemy     string  `json:"-"`
	Champion  string  `json:"-"`
}

// Road-side sites avoid dungeon gates and town. All enemy models and combat
// profiles are existing overworld types; this is not a parallel combat system.
func PublicEventSites() []PublicEventSite {
	return []PublicEventSite{
		{ID: "root", Realm: "earth", Title: "The Road That Remembers", Lore: "Orun's old road-wards remember every traveler they once sheltered. Dark splinters now turn that memory against the living.", Objective: "Keep the central stone clear and stand within its ward.", X: -750, Z: 200, Level: 35, Enemy: "Construct", Champion: "Construct"},
		{ID: "tide", Realm: "water", Title: "The Unmoored Chorus", Lore: "Fragments of Tidestar's memory drift between two river-stones. Follow their answering song before the cold stills it.", Objective: "Follow the active tide rune as it alternates between the river-stones.", X: 0, Z: -900, Level: 55, Enemy: "FrostGuardian", Champion: "FrostGuardian"},
		{ID: "ember", Realm: "fire", Title: "Ashes Without a Hearth", Lore: "The Ember Crown's warmth once carried caravans across the wastes. A buried fracture now hoards that warmth instead of sharing it.", Objective: "Clear the outer ring and vent the ward from its rim, not its center.", X: -1250, Z: 200, Level: 72, Enemy: "SandstormDjinn", Champion: "MagmaGolem"},
		{ID: "gale", Realm: "air", Title: "The Stolen Horizon", Lore: "Skyglass scattered its voice along the high road. Keep moving with the updraft so no single echo can claim the whole sky.", Objective: "Keep moving inside the ward while allies clear its attackers.", X: 1250, Z: 200, Level: 72, Enemy: "StormHarpy", Champion: "CloudElemental"},
	}
}

type PublicEventView struct {
	ID           string          `json:"id"`
	Site         PublicEventSite `json:"site"`
	Phase        string          `json:"phase"`
	StartsAt     time.Time       `json:"startsAt"`
	EndsAt       time.Time       `json:"endsAt"`
	NextAt       time.Time       `json:"nextAt"`
	Wave         int             `json:"wave"`
	Remaining    int             `json:"remaining"`
	Charge       float64         `json:"charge"`
	ChargeNeeded float64         `json:"chargeNeeded"`
	RuneX        float64         `json:"runeX"`
	RuneZ        float64         `json:"runeZ"`
	Radius       float64         `json:"radius"`
	InnerRadius  float64         `json:"innerRadius"`
	Participants int             `json:"participants"`
	CalmedUntil  time.Time       `json:"calmedUntil"`
}

type publicEventState struct {
	PublicEventView
	slot              int64
	lastTick          time.Time
	enemies           []*Entity // Retain death evidence even after normal corpse cleanup.
	previousPositions map[string][2]float64
}

func publicEventSchedule(now time.Time) (int64, PublicEventSite, time.Time) {
	slot := now.Unix() / int64(PublicEventPeriod/time.Second)
	index := int(slot % 4)
	if index < 0 {
		index += 4
	}
	return slot, PublicEventSites()[index], time.Unix(slot*int64(PublicEventPeriod/time.Second), 0).UTC()
}

func (w *World) PublicEventSnapshot() *PublicEventView {
	w.Mu.RLock()
	defer w.Mu.RUnlock()
	if w.publicEvent == nil {
		return nil
	}
	copy := w.publicEvent.PublicEventView
	return &copy
}

func (w *World) clearPublicEventEnemiesLocked(event *publicEventState) {
	for _, enemy := range event.enemies {
		if w.Entities[enemy.ID] != enemy {
			continue
		}
		if w.Grid != nil {
			w.Grid.Remove(enemy)
		}
		delete(w.Entities, enemy.ID)
	}
	event.enemies = nil
}

func (w *World) spawnPublicEventWaveLocked(event *publicEventState, players int) {
	w.clearPublicEventEnemiesLocked(event)
	event.Wave++
	event.Charge = 0
	count := 4 + 2*min(players, 4)
	subType := event.Site.Enemy
	if event.Wave == 4 {
		count, subType, event.Phase = 1, event.Site.Champion, "champion"
	} else {
		event.Phase = "defending"
	}
	for i := 0; i < count; i++ {
		angle := float64(i) * 2 * math.Pi / float64(count)
		x, z := event.Site.X+math.Cos(angle)*26, event.Site.Z+math.Sin(angle)*26
		enemy := newOverworldEnemy(fmt.Sprintf("world-event-%d-%d-%d", event.slot, event.Wave, i), subType, x, z, event.Site.Level)
		enemy.WorldEventID = event.ID
		if event.Wave == 4 {
			enemy.Name = "Fracturekeeper"
			enemy.Scale = 1.65
			enemy.MaxHealth *= 3 + min(players, 4)
			enemy.BaseStats.Vitality = enemy.MaxHealth / 10
			enemy.MaxHealth = enemy.BaseStats.Vitality * 10
			enemy.Health = enemy.MaxHealth
		}
		w.Entities[enemy.ID] = enemy
		if w.Grid != nil {
			w.Grid.Add(enemy)
		}
		event.enemies = append(event.enemies, enemy)
	}
	event.Remaining = count
}

// Called by the existing server loop, not client claims. Completion gives normal
// enemy loot/party XP plus temporary calmer roads, not a new repeatable Gold purse.
func (w *World) UpdatePublicEvent(now time.Time) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	for _, hazard := range w.Hazards {
		if !hazard.SuppressedUntil.IsZero() && !now.Before(hazard.SuppressedUntil) {
			hazard.SuppressedUntil = time.Time{}
			if entity := w.Entities[hazard.ID]; entity != nil {
				entity.Mu.Lock()
				entity.State = "IDLE"
				entity.Mu.Unlock()
			}
		}
	}
	slot, site, start := publicEventSchedule(now)
	if w.publicEvent == nil || w.publicEvent.slot != slot {
		if w.publicEvent != nil {
			w.clearPublicEventEnemiesLocked(w.publicEvent)
		}
		w.publicEvent = &publicEventState{PublicEventView: PublicEventView{ID: fmt.Sprintf("disturbance-%d", slot), Site: site, Phase: "announced", StartsAt: start.Add(time.Minute), EndsAt: start.Add(8 * time.Minute), NextAt: start.Add(PublicEventPeriod), ChargeNeeded: 20}, slot: slot, lastTick: now, previousPositions: map[string][2]float64{}}
	}
	e := w.publicEvent
	dt := math.Min(2, math.Max(0, now.Sub(e.lastTick).Seconds()))
	e.lastTick = now
	if e.Phase == "complete" || e.Phase == "expired" {
		return
	}
	if !now.Before(e.EndsAt) {
		w.clearPublicEventEnemiesLocked(e)
		e.Phase, e.Remaining = "expired", 0
		return
	}
	e.RuneX, e.RuneZ, e.Radius, e.InnerRadius = site.X, site.Z, 12, 0
	if site.ID == "tide" {
		e.RuneX += -10 + 20*float64((now.Unix()/12)%2)
		e.Radius = 7
	}
	if site.ID == "ember" {
		e.Radius, e.InnerRadius = 22, 12
	}
	nearby, holders := 0, 0
	positions := map[string][2]float64{}
	for _, player := range w.Entities {
		if player.Type != TypePlayer {
			continue
		}
		player.Mu.RLock()
		eligible := !player.Disconnected && player.Health > 0 && player.State != "DEAD" && player.InstanceID == "" && math.Hypot(player.X-site.X, player.Z-site.Z) <= 65
		if eligible {
			nearby++
			distance := math.Hypot(player.X-e.RuneX, player.Z-e.RuneZ)
			moving := false
			if previous, ok := e.previousPositions[player.ID]; ok {
				moving = math.Hypot(player.X-previous[0], player.Z-previous[1]) >= 0.5
			}
			if distance <= e.Radius && distance >= e.InnerRadius && (site.ID != "gale" || moving) {
				holders++
			}
			positions[player.ID] = [2]float64{player.X, player.Z}
		}
		player.Mu.RUnlock()
	}
	e.previousPositions, e.Participants = positions, nearby
	if now.Before(e.StartsAt) {
		return
	}
	if e.Phase == "announced" {
		if nearby > 0 {
			w.spawnPublicEventWaveLocked(e, nearby)
		}
		return
	}
	remaining, contested := 0, false
	for _, enemy := range e.enemies {
		enemy.Mu.RLock()
		if enemy.State != "DEAD" && enemy.Health > 0 {
			remaining++
			distance := math.Hypot(enemy.X-e.RuneX, enemy.Z-e.RuneZ)
			if distance <= e.Radius && distance >= e.InnerRadius {
				contested = true
			}
		}
		enemy.Mu.RUnlock()
	}
	e.Remaining = remaining
	if e.Phase == "defending" && holders > 0 && !contested {
		e.Charge = math.Min(e.ChargeNeeded, e.Charge+dt)
	}
	if remaining != 0 || (e.Phase == "defending" && e.Charge < e.ChargeNeeded) {
		return
	}
	if e.Wave < 4 {
		if nearby > 0 {
			w.spawnPublicEventWaveLocked(e, nearby)
		}
		return
	}
	e.Phase, e.CalmedUntil = "complete", now.Add(5*time.Minute)
	for _, hazard := range w.Hazards {
		if math.Hypot(hazard.X-site.X, hazard.Z-site.Z) > 400 {
			continue
		}
		hazard.SuppressedUntil = e.CalmedUntil
		if entity := w.Entities[hazard.ID]; entity != nil {
			entity.Mu.Lock()
			entity.State = "CALMED"
			entity.Mu.Unlock()
		}
	}
	w.clearPublicEventEnemiesLocked(e)
}
