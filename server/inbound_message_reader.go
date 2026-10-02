package main

import (
	"io"
	"time"

	"github.com/gorilla/websocket"
)

const inboundMessageAssemblyWait = 10 * time.Second

// Single-read-pump owned. Keepalives can renew idle liveness, but must not
// extend assembly of an already-started, possibly fragmented data message.
type inboundMessageReader struct {
	conn             *websocket.Conn
	clock            func() time.Time
	idleWait         time.Duration
	assemblyWait     time.Duration
	idleDeadline     time.Time
	assemblyDeadline time.Time
}

func newInboundMessageReader(conn *websocket.Conn, clock func() time.Time, idleWait, assemblyWait time.Duration) *inboundMessageReader {
	r := &inboundMessageReader{conn: conn, clock: clock, idleWait: idleWait,
		assemblyWait: assemblyWait, idleDeadline: clock().Add(idleWait)}
	conn.SetReadLimit(maxMessageSize)
	conn.SetPongHandler(func(string) error {
		r.idleDeadline = r.clock().Add(r.idleWait)
		return conn.SetReadDeadline(r.deadline())
	})
	return r
}

func (r *inboundMessageReader) deadline() time.Time {
	if !r.assemblyDeadline.IsZero() && r.assemblyDeadline.Before(r.idleDeadline) {
		return r.assemblyDeadline
	}
	return r.idleDeadline
}

func (r *inboundMessageReader) readMessage() (int, []byte, error) {
	if err := r.conn.SetReadDeadline(r.deadline()); err != nil {
		return 0, nil, err
	}
	kind, reader, err := r.conn.NextReader()
	if err != nil {
		return 0, nil, err
	}
	r.assemblyDeadline = r.clock().Add(r.assemblyWait)
	if err := r.conn.SetReadDeadline(r.deadline()); err != nil {
		return 0, nil, err
	}
	message, err := io.ReadAll(reader)
	if err != nil {
		return 0, nil, err
	}
	// Restore idle liveness, not a fresh idle window for each data message.
	// Existing policy renews that window only after an admitted Pong.
	r.assemblyDeadline = time.Time{}
	if err := r.conn.SetReadDeadline(r.deadline()); err != nil {
		return 0, nil, err
	}
	return kind, message, nil
}
