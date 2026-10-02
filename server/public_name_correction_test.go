package main

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"eidolon-server/internal/database"
)

const validPublicNamePayload = `{"id":"name-correction-0001","noticeId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","publicName":"Arcanis Dawn","confirmed":true}`

type fakePublicNameCorrections struct {
	owner   string
	calls   int
	request database.PublicNameCorrectionRequest
	err     error
	after   func()
}

func (s *fakePublicNameCorrections) CorrectPublicName(owner string, request database.PublicNameCorrectionRequest) (database.ChatModerationReceipt, error) {
	s.owner, s.request = owner, request
	s.calls++
	if s.after != nil {
		s.after()
	}
	return database.ChatModerationReceipt{}, s.err
}

func TestPublicNameCorrectionClosedSchemaAndAuthenticatedAdmission(t *testing.T) {
	if request, err := decodePublicNameCorrection([]byte(validPublicNamePayload)); err != nil || request.PublicName != "Arcanis Dawn" {
		t.Fatal(request, err)
	}
	for _, payload := range []string{`null`, `[]`, `{}`, validPublicNamePayload + `{}`, strings.Repeat(" ", 1025), string([]byte{255}),
		strings.Replace(validPublicNamePayload, `"confirmed":true`, `"confirmed":false`, 1),
		strings.Replace(validPublicNamePayload, `"confirmed":true`, `"confirmed":true,"confirmed":true`, 1),
		strings.Replace(validPublicNamePayload, `"confirmed":true`, `"confirmed":true,"account":"other"`, 1),
		strings.Replace(validPublicNamePayload, `"publicName":"Arcanis Dawn"`, `"publicName":{}`, 1),
		strings.Replace(validPublicNamePayload, `"publicName":"Arcanis Dawn"`, `"publicName":" Arcanis"`, 1)} {
		if _, err := decodePublicNameCorrection([]byte(payload)); err == nil {
			t.Fatal("invalid payload admitted", payload)
		}
	}
	p := inboundMessagePolicies[MsgPublicNameCorrection]
	if p.access != accessAuthenticated || p.maxPayloadBytes != 1024 || p.burst != 3 || p.window != time.Minute || messageHandlers[MsgPublicNameCorrection] == nil {
		t.Fatal(p)
	}
	anonymous := &Client{}
	if anonymous.acceptInboundMessage(Message{Type: MsgPublicNameCorrection, Payload: []byte(validPublicNamePayload)}, time.Now()) == nil {
		t.Fatal("anonymous correction admitted")
	}
}

func TestPublicNameCorrectionOwnerOnlyPersistBeforeAcknowledgement(t *testing.T) {
	previous := publicNameCorrections
	t.Cleanup(func() { publicNameCorrections = previous })
	c, _ := adminReadFixture(t)
	c.playerID = ""
	store := &fakePublicNameCorrections{}
	publicNameCorrections = store
	exchange := func() map[string]any {
		t.Helper()
		handlePublicNameCorrection(c, Message{Type: MsgPublicNameCorrection, Payload: []byte(validPublicNamePayload)})
		messages := drainSentMessages(c.send)
		if len(messages) != 1 || messages[0].Type != MsgPublicNameCorrection+"_result" {
			t.Fatal(messages)
		}
		var result map[string]any
		if err := json.Unmarshal(messages[0].Payload, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	result := exchange()
	if result["success"] != true || result["final"] != true || store.owner != c.username || store.calls != 1 || store.request.ID != "name-correction-0001" {
		t.Fatal(result, store)
	}
	store.err = errors.New("private mongo diagnostic")
	result = exchange()
	if result["success"] != false || result["pending"] != true || result["final"] != false || strings.Contains(result["message"].(string), "private") {
		t.Fatal(result)
	}
	for _, err := range []error{database.ErrPublicNameUnavailable, database.ErrChatModerationConflict} {
		store.err = err
		result = exchange()
		if result["success"] != false || result["final"] != true || result["pending"] != false {
			t.Fatal(result)
		}
	}
	store.err = nil
	store.after = func() { c.username = "replacement" }
	if exchange()["success"] != false {
		t.Fatal("changed owner received acknowledgement")
	}
	before := store.calls
	store.after = nil
	c.retired.Store(true)
	if exchange()["success"] != false || store.calls != before {
		t.Fatal("retired session wrote")
	}
}
