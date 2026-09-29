package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"eidolon-server/internal/game"
)

// Stop after gameplay has drained. A normal deploy preserves the final partial
// hour; abrupt crashes and write failures are still not a durable ledger.
func startEconomyMetrics(world *game.World, path string) func() {
	if world == nil || world.Economy == nil || path == "" {
		return func() {}
	}
	stop, done := make(chan struct{}), make(chan struct{})
	var once sync.Once
	go func() {
		defer close(done)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		flush := func(now time.Time) {
			if err := appendEconomySummary(path, world.Economy.Drain(now)); err != nil {
				log.Printf("economy metrics write failed: %v", err)
			}
		}
		for {
			select {
			case now := <-ticker.C:
				flush(now)
			case <-stop:
				flush(time.Now())
				return
			}
		}
	}()
	return func() {
		once.Do(func() { close(stop) })
		<-done
	}
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
