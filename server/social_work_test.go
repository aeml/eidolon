package main

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"eidolon-server/internal/lifecycle"
)

func TestSocialWorkCoalescesConcurrentTriggersAndRefreshesLatestState(t *testing.T) {
	var work coalescedSocialWork
	var group lifecycle.Group
	var started, calls, latest atomic.Int32
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }); group.SealWhenIdle() })
	schedule := func(callback func()) bool { started.Add(1); return group.Go(callback) }
	refresh := func() {
		if calls.Add(1) == 1 {
			close(entered)
			<-release
			return // first pass may have captured old state before the blocked IO
		}
		if latest.Load() != 200 {
			t.Error("refresh did not derive the latest state")
		}
	}
	if !work.request(schedule, refresh) {
		t.Fatal("initial refresh refused")
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("worker did not start")
	}
	var triggers sync.WaitGroup
	for range 200 {
		triggers.Add(1)
		go func() {
			defer triggers.Done()
			latest.Add(1)
			if !work.request(schedule, refresh) {
				t.Error("live refresh refused")
			}
		}()
	}
	triggers.Wait()
	if started.Load() != 1 {
		t.Fatal("duplicate triggers launched more workers", started.Load())
	}
	once.Do(func() { close(release) })
	group.SealWhenIdle()
	if calls.Load() != 2 {
		t.Fatal("dirty state should produce exactly one additional refresh", calls.Load())
	}
}

func TestSocialWorkRejectedSchedulingResetsAdmissionAndCanRestart(t *testing.T) {
	var work coalescedSocialWork
	if work.request(func(func()) bool { return false }, func() { t.Error("rejected refresh ran") }) {
		t.Fatal("rejected scheduler reported success")
	}
	var group lifecycle.Group
	var calls atomic.Int32
	if !work.request(group.Go, func() { calls.Add(1) }) {
		t.Fatal("rejected scheduling poisoned future admission")
	}
	group.SealWhenIdle()
	if calls.Load() != 1 {
		t.Fatal("replacement refresh did not run exactly once")
	}
	if work.request(group.Go, func() { t.Error("sealed work ran") }) {
		t.Fatal("sealed group admitted new work")
	}
}

func TestSocialWorkConnectionLeaseRetainsOneRefreshAndItsDirtyPass(t *testing.T) {
	old := backgroundCharacterWork
	group := &lifecycle.Group{}
	backgroundCharacterWork = group
	release, entered := make(chan struct{}), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() {
		once.Do(func() { close(release) })
		group.SealWhenIdle()
		backgroundCharacterWork = old
	})
	gate := &websocketConnectionGate{limit: 1}
	free, _ := gate.begin()
	c := &Client{username: "synthetic-presence-owner"}
	c.initializeConnectionWork(free)
	var calls atomic.Int32
	schedule := func(callback func()) bool { return scheduleClientCharacterWork(c, callback) }
	refresh := func() {
		if calls.Add(1) == 1 {
			close(entered)
			<-release
		}
	}
	if !c.friendPresenceWork.request(schedule, refresh) {
		t.Fatal("presence work refused")
	}
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("presence worker did not start")
	}
	for range 100 {
		c.friendPresenceWork.request(schedule, refresh)
	}
	c.connectionWorkMu.Lock()
	owners := c.connectionWorkUsers
	c.connectionWorkMu.Unlock()
	if owners != 4 {
		t.Fatal("presence refresh must own only one reference beyond reader/writer/retirement", owners)
	}
	for range 3 {
		c.finishConnectionWork()
	}
	if extra, admitted := gate.begin(); admitted {
		extra()
		t.Fatal("socket capacity released while friend presence remained")
	}
	once.Do(func() { close(release) })
	group.SealWhenIdle()
	if calls.Load() != 2 {
		t.Fatal("dirty presence update lost or duplicated")
	}
	if extra, admitted := gate.begin(); !admitted {
		t.Fatal("drained presence did not release connection reservation")
	} else {
		extra()
	}
	if scheduleFriendPresence(c) {
		t.Fatal("released transport revived its presence worker")
	}
}

func TestSocialWorkSealedBroadcastAndMissingAccountDoNotLaunch(t *testing.T) {
	old := backgroundCharacterWork
	group := &lifecycle.Group{}
	group.CloseAndWait()
	backgroundCharacterWork = group
	defer func() { backgroundCharacterWork = old }()
	if scheduleSocialBroadcast() {
		t.Fatal("sealed shutdown admitted a social broadcast")
	}
	if scheduleFriendPresence(nil) || scheduleFriendPresence(&Client{}) {
		t.Fatal("missing account admitted friend presence")
	}
}
