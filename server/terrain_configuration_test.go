package main

import (
	"testing"

	"eidolon-server/internal/game"
)

func TestTerrainStartupSelectionPreservesExplicitQAAndPublicSeparation(t *testing.T) {
	for _, tc := range []struct {
		name, profile, want   string
		qa, allowlist, reject bool
	}{
		{name: "default", want: game.FlatTerrainProfile},
		{name: "explicit-flat", profile: game.FlatTerrainProfile, want: game.FlatTerrainProfile},
		{name: "public-raised-no-qa", profile: game.RaisedEarthTerrainProfile, want: game.RaisedEarthTerrainProfile},
		{name: "public-raised-with-existing-allowlist", profile: game.RaisedEarthTerrainProfile, allowlist: true, want: game.RaisedEarthTerrainProfile},
		{name: "legacy-qa", qa: true, allowlist: true, want: game.RaisedEarthTerrainProfile},
		{name: "legacy-qa-with-explicit-flat", profile: game.FlatTerrainProfile, qa: true, allowlist: true, want: game.RaisedEarthTerrainProfile},
		{name: "legacy-qa-no-allowlist", qa: true, reject: true},
		{name: "public-profile-does-not-bypass-qa-guard", profile: game.RaisedEarthTerrainProfile, qa: true, reject: true},
		{name: "unknown", profile: "earth-elevation-v2", reject: true},
		{name: "incomplete-surface", profile: "earth-elevation-v1", reject: true},
		{name: "unknown-even-with-qa", profile: "typo", qa: true, allowlist: true, reject: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveTerrainStartupProfile(tc.profile, tc.qa, tc.allowlist)
			if (err != nil) != tc.reject || got != tc.want {
				t.Fatalf("profile=%q error=%v; want=%q reject=%v", got, err, tc.want, tc.reject)
			}
		})
	}
}
