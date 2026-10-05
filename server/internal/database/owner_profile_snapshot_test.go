package database

import (
	"bytes"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestOwnerProfileSnapshotPreservesOnlyOwnerProfile(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.FixedZone("fixture", 3600))
	// Decode the actual account-shaped BSON into the restricted projection.
	stored, err := bson.Marshal(bson.M{
		"username": "owner", "public_name": "<script>display only</script>",
		"email": "submitted@example.invalid", "created_at": now.Add(-time.Hour),
		"recovery_email": bson.M{"address": "verified@example.invalid", "verified_at": now},
		"password_hash":  "private-password", "roles": bson.M{"admin": "private-staff"},
		"password_recovery":      bson.M{"digest": "private-token", "address": "private-recipient"},
		"recovery_email_pending": bson.M{"address": "private-pending"},
		"characters":             bson.A{bson.M{"name": "private-character", "receipts": "private-receipt"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var source ownerProfileSource
	if err := bson.Unmarshal(stored, &source); err != nil {
		t.Fatal(err)
	}
	before := source
	encoded, err := encodeOwnerProfileSnapshot(source, "owner", now, 4096)
	if err != nil {
		t.Fatal(err)
	}
	var got ownerProfileSnapshot
	if err := json.Unmarshal(encoded, &got); err != nil {
		t.Fatal(err)
	}
	if got.Format != "eidolon-owner-account-profile" || got.Version != 1 || !got.GeneratedAt.Equal(now) || got.GeneratedAt.Location() != time.UTC {
		t.Fatal("missing versioned UTC envelope")
	}
	if got.Coverage.CompleteAccountExport || len(got.Coverage.Included) == 0 || len(got.Coverage.SeparateHandling) == 0 {
		t.Fatal("missing bounded-section coverage manifest")
	}
	profile := got.Profile
	if profile.Username != "owner" || profile.PublicName != source.PublicName || profile.SubmittedEmail != source.Email || profile.CreatedAt == nil || !profile.CreatedAt.Equal(now.Add(-time.Hour)) || profile.CreatedAt.Location() != time.UTC {
		t.Fatal("owner profile lost data")
	}
	verified := profile.VerifiedRecoveryEmail
	if verified == nil || verified.Address != "verified@example.invalid" || !verified.VerifiedAt.Equal(now) || verified.VerifiedAt.Location() != time.UTC {
		t.Fatal("verified address lost its distinct provenance")
	}
	if strings.Contains(string(encoded), "private-") || strings.Contains(string(encoded), "<script>") || !reflect.DeepEqual(source, before) {
		t.Fatal("private fields leaked, markup was not escaped or source mutated")
	}
	// A future accidental marshaling of the source must not expose its fields.
	privateJSON, err := json.Marshal(source)
	if err != nil || string(privateJSON) != "{}" {
		t.Fatal("source projection is not private")
	}
	exact, err := encodeOwnerProfileSnapshot(source, "owner", now.UTC(), len(encoded))
	if err != nil || !bytes.Equal(encoded, exact) {
		t.Fatal("exact response budget or deterministic encoding failed")
	}
	for _, sample := range []struct {
		owner string
		at    time.Time
		cap   int
	}{
		{"other", now, 4096}, {"", now, 4096}, {"owner", time.Time{}, 4096},
		{"owner", now, 0}, {"owner", now, len(encoded) - 1},
	} {
		result, err := encodeOwnerProfileSnapshot(source, sample.owner, sample.at, sample.cap)
		if err != errOwnerProfileSnapshot || result != nil {
			t.Fatal("invalid request returned partial private output")
		}
	}
}

func TestOwnerProfileSnapshotDoesNotInventVerificationOrLegacyCreation(t *testing.T) {
	now := time.Now().UTC()
	for _, email := range []recoveryEmail{
		{}, {Address: "unverified@example.invalid"},
		{Address: "invalid recipient", VerifiedAt: now},
	} {
		encoded, err := encodeOwnerProfileSnapshot(ownerProfileSource{
			Username: "owner", Email: "submitted@example.invalid", RecoveryEmail: email,
		}, "owner", now, 4096)
		if err != nil {
			t.Fatal(err)
		}
		var got ownerProfileSnapshot
		if err := json.Unmarshal(encoded, &got); err != nil {
			t.Fatal(err)
		}
		if got.Profile.CreatedAt != nil || got.Profile.VerifiedRecoveryEmail != nil || got.Profile.SubmittedEmail != "submitted@example.invalid" {
			t.Fatal("unverified email or missing legacy creation was invented")
		}
	}
}
