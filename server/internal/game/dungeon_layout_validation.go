package game

import (
	"fmt"
	"math"
)

const canonicalDungeonCorridorWidth = 40.0

type DungeonWalkRect struct {
	X         float64 `json:"x"`
	Z         float64 `json:"z"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
	Kind      string  `json:"kind"`
	RoomIndex int     `json:"roomIndex,omitempty"`
}

type DungeonCorridor struct {
	FromRoomIndex  int     `json:"fromRoomIndex"`
	ToRoomIndex    int     `json:"toRoomIndex"`
	Width          float64 `json:"width"`
	WalkRectIndices []int  `json:"walkRectIndices"`
}

func appendDungeonRoom(layout *DungeonLayout, room DungeonRoom) int {
	roomIndex := len(layout.Rooms)
	layout.Rooms = append(layout.Rooms, room)
	layout.WalkRects = append(layout.WalkRects, DungeonWalkRect{
		X:         room.X,
		Z:         room.Z,
		Width:     room.Width,
		Height:    room.Height,
		Kind:      "room",
		RoomIndex: roomIndex,
	})
	return roomIndex
}

func appendDungeonRoomAndConnect(layout *DungeonLayout, room DungeonRoom, corridorWidth float64) int {
	roomIndex := appendDungeonRoom(layout, room)
	if roomIndex > 0 {
		connectDungeonRooms(layout, roomIndex-1, roomIndex, corridorWidth)
	}
	return roomIndex
}

func assignDungeonRoomHooks(layout *DungeonLayout) {
	if layout == nil || len(layout.Rooms) == 0 {
		return
	}

	normalIndices := make([]int, 0)
	eliteIndices := make([]int, 0)
	traversableRoomCount := 0
	for idx := range layout.Rooms {
		layout.Rooms[idx].Hook = ""
		layout.Rooms[idx].Pacing = ""
		switch layout.Rooms[idx].Type {
		case "normal":
			normalIndices = append(normalIndices, idx)
			traversableRoomCount++
		case "elite":
			eliteIndices = append(eliteIndices, idx)
			traversableRoomCount++
		}
	}

	shrineIndex := -1
	if len(normalIndices) > 0 {
		shrineIndex = normalIndices[len(normalIndices)-1]
	}

	chestCandidates := make([]int, 0, len(normalIndices))
	for _, idx := range normalIndices {
		if idx == shrineIndex {
			continue
		}
		chestCandidates = append(chestCandidates, idx)
	}
	if len(chestCandidates) > 0 {
		layout.Rooms[chestCandidates[0]].Hook = "chest"
	}
	if traversableRoomCount >= 5 && len(chestCandidates) > 1 {
		midpoint := len(layout.Rooms) / 2
		for _, idx := range chestCandidates[1:] {
			if idx >= midpoint {
				layout.Rooms[idx].Hook = "chest"
				break
			}
		}
	}
	if shrineIndex >= 0 {
		layout.Rooms[shrineIndex].Hook = "shrine"
	}

	if len(eliteIndices) > 0 {
		layout.Rooms[eliteIndices[0]].Hook = "elite_ambush"
	}
	if traversableRoomCount >= 5 && len(eliteIndices) > 1 {
		lastEliteIndex := eliteIndices[len(eliteIndices)-1]
		if lastEliteIndex != eliteIndices[0] {
			layout.Rooms[lastEliteIndex].Hook = "elite_ambush"
		}
	}

	for idx := 1; idx < len(layout.Rooms); idx++ {
		if layout.Rooms[idx].Type == "boss" && layout.Rooms[idx-1].Type != "start" {
			layout.Rooms[idx-1].Pacing = "boss_approach"
		}
	}
}

func connectDungeonRooms(layout *DungeonLayout, fromRoomIndex, toRoomIndex int, corridorWidth float64) {
	if layout == nil || fromRoomIndex < 0 || toRoomIndex < 0 || fromRoomIndex >= len(layout.Rooms) || toRoomIndex >= len(layout.Rooms) {
		return
	}

	walkRects := buildCanonicalCorridorWalkRects(layout.Rooms[fromRoomIndex], layout.Rooms[toRoomIndex], corridorWidth)
	if len(walkRects) == 0 {
		return
	}

	startIndex := len(layout.WalkRects)
	walkRectIndices := make([]int, 0, len(walkRects))
	for i := range walkRects {
		layout.WalkRects = append(layout.WalkRects, walkRects[i])
		walkRectIndices = append(walkRectIndices, startIndex+i)
	}

	layout.Corridors = append(layout.Corridors, DungeonCorridor{
		FromRoomIndex:  fromRoomIndex,
		ToRoomIndex:    toRoomIndex,
		Width:          corridorWidth,
		WalkRectIndices: walkRectIndices,
	})
}

func buildCanonicalCorridorWalkRects(fromRoom, toRoom DungeonRoom, corridorWidth float64) []DungeonWalkRect {
	if corridorWidth <= 0 {
		return nil
	}

	if nearlyEqual(fromRoom.X, toRoom.X) {
		return []DungeonWalkRect{{
			X:      fromRoom.X,
			Z:      (fromRoom.Z + toRoom.Z) / 2,
			Width:  corridorWidth,
			Height: math.Abs(toRoom.Z-fromRoom.Z) + corridorWidth,
			Kind:   "corridor",
		}}
	}

	if nearlyEqual(fromRoom.Z, toRoom.Z) {
		return []DungeonWalkRect{{
			X:      (fromRoom.X + toRoom.X) / 2,
			Z:      fromRoom.Z,
			Width:  math.Abs(toRoom.X-fromRoom.X) + corridorWidth,
			Height: corridorWidth,
			Kind:   "corridor",
		}}
	}

	verticalDirection := 1.0
	if toRoom.Z < fromRoom.Z {
		verticalDirection = -1.0
	}

	fromEdgeZ := fromRoom.Z + (verticalDirection * fromRoom.Height / 2)
	toEdgeZ := toRoom.Z - (verticalDirection * toRoom.Height / 2)
	availableVertical := math.Abs(toEdgeZ - fromEdgeZ)
	if availableVertical+0.001 < corridorWidth {
		return nil
	}

	elbowZ := (fromEdgeZ + toEdgeZ) / 2
	return []DungeonWalkRect{
		{
			X:      fromRoom.X,
			Z:      (fromEdgeZ + elbowZ) / 2,
			Width:  corridorWidth,
			Height: math.Abs(elbowZ-fromEdgeZ) + corridorWidth,
			Kind:   "corridor",
		},
		{
			X:      (fromRoom.X + toRoom.X) / 2,
			Z:      elbowZ,
			Width:  math.Abs(toRoom.X-fromRoom.X) + corridorWidth,
			Height: corridorWidth,
			Kind:   "corridor",
		},
		{
			X:      toRoom.X,
			Z:      (elbowZ + toEdgeZ) / 2,
			Width:  corridorWidth,
			Height: math.Abs(toEdgeZ-elbowZ) + corridorWidth,
			Kind:   "corridor",
		},
	}
}

func ValidateDungeonLayout(layout DungeonLayout) error {
	if len(layout.Rooms) == 0 {
		return fmt.Errorf("dungeon layout has no rooms")
	}
	if len(layout.WalkRects) == 0 {
		return fmt.Errorf("dungeon layout has no canonical walkable geometry")
	}

	startRoomCount := 0
	roomWalkRectCount := make([]int, len(layout.Rooms))
	for _, room := range layout.Rooms {
		if room.Type == "start" {
			startRoomCount++
		}
	}
	if startRoomCount != 1 {
		return fmt.Errorf("dungeon layout must have exactly one start room")
	}
	if layout.Rooms[0].Type != "start" {
		return fmt.Errorf("dungeon layout start room must be room 0")
	}

	for i, rect := range layout.WalkRects {
		if rect.Width <= 0 || rect.Height <= 0 {
			return fmt.Errorf("walk rect %d has invalid size", i)
		}
		switch rect.Kind {
		case "room":
			if rect.RoomIndex < 0 || rect.RoomIndex >= len(layout.Rooms) {
				return fmt.Errorf("room walk rect %d references invalid room index %d", i, rect.RoomIndex)
			}
			if !walkRectMatchesRoom(rect, layout.Rooms[rect.RoomIndex]) {
				return fmt.Errorf("room walk rect %d must exactly match room %d", i, rect.RoomIndex)
			}
			roomWalkRectCount[rect.RoomIndex]++
		case "corridor":
		default:
			return fmt.Errorf("walk rect %d has unknown kind %q", i, rect.Kind)
		}
	}

	for roomIndex, count := range roomWalkRectCount {
		if count != 1 {
			return fmt.Errorf("room %d must have exactly one canonical room walk rect", roomIndex)
		}
	}

	if len(layout.Rooms) > 1 && len(layout.Corridors) == 0 {
		return fmt.Errorf("dungeon layout has no room connections")
	}

	adjacency := make([][]int, len(layout.Rooms))
	degrees := make([]int, len(layout.Rooms))
	corridorWalkRectRefCount := make([]int, len(layout.WalkRects))
	for corridorIndex, corridor := range layout.Corridors {
		if corridor.FromRoomIndex < 0 || corridor.FromRoomIndex >= len(layout.Rooms) || corridor.ToRoomIndex < 0 || corridor.ToRoomIndex >= len(layout.Rooms) {
			return fmt.Errorf("corridor %d references invalid room indices", corridorIndex)
		}
		if corridor.FromRoomIndex == corridor.ToRoomIndex {
			return fmt.Errorf("corridor %d connects room %d to itself", corridorIndex, corridor.FromRoomIndex)
		}
		if corridor.Width <= 0 {
			return fmt.Errorf("corridor %d has invalid width", corridorIndex)
		}
		if len(corridor.WalkRectIndices) == 0 {
			return fmt.Errorf("corridor %d has no canonical walk rects", corridorIndex)
		}

		corridorRects := make([]DungeonWalkRect, 0, len(corridor.WalkRectIndices))
		for _, walkRectIndex := range corridor.WalkRectIndices {
			if walkRectIndex < 0 || walkRectIndex >= len(layout.WalkRects) {
				return fmt.Errorf("corridor %d references invalid walk rect %d", corridorIndex, walkRectIndex)
			}
			rect := layout.WalkRects[walkRectIndex]
			if rect.Kind != "corridor" {
				return fmt.Errorf("corridor %d references non-corridor walk rect %d", corridorIndex, walkRectIndex)
			}
			corridorWalkRectRefCount[walkRectIndex]++
			if corridorWalkRectRefCount[walkRectIndex] > 1 {
				return fmt.Errorf("corridor walk rect %d is referenced more than once", walkRectIndex)
			}
			corridorRects = append(corridorRects, rect)
		}

		if !walkRectOverlapsRoom(corridorRects[0], layout.Rooms[corridor.FromRoomIndex]) {
			return fmt.Errorf("corridor %d does not overlap source room %d", corridorIndex, corridor.FromRoomIndex)
		}
		if !walkRectOverlapsRoom(corridorRects[len(corridorRects)-1], layout.Rooms[corridor.ToRoomIndex]) {
			return fmt.Errorf("corridor %d does not overlap target room %d", corridorIndex, corridor.ToRoomIndex)
		}
		for i := 1; i < len(corridorRects); i++ {
			if !walkRectsOverlap(corridorRects[i-1], corridorRects[i]) {
				return fmt.Errorf("corridor %d walk rect %d does not overlap previous segment", corridorIndex, i)
			}
		}

		adjacency[corridor.FromRoomIndex] = append(adjacency[corridor.FromRoomIndex], corridor.ToRoomIndex)
		adjacency[corridor.ToRoomIndex] = append(adjacency[corridor.ToRoomIndex], corridor.FromRoomIndex)
		degrees[corridor.FromRoomIndex]++
		degrees[corridor.ToRoomIndex]++
	}

	for walkRectIndex, rect := range layout.WalkRects {
		if rect.Kind != "corridor" {
			continue
		}
		if corridorWalkRectRefCount[walkRectIndex] == 0 {
			return fmt.Errorf("unreferenced corridor walk rect %d", walkRectIndex)
		}
	}

	for roomIndex, room := range layout.Rooms {
		if room.Type == "start" {
			continue
		}
		if degrees[roomIndex] == 0 {
			return fmt.Errorf("room %d has no connection", roomIndex)
		}
	}

	visited := make([]bool, len(layout.Rooms))
	queue := []int{0}
	visited[0] = true
	for len(queue) > 0 {
		roomIndex := queue[0]
		queue = queue[1:]
		for _, neighbor := range adjacency[roomIndex] {
			if visited[neighbor] {
				continue
			}
			visited[neighbor] = true
			queue = append(queue, neighbor)
		}
	}

	for roomIndex := range layout.Rooms {
		if !visited[roomIndex] {
			return fmt.Errorf("room %d is not reachable from the start room", roomIndex)
		}
	}

	return nil
}

func isPointInDungeonLayout(layout DungeonLayout, x, z float64) bool {
	for _, rect := range layout.WalkRects {
		if pointInWalkRect(rect, x, z) {
			return true
		}
	}
	return false
}

func pointInWalkRect(rect DungeonWalkRect, x, z float64) bool {
	halfW := rect.Width / 2
	halfH := rect.Height / 2
	return x >= rect.X-halfW && x <= rect.X+halfW && z >= rect.Z-halfH && z <= rect.Z+halfH
}

func walkRectOverlapsRoom(rect DungeonWalkRect, room DungeonRoom) bool {
	return overlapArea(
		rect.X, rect.Z, rect.Width, rect.Height,
		room.X, room.Z, room.Width, room.Height,
	)
}

func walkRectMatchesRoom(rect DungeonWalkRect, room DungeonRoom) bool {
	return nearlyEqual(rect.X, room.X) &&
		nearlyEqual(rect.Z, room.Z) &&
		nearlyEqual(rect.Width, room.Width) &&
		nearlyEqual(rect.Height, room.Height)
}

func walkRectsOverlap(a, b DungeonWalkRect) bool {
	return overlapArea(a.X, a.Z, a.Width, a.Height, b.X, b.Z, b.Width, b.Height)
}

func overlapArea(ax, az, aw, ah, bx, bz, bw, bh float64) bool {
	overlapX := math.Min(ax+aw/2, bx+bw/2) - math.Max(ax-aw/2, bx-bw/2)
	overlapZ := math.Min(az+ah/2, bz+bh/2) - math.Max(az-ah/2, bz-bh/2)
	return overlapX > 0.001 && overlapZ > 0.001
}

func nearlyEqual(a, b float64) bool {
	return math.Abs(a-b) < 0.001
}
