package main

import (
	"bytes"
	"eidolon-server/internal/registrationinvites"
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPrivateIssuerFilesAndServerAgreement(t *testing.T) {
	dir := t.TempDir()
	key := filepath.Join(dir, "key")
	roster := filepath.Join(dir, "roster.json")
	output := filepath.Join(dir, "invitations.json")
	var log bytes.Buffer
	if err := run([]string{"-generate-key", key}, &log); err != nil {
		t.Fatal(err)
	}
	original, _ := os.ReadFile(key)
	if err := run([]string{"-generate-key", key}, &log); err == nil {
		t.Fatal("key overwritten")
	}
	after, _ := os.ReadFile(key)
	if !bytes.Equal(original, after) {
		t.Fatal("key changed")
	}
	os.WriteFile(roster, []byte(`["Alice","Mira 雨"]`), 0600)
	args := []string{"-key-file", key, "-roster", roster, "-cohort", "private-qa", "-expires", time.Now().Add(time.Hour).UTC().Format(time.RFC3339), "-output", output}
	if err := run(args, &log); err != nil {
		t.Fatal(err)
	}
	info, _ := os.Stat(output)
	if info.Mode().Perm() != 0600 {
		t.Fatal("manifest is not private")
	}
	data, _ := os.ReadFile(output)
	var m manifest
	if json.Unmarshal(data, &m) != nil || len(m.Invitations) != 2 {
		t.Fatal("missing issued invitations")
	}
	keyBytes, err := readPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	p, err := registrationinvites.NewPolicy(keyBytes, "private-qa", []string{"Alice", "Mira 雨"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range m.Invitations {
		u, err := url.Parse(r.URL)
		if err != nil || u.RawQuery != "" {
			t.Fatal("secret put in query")
		}
		token, err := url.ParseQuery(u.Fragment)
		if err != nil || p.Check(r.Username, token.Get("invite"), time.Now()) != nil {
			t.Fatal("issuer/server disagreement")
		}
		if strings.Contains(log.String(), token.Get("invite")) || strings.Contains(log.String(), string(original)) {
			t.Fatal("credential printed")
		}
	}
	if err := run(args, &log); err == nil {
		t.Fatal("manifest overwritten")
	}
	os.Chmod(key, 0644)
	if _, err := readPrivateKey(key); err == nil {
		t.Fatal("insecure key file accepted")
	}
}
func TestIssuerRequiresExplicitSafeInputs(t *testing.T) {
	for _, args := range [][]string{{}, {"-cohort", "qa"}, {"-generate-key", filepath.Join(t.TempDir(), "key"), "-roster", "x"}} {
		if run(args, &bytes.Buffer{}) == nil {
			t.Fatal("ambiguous issuance accepted")
		}
	}
}
