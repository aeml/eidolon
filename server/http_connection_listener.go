package main

import (
	"fmt"
	"net"
	"sync"
)

const defaultHTTPConnections = 1024
const maxHTTPConnections = 8192

// Reserve capacity before Accept, not after net/http creates a connection
// goroutine. Saturation leaves pending connections in the kernel backlog.
// Hijacked sockets retain their reservation until the transport itself closes.
type boundedHTTPListener struct {
	net.Listener
	slots     chan struct{}
	closed    chan struct{}
	closeOnce sync.Once
	closeErr  error
}

func newBoundedHTTPListener(listener net.Listener, limit int) (*boundedHTTPListener, error) {
	if limit < 1 || limit > maxHTTPConnections {
		return nil, fmt.Errorf("HTTP connection limit must be between 1 and %d", maxHTTPConnections)
	}
	return &boundedHTTPListener{Listener: listener, slots: make(chan struct{}, limit), closed: make(chan struct{})}, nil
}

func (l *boundedHTTPListener) Accept() (net.Conn, error) {
	select {
	case l.slots <- struct{}{}:
	case <-l.closed:
		return nil, net.ErrClosed
	}
	conn, err := l.Listener.Accept()
	if err != nil {
		<-l.slots
		return nil, err
	}
	select {
	case <-l.closed:
		conn.Close()
		<-l.slots
		return nil, net.ErrClosed
	default:
	}
	return &admittedHTTPConnection{Conn: conn, release: func() { <-l.slots }}, nil
}

func (l *boundedHTTPListener) Close() error {
	l.closeOnce.Do(func() {
		close(l.closed)
		l.closeErr = l.Listener.Close()
	})
	return l.closeErr
}

type admittedHTTPConnection struct {
	net.Conn
	release   func()
	closeOnce sync.Once
	closeErr  error
}

func (c *admittedHTTPConnection) Close() error {
	c.closeOnce.Do(func() {
		c.closeErr = c.Conn.Close()
		c.release()
	})
	return c.closeErr
}
