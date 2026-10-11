package main

import (
	"errors"
	"io"
	"net"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

type transportCloseReason uint32

const (
	transportCloseNone transportCloseReason = iota
	transportPeerNormal
	transportPeerGoingAway
	transportPeerAbnormal
	transportPeerPolicy
	transportPeerProtocol
	transportPeerServer
	transportReadTimeout
	transportReadNetwork
	transportReadOther
	transportWriteTimeout
	transportWriteNetwork
	transportWriteOther
	transportPriorityOverflow
	transportInboundLimit
	transportAccessDenied
	transportHubShutdown
	transportSessionReplaced
	transportAccountRecovery
	transportAdminStorage
	transportAdminAdmission
	transportQADisconnect
	transportQueuesClosed
	transportCloseReasonCount
)

var transportCloseNames = [...]string{
	"none", "peerNormal", "peerGoingAway", "peerAbnormal", "peerPolicy", "peerProtocol", "peerServer",
	"readTimeout", "readNetwork", "readOther", "writeTimeout", "writeNetwork", "writeOther",
	"priorityOverflow", "inboundLimit", "accessDenied", "hubShutdown", "sessionReplaced", "accountRecovery",
	"adminStorage", "adminAdmission", "qaDisconnect", "queuesClosed",
}

var transportCloseCounts [transportCloseReasonCount]atomic.Uint64

// First observed cause only: writer/reader/hub cleanup often see the same loss.
// No account, address, peer text, error string or per-connection history is kept.
// This does not close a socket or change its resume timestamp/admission policy.
func (c *Client) recordTransportClosure(reason transportCloseReason) {
	if c == nil || c.conn == nil || reason <= transportCloseNone || reason >= transportCloseReasonCount {
		return
	}
	if c.transportCloseReason.CompareAndSwap(0, uint32(reason)) {
		transportCloseCounts[reason].Add(1)
	}
}

func transportClosureMetrics() map[string]uint64 {
	result := make(map[string]uint64, int(transportCloseReasonCount)-1)
	for reason := transportCloseNone + 1; reason < transportCloseReasonCount; reason++ {
		result[transportCloseNames[reason]] = transportCloseCounts[reason].Load()
	}
	return result
}

func transportReadFailure(err error) transportCloseReason {
	if err == nil {
		return transportCloseNone
	}
	if errors.Is(err, errInboundFrameLimit) || errors.Is(err, websocket.ErrReadLimit) {
		return transportInboundLimit
	}
	var closed *websocket.CloseError
	if errors.As(err, &closed) {
		switch closed.Code {
		case websocket.CloseNormalClosure:
			return transportPeerNormal
		case websocket.CloseGoingAway:
			return transportPeerGoingAway
		case websocket.CloseAbnormalClosure:
			return transportPeerAbnormal
		case websocket.ClosePolicyViolation:
			return transportPeerPolicy
		case websocket.CloseProtocolError, websocket.CloseUnsupportedData, websocket.CloseInvalidFramePayloadData, websocket.CloseMessageTooBig, websocket.CloseMandatoryExtension:
			return transportPeerProtocol
		case websocket.CloseInternalServerErr:
			return transportPeerServer
		}
	}
	var network net.Error
	if errors.As(err, &network) {
		if network.Timeout() {
			return transportReadTimeout
		}
		return transportReadNetwork
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return transportPeerAbnormal
	}
	return transportReadOther
}

func transportWriteFailure(err error) transportCloseReason {
	if err == nil {
		return transportCloseNone
	}
	var network net.Error
	if errors.As(err, &network) {
		if network.Timeout() {
			return transportWriteTimeout
		}
		return transportWriteNetwork
	}
	return transportWriteOther
}
