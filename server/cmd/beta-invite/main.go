// beta-invite prepares private files only. It does not contact players, change
// server admission, edit production configuration, or grant game privileges.
package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"eidolon-server/internal/registrationinvites"
)

type record struct {
	Username string `json:"username"`
	ID       string `json:"invitationId"`
	Expires  string `json:"expiresAt"`
	URL      string `json:"url"`
}
type manifest struct {
	Version     int      `json:"version"`
	Cohort      string   `json:"cohort"`
	Invitations []record `json:"invitations"`
}

func writePrivate(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return errors.New("Cannot create private output directory.")
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return errors.New("Output already exists or cannot be created; no existing file was changed.")
	}
	if _, err = f.Write(data); err != nil {
		f.Close()
		return errors.New("Cannot finish private output; preserve the partial file before retrying.")
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return errors.New("Cannot sync private output; preserve it before retrying.")
	}
	return f.Close()
}
func readPrivateKey(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, errors.New("Cannot open signing key.")
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0 {
		return nil, errors.New("Signing key must be a private regular file with mode0600.")
	}
	data, err := io.ReadAll(io.LimitReader(f, 128))
	if err != nil {
		return nil, errors.New("Cannot read signing key.")
	}
	// A terminal newline is normal for the generated key file.
	text := string(data)
	if len(text) > 0 && text[len(text)-1] == '\n' {
		text = text[:len(text)-1]
	}
	key, err := base64.RawURLEncoding.Strict().DecodeString(text)
	if err != nil || base64.RawURLEncoding.EncodeToString(key) != text {
		return nil, errors.New("Invalid signing key file encoding.")
	}
	if _, err = registrationinvites.EncodeKey(key); err != nil {
		return nil, err
	}
	return key, nil
}
func run(args []string, out io.Writer) error {
	flags := flag.NewFlagSet("beta-invite", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	generate := flags.String("generate-key", "", "Create a fresh private signing-key file; never overwrite")
	keyPath := flags.String("key-file", "", "Private signing-key file")
	rosterPath := flags.String("roster", "", "JSON array of 1-100 chosen exact account names")
	cohort := flags.String("cohort", "", "Explicit cohort identifier")
	expiration := flags.String("expires", "", "Explicit expiration, RFC3339 including time zone")
	output := flags.String("output", "", "New private invitation manifest path")
	baseText := flags.String("base-url", "https://play.eidolonrealms.com/", "Frontend URL; invitations use its fragment")
	if err := flags.Parse(args); err != nil {
		return errors.New("Invalid arguments. Use -generate-key PATH alone, or -key-file PATH -roster PATH -cohort ID -expires RFC3339 -output PATH [-base-url URL].")
	}
	if flags.NArg() != 0 {
		return errors.New("Unexpected positional arguments.")
	}
	if *generate != "" {
		if *keyPath != "" || *rosterPath != "" || *cohort != "" || *expiration != "" || *output != "" {
			return errors.New("Generate a key separately from issuing invitations.")
		}
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return errors.New("Cannot generate signing-key entropy.")
		}
		encoded, err := registrationinvites.EncodeKey(key)
		if err != nil {
			return err
		}
		if err = writePrivate(*generate, []byte(encoded+"\n")); err != nil {
			return err
		}
		fmt.Fprintln(out, "Created private signing-key file. No admission configuration was changed.")
		return nil
	}
	if *keyPath == "" || *rosterPath == "" || *cohort == "" || *expiration == "" || *output == "" {
		return errors.New("Key file, roster, cohort, explicit expiration and output are required.")
	}
	key, err := readPrivateKey(*keyPath)
	if err != nil {
		return err
	}
	rosterFile, err := os.Open(*rosterPath)
	if err != nil {
		return errors.New("Cannot open roster.")
	}
	data, readErr := io.ReadAll(io.LimitReader(rosterFile, registrationinvites.MaxRosterJSONBytes+1))
	rosterFile.Close()
	var roster []string
	if readErr != nil || len(data) > registrationinvites.MaxRosterJSONBytes || json.Unmarshal(data, &roster) != nil {
		return errors.New("Roster must be a bounded JSON array.")
	}
	if _, err = registrationinvites.NewPolicy(key, *cohort, roster, nil); err != nil {
		return err
	}
	expires, err := time.Parse(time.RFC3339, *expiration)
	if err != nil {
		return errors.New("Expiration must be explicit RFC3339 with a time zone.")
	}
	base, err := url.Parse(*baseText)
	if err != nil || base.Hostname() == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" {
		return errors.New("Frontend URL must contain no credentials, query or fragment.")
	}
	ip := net.ParseIP(base.Hostname())
	loopback := base.Hostname() == "localhost" || ip != nil && ip.IsLoopback()
	if base.Scheme != "https" && !(base.Scheme == "http" && loopback) {
		return errors.New("Frontend URL requires HTTPS, except explicit loopback QA.")
	}
	result := manifest{Version: 1, Cohort: *cohort}
	now := time.Now()
	for _, name := range roster {
		token, claims, err := registrationinvites.Issue(key, *cohort, name, now, expires)
		if err != nil {
			return err
		}
		link := *base
		link.Fragment = url.Values{"invite": []string{token}}.Encode()
		result.Invitations = append(result.Invitations, record{Username: name, ID: claims.ID, Expires: time.Unix(claims.Expires, 0).UTC().Format(time.RFC3339), URL: link.String()})
	}
	encoded, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return errors.New("Cannot encode invitation manifest.")
	}
	if err = writePrivate(*output, append(encoded, '\n')); err != nil {
		return err
	}
	fmt.Fprintf(out, "Wrote %d invitation links to a new private file. No messages were sent or admission settings changed.\n", len(result.Invitations))
	return nil
}
func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
