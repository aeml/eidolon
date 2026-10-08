package main

import (
	"fmt"

	"eidolon-server/internal/game"
)

func resolveTerrainStartupProfile(profile string, qaTerrain, hasQAAllowlist bool) (string, error) {
	if profile == "" {
		profile = game.FlatTerrainProfile
	}
	if profile != game.FlatTerrainProfile && profile != game.RaisedEarthTerrainProfile {
		return "", fmt.Errorf("unsupported terrain profile %q", profile)
	}
	if qaTerrain {
		if !hasQAAllowlist {
			return "", fmt.Errorf("terrain candidate requires an explicit QA username allowlist")
		}
		profile = game.RaisedEarthTerrainProfile
	}
	return profile, nil
}
