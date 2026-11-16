// Command eidolon runs the game API and WebSocket server.
package main

import "eidolon-server/internal/server"

// Linker-injected identity stays on main so existing release flags retain their API.
var (
	buildCommit  = "development"
	buildVersion = "Alpha 1.80.5"
)

func main() {
	server.Run(buildCommit, buildVersion)
}
