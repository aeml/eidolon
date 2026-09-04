package main

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestDecodeInboundMessageRejectsMalformedFrames(t *testing.T) {
	tests := [][]byte{
		nil,
		[]byte("{"),
		[]byte(`{}`),
		[]byte(`{"type":"move","payload":`),
		bytes.Repeat([]byte("x"), maxMessageSize+1),
	}
	for _, frame := range tests {
		if _, err := decodeInboundMessage(frame); err == nil {
			t.Fatalf("expected malformed frame to fail: %q", frame)
		}
	}

	message, err := decodeInboundMessage([]byte(`{"type":"move","payload":{"x":1}}`))
	if err != nil || message.Type != MsgMove || !json.Valid(message.Payload) {
		t.Fatalf("valid frame failed: message=%+v err=%v", message, err)
	}
}

func FuzzDecodeInboundMessage(f *testing.F) {
	f.Add([]byte(`{"type":"move","payload":{"x":1,"z":2}}`))
	f.Add([]byte(`{"type":"chat","payload":{"message":"hello"}}`))
	f.Add([]byte{0xff, 0x00, '{', '}'})
	f.Fuzz(func(t *testing.T, frame []byte) {
		message, err := decodeInboundMessage(frame)
		if err != nil {
			return
		}
		if message.Type == "" || (len(message.Payload) > 0 && !json.Valid(message.Payload)) {
			t.Fatalf("decoder accepted invalid message: %+v", message)
		}
	})
}

func TestSendSafeDoesNotBlockOnSaturatedPriorityQueue(t *testing.T) {
	client := &Client{send: make(chan []byte, 1), prioritySend: make(chan []byte, 1)}
	if !client.sendSafe([]byte("first")) {
		t.Fatal("first control frame should enqueue")
	}
	if client.sendSafe([]byte("overflow")) {
		t.Fatal("saturated control frame should fail closed")
	}
	if len(client.prioritySend) != 1 || len(client.send) != 0 {
		t.Fatalf("unexpected queue state: priority=%d state=%d", len(client.prioritySend), len(client.send))
	}
}

func TestSendSafeFallsBackToBoundedStateQueue(t *testing.T) {
	client := &Client{send: make(chan []byte, 1)}
	if !client.sendSafe([]byte("state")) || client.sendSafe([]byte("overflow")) {
		t.Fatal("fallback queue did not enforce its bounded capacity")
	}
}
