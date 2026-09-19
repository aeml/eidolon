package main

import (
	"errors"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var adminActivityJournal *database.AdminActivityJournal
var adminActivityReplayMu sync.Mutex

// A transport can disappear even if local storage has failed. Retain these
// unavoidable events in RAM, refuse a successful shutdown until journaled,
// and make readiness fail rather than silently reporting complete history.
var unjournaledActivity = struct {
	sync.Mutex
	events map[primitive.ObjectID]database.AdminActivity
}{events: make(map[primitive.ObjectID]database.AdminActivity)}

func newSessionActivity(username, action string) (database.AdminActivity, error) {
	if adminActivities == nil || adminActivityJournal == nil {
		return database.AdminActivity{}, errors.New("session activity persistence unavailable")
	}
	summary := ""
	switch action {
	case "login":
		summary = "Account authenticated by login."
	case "resume":
		summary = "Authenticated session resumed."
	case "disconnect":
		summary = "Authenticated connection ended."
	default:
		return database.AdminActivity{}, errors.New("invalid session activity")
	}
	event, err := database.NewAdminActivity(username, "", action, "session-event", "success", summary, time.Now(), adminActivities.AdminActivityRetentionDays())
	if err == nil {
		event.RequestID = "session-" + event.ID.Hex()
	}
	return event, err
}

// Authentication only proceeds after its event is durable on the existing
// private save volume. Mongo availability does not block the network hub.
func recordSessionActivity(username, action string) error {
	event, err := newSessionActivity(username, action)
	if err != nil {
		return err
	}
	return adminActivityJournal.Write(event)
}

func recordSessionDisconnect(username string) error {
	event, err := newSessionActivity(username, "disconnect")
	if err != nil {
		return err
	}
	if err := adminActivityJournal.Write(event); err != nil {
		unjournaledActivity.Lock()
		unjournaledActivity.events[event.ID] = event
		unjournaledActivity.Unlock()
		return err
	}
	return nil
}

func sessionActivityJournalHealthy() bool {
	unjournaledActivity.Lock()
	defer unjournaledActivity.Unlock()
	return len(unjournaledActivity.events) == 0
}

func persistUnjournaledActivity() error {
	unjournaledActivity.Lock()
	defer unjournaledActivity.Unlock()
	for id, event := range unjournaledActivity.events {
		if adminActivityJournal == nil {
			return errors.New("session activity journal unavailable")
		}
		if err := adminActivityJournal.Write(event); err != nil {
			return err
		}
		delete(unjournaledActivity.events, id)
	}
	return nil
}

func retryPendingAdminActivity() error {
	adminActivityReplayMu.Lock()
	defer adminActivityReplayMu.Unlock()
	if err := persistUnjournaledActivity(); err != nil {
		return err
	}
	if adminActivityJournal == nil || adminActivities == nil {
		return errors.New("session activity persistence unavailable")
	}
	events, err := adminActivityJournal.Pending(50)
	if err != nil {
		return err
	}
	for _, event := range events {
		if err := adminActivities.AppendAdminActivity(event); err != nil {
			return err
		}
		if err := adminActivityJournal.Acknowledge(event.ID); err != nil {
			return err
		}
	}
	return nil
}

// Before opening admission there are no new producers. Drain all batches so a
// corrupt later record cannot hide behind the runtime batch boundary at startup.
func recoverAdminActivityOnStartup() error {
	for {
		if err := retryPendingAdminActivity(); err != nil {
			return err
		}
		pending, err := adminActivityJournal.Pending(1)
		if err != nil {
			return err
		}
		if len(pending) == 0 {
			return nil
		}
	}
}
