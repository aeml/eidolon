package main

import (
	"fmt"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

const defaultTerrainProfile = "earth-elevation-rocks-v1"

// Server-owned profile selection: clients negotiate this exact profile at join.
// The explicit flat profile remains available for an operator rollback. It does
// not rewrite saved coordinates, currencies, progress or instance floors.
func newServerWorld(db *database.DB, profile string, qaTerrain, qaAllowlisted bool) (*game.World, error) {
	if qaTerrain {
		if !qaAllowlisted {
			return nil, fmt.Errorf("terrain QA requires an explicit username allowlist")
		}
		profile = "earth-elevation-rocks-v1"
	}
	switch profile {
	case "flat-v1":
		return game.NewWorld(db), nil
	case "earth-elevation-rocks-v1":
		return game.NewWorldWithElevationCandidate(db)
	default:
		return nil, fmt.Errorf("unsupported server terrain profile")
	}
}
