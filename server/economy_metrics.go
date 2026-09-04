package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"time"

	"eidolon-server/internal/game"
)

func startEconomyMetrics(world *game.World, path string) {
	if world == nil || world.Economy == nil || path == "" {
		return
	}
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for now := range ticker.C {
			if err := appendEconomySummary(path, world.Economy.Drain(now)); err != nil {
				log.Printf("economy metrics write failed: %v", err)
			}
		}
	}()
}

func appendEconomySummary(path string, summary game.EconomySummary) error {
	if directory := filepath.Dir(path); directory != "." {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			return err
		}
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	return json.NewEncoder(file).Encode(summary)
}
