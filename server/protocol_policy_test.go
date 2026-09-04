package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestInboundMessagePoliciesCoverDispatcher(t *testing.T) {
	constants := messageConstantValues(t, "protocol_types.go")
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "client_dispatch.go", nil, 0)
	if err != nil {
		t.Fatalf("parse dispatcher: %v", err)
	}

	dispatched := make(map[string]bool)
	ast.Inspect(file, func(node ast.Node) bool {
		fn, ok := node.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "dispatchMessage" {
			return true
		}
		if len(fn.Body.List) != 1 {
			t.Fatalf("dispatchMessage must contain one top-level switch, got %d statements", len(fn.Body.List))
		}
		dispatchSwitch, ok := fn.Body.List[0].(*ast.SwitchStmt)
		if !ok {
			t.Fatalf("dispatchMessage top-level statement is %T, want switch", fn.Body.List[0])
		}
		for _, statement := range dispatchSwitch.Body.List {
			clause, ok := statement.(*ast.CaseClause)
			if !ok {
				t.Fatalf("dispatcher statement is %T, want case clause", statement)
			}
			for _, expr := range clause.List {
				ident, ok := expr.(*ast.Ident)
				if !ok {
					t.Fatalf("dispatcher case is not a message constant: %T", expr)
				}
				value, ok := constants[ident.Name]
				if !ok {
					t.Fatalf("dispatcher constant %s has no string value", ident.Name)
				}
				dispatched[value] = true
				if _, ok := inboundMessagePolicies[value]; !ok {
					t.Errorf("dispatcher message %s (%q) has no inbound policy", ident.Name, value)
				}
			}
		}
		return false
	})

	if len(dispatched) == 0 {
		t.Fatal("no dispatch cases found")
	}
	for messageType := range inboundMessagePolicies {
		if !dispatched[messageType] {
			t.Errorf("inbound policy %q has no dispatcher case", messageType)
		}
	}
}

func messageConstantValues(t *testing.T, filename string) map[string]string {
	t.Helper()
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, filename, nil, 0)
	if err != nil {
		t.Fatalf("parse message constants: %v", err)
	}
	values := make(map[string]string)
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.CONST {
			continue
		}
		for _, spec := range gen.Specs {
			valueSpec, ok := spec.(*ast.ValueSpec)
			if !ok || len(valueSpec.Names) != 1 || len(valueSpec.Values) != 1 {
				continue
			}
			literal, ok := valueSpec.Values[0].(*ast.BasicLit)
			if !ok || literal.Kind != token.STRING {
				continue
			}
			value, err := strconv.Unquote(literal.Value)
			if err != nil {
				t.Fatalf("unquote %s: %v", valueSpec.Names[0].Name, err)
			}
			values[valueSpec.Names[0].Name] = value
		}
	}
	return values
}

func TestInboundMessagePolicyRequiresSessionState(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	guest := &Client{}
	if err := guest.acceptInboundMessage(Message{Type: MsgJoin}, now); err == nil || !strings.Contains(err.Error(), "authentication") {
		t.Fatalf("guest join error = %v, want authentication failure", err)
	}

	authenticated := &Client{username: "player"}
	if err := authenticated.acceptInboundMessage(Message{Type: MsgJoin}, now); err != nil {
		t.Fatalf("authenticated join rejected: %v", err)
	}
	if err := authenticated.acceptInboundMessage(Message{Type: MsgMove}, now); err == nil || !strings.Contains(err.Error(), "character") {
		t.Fatalf("pre-character move error = %v, want character failure", err)
	}

	joined := &Client{username: "player", playerID: "player-player"}
	if err := joined.acceptInboundMessage(Message{Type: MsgMove}, now); err != nil {
		t.Fatalf("joined move rejected: %v", err)
	}
}

func TestRegisteredMessageHandlersHaveAdmissionPolicies(t *testing.T) {
	if len(messageHandlers) < 40 {
		t.Fatalf("message handler registry unexpectedly small: %d", len(messageHandlers))
	}
	for messageType, handler := range messageHandlers {
		if handler == nil {
			t.Errorf("message %q has a nil handler", messageType)
		}
		if _, ok := inboundMessagePolicies[messageType]; !ok {
			t.Errorf("registered message %q has no admission policy", messageType)
		}
	}
}

func TestInboundMessagePolicyRejectsUnknownAndOversizedPayloads(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	client := &Client{username: "player", playerID: "player-player"}
	if err := client.acceptInboundMessage(Message{Type: "invented_message"}, now); err == nil || !strings.Contains(err.Error(), "unsupported") {
		t.Fatalf("unknown message error = %v", err)
	}

	tooLarge := make([]byte, inboundMessagePolicies[MsgChat].maxPayloadBytes+1)
	if err := client.acceptInboundMessage(Message{Type: MsgChat, Payload: tooLarge}, now); err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("oversized message error = %v", err)
	}
}

func TestInboundMessageRateLimitRefillsDeterministically(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	client := &Client{username: "player", playerID: "player-player"}
	message := Message{Type: MsgReport}

	for i := 0; i < 2; i++ {
		if err := client.acceptInboundMessage(message, now); err != nil {
			t.Fatalf("initial report %d rejected: %v", i+1, err)
		}
	}
	if err := client.acceptInboundMessage(message, now); err == nil || !strings.Contains(err.Error(), "rate limit") {
		t.Fatalf("third report error = %v, want rate limit", err)
	}
	if err := client.acceptInboundMessage(message, now.Add(30*time.Second)); err != nil {
		t.Fatalf("report was not admitted after one-token refill: %v", err)
	}
}
