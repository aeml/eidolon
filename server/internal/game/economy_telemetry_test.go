package game

import (
	"testing"
	"time"
)

func TestEconomyTelemetryProducesHourlyAndDailySummary(t *testing.T) {
	start := time.Date(2026, time.September, 4, 12, 0, 0, 0, time.UTC)
	telemetry := NewEconomyTelemetry(start)
	telemetry.record("combat", 125, true, start.Add(time.Minute))
	telemetry.record("vendor", 25, true, start.Add(time.Minute))
	telemetry.record("respec", 40, false, start.Add(time.Minute))

	first := telemetry.Drain(start.Add(time.Hour))
	if first.SourceTotal != 150 || first.SinkTotal != 40 || first.Net != 110 || first.DailyNet != 110 {
		t.Fatalf("first economy summary mismatch: %+v", first)
	}
	second := telemetry.Drain(start.Add(2 * time.Hour))
	if second.SourceTotal != 0 || second.SinkTotal != 0 || second.DailySourceTotal != 150 || second.DailySinkTotal != 40 {
		t.Fatalf("hourly reset or daily accumulation mismatch: %+v", second)
	}
}
