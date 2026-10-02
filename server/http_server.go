package main

import (
	"log"
	"net/http"
	"time"
)

const (
	httpHeaderWait       = 5 * time.Second
	httpRequestWait      = 10 * time.Second
	httpResponseWait     = 10 * time.Second
	httpIdleWait         = 60 * time.Second
	httpMaxHeaderBytes   = 16 * 1024
	websocketUpgradeWait = 5 * time.Second
)

func newGameHTTPServer(addr string, handler http.Handler, errorLog *log.Logger) *http.Server {
	return &http.Server{
		Addr: addr, Handler: handler, ErrorLog: errorLog,
		ReadHeaderTimeout: httpHeaderWait,
		ReadTimeout:       httpRequestWait,
		WriteTimeout:      httpResponseWait,
		IdleTimeout:       httpIdleWait,
		MaxHeaderBytes:    httpMaxHeaderBytes,
	}
}
