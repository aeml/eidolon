package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

type ownedProcessSample struct{ start, ticks, residentBytes uint64 }

// Linux stat fields only. The comm field may contain spaces or parentheses;
// never print raw proc contents, process arguments, environment or peer text.
func parseOwnedProcessStat(text string, pageBytes uint64) (ownedProcessSample, error) {
	invalid := errors.New("owned process measurement unavailable")
	end := strings.LastIndex(text, ")")
	if end < 0 || pageBytes == 0 {
		return ownedProcessSample{}, invalid
	}
	fields := strings.Fields(text[end+1:])
	if len(fields) < 22 {
		return ownedProcessSample{}, invalid
	}
	var values [4]uint64
	for i, index := range []int{11, 12, 19, 21} {
		value, err := strconv.ParseUint(fields[index], 10, 64)
		if err != nil {
			return ownedProcessSample{}, invalid
		}
		values[i] = value
	}
	if values[2] == 0 || values[0] > ^uint64(0)-values[1] || values[3] > ^uint64(0)/pageBytes {
		return ownedProcessSample{}, invalid
	}
	return ownedProcessSample{values[2], values[0] + values[1], values[3] * pageBytes}, nil
}

// Opt-in observation of the already-owned child only, from readiness until
// normal shutdown begins. One read/sec; no health polling, runtime changes,
// process selection, profiling endpoint or capacity threshold is introduced.
func observeOwnedLoadProcess(t *testing.T, process *os.Process, evidence string) func() {
	t.Helper()
	if os.Getenv("EIDOLON_LOAD_PROCESS_OBSERVATIONS") != "1" {
		return func() {}
	}
	clock, err := exec.Command("getconf", "CLK_TCK").Output()
	hz, parseErr := strconv.ParseUint(strings.TrimSpace(string(clock)), 10, 64)
	if err != nil || parseErr != nil || hz == 0 || hz > 1000000 {
		t.Fatal("owned process clock measurement unavailable")
	}
	read := func() (ownedProcessSample, error) {
		data, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(process.Pid), "stat"))
		if err != nil {
			return ownedProcessSample{}, errors.New("owned process measurement unavailable")
		}
		return parseOwnedProcessStat(string(data), uint64(os.Getpagesize()))
	}
	first, err := read()
	if err != nil {
		t.Fatal("owned process measurement unavailable")
	}
	started := time.Now()
	ctx, cancel := context.WithCancel(context.Background())
	type result struct {
		Samples                  uint64  `json:"samples"`
		Failed                   uint64  `json:"failed"`
		ElapsedSeconds           float64 `json:"elapsedSeconds"`
		CPUCorePercentMean       float64 `json:"cpuCorePercentMean"`
		CPUCorePercentMax        float64 `json:"cpuCorePercentMax"`
		PeakSampledResidentBytes uint64  `json:"peakSampledResidentBytes"`
	}
	done := make(chan result, 1)
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		last, lastAt := first, started
		out := result{PeakSampledResidentBytes: first.residentBytes}
		sample := func() {
			next, err := read()
			at := time.Now()
			if err != nil || next.start != first.start || next.ticks < last.ticks {
				out.Failed++
				return
			}
			seconds := at.Sub(lastAt).Seconds()
			out.Samples++
			out.PeakSampledResidentBytes = max(out.PeakSampledResidentBytes, next.residentBytes)
			// Exclude a very short final interval from the maximum: clock-tick
			// quantization would otherwise invent a misleading CPU spike.
			if seconds >= 0.5 {
				out.CPUCorePercentMax = max(out.CPUCorePercentMax, 100*float64(next.ticks-last.ticks)/float64(hz)/seconds)
			}
			out.ElapsedSeconds = at.Sub(started).Seconds()
			out.CPUCorePercentMean = 100 * float64(next.ticks-first.ticks) / float64(hz) / out.ElapsedSeconds
			last, lastAt = next, at
		}
		for {
			select {
			case <-ctx.Done():
				sample()
				done <- out
				return
			case <-ticker.C:
				sample()
			}
		}
	}()
	return func() {
		cancel()
		out := <-done
		encoded, err := json.Marshal(out)
		if err != nil || os.WriteFile(filepath.Join(evidence, "process-observations.json"), encoded, 0600) != nil {
			t.Error("owned process evidence unavailable")
			return
		}
		t.Logf("Owned process observations: %s", encoded)
		if out.Samples == 0 || out.Failed != 0 {
			t.Error("owned process observations incomplete")
		}
	}
}

func TestOwnedProcessStatRejectsMissingUnsafeAndPrivateFields(t *testing.T) {
	fields := strings.Fields("S 1 2 3 4 5 6 7 8 9 10 20 30 13 14 15 16 17 18 100 4096 2")
	valid := "999 (synthetic private ) comm) " + strings.Join(fields, " ")
	if sample, err := parseOwnedProcessStat(valid, 4096); err != nil || sample != (ownedProcessSample{100, 50, 8192}) {
		t.Fatal("wrong owned process fields", sample, err)
	}
	for _, invalid := range []string{"", "synthetic-private", "999 (private) S", strings.Replace(valid, "20 30", "-1 30", 1), strings.Replace(valid, "20 30", "18446744073709551615 30", 1), strings.Replace(valid, "100 4096 2", "0 4096 2", 1), strings.Replace(valid, "100 4096 2", "100 4096 18446744073709551615", 1)} {
		if _, err := parseOwnedProcessStat(invalid, 4096); err == nil || strings.Contains(err.Error(), "private") {
			t.Fatal("unsafe proc evidence accepted or leaked", err)
		}
	}
}

func TestOwnedLoadProcessObservationIsOptInJoinedAndFixedFieldOnly(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("EIDOLON_LOAD_PROCESS_OBSERVATIONS", "")
	observeOwnedLoadProcess(t, &os.Process{Pid: -1}, dir)()
	if entries, err := os.ReadDir(dir); err != nil || len(entries) != 0 {
		t.Fatal("disabled observer read a process or wrote evidence")
	}
	// A harmless explicitly-owned child, not selection of another user's PID.
	command := exec.Command("sleep", "10")
	if err := command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { command.Process.Kill(); command.Wait() }()
	t.Setenv("EIDOLON_LOAD_PROCESS_OBSERVATIONS", "1")
	observeOwnedLoadProcess(t, command.Process, dir)()
	data, err := os.ReadFile(filepath.Join(dir, "process-observations.json"))
	if err != nil {
		t.Fatal("resource evidence missing")
	}
	var result map[string]float64
	if json.Unmarshal(data, &result) != nil || len(result) != 6 || result["samples"] != 1 || result["failed"] != 0 || result["elapsedSeconds"] <= 0 {
		t.Fatal("invalid fixed resource summary")
	}
	for _, key := range []string{"samples", "failed", "elapsedSeconds", "cpuCorePercentMean", "cpuCorePercentMax", "peakSampledResidentBytes"} {
		if value, ok := result[key]; !ok || value < 0 {
			t.Fatal("missing or invalid numeric resource field", key)
		}
	}
	if info, err := os.Stat(filepath.Join(dir, "process-observations.json")); err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("resource evidence permission not private")
	}
}
