package main

import (
	"errors"
	"io"
	"net"

	"github.com/gorilla/websocket"
)

// Reader-owned closed categories only. Never retain the remote close reason,
// account, address or arbitrary transport error text in the final observation.
type readFailureStage uint8

const (
	readFailureNone readFailureStage = iota
	readFailureUnknown
	readFailureTimeout
	readFailurePolicy
	readFailureAbnormal
	readFailureGoingAway
	readFailureNormal
	readFailureProtocol
	readFailureTooBig
	readFailureServer
	readFailureEOF
	readFailureKinds
)

func classifyReadFailure(err error) readFailureStage {
	var closed *websocket.CloseError
	if errors.As(err, &closed) {
		switch closed.Code {
		case websocket.ClosePolicyViolation:
			return readFailurePolicy
		case websocket.CloseAbnormalClosure:
			return readFailureAbnormal
		case websocket.CloseGoingAway:
			return readFailureGoingAway
		case websocket.CloseNormalClosure:
			return readFailureNormal
		case websocket.CloseProtocolError, websocket.CloseUnsupportedData:
			return readFailureProtocol
		case websocket.CloseMessageTooBig:
			return readFailureTooBig
		case websocket.CloseInternalServerErr:
			return readFailureServer
		default:
			return readFailureUnknown
		}
	}
	var transport net.Error
	if errors.As(err, &transport) && transport.Timeout() {
		return readFailureTimeout
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return readFailureEOF
	}
	return readFailureUnknown
}

func summarizeReadFailures(observations []loadObservation) [readFailureKinds]uint64 {
	var result [readFailureKinds]uint64
	for _, observation := range observations {
		stage := observation.readFailure
		if stage == readFailureNone {
			continue
		}
		if stage >= readFailureKinds {
			stage = readFailureUnknown
		}
		result[stage]++
	}
	return result
}
