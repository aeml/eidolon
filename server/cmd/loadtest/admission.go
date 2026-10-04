package main

import (
	"encoding/json"
	"errors"
	"time"
)

var errLoadStopped = errors.New("load_stopped")

type admissionReply struct {
	kind, characterType string
}

// Interpret only the game's fixed acknowledgements. Never retain or echo
// arbitrary provider/database/account diagnostics from an error payload.
func decodeAdmissionReply(message Message) (admissionReply, bool) {
	if message.Type == "error" {
		var text string
		if json.Unmarshal(message.Payload, &text) != nil {
			return admissionReply{kind: "invalid_admission_response"}, true
		}
		switch text {
		case "Registration successful! Please login.", "Registration failed: username already exists":
			return admissionReply{kind: "registered"}, true
		case "Account service is busy. Please retry shortly.":
			return admissionReply{kind: "admission_busy"}, true
		default:
			return admissionReply{kind: "admission_rejected"}, true
		}
	}
	if message.Type == "login_success" {
		var payload struct {
			HasCharacter  *bool  `json:"hasCharacter"`
			CharacterType string `json:"characterType"`
		}
		if json.Unmarshal(message.Payload, &payload) != nil || payload.HasCharacter == nil {
			return admissionReply{kind: "invalid_admission_response"}, true
		}
		if *payload.HasCharacter {
			switch payload.CharacterType {
			case "Fighter", "Rogue", "Wizard", "Cleric":
				return admissionReply{kind: "authenticated", characterType: payload.CharacterType}, true
			default:
				return admissionReply{kind: "invalid_admission_response"}, true
			}
		}
		return admissionReply{kind: "authenticated"}, true
	}
	return admissionReply{}, false
}

func waitAdmissionReply(expected string, replies <-chan admissionReply, stop, readerDone <-chan struct{}, timeout time.Duration) (admissionReply, error) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-stop:
		return admissionReply{}, errLoadStopped
	case <-readerDone:
		return admissionReply{}, errors.New("admission_connection_closed")
	case <-timer.C:
		return admissionReply{}, errors.New("admission_timeout")
	case reply := <-replies:
		if reply.kind == expected {
			return reply, nil
		}
		switch reply.kind {
		case "admission_busy", "admission_rejected", "invalid_admission_response":
			return admissionReply{}, errors.New(reply.kind)
		default:
			return admissionReply{}, errors.New("unexpected_admission_response")
		}
	}
}
