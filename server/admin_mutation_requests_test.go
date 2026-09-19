package main

import (
	"encoding/json"
	"strings"
	"testing"
)

const adminGoldRequestFixture = `{"id":"request-123456789","target":"recipient","reason":"Restore verified lost reward","confirmed":true,"amount":100}`

func TestAdminMutationClosedSchema(t *testing.T) {
	for _, test := range []struct{ name, kind, payload string }{
		{"gold", MsgAdminGrantGold, adminGoldRequestFixture},
		{"item", MsgAdminGrantItem, `{"id":"request-123456789","target":"recipient","reason":"Restore gear","confirmed":true,"item":"iron-sword","rarity":"Rare","level":70,"quantity":1}`},
		{"town", MsgAdminTeleport, `{"id":"request-123456789","target":"recipient","reason":"Unstick player","confirmed":true,"destination":"town"}`},
		{"player", MsgAdminTeleport, `{"id":"request-123456789","target":"recipient","reason":"Meet player","confirmed":true,"destination":"player","destinationPlayer":"administrator"}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, err := decodeAdminMutation(Message{Type: test.kind, Payload: json.RawMessage(test.payload)}); err != nil {
				t.Fatal(err)
			}
		})
	}
	for _, test := range []struct{ name, payload string }{
		{"forged actor", strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"actor":"root"`, 1)},
		{"role", strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"role":"admin"`, 1)},
		{"unknown", strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"ep":1`, 1)},
		{"duplicate", strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"amount":200`, 1)},
		{"escaped duplicate", strings.Replace(adminGoldRequestFixture, `"amount":100`, `"amount":100,"\u0061mount":200`, 1)},
		{"wrong case", strings.Replace(adminGoldRequestFixture, `"target"`, `"Target"`, 1)},
		{"unconfirmed", strings.Replace(adminGoldRequestFixture, `true`, `false`, 1)},
		{"coerced confirmation", strings.Replace(adminGoldRequestFixture, `true`, `"true"`, 1)},
		{"null confirmation", strings.Replace(adminGoldRequestFixture, `true`, `null`, 1)},
		{"blank reason", strings.Replace(adminGoldRequestFixture, `Restore verified lost reward`, ` `, 1)},
		{"control target", strings.Replace(adminGoldRequestFixture, `recipient`, `recipient\n`, 1)},
		{"short ID", strings.Replace(adminGoldRequestFixture, `request-123456789`, `short`, 1)},
		{"missing", strings.Replace(adminGoldRequestFixture, `,"amount":100`, ``, 1)},
		{"string amount", strings.Replace(adminGoldRequestFixture, `:100`, `:"100"`, 1)},
		{"null amount", strings.Replace(adminGoldRequestFixture, `:100`, `:null`, 1)},
		{"fraction", strings.Replace(adminGoldRequestFixture, `:100`, `:1.5`, 1)},
		{"exponent", strings.Replace(adminGoldRequestFixture, `:100`, `:1e2`, 1)},
		{"negative", strings.Replace(adminGoldRequestFixture, `:100`, `:-1`, 1)},
		{"zero", strings.Replace(adminGoldRequestFixture, `:100`, `:0`, 1)},
		{"cap", strings.Replace(adminGoldRequestFixture, `:100`, `:100000001`, 1)},
		{"overflow", strings.Replace(adminGoldRequestFixture, `:100`, `:99999999999999999999`, 1)},
		{"nested", strings.Replace(adminGoldRequestFixture, `:100`, `:{"value":100}`, 1)},
		{"array", `[` + adminGoldRequestFixture + `]`},
		{"trailing", adminGoldRequestFixture + `{}`},
		{"invalid utf8", strings.Replace(adminGoldRequestFixture, `recipient`, "bad\xff", 1)},
		{"oversize", strings.Replace(adminGoldRequestFixture, `recipient`, strings.Repeat("a", adminMutationPayloadLimit), 1)},
	} {
		t.Run(test.name, func(t *testing.T) {
			if _, err := decodeAdminMutation(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(test.payload)}); err == nil {
				t.Fatal("unsafe request accepted")
			}
		})
	}
	if _, err := decodeAdminMutation(Message{Type: MsgAdminHistory, Payload: json.RawMessage(adminGoldRequestFixture)}); err == nil {
		t.Fatal("read type accepted as a mutation")
	}
}

func TestAdminTeleportRejectsAmbiguousOrRawDestinations(t *testing.T) {
	base := `{"id":"request-123456789","target":"recipient","reason":"Unstick player","confirmed":true,`
	for _, destination := range []string{
		`"destination":"player"`,
		`"destination":"player","destinationPlayer":"recipient"`,
		`"destination":"town","destinationPlayer":"somebody"`,
		`"destination":"unknown"`,
		`"destination":"town","x":1,"z":2`,
		`"destination":"town","instanceId":"private-raid"`,
	} {
		if _, err := decodeAdminMutation(Message{Type: MsgAdminTeleport, Payload: json.RawMessage(base + destination + `}`)}); err == nil {
			t.Fatalf("ambiguous destination accepted: %s", destination)
		}
	}
}

func TestAdminMutationStableIdentityAndPayloadConflicts(t *testing.T) {
	request, err := decodeAdminMutation(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(adminGoldRequestFixture)})
	if err != nil {
		t.Fatal(err)
	}
	id, hash := request.identities("operator", MsgAdminGrantGold)
	if repeatID, repeatHash := request.identities("operator", MsgAdminGrantGold); id != repeatID || hash != repeatHash {
		t.Fatal("identical replay changed identity")
	}
	if otherID, _ := request.identities("other-operator", MsgAdminGrantGold); id == otherID {
		t.Fatal("different actors shared an operation identity")
	}
	for _, change := range []func(*adminMutationRequest){
		func(r *adminMutationRequest) { r.Amount++ },
		func(r *adminMutationRequest) { r.Target = "other" },
		func(r *adminMutationRequest) { r.Reason = "different reason" },
		func(r *adminMutationRequest) { r.Destination = "town" },
	} {
		changed := request
		change(&changed)
		newID, newHash := changed.identities("operator", MsgAdminGrantGold)
		if newID != id || newHash == hash {
			t.Fatal("different payload escaped same-ID conflict detection")
		}
	}
	if newID, newHash := request.identities("operator", MsgAdminGrantItem); newID != id || newHash == hash {
		t.Fatal("different action escaped same-ID conflict detection")
	}
	// JSON formatting and property order cannot change durable replay identity.
	reordered, err := decodeAdminMutation(Message{Type: MsgAdminGrantGold, Payload: json.RawMessage(`{"amount":100,"confirmed":true,"target":"recipient","reason":"Restore verified lost reward","id":"request-123456789"}`)})
	if err != nil {
		t.Fatal(err)
	}
	if reorderedID, reorderedHash := reordered.identities("operator", MsgAdminGrantGold); reorderedID != id || reorderedHash != hash {
		t.Fatal("JSON property order affected idempotency")
	}
}

func TestAdminGoldBoundaries(t *testing.T) {
	for _, values := range [][2]int{{0, 1}, {1, adminGoldGrantLimit}, {adminGoldBalanceLimit - 1, 1}} {
		if err := validateAdminGoldBalance(values[0], values[1]); err != nil {
			t.Fatal(err)
		}
	}
	for _, values := range [][2]int{{-1, 1}, {0, 0}, {0, -1}, {0, adminGoldGrantLimit + 1}, {adminGoldBalanceLimit, 1}, {int(^uint(0) >> 1), 1}} {
		if err := validateAdminGoldBalance(values[0], values[1]); err == nil {
			t.Fatalf("invalid Gold balance accepted: %v", values)
		}
	}
}
