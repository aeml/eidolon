package main

import (
	"flag"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"runtime/pprof"
	"strconv"
	"testing"
	"time"
)

// Test binaries only: profile the real main/transport/world path against an
// explicitly disposable loopback database. Ordinary production builds do not
// contain this flag, TestMain, or a profiling HTTP endpoint.
var ownedCPUProfilePath = flag.String("qa-owned-cpu-profile", "", "Test-only private CPU profile for an owned disposable loopback server")

func ownedProfileConfigurationAllowed(path, address, mongo string, disposable bool) bool {
	if !disposable || !filepath.IsAbs(path) {
		return false
	}
	loopback := func(address string) bool {
		host, port, err := net.SplitHostPort(address)
		ip := net.ParseIP(host)
		n, portErr := strconv.Atoi(port)
		return err == nil && portErr == nil && n > 0 && n <= 65535 && ip != nil && ip.IsLoopback()
	}
	u, err := url.Parse(mongo)
	return loopback(address) && err == nil && u.Scheme == "mongodb" &&
		u.User == nil && u.RawQuery == "" && u.Fragment == "" &&
		(u.Path == "" || u.Path == "/") && loopback(u.Host)
}

func TestMain(m *testing.M) {
	flag.Parse()
	if *ownedCPUProfilePath == "" {
		os.Exit(m.Run())
	}
	if !ownedProfileConfigurationAllowed(*ownedCPUProfilePath, *addr, *mongoURI,
		os.Getenv("EIDOLON_RESOURCE_DISPOSABLE_DATABASE") == "1") ||
		buildCommit == "development" || buildCommit != filepath.Base(os.Args[0]) ||
		*checkSchema || *checkSaveJournal || *certFile != "" || *keyFile != "" {
		fmt.Fprintln(os.Stderr, "Owned CPU profile configuration refused")
		os.Exit(2)
	}
	// Never overwrite a prior artifact or follow a destination symlink. A
	// profile contains stack symbols, not recorded account/socket payloads.
	file, err := os.OpenFile(*ownedCPUProfilePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Owned CPU profile file unavailable")
		os.Exit(2)
	}
	stop, done := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(done)
		defer file.Close()
		// Exclude world initialization and the first admission burst. One fixed
		// 60s active sample is attribution, never a release/headroom gate.
		delay := time.NewTimer(20 * time.Second)
		defer delay.Stop()
		select {
		case <-stop:
			return
		case <-delay.C:
		}
		if err := pprof.StartCPUProfile(file); err != nil {
			fmt.Fprintln(os.Stderr, "Owned CPU profile unavailable")
			return
		}
		defer pprof.StopCPUProfile()
		window := time.NewTimer(60 * time.Second)
		defer window.Stop()
		select {
		case <-stop:
		case <-window.C:
		}
	}()
	main() // Same ordinary entry point, settings, simulation and socket handlers.
	close(stop)
	<-done
	os.Exit(0)
}

func TestOwnedProfileRefusesUnownedOrRemoteTargets(t *testing.T) {
	path := filepath.Join(t.TempDir(), "owned.cpu.pprof")
	if !ownedProfileConfigurationAllowed(path, "127.0.0.1:39001", "mongodb://127.0.0.1:39002", true) ||
		!ownedProfileConfigurationAllowed(path, "[::1]:39001", "mongodb://[::1]:39002", true) {
		t.Fatal("explicit owned loopback targets refused")
	}
	for _, test := range []struct {
		path, address, mongo string
		disposable           bool
	}{
		{path, "127.0.0.1:39001", "mongodb://127.0.0.1:39002", false},
		{"relative.pprof", "127.0.0.1:39001", "mongodb://127.0.0.1:39002", true},
		{path, "0.0.0.0:39001", "mongodb://127.0.0.1:39002", true},
		{path, "localhost:39001", "mongodb://127.0.0.1:39002", true},
		{path, "127.0.0.1:0", "mongodb://127.0.0.1:39002", true},
		{path, "127.0.0.1:39001", "mongodb://example.invalid:27017", true},
		{path, "127.0.0.1:39001", "mongodb://127.0.0.1:0", true},
		{path, "127.0.0.1:39001", "mongodb://user:pass@127.0.0.1:39002", true},
		{path, "127.0.0.1:39001", "mongodb://127.0.0.1:39002/production", true},
		{path, "127.0.0.1:39001", "mongodb://127.0.0.1:39002?replicaSet=live", true},
		{path, "127.0.0.1:39001", "mongodb+srv://example.invalid", true},
	} {
		if ownedProfileConfigurationAllowed(test.path, test.address, test.mongo, test.disposable) {
			t.Fatal("unowned or non-loopback profiling configuration accepted")
		}
	}
}

// Check test-package linker metadata without launching a database or server.
// A go test -c binary uses eidolon-server.buildCommit, not main.buildCommit.
func TestOwnedProfileBuildIdentity(t *testing.T) {
	expected := os.Getenv("EIDOLON_EXPECTED_PROFILE_COMMIT")
	if expected == "" {
		t.Skip("explicit compiled profile identity probe only")
	}
	if buildCommit != expected || filepath.Base(os.Args[0]) != expected {
		t.Fatal("compiled profile API does not match its declared build identity")
	}
}
