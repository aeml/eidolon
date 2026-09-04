package game

import (
	"sync"
	"time"
)

type EconomySummary struct {
	PeriodStart      time.Time      `json:"periodStart"`
	PeriodEnd        time.Time      `json:"periodEnd"`
	Sources          map[string]int `json:"sources"`
	Sinks            map[string]int `json:"sinks"`
	SourceTotal      int            `json:"sourceTotal"`
	SinkTotal        int            `json:"sinkTotal"`
	Net              int            `json:"net"`
	Day              string         `json:"day"`
	DailySources     map[string]int `json:"dailySources"`
	DailySinks       map[string]int `json:"dailySinks"`
	DailySourceTotal int            `json:"dailySourceTotal"`
	DailySinkTotal   int            `json:"dailySinkTotal"`
	DailyNet         int            `json:"dailyNet"`
}

type EconomyTelemetry struct {
	mu           sync.Mutex
	periodStart  time.Time
	day          string
	sources      map[string]int
	sinks        map[string]int
	dailySources map[string]int
	dailySinks   map[string]int
}

func NewEconomyTelemetry(now time.Time) *EconomyTelemetry {
	now = now.UTC()
	return &EconomyTelemetry{
		periodStart: now,
		day:         now.Format(time.DateOnly),
		sources:     make(map[string]int), sinks: make(map[string]int),
		dailySources: make(map[string]int), dailySinks: make(map[string]int),
	}
}

func (telemetry *EconomyTelemetry) RecordSource(reason string, amount int) {
	telemetry.record(reason, amount, true, time.Now().UTC())
}

func (telemetry *EconomyTelemetry) RecordSink(reason string, amount int) {
	telemetry.record(reason, amount, false, time.Now().UTC())
}

func (telemetry *EconomyTelemetry) record(reason string, amount int, source bool, now time.Time) {
	if telemetry == nil || reason == "" || amount <= 0 {
		return
	}
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()
	telemetry.rollDayLocked(now)
	if source {
		telemetry.sources[reason] += amount
		telemetry.dailySources[reason] += amount
	} else {
		telemetry.sinks[reason] += amount
		telemetry.dailySinks[reason] += amount
	}
}

func (telemetry *EconomyTelemetry) Drain(now time.Time) EconomySummary {
	now = now.UTC()
	telemetry.mu.Lock()
	defer telemetry.mu.Unlock()
	telemetry.rollDayLocked(now)
	summary := EconomySummary{
		PeriodStart: telemetry.periodStart, PeriodEnd: now, Day: telemetry.day,
		Sources: cloneIntMap(telemetry.sources), Sinks: cloneIntMap(telemetry.sinks),
		DailySources: cloneIntMap(telemetry.dailySources), DailySinks: cloneIntMap(telemetry.dailySinks),
	}
	summary.SourceTotal = sumIntMap(summary.Sources)
	summary.SinkTotal = sumIntMap(summary.Sinks)
	summary.Net = summary.SourceTotal - summary.SinkTotal
	summary.DailySourceTotal = sumIntMap(summary.DailySources)
	summary.DailySinkTotal = sumIntMap(summary.DailySinks)
	summary.DailyNet = summary.DailySourceTotal - summary.DailySinkTotal
	telemetry.sources = make(map[string]int)
	telemetry.sinks = make(map[string]int)
	telemetry.periodStart = now
	return summary
}

func (telemetry *EconomyTelemetry) rollDayLocked(now time.Time) {
	day := now.UTC().Format(time.DateOnly)
	if day == telemetry.day {
		return
	}
	telemetry.day = day
	telemetry.dailySources = make(map[string]int)
	telemetry.dailySinks = make(map[string]int)
}

func cloneIntMap(values map[string]int) map[string]int {
	cloned := make(map[string]int, len(values))
	for key, value := range values {
		cloned[key] = value
	}
	return cloned
}

func sumIntMap(values map[string]int) int {
	total := 0
	for _, value := range values {
		total += value
	}
	return total
}
