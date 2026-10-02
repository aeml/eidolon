package main

import (
	"fmt"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestPasswordChangeActualConnectedSessions(t *testing.T) {
	repo, uri, binary := resourceJournalIntegration(t)
	name := fmt.Sprintf("password-connected-%d", time.Now().UnixNano())
	const current = "oldpass"
	const next = "  Connected unique password phrase  "
	if err := repo.CreateUser(name, "fixture@example.invalid", current); err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateUser(name+"-other", "other@example.invalid", current); err != nil {
		t.Fatal(err)
	}
	address, stop := compatStartServer(t, binary, uri, 171, "-save-journal-dir", t.TempDir())
	defer stop()
	var result struct {
		RequestID   string
		Success     bool
		Message     string
		ResumeToken string
	}
	send := func(conn *websocket.Conn, password string) {
		resourceSend(t, conn, MsgChangePassword, map[string]string{"requestId": "connected-change", "username": name + "-other",
			"currentPassword": password, "newPassword": next})
		result.ResumeToken = ""
		resourceReadMessage(t, conn, "password_change_result", &result)
		if result.RequestID != "connected-change" {
			t.Fatal("password response lost correlation")
		}
	}
	guest := credentialSocket(t, address)
	send(guest, current)
	if result.Success || result.ResumeToken != "" {
		t.Fatal("guest changed credentials")
	}
	guest.Close()
	owner := credentialSocket(t, address)
	resourceSend(t, owner, MsgLogin, AuthPayload{Username: name, Password: current})
	oldToken := credentialExpectLogin(t, owner)
	send(owner, "incorrect-current")
	if result.Success || result.ResumeToken != "" {
		t.Fatal("wrong current proof changed credentials")
	}
	send(owner, current)
	if !result.Success || len(result.ResumeToken) != 64 || result.ResumeToken == oldToken {
		t.Fatal("connected password change did not confirm and rotate")
	}
	// A repeated unconfirmed request is not an automatic credential replay.
	send(owner, current)
	if result.Success {
		t.Fatal("replayed former password changed credentials again")
	}
	if ok, err := repo.Authenticate(name, next); err != nil || !ok {
		t.Fatal("new credential not persisted", err)
	}
	if ok, err := repo.Authenticate(name+"-other", current); err != nil || !ok {
		t.Fatal("forged username changed another account", err)
	}
	probe := credentialSocket(t, address)
	resourceSend(t, probe, MsgResumeSession, map[string]string{"token": oldToken})
	credentialExpectError(t, probe, "invalid or expired")
	probe.Close()
	owner.Close()
	stop()
	// A fresh process must accept only the new credential, not merely a RAM
	// session update. The fixture creates no character or gameplay privilege.
	address, stop = compatStartServer(t, binary, uri, 172, "-save-journal-dir", t.TempDir())
	defer stop()
	old := credentialSocket(t, address)
	resourceSend(t, old, MsgLogin, AuthPayload{Username: name, Password: current})
	credentialExpectError(t, old, "Invalid credentials")
	old.Close()
	fresh := credentialSocket(t, address)
	resourceSend(t, fresh, MsgLogin, AuthPayload{Username: name, Password: next})
	_ = credentialExpectLogin(t, fresh)
	fresh.Close()
}
