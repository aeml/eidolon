package game

import (
	"fmt"
	"math"
)

// These are live ritual objectives, not inventory items or client-authored credit.
// The repair worker owns mutations under RepairMu; snapshots copy every slice.
type CrystalVigil struct {
	Step      int
	Channel   float64
	Carriers  map[string]bool
	LastRelay string
	Paused    bool
}

type CrystalVigilPoint struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Radius float64 `json:"radius"`
	Label  string  `json:"label"`
	State  string  `json:"state"`
}

type CrystalVigilSnapshot struct {
	Title    string              `json:"title"`
	Hint     string              `json:"hint"`
	Current  int                 `json:"current"`
	Total    int                 `json:"total"`
	Channel  float64             `json:"channel"`
	Complete bool                `json:"complete"`
	Paused   bool                `json:"paused"`
	Points   []CrystalVigilPoint `json:"points"`
}

type vigilPlayer struct {
	ID   string
	X, Z float64
}

func (s *CrystalRepairState) vigilDialogue(wave int) string {
	lines := map[string][3]string{
		"Earth": {
			"Orun's ward is a promise to stand beside others, not above them. Hold its heart while your companions turn the corruption aside.",
			"Malachar taught the old keepers to call every wall protection. Rootheart remembers the doors they sealed against their own people.",
			"Give the roots somewhere living to hold. This time the sanctuary will shelter everyone who asks, not only those who obey.",
		},
		"Water": {
			"Neris kept the names of those the floods took. Carry their memories home; the crystal cannot heal by forgetting them.",
			"Malachar drowned the keepers' warnings in comforting visions. Bring back the painful truths as gently as the joyful ones.",
			"These are not offerings to a ruler. They are lives entrusted to one another. Let Tidestar remember why it flows.",
		},
		"Fire": {
			"Pyralis gave us flame to make and mend. Still the vents one by one so I can forge a circuit that does not devour its bearers.",
			"Malachar called every sacrifice necessary, then demanded another. We end that hunger here: no life must fuel this crown.",
			"Hold the last vents steady. The old lattice must change, but the people it protects need not burn with it.",
		},
		"Air": {
			"Aeral will not answer a single commanding voice. Pass the wind between you; let each companion choose to carry it onward.",
			"Malachar wanted one future, with every road ending at his throne. Each handoff restores a direction he tried to silence.",
			"Four winds, freely offered. When Skyglass joins the other crystals, their resonance will open the path he could never command.",
		},
	}
	return "Maelin: " + lines[s.Element][max(0, min(2, wave-1))]
}

func (s *CrystalRepairState) vigilPoint(index int) CrystalVigilPoint {
	p := CrystalVigilPoint{X: s.CenterX, Z: s.CenterZ, Radius: 6, State: "waiting"}
	switch s.Element {
	case "Earth":
		p.Radius, p.Label = 12, "Rootward"
		if index == 1 {
			p.Radius, p.Label = 18, "Keep attackers outside"
		}
	case "Water":
		p.Label = "Memory font"
		if index == 0 {
			p.X += 30
		} else {
			p.Radius, p.Label = 10, "Return memories to Maelin"
		}
	case "Fire", "Air":
		count, label := 3, "Vent"
		if s.Element == "Air" {
			count, label = 4, "Wind anchor"
		}
		angle := float64(index) * 2 * math.Pi / float64(count)
		p.X += math.Cos(angle) * 30
		p.Z += math.Sin(angle) * 30
		p.Label = fmt.Sprintf("%s %d", label, index+1)
	}
	return p
}

func withinVigilPoint(player vigilPlayer, point CrystalVigilPoint) bool {
	return math.Hypot(player.X-point.X, player.Z-point.Z) <= point.Radius
}

func (s *CrystalRepairState) vigilTotal() int {
	switch s.Element {
	case "Earth":
		return 8
	case "Water":
		return 2
	case "Fire":
		return 3
	case "Air":
		return 4
	}
	return 0
}

func (s *CrystalRepairState) vigilComplete() bool {
	return s.Vigil != nil && s.vigilTotal() > 0 && s.Vigil.Step >= s.vigilTotal()
}

// Advance from observed positions and elapsed simulation time only. Wipes pause
// the current wave and discard incomplete work, but retain fully cleared waves.
// No participant means no advancement even when the last attacker is gone.
func (s *CrystalRepairState) advanceVigil(players []vigilPlayer, enemyAtWard bool, seconds float64) {
	v := s.Vigil
	if v == nil {
		return
	}
	if len(players) == 0 {
		*v = CrystalVigil{Paused: true}
		return
	}
	v.Paused = false
	if s.vigilComplete() || seconds <= 0 {
		return
	}
	// A delayed worker cannot award seconds spent unobserved during a stall.
	seconds = min(seconds, 0.5)
	switch s.Element {
	case "Earth":
		for _, player := range players {
			if !enemyAtWard && withinVigilPoint(player, s.vigilPoint(0)) {
				v.Channel = min(8, v.Channel+seconds)
				v.Step = int(v.Channel)
				break
			}
		}
	case "Water":
		if v.Carriers == nil {
			v.Carriers = make(map[string]bool)
		}
		present := make(map[string]bool, len(players))
		for _, player := range players {
			present[player.ID] = true
			if v.Carriers[player.ID] && withinVigilPoint(player, s.vigilPoint(1)) {
				delete(v.Carriers, player.ID)
				v.Step = min(2, v.Step+1)
			} else if withinVigilPoint(player, s.vigilPoint(0)) {
				v.Carriers[player.ID] = true
			}
		}
		for id := range v.Carriers {
			if !present[id] {
				delete(v.Carriers, id)
			}
		}
	case "Fire":
		occupied := false
		for _, player := range players {
			if withinVigilPoint(player, s.vigilPoint(v.Step)) {
				occupied = true
				break
			}
		}
		if occupied {
			v.Channel += seconds
			if v.Channel >= 2 {
				v.Step++
				v.Channel = 0
			}
		} else {
			v.Channel = 0
		}
	case "Air":
		for _, player := range players {
			if player.ID != v.LastRelay && withinVigilPoint(player, s.vigilPoint(v.Step)) {
				v.Step++
				v.LastRelay = player.ID
				break
			}
		}
	}
}

func (s *CrystalRepairState) vigilSnapshot() *CrystalVigilSnapshot {
	if s.Vigil == nil || s.Completed {
		return nil
	}
	v := s.Vigil
	out := &CrystalVigilSnapshot{Current: v.Step, Total: s.vigilTotal(), Channel: v.Channel,
		Complete: s.vigilComplete(), Paused: v.Paused}
	count := 1
	switch s.Element {
	case "Earth":
		count = 2
		out.Title = "Hold the Rootward"
		out.Hint = "Stand in the central ward for 8 seconds total. Keep attackers outside its 18-step boundary; enemies inside pause the channel."
	case "Water":
		count = 2
		out.Title = "Carry the lost memories"
		out.Hint = fmt.Sprintf("Enter the eastern font, then return to Maelin. Deliver 2 memories; %d currently carried. Death or leaving drops your memory.", len(v.Carriers))
	case "Fire":
		count = 3
		out.Title = "Quench the crown vents"
		out.Hint = "Stand in each bright vent for 2 uninterrupted seconds, in order. Moving away interrupts that vent."
	case "Air":
		count = 4
		out.Title = "Pass the four winds"
		out.Hint = "Touch the bright wind anchors in order. A different raider must activate each next anchor; two players can alternate."
	}
	for index := 0; index < count; index++ {
		point := s.vigilPoint(index)
		if out.Complete || ((s.Element == "Fire" || s.Element == "Air") && index < v.Step) {
			point.State = "complete"
		} else if index == v.Step || s.Element == "Earth" || s.Element == "Water" {
			point.State = "active"
		}
		if s.Element == "Earth" && index == 1 {
			point.State = "boundary"
		}
		out.Points = append(out.Points, point)
	}
	if out.Complete {
		out.Hint = "Facet aligned. Defeat every remaining attacker to finish this wave."
	} else if out.Paused {
		out.Hint = "Ritual paused: return alive to Maelin's chamber. Cleared waves remain earned; this wave's ritual work restarts."
	}
	return out
}

// Read the world before taking RepairMu: room snapshots use the same ordering.
func (w *World) observeCrystalVigil(s *CrystalRepairState, enemyIDs []string) ([]vigilPlayer, bool, bool) {
	players := make([]vigilPlayer, 0, len(s.Participants))
	for _, id := range s.Participants {
		if p := w.GetEntity(id); p != nil {
			p.Mu.RLock()
			if p.Type == TypePlayer && p.InstanceID == s.InstanceID && !p.Disconnected && p.Health > 0 && p.State != "DEAD" && math.Hypot(p.X-s.CenterX, p.Z-s.CenterZ) <= 110 {
				players = append(players, vigilPlayer{p.ID, p.X, p.Z})
			}
			p.Mu.RUnlock()
		}
	}
	allDefeated, enemyAtWard := true, false
	for _, id := range enemyIDs {
		if enemy := w.GetEntity(id); enemy != nil {
			enemy.Mu.RLock()
			if enemy.InstanceID == s.InstanceID && enemy.Health > 0 && enemy.State != "DEAD" {
				allDefeated = false
				enemyAtWard = enemyAtWard || math.Hypot(enemy.X-s.CenterX, enemy.Z-s.CenterZ) <= 18
			}
			enemy.Mu.RUnlock()
		}
	}
	return players, allDefeated, enemyAtWard
}
