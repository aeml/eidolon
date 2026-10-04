package database

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func TestAccountJSONExcludesPasswordHashWithoutChangingBSON(t *testing.T) {
	user := User{Username: "privacy-fixture", Email: "fixture@example.invalid", PasswordHash: "synthetic-password-hash"}
	encoded, err := json.Marshal(user)
	if err != nil {
		t.Fatal(err)
	}
	var public map[string]any
	if err := json.Unmarshal(encoded, &public); err != nil {
		t.Fatal(err)
	}
	if _, present := public["PasswordHash"]; present || strings.Contains(string(encoded), user.PasswordHash) {
		t.Fatal("raw account JSON contains a password hash")
	}
	stored, err := bson.Marshal(user)
	if err != nil {
		t.Fatal(err)
	}
	var restored User
	if err := bson.Unmarshal(stored, &restored); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(restored, user) {
		t.Fatal("JSON protection changed the BSON account persistence contract")
	}
}

func TestRecoveryAccountJSONExcludesPrivateProofsWithoutChangingBSON(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	email := recoveryEmail{Address: "fixture@example.invalid", VerifiedAt: now}
	challenge := recoveryChallenge{Digest: strings.Repeat("a", 64), Address: email.Address,
		PasswordHash: "synthetic-password-hash", IssuedAt: now, ExpiresAt: now.Add(15 * time.Minute)}
	account := recoveryAccount{Hash: challenge.PasswordHash, Email: email, Verification: challenge, Reset: challenge}
	for _, sample := range []struct {
		name  string
		value any
	}{
		{"verified-address", email},
		{"challenge", challenge},
		{"account-projection", account},
	} {
		t.Run(sample.name, func(t *testing.T) {
			typeOf := reflect.TypeOf(sample.value)
			for i := 0; i < typeOf.NumField(); i++ {
				if typeOf.Field(i).Tag.Get("json") != "-" {
					t.Fatal("private recovery field lacks an explicit JSON exclusion")
				}
			}
			encoded, err := json.Marshal(sample.value)
			if err != nil {
				t.Fatal(err)
			}
			if string(encoded) != "{}" {
				t.Fatal("private recovery projection was exposed as JSON")
			}
			stored, err := bson.Marshal(sample.value)
			if err != nil {
				t.Fatal(err)
			}
			restored := reflect.New(reflect.TypeOf(sample.value))
			if err := bson.Unmarshal(stored, restored.Interface()); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(restored.Elem().Interface(), sample.value) {
				t.Fatal("JSON protection changed private recovery BSON persistence")
			}
		})
	}
}
