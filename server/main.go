package main

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
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
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	"eidolon-server/internal/operations"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Bound the full JSON envelope, not just its message-specific payload.
	// Reports can contain 4000 Unicode characters (up to 24KiB when JSON
	// escapes control characters); every policy must fit below this ceiling.
	maxInboundPayloadSize = 32 * 1024
	maxMessageSize        = maxInboundPayloadSize + 1024

	// How long a disconnected player entity lingers in the world for session resume.
	resumeWindow = 5 * time.Minute
)

var addr = flag.String("addr", ":8080", "http service address")
var mongoURI = flag.String("mongo-uri", "mongodb://localhost:27017", "MongoDB connection URI")
var characterJournalDir = flag.String("save-journal-dir", "logs/character-saves", "Persistent private pending-character journal directory")
var checkSchema = flag.Bool("check-schema", false, "Read-only database compatibility check; exit without logging files, migrations or admission")
var checkSaveJournal = flag.Bool("check-save-journal", false, "Read-only account-bound character journal check; exit without database access, files or admission")
var credentialConcurrencyFlag = flag.Int("auth-max-concurrent", defaultCredentialConcurrency, "Maximum simultaneous credential queries/hashes (1-32); excess requests receive retry feedback")
var websocketConnectionsFlag = flag.Int("ws-max-connections", defaultWebsocketConnections, "Maximum simultaneous WebSocket upgrades/transports (1-4096); excess upgrades receive HTTP503")
var httpConnectionsFlag = flag.Int("http-max-connections", defaultHTTPConnections, "Combined HTTP/TLS/WebSocket connection cap (1-8192); saturated accepts wait in the kernel backlog; allow headroom above the WebSocket cap")
var certFile = flag.String("cert", "", "Path to SSL certificate file")
var keyFile = flag.String("key", "", "Path to SSL key file")

var logFilePath = flag.String("log-file", "server.log", "Path to server log file (empty disables file logging)")
var logStdout = flag.Bool("log-stdout", true, "Also write logs to stdout")
var logHTTPErrors = flag.Bool("log-http-errors", false, "Log noisy HTTP/TLS handshake errors (can be very noisy on public servers)")
var suspiciousStdout = flag.Bool("suspicious-stdout", true, "Print suspicious/non-client connections to stdout")
var suspiciousCooldown = flag.Duration("suspicious-cooldown", 30*time.Second, "Minimum time between suspicious stdout logs per transport peer (diagnostics only)")
var suspiciousLogFilePath = flag.String("suspicious-log-file", "logs/junk.log", "Path to log suspicious/non-client connections (empty disables file logging)")
var economyMetricsFilePath = flag.String("economy-metrics-file", "logs/economy_metrics.jsonl", "Hourly gold source/sink metrics path (empty disables)")
var qaUsernamesFlag = flag.String("qa-usernames", os.Getenv("EIDOLON_QA_USERNAMES"), "Comma-separated usernames allowed to use QA-only commands")
var qaTerrainElevationFlag = flag.Bool("qa-terrain-elevation", false, "Enable the Earth terrain integration candidate on an explicitly configured QA server")
var terrainProfileFlag = flag.String("terrain-profile", os.Getenv("EIDOLON_TERRAIN_PROFILE"), "Server-owned terrain profile: flat-v1 (default) or earth-elevation-rocks-v1; does not enable QA commands")
var adminBootstrapUsernamesFlag = flag.String("admin-bootstrap-usernames", os.Getenv("EIDOLON_ADMIN_BOOTSTRAP_USERNAMES"), "Comma-separated exact usernames allowed to bootstrap the durable admin role")

var (
	buildCommit  = "development"
	buildVersion = "Alpha 1.79.16"
	qaUsernames  = map[string]struct{}{}
)

var stateProtoMagic = []byte{'E', 'D', 'P', 'B'}

const stateProtoWireVersion byte = 2

var allowedWebsocketOriginHosts = map[string]struct{}{
	"localhost":                {},
	"127.0.0.1":                {},
	"eidolon.mendola.tech":     {},
	"eserver.mendola.tech":     {},
	"play.eidolonrealms.com":   {},
	"server.eidolonrealms.com": {},
}

func isAllowedWebsocketOrigin(origin string) bool {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.User != nil || parsed.Opaque != "" || parsed.Path != "" ||
		strings.ContainsAny(origin, "?#") {
		return false
	}
	// Origin is a scheme/host/optional-port tuple, not a URL to a resource.
	// Keep local development ports, but reject empty/out-of-range ports.
	if strings.HasSuffix(parsed.Host, ":") {
		return false
	}
	if port := parsed.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return false
		}
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
	Status          string                        `json:"status"`
	Database        string                        `json:"database"`
	Commit          string                        `json:"commit"`
	Version         string                        `json:"version"`
	Goroutines      int                           `json:"goroutines"`
	HeapAllocBytes  uint64                        `json:"heapAllocBytes"`
	HeapObjects     uint64                        `json:"heapObjects"`
	BroadcastQueues broadcastQueueMetrics         `json:"broadcastQueues"`
	Operational     operations.OperationalMetrics `json:"operational"`
}

func collectHealthResponse(ctx context.Context, pingDatabase func(context.Context) error) (healthResponse, int) {
	var memory runtime.MemStats
	runtime.ReadMemStats(&memory)
	response := healthResponse{
		Status:     "ok",
		Database:   "ready",
		Commit:     buildCommit,
		Version:    buildVersion,
		Goroutines: runtime.NumGoroutine(), HeapAllocBytes: memory.HeapAlloc,
		HeapObjects:     memory.HeapObjects,
		BroadcastQueues: transientBroadcastMetrics(),
		Operational:     operationalMetricsSnapshot(),
	}
	statusCode := http.StatusOK
	if pingDatabase == nil || pingDatabase(ctx) != nil {
		response.Status = "unavailable"
		response.Database = "unavailable"
		statusCode = http.StatusServiceUnavailable
	}
	return response, statusCode
}

func pingServiceDatabase(ctx context.Context) error {
	if !sessionActivityJournalHealthy() {
		return errors.New("session activity awaits durable storage")
	}
	if serverStopping.Load() {
		return errors.New("server is shutting down")
	}
	if db == nil {
		return errors.New("database is not initialized")
	}
	return db.Ping(ctx)
}

func healthHandler(pingDatabase func(context.Context) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		response, statusCode := collectHealthResponse(ctx, pingDatabase)

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
	HandshakeTimeout: websocketUpgradeWait,
	CheckOrigin: func(r *http.Request) bool {
		origins := r.Header.Values("Origin")
		// Native clients may omit Origin; it never authenticates an account.
		// Browser origins must be one nonempty tuple, not the first of several.
		if len(origins) == 0 {
			return true
		}
		return len(origins) == 1 && strings.TrimSpace(origins[0]) != "" && isAllowedWebsocketOrigin(origins[0])
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
var broadcast = make(chan BroadcastMessage, transientBroadcastCapacity)
var encounterBroadcast = make(chan BroadcastMessage, encounterBroadcastCapacity)
var register = make(chan *Client)
var unregister = make(chan *Client)

// Session-resume token store (in-memory; one token per username).
type resumeTokenEntry struct {
	accountID primitive.ObjectID
	username  string
	owner     *Client // immutable binding; transport closure uses atomic state
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
var suspiciousLogBudget = newSuspiciousTrafficBudget()

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
func issueResumeToken(username string, owner *Client) (string, error) {
	if owner == nil || username == "" || owner.username != username {
		return "", errors.New("resume token requires its authenticated connection")
	}
	if requireBoundCharacterSaves && clientAccountID(owner).IsZero() {
		return "", errors.New("resume token account identity required")
	}
	token, err := generateResumeToken()
	if err != nil {
		return "", err
	}
	installResumeToken(username, owner, token)
	return token, nil
}

// Internal only: callers validate the owner and generate a fresh CSPRNG token
// before any credential mutation. No client-provided token is installed here.
func installResumeToken(username string, owner *Client, token string) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	// Revoke old token
	if old, ok := resumeByUser[username]; ok {
		delete(resumeTokens, old)
	}
	entry := &resumeTokenEntry{
		accountID: clientAccountID(owner),
		username:  username,
		owner:     owner,
	}
	resumeTokens[token] = entry
	resumeByUser[username] = token
}

func revokeAccountResumeToken(username string) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	if old := resumeByUser[username]; old != "" {
		delete(resumeTokens, old)
		delete(resumeByUser, username)
	}
}

// Resolve the account without consuming first; dispatch revalidates/consumes
// only under that account's handoff lock, against password changes and rotation.
func resumeTokenAccount(token, authenticatedUsername string) (string, bool) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	entry := resumeTokens[token]
	if entry == nil || (authenticatedUsername != "" && entry.username != authenticatedUsername) || resumeTokenExpired(entry, time.Now()) {
		return "", false
	}
	return entry.username, true
}

// validateAndConsumeResumeToken validates and consumes a single-use token.
func validateAndConsumeResumeToken(token, authenticatedUsername string) (string, bool) {
	return validateAndConsumeResumeTokenFor(token, authenticatedUsername, time.Now())
}

func validateAndConsumeResumeTokenAt(token string, now time.Time) (string, bool) {
	return validateAndConsumeResumeTokenFor(token, "", now)
}

func validateAndConsumeResumeTokenFor(token, authenticatedUsername string, now time.Time) (string, bool) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	entry, ok := resumeTokens[token]
	if !ok {
		return "", false
	}
	if resumeTokenExpired(entry, now) {
		removeResumeTokenLocked(token, entry)
		return "", false
	}
	if authenticatedUsername != "" && authenticatedUsername != entry.username {
		return "", false
	}
	// A resume-only bearer cannot displace or burn the token of a live owner.
	// Long active play does not spend the disconnected reconnect allowance.
	if !entry.owner.transportClosed.Load() {
		return "", false
	}
	username := entry.username
	removeResumeTokenLocked(token, entry)
	return username, true
}

func resumeTokenExpired(entry *resumeTokenEntry, now time.Time) bool {
	if entry == nil || entry.owner == nil {
		return true
	}
	if !entry.owner.transportClosed.Load() {
		return false
	}
	closedAt := entry.owner.transportClosedAt.Load()
	return closedAt == nil || !now.Before(closedAt.Add(resumeWindow))
}

// Caller holds resumeTokensMu. Never remove a newer account token's index.
func removeResumeTokenLocked(token string, entry *resumeTokenEntry) {
	delete(resumeTokens, token)
	if entry != nil && resumeByUser[entry.username] == token {
		delete(resumeByUser, entry.username)
	}
}

func pruneResumeTokens(now time.Time) {
	resumeTokensMu.Lock()
	defer resumeTokensMu.Unlock()
	for token, entry := range resumeTokens {
		if resumeTokenExpired(entry, now) {
			removeResumeTokenLocked(token, entry)
		}
	}
}

func setupLogging() ([]io.Closer, error) {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	// Diagnostic junk traffic is bounded at both sinks. Durable structured
	// account/administrator activity uses its separate unsampled journal.
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
	terrainProfile, terrainErr := resolveTerrainStartupProfile(*terrainProfileFlag, *qaTerrainElevationFlag, len(parseQAUsernames(*qaUsernamesFlag)) > 0)
	if terrainErr != nil {
		fmt.Fprintln(os.Stderr, terrainErr)
		os.Exit(2)
	}
	if *checkSaveJournal {
		if *checkSchema {
			fmt.Fprintln(os.Stderr, "Choose one read-only preflight at a time")
			os.Exit(2)
		}
		if err := database.CheckAccountBoundCharacterSaveJournal(*characterJournalDir); err != nil {
			fmt.Fprintln(os.Stderr, "Character journal preflight failed; preserve files and reconcile using the original compatible writer")
			os.Exit(1)
		}
		fmt.Printf("Character journal preflight passed: supported=2 commit=%s\n", buildCommit)
		return
	}
	if *checkSchema {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		version, err := database.CheckSchemaCompatibility(ctx, *mongoURI)
		cancel()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Schema preflight failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Schema preflight passed: database=%d supported=%d commit=%s\n", version, database.CurrentSchemaVersion, buildCommit)
		return
	}
	if *credentialConcurrencyFlag < 1 || *credentialConcurrencyFlag > maxCredentialConcurrency {
		fmt.Fprintf(os.Stderr, "auth-max-concurrent must be between 1 and %d\n", maxCredentialConcurrency)
		os.Exit(2)
	}
	credentialAdmission = newCredentialWorkGate(*credentialConcurrencyFlag)
	if *websocketConnectionsFlag < 1 || *websocketConnectionsFlag > maxWebsocketConnections {
		fmt.Fprintf(os.Stderr, "ws-max-connections must be between 1 and %d\n", maxWebsocketConnections)
		os.Exit(2)
	}
	websocketAdmission = &websocketConnectionGate{limit: *websocketConnectionsFlag}
	if *httpConnectionsFlag < 1 || *httpConnectionsFlag > maxHTTPConnections {
		fmt.Fprintf(os.Stderr, "http-max-connections must be between 1 and %d\n", maxHTTPConnections)
		os.Exit(2)
	}
	qaUsernames = parseQAUsernames(*qaUsernamesFlag)
	adminBootstrapUsernames = parseAdminBootstrapUsernames(*adminBootstrapUsernamesFlag)
	closers, err := setupLogging()
	if err != nil {
		// Logging isn't ready; fall back to stderr.
		fmt.Fprintf(os.Stderr, "failed to set up logging: %v\n", err)
		os.Exit(1)
	}
	for i := len(closers) - 1; i >= 0; i-- {
		defer closers[i].Close()
	}

	// Refuse unbound pending work before advancing the writer-compatibility
	// marker. An old matching server can still reconcile its recovery point.
	characterSaveJournal, err = database.OpenCharacterSaveJournal(*characterJournalDir)
	if err != nil {
		log.Fatalf("Character save journal unavailable: %v", err)
	}
	if err := characterSaveJournal.ValidateAccountBoundRecords(); err != nil {
		log.Fatalf("Character journal transition required; files preserved: %v", err)
	}
	requireBoundCharacterSaves = true
	db, err = database.New(*mongoURI)
	if err != nil {
		log.Fatal(err)
	}
	adminRoles = db
	sessionAccountIdentities = db
	worldEntryModeration = newWorldModerationGate(db, time.Now)
	chatService.authorizeSend = newTemporaryChatMuteGuard(db, time.Now)
	adminActivities = db
	adminOperations = db
	guildBankOperations = db
	directTradeOperations = db
	groundItemOperations = db
	dungeonRoomRewards = db
	bossLootCharacters = db
	bossVictories = db
	weeklyRaidRewards = db
	characterSaveCommitter = db
	if err := retryPendingCharacterSaves(); err != nil {
		log.Fatalf("Cannot recover pending character saves; refusing stale logins: %v", err)
	}
	if err := recoverPendingWeeklyRaidRewards(); err != nil {
		// Character journals have already replayed. Unpaid entitlements can
		// retry under account locks without blocking unrelated player logins.
		log.Printf("Weekly reward delivery remains pending at startup: %v", err)
	}
	arenaResultJournal, err = database.OpenPvPResultJournal(filepath.Join(*characterJournalDir, "arena-results"))
	if err != nil {
		log.Fatalf("Arena result journal unavailable: %v", err)
	}
	if err := recoverPvPResultsAtStartup(); err != nil {
		log.Fatalf("Cannot recover ranked results; refusing stale logins: %v", err)
	}
	guildClearJournal, err = database.OpenGuildClearJournal(filepath.Join(*characterJournalDir, "guild-clears"))
	if err != nil {
		log.Fatalf("Guild clear journal unavailable: %v", err)
	}
	if err := retryPendingGuildClears(); err != nil {
		// Leaderboards may lag without granting stale wallets, roles or
		// characters. Leave receipts untouched for periodic/operator recovery.
		log.Printf("Guild leaderboard recovery remains pending at startup: %v", err)
	}
	adminActivityJournal, err = database.OpenAdminActivityJournal(filepath.Join(*characterJournalDir, "admin-activity"))
	if err != nil {
		log.Fatal("Session activity journal unavailable; refusing unaudited logins")
	}
	if err := recoverAdminActivityOnStartup(); err != nil {
		log.Fatal("Session activity recovery failed; refusing unaudited logins")
	}

	// Seed the random number generator
	rand.Seed(time.Now().UnixNano())

	world, err = game.NewWorldWithTerrainProfile(db, terrainProfile)
	if err != nil {
		log.Fatalf("Cannot initialize configured terrain: %v", err)
	}
	if err := world.Trading.ReadinessError(); err != nil {
		log.Fatalf("Cannot load durable auction state; refusing an empty market: %v", err)
	}
	if err := recoverPendingAuctionBids(); err != nil {
		log.Fatalf("Cannot recover durable auction bids; refusing stale balances: %v", err)
	}
	if err := initializeBlackjack(); err != nil {
		log.Fatalf("Cannot recover durable blackjack table; refusing stale balances: %v", err)
	}
	if err := initializeSlots(); err != nil {
		log.Fatalf("Cannot recover durable slot entitlements: %v", err)
	}
	if err := initializePoker(); err != nil {
		log.Fatalf("Cannot recover durable poker table: %v", err)
	}
	if err := initializeHouseTables(); err != nil {
		log.Fatalf("Cannot recover durable roulette/baccarat tables: %v", err)
	}
	if err := recoverAdminOperationsOnStartup(); err != nil {
		log.Fatal("Administration operation recovery failed; refusing stale character admission")
	}
	if err := recoverGuildBankOperationsOnStartup(); err != nil {
		log.Fatal("Guild bank recovery failed; refusing stale character admission")
	}
	if err := recoverDirectTradesOnStartup(); err != nil {
		log.Fatal("Direct trade recovery failed; refusing stale character admission")
	}
	if err := recoverGroundItemsOnStartup(); err != nil {
		log.Fatal("Ground item recovery failed; refusing stale character admission")
	}
	world.OnBossReward = persistBossRewardFeedback
	world.OnBossVictory = prepareAndDeliverBossVictory
	world.OnDungeonRoomReward = func(op database.DungeonRoomRewardOperation) error {
		err := prepareAndDeliverDungeonRoomReward(op)
		if err != nil {
			log.Print("Dungeon room reward retained for recovery")
		}
		return err
	}
	if err := recoverDungeonRoomRewardsOnStartup(); err != nil {
		log.Fatal("Dungeon room reward recovery failed; refusing stale character admission")
	}
	if err := recoverBossVictoriesOnStartup(); err != nil {
		log.Fatal("Boss victory recovery failed; refusing stale character admission")
	}
	if err := recoverBossDropsOnStartup(); err != nil {
		log.Fatal("Boss drop recovery failed; refusing stale character admission")
	}
	world.Trading.SetRefundDelivery(deliverAuctionRefund)
	if err := world.Trading.RetryPendingRefunds(); err != nil {
		log.Printf("Startup auction refunds remain pending: %v", err)
	}
	stopEconomyMetrics := startEconomyMetrics(world, *economyMetricsFilePath)
	defer stopEconomyMetrics()
	recoveryMailer, err := newRecoveryMailer(os.Getenv)
	if err != nil {
		log.Fatal("Account recovery configuration is invalid: ", err)
	}
	loops := newServerLoops()
	accountRecovery = newEmailRecoveryService(db, recoveryMailer, loops)

	// Sweep goroutine: remove disconnected player entities whose resume window
	// has expired. Runs every 30 seconds.
	loops.Every(30*time.Second, func() {
		pruneResumeTokens(time.Now())
		expired := world.CollectExpiredDisconnectedPlayers(resumeWindow)
		for _, e := range expired {
			log.Printf("Session resume window expired for player %s (%s); entity removed", e.Name, e.ID)
			// Clean up party membership now that the entity is gone (0.37.1).
			if e.PartyID != "" {
				world.RemoveExpiredMemberFromParty(e.ID, e.PartyID)
			}
		}
	})

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
			sendChronicleAdvanceAndSave(evt.PlayerID, message)
		case "raid_phase":
			evt, ok := data.(game.RaidPhaseEvent)
			if !ok {
				return
			}
			payload, _ := json.Marshal(evt)
			message := createMessage("raid_phase", payload)
			enqueueTransientBroadcast(BroadcastMessage{Type: "raid_phase", Data: message, InstanceID: evt.InstanceID})
		case "crystal_repair":
			evt, ok := data.(game.CrystalRepairEvent)
			if !ok {
				return
			}
			payload, _ := json.Marshal(evt)
			message := createMessage("crystal_repair", payload)
			enqueueTransientBroadcast(BroadcastMessage{Type: "crystal_repair", Data: message, InstanceID: evt.InstanceID})
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

			enqueueTransientBroadcast(BroadcastMessage{Type: MsgChat, Data: dataBytes})
		case "ability":
			evt, ok := data.(game.AbilityEvent)
			if !ok {
				return
			}
			payload := abilityPayloadFromEvent(evt)
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgAbility,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)
			enqueueTransientBroadcast(BroadcastMessage{Type: MsgAbility, Data: dataBytes, InstanceID: evt.InstanceID, ActorID: evt.SourceID})
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
			enqueueTransientBroadcast(BroadcastMessage{Type: MsgAttack, Data: dataBytes, InstanceID: evt.InstanceID, ActorID: evt.SourceID})
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

			enqueueTransientBroadcast(BroadcastMessage{Type: MsgDamage, Data: dataBytes, InstanceID: evt.InstanceID, ActorID: evt.TargetID})
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
			enqueueTransientBroadcast(projectileImpactBroadcast(evt, dataBytes))
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
			enqueueTransientBroadcast(BroadcastMessage{Type: MsgHeal, Data: dataBytes, InstanceID: evt.InstanceID, ActorID: evt.TargetID})
		case "hazard_damage":
			evt, ok := data.(game.HazardDamageEvent)
			if !ok {
				return
			}
			// Send hazard damage as a damage event so client shows floating text
			payload := DamagePayload{
				TargetID:   evt.PlayerID,
				Amount:     evt.Damage,
				SourceID:   evt.HazardID, // e.g. "hazard-lava-5"
				InstanceID: evt.InstanceID,
				Kind:       string(evt.HazardType),
			}
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgDamage,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			enqueueTransientBroadcast(BroadcastMessage{Type: MsgDamage, Data: dataBytes, InstanceID: evt.InstanceID, ActorID: evt.PlayerID})
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

			// The next world broadcast already synchronizes authoritative
			// Resonance changes. Do not re-enter World.Mu from this callback.
			sendPrivateWorldFeedback(playerID, dataBytes)
		case "telegraph":
			evt, ok := data.(game.TelegraphEvent)
			if !ok {
				return
			}
			message, err := telegraphBroadcast(evt)
			if err != nil {
				return
			}
			enqueueTransientBroadcast(message)
		case "reward_summary":
			evt, ok := data.(game.RewardSummaryEvent)
			if !ok {
				return
			}
			payload := RewardSummaryPayload(evt)
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgRewardSummary,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			sendPrivateWorldFeedback(evt.PlayerID, dataBytes)
		case "room_clear_reward":
			evt, ok := data.(game.DungeonRoomClearRewardEvent)
			if !ok {
				return
			}
			payload := RoomClearRewardPayload(evt)
			b, _ := json.Marshal(payload)
			outMsg := Message{
				Type:    MsgRoomClearReward,
				Payload: b,
			}
			dataBytes, _ := json.Marshal(outMsg)

			sendPrivateWorldFeedback(evt.PlayerID, dataBytes)
		case "weekly_raid_complete":
			evt, ok := data.(game.WeeklyRaidCompletionEvent)
			if !ok {
				return
			}
			// The combat path records the completion before this callback. Do
			// not take world/account locks here, or queue one worker per player.
			if client := getClientByPlayerID(evt.PlayerID); client != nil {
				client.sendSystemChat("Weekly raid complete. Your cache is being processed; delayed delivery retries automatically.")
			}
			weeklyRaidSync.request()
		case "dungeon_complete":
			evt, ok := data.(game.DungeonCompletionEvent)
			if !ok {
				return
			}
			if err := recordGuildDungeonCompletion(evt); err != nil {
				log.Printf("Guild clear recording failed: %v", err)
				for _, playerID := range evt.Participants {
					if client := getClientByPlayerID(playerID); client != nil {
						client.sendSystemChat("This run's guild leaderboard record could not be saved. Gameplay rewards are separate; report this clear if it is missing.")
					}
				}
			}
		}
	}

	world.OnQuestProgress = requestQuestProgressSave
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
		// The world has released its locks and restored participants, and any
		// ranked result is already durable through OnPvPResultRecord. Database
		// synchronization must not delay return/result presentation or spawn a
		// new worker for every match.
		if len(result.Profiles) > 0 {
			arenaResultSync.request()
		}
		notifyPvPMatchResult(result, len(result.Profiles) > 0)
	}
	world.OnPvPResultRecord = recordPvPResult
	world.OnPvPMatchUpdate = func(match *game.PvPMatch) {
		queuePvPMatchState(match)
	}
	world.OnPvPMatchStart = func(match *game.PvPMatch) {
		sendPvPEntry(match)
		sendPvPMatchState(match)
	}

	// Game Loop
	loops.Every(33*time.Millisecond, func() {
		runRealtimeFrame(time.Now())
	})

	// Party Update Loop (Every 1 second)
	loops.Every(time.Second, func() {
		parties := world.GetAllParties()
		for _, party := range parties {
			broadcastPartyUpdate(party)
		}
	})

	// Time Sync Loop (Every 1 second)
	loops.Every(time.Second, broadcastTime)
	world.UpdatePublicEvent(time.Now())
	loops.Every(time.Second, broadcastPublicEvent)
	loops.Every(time.Second, func() {
		if err := tickSlotRecovery(); err != nil {
			log.Printf("Slot settlement remains pending: %v", err)
		}
	})
	loops.Every(time.Second, func() {
		if err := tickBlackjack(time.Now()); err != nil {
			log.Printf("Blackjack table recovery remains pending: %v", err)
		}
	})
	loops.Every(time.Second, func() {
		if err := tickPoker(time.Now()); err != nil {
			log.Printf("Poker table recovery remains pending: %v", err)
		}
	})
	loops.Every(time.Second, func() {
		if err := tickHouseTables(time.Now()); err != nil {
			log.Printf("Roulette/baccarat settlement remains pending: %v", err)
		}
	})

	// Hub
	go runHub()

	// Periodic Save Loop (Every 1 minute)
	loops.Every(time.Minute, func() {
		saveAllPlayers()
		world.Trading.CleanupExpired()
	})
	// Independent bounded retry passes: an outage must not multiply timeouts
	// across a large outbox or queue redundant workers behind one delivery.
	loops.Every(game.RefundRetryInterval, world.Trading.ScheduleRefundDelivery)
	loops.Every(5*time.Second, func() {
		arenaResultSync.request()
	})
	loops.Every(5*time.Second, func() {
		guildClearSync.request()
	})
	loops.Every(5*time.Second, func() {
		if err := retryPendingAdminActivity(); err != nil {
			log.Print("Session activity sync remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingAdminOperations(); err != nil {
			log.Print("Administration operation recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingGuildBankOperations(); err != nil {
			log.Print("Guild bank transfer recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingDirectTrades(); err != nil {
			log.Print("Direct trade custody recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingGroundItems(); err != nil {
			log.Print("Ground item custody recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingDungeonRoomRewards(); err != nil {
			log.Print("Dungeon room reward recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingBossVictories(); err != nil {
			log.Print("Boss victory recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverAvailableBossDrops(); err != nil {
			log.Print("Original boss drop recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		if err := recoverPendingBossLoot(); err != nil {
			log.Print("Boss loot delivery recovery remains pending")
		}
	})
	loops.Every(5*time.Second, func() {
		weeklyRaidSync.request()
	})
	loops.Every(game.RefundRetryInterval, func() {
		if err := recoverPendingAuctionBids(); err != nil {
			log.Printf("Auction bid recovery remains pending: %v", err)
		}
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler(pingServiceDatabase))
	mux.HandleFunc("/ws", serveWs)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Anything that isn't the game's websocket endpoint is almost always noise on a public IP.
		logSuspicious(r, "non-ws request", nil)
		http.NotFound(w, r)
	})

	srv := newGameHTTPServer(*addr, mux, httpErrLogger)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(stop)
	shutdownDone := make(chan struct{})
	go func() {
		<-stop
		log.Println("Shutting down server...")
		drainServer(loops)
		if err := shutdownHTTPServer(srv); err != nil {
			log.Printf("HTTP shutdown: %v", err)
		}
		close(shutdownDone)
	}()

	log.Printf("Server started on %s", *addr)
	baseListener, err := net.Listen("tcp", srv.Addr)
	if err != nil {
		log.Fatal(err)
	}
	listener, err := newBoundedHTTPListener(baseListener, *httpConnectionsFlag)
	if err != nil {
		baseListener.Close()
		log.Fatal(err)
	}
	defer listener.Close()
	log.Printf("Combined HTTP/TLS/WebSocket connection cap: %d", *httpConnectionsFlag)
	var serveErr error
	if *certFile != "" && *keyFile != "" {
		log.Printf("Serving with SSL/TLS")
		serveErr = srv.ServeTLS(listener, *certFile, *keyFile)
	} else {
		log.Printf("Serving without SSL (HTTP)")
		serveErr = srv.Serve(listener)
	}
	if !errors.Is(serveErr, http.ErrServerClosed) {
		log.Fatal(serveErr)
	}
	<-shutdownDone
	db.Close(context.Background())
}
