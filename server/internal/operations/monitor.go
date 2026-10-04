package operations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"time"
)

type Event struct {
	Notice Notice `json:"notice"`
	Sample Sample `json:"sample"`
}

// Monitor runs outside the game process. Only incident transitions/reminders
// are written; healthy polling is silent and no player data is collected.
func Monitor(ctx context.Context, probe *Probe, detector *Detector, interval time.Duration, output io.Writer) error {
	if probe == nil || detector == nil || output == nil || interval < time.Second || interval > 5*time.Minute {
		return errors.New("invalid bounded monitor configuration")
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	encoder := json.NewEncoder(output)
	for {
		if ctx.Err() != nil {
			return nil
		}
		sample := probe.Check(ctx)
		if notice := detector.Observe(sample, time.Now()); notice != nil {
			if encoder.Encode(Event{Notice: *notice, Sample: sample}) != nil {
				return errors.New("monitor output unavailable") // No downstream error text.
			}
		}
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}
