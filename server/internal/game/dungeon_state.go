package game

type DungeonRoom struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Type   string  `json:"type"` // "start", "boss", "normal", "elite"
	Hook   string  `json:"hook,omitempty"`
	Pacing string  `json:"pacing,omitempty"`
	Color  int     `json:"color"`
}

type DungeonLayout struct {
	GenerationSeed     string            `json:"generationSeed,omitempty"`
	GeneratorVersion   int               `json:"generatorVersion,omitempty"`
	GenerationAttempt  int               `json:"generationAttempt,omitempty"`
	GenerationFallback bool              `json:"generationFallback,omitempty"`
	Rooms              []DungeonRoom     `json:"rooms"`
	WalkRects          []DungeonWalkRect `json:"walkRects,omitempty"`
	Corridors          []DungeonCorridor `json:"corridors,omitempty"`
}

type DungeonRoomProgress struct {
	Explored bool `json:"explored"`
	Cleared  bool `json:"cleared"`
	Rewarded bool `json:"-"`
}

type DungeonRoomSummaryEntry struct {
	Index    int     `json:"index"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
	Type     string  `json:"type"`
	Hook     string  `json:"hook,omitempty"`
	Pacing   string  `json:"pacing,omitempty"`
	Identity string  `json:"identity,omitempty"`
	Explored bool    `json:"explored"`
	Cleared  bool    `json:"cleared"`
}

type DungeonRoomSummary struct {
	Rooms              []DungeonRoomSummaryEntry `json:"rooms"`
	CurrentRoomIndex   int                       `json:"currentRoomIndex"`
	ObjectiveRoomIndex int                       `json:"objectiveRoomIndex"`
	Difficulty         string                    `json:"difficulty,omitempty"`
	RunLevel           int                       `json:"runLevel,omitempty"`
	DifficultyPacing   string                    `json:"difficultyPacing,omitempty"`
}

type DungeonRoomState struct {
	Layout                DungeonLayout
	Rooms                 []DungeonRoomProgress
	CurrentRoomIndexValue int
}

func NewDungeonRoomState(layout DungeonLayout) *DungeonRoomState {
	rooms := make([]DungeonRoomProgress, len(layout.Rooms))
	return &DungeonRoomState{
		Layout:                layout,
		Rooms:                 rooms,
		CurrentRoomIndexValue: -1,
	}
}

func dungeonRoomIdentityTag(room DungeonRoom) string {
	switch {
	case room.Type == "start":
		return "entry_gate"
	case room.Type == "boss":
		return "boss_lair"
	case room.Hook == "chest":
		return "treasure_cache"
	case room.Hook == "shrine":
		return "restorative_shrine"
	case room.Hook == "elite_ambush":
		return "ambush_chamber"
	case room.Pacing == "boss_approach":
		return "boss_approach"
	case room.Type == "elite":
		return "elite_guard"
	default:
		return "route_hall"
	}
}

func (s *DungeonRoomState) CurrentRoomIndexForPosition(x, z float64) int {
	for idx, room := range s.Layout.Rooms {
		halfW := room.Width / 2
		halfH := room.Height / 2
		if x >= room.X-halfW && x <= room.X+halfW && z >= room.Z-halfH && z <= room.Z+halfH {
			return idx
		}
	}
	return -1
}

func (s *DungeonRoomState) CurrentRoomIndex(x, z float64) int {
	return s.CurrentRoomIndexForPosition(x, z)
}

func (s *DungeonRoomState) MarkExploredAt(x, z float64) {
	idx := s.CurrentRoomIndexForPosition(x, z)
	if idx < 0 || idx >= len(s.Rooms) {
		return
	}
	s.Rooms[idx].Explored = true
	s.CurrentRoomIndexValue = idx
}

func (s *DungeonRoomState) MarkRoomCleared(index int) {
	if index < 0 || index >= len(s.Rooms) {
		return
	}
	s.Rooms[index].Explored = true
	s.Rooms[index].Cleared = true
}

func (s *DungeonRoomState) ObjectiveRoomIndex() int {
	for idx, room := range s.Layout.Rooms {
		if room.Type == "start" {
			continue
		}
		if idx >= len(s.Rooms) || !s.Rooms[idx].Cleared {
			return idx
		}
	}
	return -1
}

func (s *DungeonRoomState) Summary(x, z float64) DungeonRoomSummary {
	if x != 0 || z != 0 {
		s.MarkExploredAt(x, z)
	}
	entries := make([]DungeonRoomSummaryEntry, 0, len(s.Layout.Rooms))
	for idx, room := range s.Layout.Rooms {
		progress := DungeonRoomProgress{}
		if idx < len(s.Rooms) {
			progress = s.Rooms[idx]
		}
		entries = append(entries, DungeonRoomSummaryEntry{
			Index:    idx,
			X:        room.X,
			Z:        room.Z,
			Width:    room.Width,
			Height:   room.Height,
			Type:     room.Type,
			Hook:     room.Hook,
			Pacing:   room.Pacing,
			Identity: dungeonRoomIdentityTag(room),
			Explored: progress.Explored,
			Cleared:  progress.Cleared,
		})
	}
	return DungeonRoomSummary{
		Rooms:              entries,
		CurrentRoomIndex:   s.CurrentRoomIndexValue,
		ObjectiveRoomIndex: s.ObjectiveRoomIndex(),
	}
}
