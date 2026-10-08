package database

import (
	"testing"
	"time"
)

func TestBetaInvitationAdmissionAuditJournalReopensWithoutIdentitySecrets(t *testing.T) {
	dir := t.TempDir()
	journal, err := OpenAdminActivityJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	event, err := NewAdminActivity("operator", "invitee", "admin_beta_invitation", "invitation-journal-0001", "success",
		"Signup invitation admitted; no account was created", time.Now(), 90)
	if err != nil {
		t.Fatal(err)
	}
	event.Reason = "Expiry UTC: " + time.Now().Add(time.Hour).UTC().Format(time.RFC3339) + "; private response admission only"
	if err := journal.Write(event); err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenAdminActivityJournal(dir)
	if err != nil {
		t.Fatal(err)
	}
	pending, err := reopened.Pending(50)
	if err != nil || len(pending) != 1 || pending[0].ID != event.ID || pending[0].Action != event.Action ||
		pending[0].Summary != event.Summary || pending[0].Reason != event.Reason || !pending[0].ExpiresAt.Equal(event.ExpiresAt) {
		t.Fatal("invitation admission journal did not preserve exact bounded audit data")
	}
	if err := reopened.Acknowledge(event.ID); err != nil {
		t.Fatal(err)
	}
	if pending, err := reopened.Pending(50); err != nil || len(pending) != 0 {
		t.Fatal("invitation audit acknowledgement did not retire the owned journal record")
	}
}
