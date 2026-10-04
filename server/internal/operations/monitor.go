package operations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"time"
)

type Event struct {
	Notice   Notice `json:"notice"`
	Sample   Sample `json:"sample"`
	Delivery string `json:"delivery,omitempty"` // accepted, unconfirmed, suppressed
}

// Notifications are opt-in and independent of readiness or financial outcomes.
// Deliver must respect ctx and a finite timeout; failures never expose peer text.
type Notifier interface {
	Deliver(context.Context, Event) (string, error)
}

// Monitor runs outside the game process. Only incident transitions/reminders
// are written; healthy polling is silent and no player data is collected.
func Monitor(ctx context.Context, probe *Probe, detector *Detector, interval time.Duration, output io.Writer) error {
	return MonitorWithNotifier(ctx, probe, detector, interval, output, nil)
}

func MonitorWithNotifier(ctx context.Context, probe *Probe, detector *Detector, interval time.Duration, output io.Writer, notifier Notifier) error {
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
			event := Event{Notice: *notice, Sample: sample}
			if notifier != nil {
				status, err := notifier.Deliver(ctx, event)
				if ctx.Err() != nil {
					return nil
				}
				event.Delivery = "unconfirmed"
				if err == nil && (status == "accepted" || status == "suppressed") {
					event.Delivery = status
				}
			}
			if encoder.Encode(event) != nil {
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
