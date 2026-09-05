package main

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 8192 // Increased for larger payloads

	// How long a disconnected player entity lingers in the world for session resume.
	resumeWindow = 5 * time.Minute
)

var addr = flag.String("addr", ":8080", "http service address")
var mongoURI = flag.String("mongo-uri", "mongodb://localhost:27017", "MongoDB connection URI")
var certFile = flag.String("cert", "", "Path to SSL certificate file")
var keyFile = flag.String("key", "", "Path to SSL key file")

var logFilePath = flag.String("log-file", "server.log", "Path to server log file (empty disables file logging)")
var logStdout = flag.Bool("log-stdout", true, "Also write logs to stdout")
var logHTTPErrors = flag.Bool("log-http-errors", false, "Log noisy HTTP/TLS handshake errors (can be very noisy on public servers)")
var suspiciousStdout = flag.Bool("suspicious-stdout", true, "Print suspicious/non-client connections to stdout")
var suspiciousCooldown = flag.Duration("suspicious-cooldown", 30*time.Second, "Minimum time between suspicious logs per IP")
var suspiciousLogFilePath = flag.String("suspicious-log-file", "logs/junk.log", "Path to log suspicious/non-client connections (empty disables file logging)")
var economyMetricsFilePath = flag.String("economy-metrics-file", "logs/economy_metrics.jsonl", "Hourly gold source/sink metrics path (empty disables)")
var qaUsernamesFlag = flag.String("qa-usernames", os.Getenv("EIDOLON_QA_USERNAMES"), "Comma-separated usernames allowed to use QA-only commands")

var (
	buildCommit  = "development"
	buildVersion = "Alpha 1.0.6"
	qaUsernames  = map[string]struct{}{}
)

var stateProtoMagic = []byte{'E', 'D', 'P', 'B'}

const stateProtoWireVersion byte = 2

var allowedWebsocketOriginHosts = map[string]struct{}{
	"localhost":            {},
	"127.0.0.1":            {},
	"eidolon.mendola.tech": {},
	"eserver.mendola.tech": {},
}

func isAllowedWebsocketOrigin(origin string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	hostname := strings.ToLower(strings.TrimSpace(parsed.Hostname()))
	if hostname == "" {
		return false
	}
	_, ok := allowedWebsocketOriginHosts[hostname]
	return ok
}

func parseQAUsernames(raw string) map[string]struct{} {
	parsed := make(map[string]struct{})
	for _, username := range strings.Split(raw, ",") {
		username = strings.ToLower(strings.TrimSpace(username))
		if username != "" {
			parsed[username] = struct{}{}
		}
	}
	return parsed
}

func isQAUsername(username string) bool {
	_, ok := qaUsernames[strings.ToLower(strings.TrimSpace(username))]
	return ok
}

type healthResponse struct {
	Status         string `json:"status"`
	Database       string `json:"database"`
	Commit         string `json:"commit"`
	Version        string `json:"version"`
	Goroutines     int    `json:"goroutines"`
	HeapAllocBytes uint64 `json:"heapAllocBytes"`
	HeapObjects    uint64 `json:"heapObjects"`
}

func healthHandler(pingDatabase func(context.Context) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var memory runtime.MemStats
		runtime.ReadMemStats(&memory)
		response := healthResponse{
			Status:     "ok",
			Database:   "ready",
			Commit:     buildCommit,
			Version:    buildVersion,
			Goroutines: runtime.NumGoroutine(), HeapAllocBytes: memory.HeapAlloc,
			HeapObjects: memory.HeapObjects,
		}
		statusCode := http.StatusOK
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if pingDatabase == nil || pingDatabase(ctx) != nil {
			response.Status = "unavailable"
			response.Database = "unavailable"
			statusCode = http.StatusServiceUnavailable
		}

		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(statusCode)
		if r.Method == http.MethodHead {
			return
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Printf("health response write failed: %v", err)
		}
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return isAllowedWebsocketOrigin(r.Header.Get("Origin"))
	},
	// EnableCompression: true, // Disabled, using manual GZIP
}

// Global instances
var (
	db    *database.DB
	world *game.World
)

var clients = make(map[*Client]bool)
var activeSessions = make(map[string]*Client)
var sessionsMu sync.Mutex
var broadcast = make(chan BroadcastMessage)
var register = make(chan *Client)
var unregister = make(chan *Client)

// Session-resume token store (in-memory; one token per username).
type resumeTokenEntry struct {
	username  string
	expiresAt time.Time
}

var (
	resumeTokens   = make(map[string]*resumeTokenEntry) // token → entry
	resumeByUser   = make(map[string]string)            // username → token
	resumeTokensMu sync.Mutex
)

var httpErrLogger *log.Logger
var suspiciousStdoutLogger *log.Logger
var suspiciousFileLogger *log.Logger
var suspiciousLogThrottle = newIPThrottle()

type ipThrottle struct {
	mu   sync.Mutex
	last map[string]time.Time
}

func newIPThrottle() *ipThrottle {
	return &ipThrottle{last: make(map[string]time.Time)}
}

func (t *ipThrottle) allow(ip string, cooldown time.Duration) bool {
	if cooldown <= 0 {
		return true
	}
	now := time.Now()
	t.mu.Lock()
	defer t.mu.Unlock()
	if last, ok := t.last[ip]; ok && now.Sub(last) < cooldown {
		return false
	}
	t.last[ip] = now
	return true
}

func requestIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return strings.TrimSpace(xr)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

// generateResumeToken returns a cryptographically random 32-byte hex token.
func generateResumeToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := crand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// issueResumeToken creates (or replaces) a session-resume token for username.
// The previous token for this user, if any, is revoked.
func issueResumeToken(username string) (string, error) {
	token, err := generateResumeToken()
	if err != nil {
		return "", err
	}
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	// Revoke old token
	if old, ok := resumeByUser[username]; ok {
		delete(resumeTokens, old)
	}
	entry := &resumeTokenEntry{
		username:  username,
		expiresAt: time.Now().Add(resumeWindow),
	}
	resumeTokens[token] = entry
	resumeByUser[username] = token
	return token, nil
}

// validateAndConsumeResumeToken validates the token and, if valid, removes it
// and returns the associated username. Returns ("", false) on any failure.
func validateAndConsumeResumeToken(token string) (string, bool) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	entry, ok := resumeTokens[token]
	if !ok {
		return "", false
	}
	if time.Now().After(entry.expiresAt) {
		delete(resumeTokens, token)
		delete(resumeByUser, entry.username)
		return "", false
	}
	username := entry.username
	delete(resumeTokens, token)
	delete(resumeByUser, username)
	return username, true
}

func logSuspicious(r *http.Request, reason string, err error) {
	ip := requestIP(r)
	ua := r.UserAgent()
	// Always write suspicious traffic to the dedicated junk log (if configured).
	if suspiciousFileLogger != nil {
		if err != nil {
			suspiciousFileLogger.Printf("%s %s %s reason=%q ua=%q err=%v", ip, r.Method, r.URL.Path, reason, ua, err)
		} else {
			suspiciousFileLogger.Printf("%s %s %s reason=%q ua=%q", ip, r.Method, r.URL.Path, reason, ua)
		}
	}

	// Optionally print suspicious traffic to stdout, throttle-controlled.
	if suspiciousStdoutLogger != nil && *suspiciousStdout && suspiciousLogThrottle.allow(ip, *suspiciousCooldown) {
		if err != nil {
			suspiciousStdoutLogger.Printf("%s %s %s reason=%q ua=%q err=%v", ip, r.Method, r.URL.Path, reason, ua, err)
		} else {
			suspiciousStdoutLogger.Printf("%s %s %s reason=%q ua=%q", ip, r.Method, r.URL.Path, reason, ua)
		}
	}
}

func setupLogging() ([]io.Closer, error) {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Suspicious loggers: file is always-on (if configured); stdout is optional + throttle-controlled.
	suspiciousStdoutLogger = log.New(os.Stdout, "SUSPICIOUS ", log.LstdFlags)
	var closers []io.Closer
	if *suspiciousLogFilePath != "" {
		dir := filepath.Dir(*suspiciousLogFilePath)
		if dir != "." {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, err
			}
		}
		f, err := os.OpenFile(*suspiciousLogFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, err
		}
		closers = append(closers, f)
		suspiciousFileLogger = log.New(f, "SUSPICIOUS ", log.LstdFlags)
	}

	var file *os.File
	var fileWriter io.Writer = io.Discard
	if *logFilePath != "" {
		// Ensure directory exists
		dir := filepath.Dir(*logFilePath)
		if dir != "." {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, err
			}
		}
		f, err := os.OpenFile(*logFilePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return nil, err
		}
		file = f
		closers = append(closers, f)
		fileWriter = f
	}

	var writers []io.Writer
	if *logStdout {
		writers = append(writers, os.Stdout)
	}
	if fileWriter != io.Discard {
		writers = append(writers, fileWriter)
	}
	if len(writers) == 0 {
		log.SetOutput(io.Discard)
	} else if len(writers) == 1 {
		log.SetOutput(writers[0])
	} else {
		log.SetOutput(io.MultiWriter(writers...))
	}

	if *logHTTPErrors {
		httpErrLogger = log.New(fileWriter, "http: ", log.LstdFlags)
	} else {
		httpErrLogger = log.New(io.Discard, "http: ", log.LstdFlags)
	}

	_ = file
	return closers, nil
}

func main() {
	flag.Parse()
	qaUsernames = parseQAUsernames(*qaUsernamesFlag)
	closers, err := setupLogging()
	if err != nil {
		// Logging isn't ready; fall back to stderr.
		fmt.Fprintf(os.Stderr, "failed to set up logging: %v\n", err)
		os.Exit(1)
	}
	for i := len(closers) - 1; i >= 0; i-- {
		defer closers[i].Close()
	}

	db, err = database.New(*mongoURI)
	if err != nil {
		log.Fatal(err)
	}

	// Seed the random number generator
	rand.Seed(time.Now().UnixNano())

	world = game.NewWorld(db)
	startEconomyMetrics(world, *economyMetricsFilePath)

	// Sweep goroutine: remove disconnected player entities whose resume window
	// has expired. Runs every 30 seconds.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			expired := world.CollectExpiredDisconnectedPlayers(resumeWindow)
			for _, e := range expired {
				log.Printf("Session resume window expired for player %s (%s); entity removed", e.Name, e.ID)
				// Clean up party membership now that the entity is gone (0.37.1).
				if e.PartyID != "" {
					world.RemoveExpiredMemberFromParty(e.ID, e.PartyID)
				}
			}
		}
	}()

	// Set up World Event Callback
	world.OnEvent = func(eventType string, data interface{}) {
		switch eventType {
		case "chronicle_advance":
			evt, ok := data.(game.ChronicleAdvanceEvent)
			if !ok {
				return
			}
			payload, _ := json.Marshal(evt)
			message := createMessage("chronicle_advance", payload)
			go func() {
				client := getClientByPlayerID(evt.PlayerID)
				if client == nil {
					return
				}
				client.sendSafe(message)
				savePlayer(client)
			}()
		case "raid_phase":
			evt, ok := data.(game.RaidPhaseEvent)
			if !ok {
				return
			}
			payload, _ := json.Marshal(evt)
			message := createMessage("raid_phase", payload)
			go func() {
				broadcast <- BroadcastMessage{Type: "raid_phase", Data: message, InstanceID: evt.InstanceID}
			}()
		case "crystal_repair":
			evt, ok := data.(game.CrystalRepairEvent)
			if !ok {
				return
			}
			payload, _ := json.Marshal(evt)
			message := createMessage("crystal_repair", payload)
			go func() {
				broadcast <- BroadcastMessage{Type: "crystal_repair", Data: message, InstanceID: evt.InstanceID}
			}()
		case "elite_spawn":
			msgText, ok := data.(string)
			if !ok {
				return
			}
			// Broadcast chat message
			outPayload := ChatPayload{
				Message: msgText,
				Sender:  "System",
				Channel: "server",
			}
			b, _ := json.Marshal(outPayload)
			outMsg := Message{
				Type:    MsgChat,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			// Send in goroutine to avoid deadlock if hub is busy
			go func() {
				broadcast <- BroadcastMessage{Type: MsgChat, Data: dataBytes}
			}()
		case "ability":
			evt, ok := data.(game.AbilityEvent)
			if !ok {
				return
			}
			payload := AbilityPayload{
				TargetX:   evt.TargetX,
				TargetZ:   evt.TargetZ,
				TargetID:  evt.TargetID,
				SkillName: evt.SkillName,
				SourceID:  evt.SourceID,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgAbility,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgAbility, Data: dataBytes}
			}()
		case "attack":
			evt, ok := data.(game.AttackEvent)
			if !ok {
				return
			}
			payload := AttackEventPayload{
				SourceID: evt.SourceID,
				TargetID: evt.TargetID,
				TargetX:  evt.TargetX,
				TargetZ:  evt.TargetZ,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgAttack,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgAttack, Data: dataBytes}
			}()
		case "inventory_update":
			playerID, ok := data.(string)
			if !ok {
				return
			}
			log.Printf("Handling inventory_update event for player: %s", playerID)

			// Extract username from playerID (player-username)
			username := playerID
			if strings.HasPrefix(playerID, "player-") {
				username = strings.TrimPrefix(playerID, "player-")
			}

			sessionsMu.Lock()
			client, exists := activeSessions[username]
			sessionsMu.Unlock()

			if exists {
				player := world.GetEntity(playerID)
				if player != nil {
					player.Mu.RLock()
					// Copy inventory to avoid race conditions during marshal
					inv := make([]game.Item, len(player.Inventory))
					copy(inv, player.Inventory)
					player.Mu.RUnlock()

					b, err := json.Marshal(inv)
					if err != nil {
						log.Printf("Error marshaling inventory for %s: %v", playerID, err)
						return
					}

					outMsg := Message{
						Type:    MsgInventory,
						Payload: b,
					}
					dataBytes, _ := json.Marshal(outMsg)
					client.sendSafe(dataBytes)
					log.Printf("Sent inventory update to client %s. Payload size: %d bytes", playerID, len(dataBytes))
				} else {
					log.Printf("Player entity %s not found during inventory update", playerID)
				}
			} else {
				log.Printf("No active session found for player %s during inventory update", playerID)
			}
		case "damage":
			evt, ok := data.(game.DamageEvent)
			if !ok {
				return
			}

			payload := DamagePayload{
				TargetID: evt.TargetID, Amount: evt.Amount, SourceID: evt.SourceID,
				Kind: evt.Kind, InstanceID: evt.InstanceID,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgDamage,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			go func() {
				broadcast <- BroadcastMessage{Type: MsgDamage, Data: dataBytes, InstanceID: evt.InstanceID}
			}()
		case "projectile_impact":
			evt, ok := data.(game.ProjectileImpactEvent)
			if !ok {
				return
			}
			payload := ProjectileImpactPayload{
				ProjectileID: evt.ProjectileID, ProjectileType: evt.ProjectileType,
				SourceID: evt.SourceID, TargetID: evt.TargetID, InstanceID: evt.InstanceID,
				SkillName: evt.SkillName, X: evt.X, Y: evt.Y, Z: evt.Z,
				DirectionX: evt.DirectionX, DirectionZ: evt.DirectionZ,
				Radius: evt.Radius, Terminal: evt.Terminal,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{Type: MsgProjectileImpact, Payload: b}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgProjectileImpact, Data: dataBytes, InstanceID: evt.InstanceID}
			}()
		case "heal":
			evt, ok := data.(game.HealEvent)
			if !ok {
				return
			}
			payload := DamagePayload{
				TargetID: evt.TargetID, Amount: evt.Amount, SourceID: evt.SourceID,
				Kind: evt.Kind, InstanceID: evt.InstanceID,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{Type: MsgHeal, Payload: b}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgHeal, Data: dataBytes, InstanceID: evt.InstanceID}
			}()
		case "hazard_damage":
			evt, ok := data.(game.HazardDamageEvent)
			if !ok {
				return
			}
			// Send hazard damage as a damage event so client shows floating text
			payload := DamagePayload{
				TargetID: evt.PlayerID,
				Amount:   evt.Damage,
				SourceID: evt.HazardID, // e.g. "hazard-lava-5"
				Kind:     string(evt.HazardType),
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgDamage,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			go func() {
				broadcast <- BroadcastMessage{Type: MsgDamage, Data: dataBytes}
			}()
		case "combo":
			evtData, ok := data.(map[string]interface{})
			if !ok {
				return
			}
			playerID, _ := evtData["playerID"].(string)
			comboID, _ := evtData["comboID"].(string)
			comboName, _ := evtData["comboName"].(string)

			payload := ComboPayload{
				PlayerID:  playerID,
				ComboID:   comboID,
				ComboName: comboName,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgCombo,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			// Send to the specific player who triggered the combo
			username := playerID
			if strings.HasPrefix(playerID, "player-") {
				username = strings.TrimPrefix(playerID, "player-")
			}

			go func() {
				sessionsMu.Lock()
				client, exists := activeSessions[username]
				sessionsMu.Unlock()
				if exists {
					client.sendSafe(dataBytes)
					sendEndgameState(client)
				}
			}()
		case "telegraph":
			evt, ok := data.(game.TelegraphEvent)
			if !ok {
				return
			}
			payload := TelegraphPayload{
				SourceID:   evt.SourceID,
				X:          evt.X,
				Z:          evt.Z,
				Radius:     evt.Radius,
				Duration:   evt.Duration,
				Theme:      evt.Theme,
				Attack:     evt.Attack,
				ThreatTier: evt.ThreatTier,
				Label:      evt.Label,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgTelegraph,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgTelegraph, Data: dataBytes}
			}()
		case "reward_summary":
			evt, ok := data.(game.RewardSummaryEvent)
			if !ok {
				return
			}
			payload := RewardSummaryPayload{
				PlayerID:          evt.PlayerID,
				Title:             evt.Title,
				Subtitle:          evt.Subtitle,
				Gold:              evt.Gold,
				XP:                evt.XP,
				ItemCount:         evt.ItemCount,
				GemCount:          evt.GemCount,
				HeartCount:        evt.HeartCount,
				BossName:          evt.BossName,
				InstanceType:      evt.InstanceType,
				Difficulty:        evt.Difficulty,
				RunLevel:          evt.RunLevel,
				RoomsCleared:      evt.RoomsCleared,
				TotalRooms:        evt.TotalRooms,
				EliteRoomsCleared: evt.EliteRoomsCleared,
				TotalEliteRooms:   evt.TotalEliteRooms,
				DifficultyNote:    evt.DifficultyNote,
				ExitHint:          evt.ExitHint,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgRewardSummary,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			username := evt.PlayerID
			if strings.HasPrefix(username, "player-") {
				username = strings.TrimPrefix(username, "player-")
			}

			go func() {
				sessionsMu.Lock()
				client, exists := activeSessions[username]
				sessionsMu.Unlock()
				if exists {
					client.sendSafe(dataBytes)
					sendEndgameState(client)
				}
			}()
		case "room_clear_reward":
			evt, ok := data.(game.DungeonRoomClearRewardEvent)
			if !ok {
				return
			}
			payload := RoomClearRewardPayload{
				PlayerID:            evt.PlayerID,
				Title:               evt.Title,
				Subtitle:            evt.Subtitle,
				Gold:                evt.Gold,
				XP:                  evt.XP,
				ItemCount:           evt.ItemCount,
				GemCount:            evt.GemCount,
				HeartCount:          evt.HeartCount,
				Hint:                evt.Hint,
				RoomIndex:           evt.RoomIndex,
				ObjectiveRoomIndex:  evt.ObjectiveRoomIndex,
				RoomType:            evt.RoomType,
				RoomHook:            evt.RoomHook,
				InstanceType:        evt.InstanceType,
				Difficulty:          evt.Difficulty,
				HealthRestored:      evt.HealthRestored,
				ManaRestored:        evt.ManaRestored,
				BuffName:            evt.BuffName,
				BuffDurationSeconds: evt.BuffDurationSeconds,
				DamageReductionPct:  evt.DamageReductionPct,
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgRoomClearReward,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			username := evt.PlayerID
			if strings.HasPrefix(username, "player-") {
				username = strings.TrimPrefix(username, "player-")
			}

			go func() {
				sessionsMu.Lock()
				client, exists := activeSessions[username]
				sessionsMu.Unlock()
				if exists {
					client.sendSafe(dataBytes)
				}
			}()
		case "weekly_raid_complete":
			evt, ok := data.(game.WeeklyRaidCompletionEvent)
			if !ok {
				return
			}
			go func() {
				claimed, err := db.ClaimWeeklyRaidReward(evt.PlayerID, time.Now().UTC())
				if err != nil {
					log.Printf("weekly raid lockout for %s: %v", evt.PlayerID, err)
					return
				}
				client := getClientByPlayerID(evt.PlayerID)
				if !claimed {
					if client != nil {
						client.sendSystemChat("Weekly raid already completed; no duplicate weekly cache awarded.")
					}
					return
				}
				if !world.GrantWeeklyRaidReward(evt.PlayerID) {
					log.Printf("weekly raid reward player missing: %s", evt.PlayerID)
					return
				}
				if client != nil {
					client.sendSystemChat("Weekly Umbra cache: +50,000 gold, +1 Resonance level, and an endgame unique.")
					sendInventoryForPlayer(evt.PlayerID)
					sendEndgameState(client)
					savePlayer(client)
				}
			}()
		case "dungeon_complete":
			evt, ok := data.(game.DungeonCompletionEvent)
			if !ok {
				return
			}
			go recordGuildDungeonCompletion(evt)
		}
	}

	world.OnQuestUpdate = func(playerID string, quests []game.Quest) {
		// Find client
		sessionsMu.Lock()
		var client *Client
		for _, c := range activeSessions {
			if c.playerID == playerID {
				client = c
				break
			}
		}
		sessionsMu.Unlock()

		if client != nil {
			payload, _ := json.Marshal(quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: payload,
			}
			b, _ := json.Marshal(msg)
			client.sendSafe(b)
		}
	}
	world.OnPvPMatchComplete = func(result game.PvPMatchResult) {
		go persistPvPMatchResult(result)
	}
	world.OnPvPMatchUpdate = func(match *game.PvPMatch) {
		go sendPvPMatchState(match)
	}

	// Game Loop
	go func() {
		ticker := time.NewTicker(33 * time.Millisecond) // 30 TPS
		for range ticker.C {
			world.Update(0.033)
			broadcastState()
		}
	}()

	// Party Update Loop (Every 1 second)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			parties := world.GetAllParties()
			for _, party := range parties {
				broadcastPartyUpdate(party)
			}
		}
	}()

	// Time Sync Loop (Every 1 second)
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		for range ticker.C {
			broadcastTime()
		}
	}()

	// Hub
	go runHub()

	// Periodic Save Loop (Every 1 minute)
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			saveAllPlayers()
			world.Trading.CleanupExpired()
		}
	}()

	// Graceful Shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		log.Println("Shutting down server...")
		saveAllPlayers()
		os.Exit(0)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler(func(ctx context.Context) error {
		if db == nil {
			return fmt.Errorf("database is not initialized")
		}
		return db.Ping(ctx)
	}))
	mux.HandleFunc("/ws", serveWs)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Anything that isn't the game's websocket endpoint is almost always noise on a public IP.
		logSuspicious(r, "non-ws request", nil)
		http.NotFound(w, r)
	})

	srv := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ErrorLog:          httpErrLogger,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Server started on %s", *addr)
	if *certFile != "" && *keyFile != "" {
		log.Printf("Serving with SSL/TLS")
		log.Fatal(srv.ListenAndServeTLS(*certFile, *keyFile))
	} else {
		log.Printf("Serving without SSL (HTTP)")
		log.Fatal(srv.ListenAndServe())
	}
}
