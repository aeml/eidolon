package main

import (
	"bytes"
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
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
var qaUsernamesFlag = flag.String("qa-usernames", os.Getenv("EIDOLON_QA_USERNAMES"), "Comma-separated usernames allowed to use QA-only commands")

var (
	buildCommit  = "development"
	buildVersion = "Alpha 0.41.0.12"
	qaUsernames  = map[string]struct{}{}
)

var stateProtoMagic = []byte{'E', 'D', 'P', 'B'}

const stateProtoWireVersion byte = 1

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
	Status   string `json:"status"`
	Database string `json:"database"`
	Commit   string `json:"commit"`
	Version  string `json:"version"`
}

func healthHandler(pingDatabase func(context.Context) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		response := healthResponse{
			Status:   "ok",
			Database: "ready",
			Commit:   buildCommit,
			Version:  buildVersion,
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

// EntitySnapshot stores minimal state for delta comparison
// We only track fields that change frequently
type EntitySnapshot struct {
	X                          float64
	Z                          float64
	Y                          float64
	Rotation                   float64
	Health                     int
	MaxHealth                  int
	Mana                       int
	State                      string
	Level                      int
	IsCharging                 bool
	SpiritsActive              bool
	SpiritsBoosted             bool
	GuardianEmbraceActive      bool
	BlessingResolveActive      bool
	DivineInterventionActive   bool
	ArcaneShieldActive         bool
	ArcaneShieldHP             int
	TimeWarpActive             bool
	SpellFocusActive           bool
	SwiftActive                bool
	IronFortressActive         bool
	GuardianRoarActive         bool
	BerserkerModeActive        bool
	LastStandActive            bool
	SerratedEdgesActive        bool
	PoisonCoatingActive        bool
	StealthActive              bool
	ZealActive                 bool
	Stunned                    bool
	StunDuration               float64
	Slowed                     bool
	SlowFactor                 float64
	SlowDuration               float64
	Rooted                     bool
	RootDuration               float64
	Bleeding                   bool
	BleedDuration              float64
	BleedDamage                int
	Poisoned                   bool
	PoisonDuration             float64
	PoisonDamage               int
	WeakPointMarked            bool
	WeakPointDuration          float64
	MarkWeakness               bool
	MarkWeaknessDuration       float64
	SpiritDuration             float64
	BlessingResolveDuration    float64
	TimeWarpDuration           float64
	GuardianEmbraceDuration    float64
	ArcaneShieldDuration       float64
	DivineInterventionDuration float64
	SpellFocusDuration         float64
	SwiftDuration              float64
	IronFortressDuration       float64
	GuardianRoarDuration       float64
	BerserkerModeDuration      float64
	LastStandDuration          float64
	SerratedEdgesDuration      float64
	PoisonCoatingDuration      float64
	StealthDuration            float64
	ZealDuration               float64
	JumpProgress               float64
	TalentPoints               int
	TalentKeys                 int
	TalentSpent                int
	PartyID                    string
	SocialStatus               string
	EquipmentRevision          uint64
}

// Client represents a connected player
type Client struct {
	conn         *websocket.Conn
	send         chan []byte
	prioritySend chan []byte
	playerID     string
	username     string
	lastState    map[string]*EntitySnapshot // Track last sent state per entity
	seenIDs      map[string]bool            // Track which entities client knows about
	qaDisconnect func()                     // Optional test hook for the allowlisted reconnect fault.
}

// Message types
const (
	MsgJoin             = "join"
	MsgLogin            = "login"
	MsgRegister         = "register"
	MsgMove             = "move"
	MsgJump             = "jump"
	MsgQAAnimationReady = "qa_animation_ready"
	MsgAttack           = "attack"
	MsgDamage           = "damage"
	MsgHeal             = "heal"
	MsgChat             = "chat"
	MsgState            = "state"
	MsgError            = "error"
	MsgPickup           = "pickup"
	MsgInventory        = "inventory"
	MsgAbility          = "ability"
	MsgAbilityResult    = "ability_result"
	MsgAbilityCooldowns = "ability_cooldowns"
	MsgEquip            = "equip"
	MsgBuyGamble        = "buy_gamble"
	MsgSell             = "sell"
	MsgSocial           = "social"
	MsgRespawn          = "respawn"
	MsgRecall           = "recall"
	MsgReport           = "report"
	MsgStashDeposit     = "stash_deposit"
	MsgStashWithdraw    = "stash_withdraw"
	MsgStash            = "stash"
	MsgQuestUpdate      = "quest_update"
	MsgRequestQuests    = "request_quests"
	MsgAcceptQuest      = "accept_quest"
	MsgCompleteQuest    = "complete_quest"
	MsgSelectBranch     = "selectBranch"
	MsgUnlockSkill      = "unlockSkill"
	MsgUnlockTalent     = "unlockTalent"
	MsgResetTalents     = "resetTalents"
	MsgRespec           = "respec"
	MsgRespecCost       = "respec_cost"
	MsgSelectRune       = "select_rune"
	MsgGetRunes         = "get_runes"
	MsgCombo            = "combo"
	MsgForgeUpgrade     = "forge_upgrade"
	MsgForgePotency     = "forge_potency"
	MsgForgeSocket      = "forge_socket"
	MsgForgeInsertGem   = "forge_insert_gem"
	MsgForgeCombineGem  = "forge_combine_gem"
	MsgForgeRemoveGem   = "forge_remove_gem"
	MsgPartyInvite      = "party_invite"
	MsgPartyResponse    = "party_response"
	MsgPartyRequest     = "party_request"
	MsgPartyJoinResp    = "party_join_resp"
	MsgPartyKick        = "party_kick"
	MsgPartyPromote     = "party_promote"
	MsgPartyLeave       = "party_leave"
	MsgPartyUpdate      = "party_update"
	MsgSocialStatus     = "social_status"
	MsgBuyback          = "buyback"
	MsgBuybackList      = "buyback_list"
	MsgUnequip          = "unequip"

	// Trading
	MsgTradingSearch     = "trading_search"
	MsgTradingCreate     = "trading_create"
	MsgTradingMyAuctions = "trading_my_auctions"
	MsgTradingBuyout     = "trading_buyout"
	MsgTradingCollect    = "trading_collect"
	MsgTradingCancel     = "trading_cancel"
	MsgTradingBid        = "trading_bid"
	MsgInventoryMove     = "inventory_move"
	MsgInventorySort     = "inventory_sort"
	MsgEnterDungeon      = "enter_dungeon"
	MsgEnterInstance     = "enter_instance"
	MsgSplitStack        = "split_stack"
	MsgGetDungeonStatus  = "get_dungeon_status"
	MsgResetDungeon      = "reset_dungeon"
	MsgTelegraph         = "telegraph"
	MsgRewardSummary     = "reward_summary"
	MsgRoomClearReward   = "room_clear_reward"
	MsgDungeonRoomState  = "dungeon_room_state"
	MsgResumeSession     = "resume_session"

	// Friends (0.38)
	MsgFriendRequest  = "friend_request"  // C→S send request; S→C incoming request notification
	MsgFriendAccept   = "friend_accept"   // C→S accept pending; S→C accepted notification
	MsgFriendDecline  = "friend_decline"  // C→S decline pending request
	MsgFriendRemove   = "friend_remove"   // C→S remove accepted friend
	MsgFriendList     = "friend_list"     // C→S request list; S→C full list payload
	MsgFriendPresence = "friend_presence" // S→C friend came online or went offline
)

type SplitStackPayload struct {
	Slot   int `json:"slot"`
	Amount int `json:"amount"`
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type UnlockTalentPayload struct {
	TalentId string `json:"talentId"`
}

type RespecPayload struct {
	RespecType string `json:"respecType"` // "talents", "skills", or "both"
}

type TradingBidPayload struct {
	AuctionID string `json:"auctionId"`
	Amount    int    `json:"amount"`
}

type InventoryMovePayload struct {
	FromIndex int `json:"fromIndex"`
	ToIndex   int `json:"toIndex"`
}

type SocialEntry struct {
	Name         string `json:"name"`
	Class        string `json:"class"`
	Level        int    `json:"level"`
	SocialStatus string `json:"socialStatus"`
}

type SocialStatusPayload struct {
	Status string `json:"status"`
}

// FriendUsernamePayload is used for friend_request / friend_accept / friend_decline / friend_remove.
// Username is the other player's username (not playerID).
type FriendUsernamePayload struct {
	Username string `json:"username"`
}

// FriendEntry is one row in the friend list sent to the client.
type FriendEntry struct {
	Username     string `json:"username"`
	Online       bool   `json:"online"`
	SocialStatus string `json:"socialStatus,omitempty"`
}

// FriendListPayload is the full S→C friend_list payload.
type FriendListPayload struct {
	Friends []FriendEntry `json:"friends"`
	Pending []string      `json:"pending"` // usernames of players who sent *this* player a pending request
}

// FriendPresencePayload is sent S→C when a friend comes online or goes offline.
type FriendPresencePayload struct {
	Username string `json:"username"`
	Online   bool   `json:"online"`
}

type AuthPayload struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type JoinPayload struct {
	Type string `json:"type"` // Class type
}

type MovePayload struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Z        float64 `json:"z"`
	Rotation float64 `json:"rotation"`
	State    string  `json:"state"`
	Sequence uint64  `json:"sequence"`
}

type JumpPayload struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type AttackPayload struct {
	TargetID string `json:"targetId"`
}

type AttackEventPayload struct {
	SourceID string  `json:"sourceId"`
	TargetID string  `json:"targetId"`
	TargetX  float64 `json:"targetX"`
	TargetZ  float64 `json:"targetZ"`
}

type PickupPayload struct {
	LootID string `json:"lootId"`
}

type BuyGamblePayload struct {
	Slot string `json:"slot"`
}

type SellPayload struct {
	ItemID string `json:"itemId"`
}

type BuybackPayload struct {
	ItemID string `json:"itemId"`
}

type StashDepositPayload struct {
	ItemID string `json:"itemId"`
}

type StashWithdrawPayload struct {
	ItemID string `json:"itemId"`
}

type ForgeUpgradePayload struct {
	Slot   string `json:"slot"`
	Amount int    `json:"amount"`
}

type ForgePotencyPayload struct {
	Slot string `json:"slot"`
}

type ForgeSocketPayload struct {
	Slot string `json:"slot"`
}

type ForgeInsertGemPayload struct {
	EquipSlot   string `json:"equipSlot"`
	GemInvIndex int    `json:"gemInvIndex"`
	SocketIndex int    `json:"socketIndex"`
}

type ForgeCombineGemPayload struct {
	GemIndices [3]int `json:"gemIndices"`
}

type ForgeRemoveGemPayload struct {
	EquipSlot   string `json:"equipSlot"`
	SocketIndex int    `json:"socketIndex"`
}

type AcceptQuestPayload struct {
	QuestID string `json:"questId"`
}

type CompleteQuestPayload struct {
	QuestID string `json:"questId"`
}

type EquipPayload struct {
	ItemID string `json:"itemId"`
	Slot   string `json:"slot"`
}

type TradingSearchPayload struct {
	Query string `json:"query"`
}

type TradingCreatePayload struct {
	SlotIndex int `json:"slotIndex"`
	Bid       int `json:"bid"`
	Buyout    int `json:"buyout"`
	Duration  int `json:"duration"`
}

type TradingBuyoutPayload struct {
	AuctionID string `json:"auctionId"`
}

type TradingCollectPayload struct {
	AuctionID string `json:"auctionId"`
}

type TradingCancelPayload struct {
	AuctionID string `json:"auctionId"`
}

type UnequipPayload struct {
	Slot string `json:"slot"`
}

type AbilityPayload struct {
	TargetX   float64 `json:"targetX"`
	TargetZ   float64 `json:"targetZ"`
	TargetID  string  `json:"targetId"`
	SkillName string  `json:"skillName"`
	SourceID  string  `json:"sourceId"`
}

type DamagePayload struct {
	TargetID string `json:"targetId"`
	Amount   int    `json:"amount"`
	SourceID string `json:"sourceId"`
}

type ComboPayload struct {
	PlayerID  string `json:"playerId"`
	ComboID   string `json:"comboId"`
	ComboName string `json:"comboName"`
}

type TelegraphPayload struct {
	SourceID string  `json:"sourceId"`
	X        float64 `json:"x"`
	Z        float64 `json:"z"`
	Radius   float64 `json:"radius"`
	Duration float64 `json:"duration"`
}

type RewardSummaryPayload struct {
	PlayerID          string `json:"playerId"`
	Title             string `json:"title"`
	Subtitle          string `json:"subtitle,omitempty"`
	Gold              int    `json:"gold"`
	XP                int    `json:"xp"`
	ItemCount         int    `json:"itemCount"`
	GemCount          int    `json:"gemCount"`
	HeartCount        int    `json:"heartCount"`
	BossName          string `json:"bossName,omitempty"`
	InstanceType      string `json:"instanceType,omitempty"`
	Difficulty        string `json:"difficulty,omitempty"`
	RunLevel          int    `json:"runLevel,omitempty"`
	RoomsCleared      int    `json:"roomsCleared,omitempty"`
	TotalRooms        int    `json:"totalRooms,omitempty"`
	EliteRoomsCleared int    `json:"eliteRoomsCleared,omitempty"`
	TotalEliteRooms   int    `json:"totalEliteRooms,omitempty"`
	DifficultyNote    string `json:"difficultyNote,omitempty"`
	ExitHint          string `json:"exitHint,omitempty"`
}

type RoomClearRewardPayload struct {
	PlayerID            string `json:"playerId"`
	Title               string `json:"title"`
	Subtitle            string `json:"subtitle,omitempty"`
	Gold                int    `json:"gold"`
	XP                  int    `json:"xp"`
	ItemCount           int    `json:"itemCount,omitempty"`
	GemCount            int    `json:"gemCount,omitempty"`
	HeartCount          int    `json:"heartCount,omitempty"`
	Hint                string `json:"hint,omitempty"`
	RoomIndex           int    `json:"roomIndex"`
	ObjectiveRoomIndex  int    `json:"objectiveRoomIndex"`
	RoomType            string `json:"roomType,omitempty"`
	RoomHook            string `json:"roomHook,omitempty"`
	InstanceType        string `json:"instanceType,omitempty"`
	Difficulty          string `json:"difficulty,omitempty"`
	HealthRestored      int    `json:"healthRestored,omitempty"`
	ManaRestored        int    `json:"manaRestored,omitempty"`
	BuffName            string `json:"buffName,omitempty"`
	BuffDurationSeconds int    `json:"buffDurationSeconds,omitempty"`
	DamageReductionPct  int    `json:"damageReductionPct,omitempty"`
}

type ChatPayload struct {
	Message string `json:"message"`
	Sender  string `json:"sender"`
	Channel string `json:"channel,omitempty"`
}

type ReportPayload struct {
	ReportType string `json:"reportType"`
	Text       string `json:"text"`
}

type SelectBranchPayload struct {
	Branch string `json:"branch"`
}

type UnlockSkillPayload struct {
	SkillName string `json:"skillName"`
}

type PartyInvitePayload struct {
	TargetName string `json:"targetName"`
}

type PartyResponsePayload struct {
	InviterName string `json:"inviterName"`
	Accepted    bool   `json:"accepted"`
}

type PartyRequestPayload struct {
	TargetName string `json:"targetName"`
}

type PartyJoinRespPayload struct {
	RequesterName string `json:"requesterName"`
	Approved      bool   `json:"approved"`
}

type PartyKickPayload struct {
	TargetID string `json:"targetId"`
}

type PartyPromotePayload struct {
	TargetID string `json:"targetId"`
}

type BroadcastMessage struct {
	Type       string
	Data       []byte
	InstanceID string
}

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
				TargetID: evt.TargetID,
				Amount:   evt.Amount,
				SourceID: evt.SourceID,
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
		case "heal":
			evt, ok := data.(game.HealEvent)
			if !ok {
				return
			}
			payload := DamagePayload{TargetID: evt.TargetID, Amount: evt.Amount, SourceID: evt.SourceID}
			b, _ := json.Marshal(payload)
			outMsg := Message{Type: MsgHeal, Payload: b}
			dataBytes, _ := json.Marshal(outMsg)
			go func() {
				broadcast <- BroadcastMessage{Type: MsgHeal, Data: dataBytes}
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
				}
			}()
		case "telegraph":
			evt, ok := data.(game.TelegraphEvent)
			if !ok {
				return
			}
			payload := TelegraphPayload{
				SourceID: evt.SourceID,
				X:        evt.X,
				Z:        evt.Z,
				Radius:   evt.Radius,
				Duration: evt.Duration,
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

func runHub() {
	for {
		select {
		case client := <-register:
			clients[client] = true
		case client := <-unregister:
			if _, ok := clients[client]; ok {
				cleanupClient(client)
				delete(clients, client)
				close(client.send)
				if client.prioritySend != nil {
					close(client.prioritySend)
				}
			}
		case message := <-broadcast:
			for client := range clients {
				// Filter by InstanceID
				if message.InstanceID != "" {
					clientInstance := world.GetPlayerInstance(client.playerID)
					if clientInstance != message.InstanceID {
						continue
					}
				}

				if message.Type == MsgState || message.Type == "time" {
					// Non-blocking send for state/time updates
					// If channel is full, drop the message instead of disconnecting
					select {
					case client.send <- message.Data:
					default:
						// Drop message, client is too slow
					}
				} else {
					// Critical messages (Chat, Damage, etc.)
					// Try to send, if full, we might have to disconnect or risk blocking
					select {
					case client.send <- message.Data:
					default:
						cleanupClient(client)
						delete(clients, client)
						close(client.send)
						if client.prioritySend != nil {
							close(client.prioritySend)
						}
					}
				}
			}
		}
	}
}

// sendInitialPlayerState pushes inventory, stash, buyback, quests, skill runes,
// and (optionally) the current dungeon instance layout to the client. It is
// called both on a fresh MsgJoin and on a successful MsgResumeSession.
func sendInitialPlayerState(c *Client, entity *game.Entity, instanceID string) {
	// Cooldowns are server-owned and survive the session-resume window. Send a
	// complete snapshot so reconnecting clients do not show abilities as ready
	// only to have the server reject their first cast.
	cooldowns, _ := world.GetAbilityCooldownSnapshot(entity.ID)
	cooldownPayload, _ := json.Marshal(map[string]interface{}{
		"cooldowns": cooldowns,
	})
	cooldownMessage, _ := json.Marshal(Message{Type: MsgAbilityCooldowns, Payload: cooldownPayload})
	c.sendSafe(cooldownMessage)

	// Inventory
	if len(entity.Inventory) > 0 {
		invPayload, _ := json.Marshal(entity.Inventory)
		msg := Message{Type: MsgInventory, Payload: invPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Stash
	if len(entity.Stash) > 0 {
		stashPayload, _ := json.Marshal(entity.Stash)
		msg := Message{Type: MsgStash, Payload: stashPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Buyback list
	if len(entity.Buyback) > 0 {
		buybackPayload, _ := json.Marshal(entity.Buyback)
		msg := Message{Type: MsgBuybackList, Payload: buybackPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Quests
	if len(entity.Quests) > 0 {
		questPayload, _ := json.Marshal(entity.Quests)
		msg := Message{Type: MsgQuestUpdate, Payload: questPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Skill runes
	if len(entity.SkillRunes) > 0 {
		runesPayload, _ := json.Marshal(map[string]interface{}{
			"skillRunes": entity.SkillRunes,
		})
		msg := Message{Type: MsgSelectRune, Payload: runesPayload}
		b, _ := json.Marshal(msg)
		c.sendSafe(b)
	}

	// Dungeon instance layout (reconnect / session-resume)
	if instanceID != "" {
		layout, hasLayout := world.GetInstanceLayout(instanceID)
		if hasLayout {
			log.Printf("Sending instance layout to %s for instance %s: %d rooms", c.username, instanceID, len(layout.Rooms))
			resp := map[string]interface{}{
				"instanceId": instanceID,
				"type":       "verdant_bastion", // TODO: store dungeon type in DB when multiple types exist
				"layout":     layout,
			}
			if roomState, ok := world.GetDungeonRoomSummary(instanceID, c.playerID); ok {
				resp["roomState"] = roomState
			}
			payloadBytes, _ := json.Marshal(resp)
			instMsg := Message{Type: MsgEnterInstance, Payload: payloadBytes}
			b, _ := json.Marshal(instMsg)
			c.sendSafe(b)
		}
	}
}

func cleanupClient(client *Client) {
	// 1. Get state (fast, in-memory)
	var entity *game.Entity
	if client.playerID != "" {
		entity = world.GetEntityCopy(client.playerID)
	}

	// 2. Mark entity as disconnected instead of removing it immediately.
	//    The entity remains in the world during the resume window so a
	//    reconnecting client can pick up where it left off.
	if client.playerID != "" {
		if !world.SetEntityDisconnected(client.playerID, time.Now()) {
			// Entity was already gone (e.g. removed by the sweep); nothing to do.
			log.Printf("cleanupClient: entity %s not found in world", client.playerID)
		}
	}

	// 3. Cleanup session (fast)
	sessionsMu.Lock()
	if existing, exists := activeSessions[client.username]; exists && existing == client {
		delete(activeSessions, client.username)
	}
	sessionsMu.Unlock()

	// 4. Notify online friends that this player has gone offline (0.38.1).
	if client.username != "" {
		go notifyFriendsPresence(client.username, false)
	}

	// 5. Save to DB (slow, do async)
	if entity != nil {
		go func(c *Client, e *game.Entity) {
			saveCharacterDB(c, e)
		}(client, entity)
	}
}

func serveWs(w http.ResponseWriter, r *http.Request) {
	if !websocket.IsWebSocketUpgrade(r) {
		logSuspicious(r, "non-websocket request to /ws", nil)
		http.Error(w, "websocket upgrade required", http.StatusBadRequest)
		return
	}

	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logSuspicious(r, "websocket upgrade failed", err)
		return
	}

	client := &Client{
		conn:         c,
		send:         make(chan []byte, 256), // State traffic is lossy under pressure.
		prioritySend: make(chan []byte, 64),  // Control/UI messages must not starve behind state.
		lastState:    make(map[string]*EntitySnapshot),
		seenIDs:      make(map[string]bool),
	}
	register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Println("json unmarshal:", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	writeMessage := func(message []byte) error {
		c.conn.SetWriteDeadline(time.Now().Add(writeWait))
		msgType := websocket.TextMessage
		if len(message) > 5 && bytes.Equal(message[0:4], stateProtoMagic) {
			msgType = websocket.BinaryMessage
		}
		w, err := c.conn.NextWriter(msgType)
		if err != nil {
			return err
		}
		if _, err := w.Write(message); err != nil {
			_ = w.Close()
			return err
		}
		return w.Close()
	}

	for {
		// Give already-queued control traffic strict precedence without
		// preventing state or ping progress when the priority lane is empty.
		select {
		case message, ok := <-c.prioritySend:
			if !ok || writeMessage(message) != nil {
				return
			}
			continue
		default:
		}

		select {
		case message, ok := <-c.prioritySend:
			if !ok || writeMessage(message) != nil {
				return
			}
		case message, ok := <-c.send:
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if writeMessage(message) != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg Message) {
	switch msg.Type {
	case MsgRegister:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if err := db.CreateUser(payload.Username, payload.Email, payload.Password); err != nil {
			c.sendError("Registration failed: " + err.Error())
			return
		}
		c.sendError("Registration successful! Please login.")

	case MsgLogin:
		var payload AuthPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		success, err := db.Authenticate(payload.Username, payload.Password)
		if err != nil {
			c.sendError("Login error")
			return
		}
		if !success {
			c.sendError("Invalid credentials")
			return
		}
		c.username = payload.Username

		// Enforce single session
		sessionsMu.Lock()
		if oldClient, ok := activeSessions[c.username]; ok && oldClient != c {
			// Kick old client
			// Use a goroutine to avoid blocking and potential deadlocks if oldClient is stuck
			go func(clientToKick *Client) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Recovered from kick panic: %v", r)
					}
				}()
				clientToKick.sendError("Logged in from another location")
				// Give a small delay for the message to be sent before closing
				time.Sleep(100 * time.Millisecond)
				clientToKick.conn.Close()
			}(oldClient)
		}
		activeSessions[c.username] = c
		sessionsMu.Unlock()

		// Check for characters
		user, err := db.GetUser(c.username)
		hasCharacter := false
		characterType := ""
		if err == nil && len(user.Characters) > 0 {
			hasCharacter = true
			characterType = user.Characters[0].Class
		}

		// Issue session-resume token
		resumeToken, err := issueResumeToken(c.username)
		if err != nil {
			log.Printf("Failed to issue resume token for %s: %v", c.username, err)
			resumeToken = ""
		}

		// Send success message
		response := map[string]interface{}{
			"message":       "Login successful",
			"hasCharacter":  hasCharacter,
			"characterType": characterType,
			"resumeToken":   resumeToken,
		}
		payloadBytes, _ := json.Marshal(response)

		successMsg := Message{
			Type:    "login_success",
			Payload: payloadBytes,
		}
		data, _ := json.Marshal(successMsg)
		c.sendSafe(data)

	case MsgJoin:
		if c.username == "" {
			log.Printf("MsgJoin failed: User not logged in (Client: %s)", c.conn.RemoteAddr())
			c.sendError("Please login first")
			return
		}
		var payload JoinPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			log.Printf("MsgJoin failed: Invalid payload from %s", c.username)
			return
		}

		// Defensive re-join: clean up previous entity if this client already joined
		if c.playerID != "" {
			log.Printf("Re-join detected for %s (old playerID: %s) – removing stale entity", c.username, c.playerID)
			world.RemoveEntity(c.playerID)
			c.seenIDs = make(map[string]bool)
			c.lastState = make(map[string]*EntitySnapshot)
		}

		log.Printf("Player joining: %s (Class: %s)", c.username, payload.Type)

		// Load user from DB to check for existing character
		user, err := db.GetUser(c.username)
		if err != nil {
			c.sendError("Failed to load user data")
			return
		}

		var char *database.Character
		// Simple logic: Use the first character if it exists, otherwise create one
		// In a real game, we'd have a character selection screen
		if len(user.Characters) > 0 {
			// Find character matching the requested class if possible, or just use the first one
			// For now, let's just use the first one to support persistence
			char = user.Characters[0]
			// If the class doesn't match what they selected in UI, we might want to warn or just use the DB one
			// Let's assume the DB one is authoritative
		} else {
			// Create new character
			char = &database.Character{
				Name:  c.username, // Simple name
				Class: payload.Type,
				Level: 1,
				XP:    0,
				X:     -1.25, // Midpoint between Quest NPC (-25) and Merchant (22.5)
				Y:     0,
				Z:     200, // Town Center Z
				Stats: database.Stats{
					Strength:     10,
					Dexterity:    10,
					Intelligence: 10,
					Wisdom:       10,
					Vitality:     10,
				},
			}
			// Save new character to DB
			var err error
			if user.Characters == nil {
				// If characters array is nil/null in DB, use $set to initialize it
				err = db.SetFirstCharacter(c.username, char)
			} else {
				// Otherwise use $push
				err = db.CreateCharacter(c.username, char)
			}

			if err != nil {
				log.Printf("Failed to create character for %s: %v", c.username, err)
				c.sendError("Failed to create character")
				return
			}
		}

		// Create player entity from DB character
		playerID := "player-" + c.username
		c.playerID = playerID

		// Check if player was in an instance and logged out more than 15 minutes ago
		spawnX := char.X
		spawnY := char.Y
		spawnZ := char.Z
		instanceID := char.InstanceID

		if instanceID != "" {
			// Player was in a dungeon instance
			timeSinceLogout := time.Since(char.LastLogout)
			if timeSinceLogout > 15*time.Minute {
				// More than 15 minutes - return to town
				log.Printf("Player %s was in instance %s but logged out %v ago - returning to town", c.username, instanceID, timeSinceLogout)
				spawnX = -1.25 // Town center
				spawnY = 0
				spawnZ = 200
				instanceID = "" // Clear instance
			} else {
				// Less than 15 minutes - check if instance still exists
				_, exists := world.GetInstanceLayout(instanceID)
				if !exists {
					// Instance no longer exists - return to town
					log.Printf("Player %s was in instance %s but it no longer exists - returning to town", c.username, instanceID)
					spawnX = -1.25
					spawnY = 0
					spawnZ = 200
					instanceID = ""
				} else {
					log.Printf("Player %s reconnecting to instance %s (logged out %v ago)", c.username, instanceID, timeSinceLogout)
				}
			}
		}

		entity := &game.Entity{
			ID:             playerID,
			Name:           c.username,
			Type:           game.TypePlayer,
			SubType:        char.Class,
			X:              spawnX,
			Y:              spawnY,
			Z:              spawnZ,
			InstanceID:     instanceID,
			Health:         char.Stats.Vitality * 10,
			MaxHealth:      char.Stats.Vitality * 10,
			Mana:           char.Stats.Intelligence * 10,
			MaxMana:        char.Stats.Intelligence * 10,
			Level:          char.Level,
			Experience:     char.XP,
			MaxExperience:  int(100 * math.Pow(1.2, float64(char.Level-1))),
			Gold:           char.Gold,
			State:          "IDLE",
			Damage:         char.Stats.Strength * 2,
			Defense:        0,
			AttackCooldown: 1000 * time.Millisecond,
			Scale:          1.0,
			BaseStats: game.Stats{
				Strength:     char.Stats.Strength,
				Dexterity:    char.Stats.Dexterity,
				Intelligence: char.Stats.Intelligence,
				Wisdom:       char.Stats.Wisdom,
				Vitality:     char.Stats.Vitality,
			},
			SkillPoints:    0,
			SelectedBranch: char.SelectedBranch,
			UnlockedSkills: []string{},
		}

		// Passive talents: ranked map. Migrate legacy unlocked_talents (rank=1) if needed.
		if char.TalentRanks != nil {
			entity.TalentRanks = make(map[string]int, len(char.TalentRanks))
			for k, v := range char.TalentRanks {
				entity.TalentRanks[k] = v
			}
		} else if len(char.UnlockedTalents) > 0 {
			// Legacy migration safety:
			// Older saves may have large unlocked_talents lists that don't map cleanly to the
			// new ranked + budgeted system (1 point per 5 levels). If we blindly convert all
			// legacy unlocked IDs into ranks, players can appear to have 0 available points.
			//
			// If the legacy list exceeds the new budget, start them with a clean slate so
			// they can re-allocate under the new rules.
			budget := 0
			if entity.Level >= 5 {
				budget = entity.Level / 5
			}
			uniq := make(map[string]struct{}, len(char.UnlockedTalents))
			for _, tid := range char.UnlockedTalents {
				if tid == "" {
					continue
				}
				uniq[tid] = struct{}{}
			}
			if len(uniq) > budget {
				log.Printf("Legacy talent migration for %s: %d unlocked_talents exceeds budget %d at level %d; resetting talents to avoid 0 available points", c.username, len(uniq), budget, entity.Level)
				entity.TalentRanks = make(map[string]int)
			} else {
				entity.TalentRanks = make(map[string]int, len(uniq))
				for tid := range uniq {
					entity.TalentRanks[tid] = 1
				}
			}
		}
		// Sanitize ranks: only allow class-specific IDs and clamp to max rank.
		// TalentPoints are derived later during RecalculateStats().
		entity.NormalizeTalentRanks()
		// Helpful debug line for shipping confidence: shows what we loaded from DB.
		log.Printf("Login %s: TalentRanks=%d, TalentPoints=%d (Level=%d)", c.username, len(entity.TalentRanks), entity.TalentPoints, entity.Level)

		// Load Skill Runes
		if char.SkillRunes != nil {
			entity.SkillRunes = make(map[string]string, len(char.SkillRunes))
			for k, v := range char.SkillRunes {
				entity.SkillRunes[k] = v
			}
		}

		// Auto-Unlock Skills based on Level and Branch
		world.UpdateUnlockedSkills(entity)

		log.Printf("Login %s: Level %d, Branch %s, Unlocked %v",
			c.username, entity.Level, entity.SelectedBranch, entity.UnlockedSkills)

		// Convert DB Inventory to Game Inventory
		entity.Inventory = make([]game.Item, game.MaxInventorySize)
		if len(char.Inventory) > 0 {
			log.Printf("Loading inventory for %s: %d items", c.username, len(char.Inventory))
			// Fill slots sequentially for now (since DB doesn't store slot index)
			for i, dbItem := range char.Inventory {
				if i >= game.MaxInventorySize {
					break
				}
				// Fix for old items (Shards/Hearts missing MaxStack)
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					// Also update icon if needed
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				// Fix for old items (Missing Stack count)
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Inventory[i] = loadedItem
			}
		}

		// Convert DB Stash to Game Stash
		entity.Stash = make([]game.Item, 0)
		if len(char.Stash) > 0 {
			entity.Stash = make([]game.Item, len(char.Stash))
			for i, dbItem := range char.Stash {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Stash[i] = loadedItem
			}
		}

		// Convert DB Buyback to Game Buyback
		entity.Buyback = make([]game.Item, 0)
		if len(char.Buyback) > 0 {
			entity.Buyback = make([]game.Item, len(char.Buyback))
			for i, dbItem := range char.Buyback {
				// Fix for old items
				maxStack := dbItem.MaxStack
				if (dbItem.Name == "Shard" || dbItem.Name == "Eidolon Shard" || dbItem.Name == "Heart" || dbItem.Name == "Eidolon Heart") && maxStack == 0 {
					maxStack = 1000
				}

				// Migration: Rename "Heart" to "Eidolon Heart"
				name := dbItem.Name
				if name == "Heart" {
					name = "Eidolon Heart"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/heart.png" {
						dbItem.Icon = "assets/items/eidolon_heart/eidolon_heart.png"
					}
				}
				// Migration: Rename "Shard" to "Eidolon Shard"
				if name == "Shard" {
					name = "Eidolon Shard"
					if dbItem.Icon == "" || dbItem.Icon == "assets/items/shard.png" {
						dbItem.Icon = "assets/items/eidolon_shard/eidolon_shard.png"
					}
				}

				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}

				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         maxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Buyback[i] = loadedItem
			}
		}

		// Convert DB Equipment to Game Equipment
		entity.Equipment = make(map[string]game.Item)
		if len(char.Equipment) > 0 {
			for slot, dbItem := range char.Equipment {
				stack := dbItem.Stack
				if stack == 0 {
					stack = 1
				}
				loadedItem := game.Item{
					ID:               dbItem.ID,
					Name:             dbItem.Name,
					Type:             game.ItemType(dbItem.Type),
					Rarity:           game.ItemRarity(dbItem.Rarity),
					Slot:             dbItem.Slot,
					Level:            dbItem.Level,
					Value:            dbItem.Value,
					Icon:             dbItem.Icon,
					Description:      dbItem.Description,
					Stats:            dbItem.Stats,
					Stack:            stack,
					MaxStack:         dbItem.MaxStack,
					Potency:          dbItem.Potency,
					Sockets:          dbItem.Sockets,
					Gems:             socketedGemsFromDatabase(dbItem.Gems),
					SetID:            dbItem.SetID,
					UniqueEffect:     dbItem.UniqueEffect,
					GemType:          game.GemType(dbItem.GemType),
					GemQuality:       game.GemQuality(dbItem.GemQuality),
					StatScaleVersion: dbItem.StatScaleVersion,
				}
				game.NormalizeItemStatScale(&loadedItem)
				entity.Equipment[slot] = loadedItem
			}
		}

		// Convert DB Quests to Game Quests
		if len(char.Quests) > 0 {
			entity.Quests = make([]game.Quest, len(char.Quests))
			for i, q := range char.Quests {
				entity.Quests[i] = game.Quest{
					ID:        q.ID,
					Type:      q.Type,
					Target:    q.Target,
					Count:     q.Count,
					MaxCount:  q.MaxCount,
					RewardXP:  q.RewardXP,
					Completed: q.Completed,
					Accepted:  q.Accepted,
				}
			}
		}
		entity.LastDailyQuest = char.LastDailyQuest

		// Fix for persistence issue: If we have quests but no date (or zero date), assume they are valid for today to prevent reset
		if len(entity.Quests) > 0 && entity.LastDailyQuest.IsZero() {
			log.Printf("Restoring LastDailyQuest for %s (was zero, setting to Now)", c.username)
			entity.LastDailyQuest = time.Now().UTC()
		}

		entity.RecalculateStats()
		world.AddEntity(entity)

		// Attempt to rejoin the persisted party (0.37.1).
		// The party may no longer exist (all members left / server restart) — fail silently.
		if char.PartyID != "" {
			if err := world.RejoinParty(playerID, char.PartyID); err != nil {
				log.Printf("Party rejoin for %s (party %s) skipped: %v", c.username, char.PartyID, err)
			} else {
				log.Printf("Player %s rejoined party %s on login", c.username, char.PartyID)
			}
		}

		// Generate Daily Quests if needed
		world.GenerateDailyQuests(playerID)

		sendInitialPlayerState(c, entity, instanceID)
		// Notify online friends that this player has come online (0.38.1).
		go notifyFriendsPresence(c.username, true)

	case MsgEnterDungeon:
		if c.playerID == "" {
			return
		}

		var req struct {
			DungeonType string `json:"dungeonType"`
			Difficulty  string `json:"difficulty"`
			RunLevel    int    `json:"runLevel"`
		}
		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &req)
		}
		dungeonType := req.DungeonType
		if dungeonType == "" {
			dungeonType = "crypt"
		}

		// Parse difficulty
		difficulty := game.DifficultyNormal
		switch req.Difficulty {
		case "heroic":
			difficulty = game.DifficultyHeroic
		case "mythic":
			difficulty = game.DifficultyMythic
		}

		player := world.GetEntityCopy(c.playerID)
		if player == nil {
			return
		}

		if player.PartyID == "" {
			c.sendError("You must be in a party to enter a dungeon.")
			return
		}

		runLevel := req.RunLevel
		if runLevel == 0 {
			runLevel = game.DungeonUnlockLevel
		}
		if err := game.ValidateDungeonEntrySelection(player.Level, runLevel, difficulty); err != nil {
			c.sendError(err.Error())
			return
		}

		// Create Dungeon
		log.Printf("Creating dungeon for party %s (Player: %s, Difficulty: %s, RunLevel: %d)", player.PartyID, c.playerID, difficulty, runLevel)
		instanceID := world.CreateDungeon(player.PartyID, dungeonType, difficulty, runLevel)
		log.Printf("Dungeon created: %s", instanceID)
		// c.sendError(fmt.Sprintf("Debug: Dungeon Created %s", instanceID))

		// Get Party
		party := world.GetParty(player.PartyID)
		if party == nil {
			c.sendError("Debug: Party not found")
			return
		}

		// Get members safely
		_, _, members := party.GetSnapshot()

		for _, memberID := range members {
			err := world.EnterInstance(memberID, instanceID)
			if err != nil {
				// c.sendError(fmt.Sprintf("Debug: EnterInstance failed for %s: %v", memberID, err))
				continue
			}

			// Notify Client
			sessionsMu.Lock()
			var memberClient *Client
			for _, mc := range activeSessions {
				if mc.playerID == memberID {
					memberClient = mc
					break
				}
			}
			sessionsMu.Unlock()

			if memberClient != nil {
				layout, hasLayout := world.GetInstanceLayout(instanceID)
				if hasLayout {
					log.Printf("Sending layout to %s: %d rooms", memberID, len(layout.Rooms))
				} else {
					log.Printf("Sending NO layout to %s", memberID)
				}

				resp := map[string]interface{}{
					"instanceId": instanceID,
					"type":       dungeonType,
				}
				if hasLayout {
					resp["layout"] = layout
				}
				if roomState, ok := world.GetDungeonRoomSummary(instanceID, memberID); ok {
					resp["roomState"] = roomState
				}
				payloadBytes, _ := json.Marshal(resp)

				msg := Message{
					Type:    MsgEnterInstance,
					Payload: payloadBytes,
				}
				b, _ := json.Marshal(msg)
				memberClient.sendSafe(b)
				// memberClient.sendError("Debug: Sent EnterInstance")
				// Auto-set social status: in_run (0.37.4)
				autoSetSocialStatus(memberClient, memberID, "in_run")
			}
		}

	case MsgGetDungeonStatus:
		if c.playerID == "" {
			return
		}

		var statusReq struct {
			DungeonType string `json:"dungeonType"`
		}
		if len(msg.Payload) > 0 {
			_ = json.Unmarshal(msg.Payload, &statusReq)
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil {
			return
		}

		// Auto-create party for solo players
		if player.PartyID == "" {
			party := world.CreateParty(c.playerID)
			if party != nil {
				broadcastPartyUpdate(party)
				// Update local player copy's PartyID
				player.PartyID = party.ID
			} else {
				// Check if failure was due to race condition (already in party)
				updatedPlayer := world.GetEntityCopy(c.playerID)
				if updatedPlayer != nil && updatedPlayer.PartyID != "" {
					player.PartyID = updatedPlayer.PartyID
				} else {
					// DEBUG: Detailed failure reason
					exists := false
					pid := "nil"
					if updatedPlayer != nil {
						exists = true
						pid = updatedPlayer.PartyID
					}
					c.sendError(fmt.Sprintf("Failed to create party. Exists: %v, PID: %s, ID: %s", exists, pid, c.playerID))
					return
				}
			}
		}

		hasInstance, timeLeft := world.GetDungeonStatus(player.PartyID)

		// Check if leader
		party := world.GetParty(player.PartyID)
		isLeader := false
		if party != nil {
			leaderID, _, _ := party.GetSnapshot()
			isLeader = (leaderID == c.playerID)
		}

		resp := map[string]interface{}{
			"hasInstance":                  hasInstance,
			"timeLeft":                     timeLeft,
			"isLeader":                     isLeader,
			"playerLevel":                  player.Level,
			"maxPlayerLevel":               game.MaxPlayerLevel,
			"dungeonUnlockLevel":           game.DungeonUnlockLevel,
			"endgameDifficultyUnlockLevel": game.EndgameDifficultyUnlockLevel,
			"availableRunLevels":           game.AvailableDungeonRunLevelsForPlayer(player.Level),
		}
		if statusReq.DungeonType != "" {
			resp["dungeonType"] = statusReq.DungeonType
		}
		payloadBytes, _ := json.Marshal(resp)
		log.Printf("Sending Dungeon Menu to %s: %+v", c.username, resp)
		c.sendSafe(createMessage(MsgGetDungeonStatus, payloadBytes))
		// c.sendError(fmt.Sprintf("Debug: Menu Data Sent. Party: %s, Leader: %v", player.PartyID, isLeader))

	case MsgResetDungeon:
		if c.playerID == "" {
			return
		}
		player := world.GetEntityCopy(c.playerID)
		if player == nil || player.PartyID == "" {
			return
		}

		party := world.GetParty(player.PartyID)
		if party == nil {
			return
		}
		leaderID, _, _ := party.GetSnapshot()
		if leaderID != c.playerID {
			c.sendError("Only the party leader can reset the dungeon.")
			return
		}

		world.ResetDungeon(player.PartyID)
		c.sendError("Dungeon reset.") // Using sendError for notification for now

	case MsgResumeSession:
		// Client sends: { "token": "<64-char hex>" }
		var payload struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil || payload.Token == "" {
			c.sendError("Invalid resume_session payload")
			return
		}

		username, ok := validateAndConsumeResumeToken(payload.Token)
		if !ok {
			c.sendError("Session token invalid or expired. Please log in again.")
			return
		}

		// Clear the disconnected flag; this also returns the live entity pointer.
		playerID := "player-" + username
		entity, ok := world.ClearEntityDisconnected(playerID)
		if !ok {
			// Entity already swept or was never disconnected — fall back to normal login.
			c.sendError("No resumable session found. Please log in and join normally.")
			return
		}

		// Bind this new client to the existing entity.
		c.username = username
		c.playerID = playerID

		sessionsMu.Lock()
		// Kick any stale session for this username (shouldn't exist, but be safe).
		if old, exists := activeSessions[username]; exists && old != c {
			go func(old *Client) {
				defer func() { recover() }()
				old.sendError("Logged in from another location")
				time.Sleep(100 * time.Millisecond)
				old.conn.Close()
			}(old)
		}
		activeSessions[username] = c
		sessionsMu.Unlock()

		// Issue a fresh resume token for the next disconnect.
		newToken, err := issueResumeToken(username)
		if err != nil {
			log.Printf("Failed to re-issue resume token for %s: %v", username, err)
			newToken = ""
		}

		// Notify the client that the session resumed successfully.
		resumeResp := map[string]interface{}{
			"playerID":    playerID,
			"resumeToken": newToken,
		}
		resumePayload, _ := json.Marshal(resumeResp)
		resumeMsg := Message{Type: MsgResumeSession, Payload: resumePayload}
		b, _ := json.Marshal(resumeMsg)
		c.sendSafe(b)

		// Re-send all initial state so the client can repopulate its UI.
		world.GenerateDailyQuests(playerID)
		instanceID := entity.InstanceID
		sendInitialPlayerState(c, entity, instanceID)

		log.Printf("Session resumed: %s (playerID: %s)", username, playerID)

	case MsgMove:
		if c.playerID == "" {
			return
		}
		var payload MovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		// Authoritative movement validation should happen here
		// For now, trust client but update world state

		// Check for respawn immunity first
		if e := world.GetEntity(c.playerID); e != nil {
			e.Mu.RLock()
			lastRespawnTime := e.LastRespawnTime
			moveLockUntil := e.MoveLockUntil
			state := e.State
			x, z := e.X, e.Z
			e.Mu.RUnlock()
			if time.Since(lastRespawnTime) < 1*time.Second {
				return
			}
			if time.Now().Before(moveLockUntil) {
				return
			}
			if state == "JUMPING" {
				return
			}

			// Basic distance validation to prevent teleporting across map due to lag/race conditions
			// e.g. Client sends (0,0) after server moved player to (20000, 20000)
			dx := payload.X - x
			dz := payload.Z - z
			distSq := dx*dx + dz*dz
			if distSq > 100*100 { // 100 units max jump per frame
				// Ignore this move packet, it's likely from the previous context
				// log.Printf("Ignored large move for %s: distSq=%f", c.playerID, distSq)
				return
			}
		}

		world.UpdatePlayerMovement(
			c.playerID,
			payload.X,
			payload.Y,
			payload.Z,
			payload.Rotation,
			payload.State,
			payload.Sequence,
		)

	case MsgJump:
		if c.playerID == "" {
			return
		}
		var payload JumpPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if e := world.GetEntity(c.playerID); e != nil {
			e.Mu.RLock()
			lastRespawnTime := e.LastRespawnTime
			moveLockUntil := e.MoveLockUntil
			e.Mu.RUnlock()
			if time.Since(lastRespawnTime) < 1*time.Second {
				return
			}
			if time.Now().Before(moveLockUntil) {
				return
			}
		}
		world.StartPlayerJump(c.playerID, payload.X, payload.Y, payload.Z)

	case MsgAttack:
		if c.playerID == "" {
			return
		}
		var payload AttackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		world.PerformAttack(c.playerID, payload.TargetID)
		// Damage is now broadcast via OnEvent("damage") asynchronously

	case MsgPickup:
		if c.playerID == "" {
			return
		}
		var payload PickupPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, reason := world.PerformPickup(c.playerID, payload.LootID)
		if success {
			// Send inventory update to player
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			savePlayer(c)
		} else if reason == "inventory_full" {
			c.sendError("Inventory full")
		}

	case MsgAbility:
		if c.playerID == "" {
			return
		}
		var payload AbilityPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		result := world.PerformAbility(c.playerID, payload.TargetX, payload.TargetZ, payload.TargetID, payload.SkillName)
		resultPayload, _ := json.Marshal(result)
		resultMessage, _ := json.Marshal(Message{Type: MsgAbilityResult, Payload: resultPayload})
		c.sendSafe(resultMessage)

	case MsgChat:
		if c.username == "" {
			return
		}
		var payload ChatPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if handled := c.handleChatCommand(strings.TrimSpace(payload.Message)); handled {
			return
		}

		// Broadcast chat
		outPayload := ChatPayload{
			Message: payload.Message,
			Sender:  c.username,
			Channel: "global",
		}
		b, _ := json.Marshal(outPayload)
		outMsg := Message{
			Type:    MsgChat,
			Payload: b,
		}
		data, _ := json.Marshal(outMsg)
		broadcast <- BroadcastMessage{Type: MsgChat, Data: data}

	case MsgEquip:
		if c.playerID == "" {
			return
		}
		var payload EquipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformEquip(c.playerID, payload.ItemID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgUnequip:
		if c.playerID == "" {
			return
		}
		var payload UnequipPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformUnequip(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgInventoryMove:
		if c.playerID == "" {
			return
		}
		var payload InventoryMovePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformInventoryMove(c.playerID, payload.FromIndex, payload.ToIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgInventorySort:
		if c.playerID == "" {
			return
		}

		player, success := world.PerformInventorySort(c.playerID)
		if success {
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSplitStack:
		if c.playerID == "" {
			return
		}
		var payload SplitStackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSplitStack(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgTradingSearch:
		handleMsgTradingSearch(c, msg)

	case MsgTradingMyAuctions:
		handleMsgTradingMyAuctions(c, msg)

	case MsgTradingCreate:
		handleMsgTradingCreate(c, msg)

	case MsgTradingBid:
		handleMsgTradingBid(c, msg)

	case MsgTradingBuyout:
		handleMsgTradingBuyout(c, msg)

	case MsgTradingCollect:
		handleMsgTradingCollect(c, msg)

	case MsgTradingCancel:
		handleMsgTradingCancel(c, msg)

	case MsgBuyGamble:
		if c.playerID == "" {
			return
		}
		var payload BuyGamblePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyGamble(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgSell:
		if c.playerID == "" {
			return
		}
		var payload SellPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformSell(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgBuyback:
		if c.playerID == "" {
			return
		}
		var payload BuybackPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformBuyback(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Buyback Update
			buybackPayload, _ := json.Marshal(player.Buyback)
			msgBuyback := Message{
				Type:    MsgBuybackList,
				Payload: buybackPayload,
			}
			bBuyback, _ := json.Marshal(msgBuyback)
			c.sendSafe(bBuyback)
		}

	case MsgPartyInvite:
		handleMsgPartyInvite(c, msg)

	case MsgPartyResponse:
		handleMsgPartyResponse(c, msg)

	case MsgPartyLeave:
		handleMsgPartyLeave(c, msg)

	case MsgPartyKick:
		handleMsgPartyKick(c, msg)

	case MsgPartyPromote:
		handleMsgPartyPromote(c, msg)

	case MsgSocial:
		handleMsgSocial(c, msg)

	case MsgSocialStatus:
		handleMsgSocialStatus(c, msg)

	// ── Friends (0.38) ──────────────────────────────────────────────────────────

	case MsgFriendList:
		handleMsgFriendList(c, msg)

	case MsgFriendRequest:
		handleMsgFriendRequest(c, msg)

	case MsgFriendAccept:
		handleMsgFriendAccept(c, msg)

	case MsgFriendDecline:
		handleMsgFriendDecline(c, msg)

	case MsgFriendRemove:
		handleMsgFriendRemove(c, msg)

	case MsgRespawn:
		if c.playerID == "" {
			return
		}

		// Check if in instance before respawn resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		world.PerformRespawn(c.playerID)

		if wasInInstance {
			log.Printf("Respawn: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			// Auto-revert social status: available (0.37.4)
			autoSetSocialStatus(c, c.playerID, "available")
		}

	case MsgRecall:
		if c.playerID == "" {
			return
		}

		// Check if in instance before recall resets it
		p := world.GetEntity(c.playerID)
		wasInInstance := p != nil && p.InstanceID != ""

		world.PerformRecall(c.playerID)

		if wasInInstance {
			log.Printf("Recall: Sending return to overworld for %s", c.playerID)
			// Send "return to overworld" message
			resp := map[string]interface{}{
				"instanceId": "",
				"type":       "overworld",
			}
			payloadBytes, _ := json.Marshal(resp)
			msg := Message{
				Type:    MsgEnterInstance,
				Payload: payloadBytes,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
			// Auto-revert social status: available (0.37.4)
			autoSetSocialStatus(c, c.playerID, "available")
		}

	case MsgReport:
		var payload ReportPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		saveReport(c.username, payload)

	case MsgStashDeposit:
		if c.playerID == "" {
			return
		}
		var payload StashDepositPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashDeposit(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgStashWithdraw:
		if c.playerID == "" {
			return
		}
		var payload StashWithdrawPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformStashWithdraw(c.playerID, payload.ItemID)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)

			// Send Stash Update
			stashPayload, _ := json.Marshal(player.Stash)
			msgStash := Message{
				Type:    MsgStash,
				Payload: stashPayload,
			}
			bStash, _ := json.Marshal(msgStash)
			c.sendSafe(bStash)
		}

	case MsgRequestQuests:
		if c.playerID == "" {
			return
		}
		player := world.GenerateDailyQuests(c.playerID)
		if player != nil {
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{Type: MsgQuestUpdate, Payload: questPayload}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgAcceptQuest:
		if c.playerID == "" {
			return
		}
		var payload AcceptQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformAcceptQuest(c.playerID, payload.QuestID)
		if success {
			// Send Quest Update
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgCompleteQuest:
		if c.playerID == "" {
			return
		}
		var payload CompleteQuestPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success := world.PerformCompleteQuest(c.playerID, payload.QuestID)
		if success {
			// Send Quest Update
			questPayload, _ := json.Marshal(player.Quests)
			msg := Message{
				Type:    MsgQuestUpdate,
				Payload: questPayload,
			}
			b, _ := json.Marshal(msg)
			c.sendSafe(b)
		}

	case MsgForgeUpgrade:
		if c.playerID == "" {
			return
		}
		var payload ForgeUpgradePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeUpgrade(c.playerID, payload.Slot, payload.Amount)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgePotency:
		if c.playerID == "" {
			return
		}
		var payload ForgePotencyPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgePotency(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeSocket:
		if c.playerID == "" {
			return
		}
		var payload ForgeSocketPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeSocket(c.playerID, payload.Slot)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeInsertGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeInsertGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeInsertGem(c.playerID, payload.EquipSlot, payload.GemInvIndex, payload.SocketIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem insertion
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeCombineGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeCombineGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeCombineGems(c.playerID, payload.GemIndices)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem combining
		} else {
			c.sendError(msgStr)
		}

	case MsgForgeRemoveGem:
		if c.playerID == "" {
			return
		}
		var payload ForgeRemoveGemPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		player, success, msgStr := world.PerformForgeRemoveGem(c.playerID, payload.EquipSlot, payload.SocketIndex)
		if success {
			// Send Inventory Update
			invPayload, _ := json.Marshal(player.Inventory)
			msgInv := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			bInv, _ := json.Marshal(msgInv)
			c.sendSafe(bInv)
			savePlayer(c) // Persist gem removal
		} else {
			c.sendError(msgStr)
		}

	case MsgSelectBranch:
		if c.playerID == "" {
			return
		}
		var payload SelectBranchPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformSelectBranch(c.playerID, payload.Branch); success {
			savePlayer(c) // Persist immediately
		}

	case MsgUnlockSkill:
		if c.playerID == "" {
			return
		}
		var payload UnlockSkillPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success := world.PerformUnlockSkill(c.playerID, payload.SkillName); success {
			savePlayer(c) // Persist immediately
		}

	case MsgUnlockTalent:
		if c.playerID == "" {
			return
		}
		var payload UnlockTalentPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}
		if _, success, msgStr := world.PerformUnlockTalent(c.playerID, payload.TalentId); success {
			savePlayer(c) // Persist immediately
		} else {
			c.sendError(msgStr)
		}

	case MsgResetTalents:
		if c.playerID == "" {
			return
		}
		if _, success, msgStr := world.PerformResetTalents(c.playerID); success {
			savePlayer(c) // Persist immediately
		} else {
			c.sendError(msgStr)
		}

	case MsgRespec:
		if c.playerID == "" {
			return
		}
		var payload RespecPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendError("Invalid respec payload")
			return
		}
		if player, success, msgStr := world.PerformRespec(c.playerID, payload.RespecType); success {
			// Send Inventory Update (includes gold)
			player.Mu.RLock()
			invPayload, _ := json.Marshal(player.Inventory)
			player.Mu.RUnlock()
			invMsg := Message{
				Type:    MsgInventory,
				Payload: invPayload,
			}
			b, _ := json.Marshal(invMsg)
			c.sendSafe(b)
			savePlayer(c) // Persist immediately
		} else {
			c.sendError(msgStr)
		}

	case MsgRespecCost:
		if c.playerID == "" {
			return
		}
		var payload RespecPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendError("Invalid respec payload")
			return
		}
		cost := world.GetRespecCost(c.playerID, payload.RespecType)
		// Send cost response
		response := map[string]interface{}{
			"type":      payload.RespecType,
			"cost":      cost,
			"canAfford": false,
		}
		if player := world.GetEntity(c.playerID); player != nil {
			player.Mu.RLock()
			response["canAfford"] = player.Gold >= cost
			player.Mu.RUnlock()
		}
		respBytes, _ := json.Marshal(response)
		costMsg := Message{
			Type:    MsgRespecCost,
			Payload: respBytes,
		}
		msgBytes, _ := json.Marshal(costMsg)
		c.sendSafe(msgBytes)

	case MsgSelectRune:
		if c.playerID == "" {
			return
		}
		var payload struct {
			Skill  string `json:"skill"`
			RuneID string `json:"runeId"` // Empty string to unequip
		}
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			c.sendError("Invalid rune payload")
			return
		}

		player := world.GetEntity(c.playerID)
		if player == nil {
			return
		}

		player.Mu.Lock()
		// Validate the rune if one is being equipped
		if payload.RuneID != "" {
			runeDef, ok := game.GetRuneDef(payload.RuneID)
			if !ok {
				player.Mu.Unlock()
				c.sendError("Invalid rune ID")
				return
			}
			// Check level requirement
			if player.Level < runeDef.UnlockLevel {
				player.Mu.Unlock()
				c.sendError(fmt.Sprintf("You need to be level %d to use this rune", runeDef.UnlockLevel))
				return
			}
			// Check that the rune matches the skill
			if runeDef.Skill != payload.Skill {
				player.Mu.Unlock()
				c.sendError("This rune doesn't work with that skill")
				return
			}
			// Verify player has this skill unlocked
			hasSkill := false
			for _, s := range player.UnlockedSkills {
				if s == payload.Skill {
					hasSkill = true
					break
				}
			}
			if !hasSkill {
				player.Mu.Unlock()
				c.sendError("You don't have this skill unlocked")
				return
			}
		}

		// Initialize map if needed
		if player.SkillRunes == nil {
			player.SkillRunes = make(map[string]string)
		}

		// Set or clear the rune
		if payload.RuneID == "" {
			delete(player.SkillRunes, payload.Skill)
		} else {
			player.SkillRunes[payload.Skill] = payload.RuneID
		}
		player.Mu.Unlock()

		// Send updated runes to client
		player.Mu.RLock()
		runesPayload, _ := json.Marshal(map[string]interface{}{
			"skillRunes": player.SkillRunes,
		})
		player.Mu.RUnlock()
		runeMsg := Message{
			Type:    MsgSelectRune,
			Payload: runesPayload,
		}
		b, _ := json.Marshal(runeMsg)
		c.sendSafe(b)
		savePlayer(c)

	case MsgGetRunes:
		if c.playerID == "" {
			return
		}
		player := world.GetEntity(c.playerID)
		if player == nil {
			return
		}

		player.Mu.RLock()
		classType := player.SubType
		level := player.Level
		equippedRunes := player.SkillRunes
		player.Mu.RUnlock()

		// Get all available runes for this class
		allRunes := game.GetAllRunesForClass(classType)
		unlockedRunes := game.GetUnlockedRunes(classType, level)

		response := map[string]interface{}{
			"allRunes":      allRunes,
			"unlockedRunes": unlockedRunes,
			"equippedRunes": equippedRunes,
		}
		respBytes, _ := json.Marshal(response)
		runeMsg := Message{
			Type:    MsgGetRunes,
			Payload: respBytes,
		}
		msgBytes, _ := json.Marshal(runeMsg)
		c.sendSafe(msgBytes)
	}
}

func (c *Client) handleChatCommand(raw string) bool {
	if raw == "" || !strings.HasPrefix(raw, "/") {
		return false
	}

	fields := strings.Fields(raw)
	if len(fields) == 0 {
		return false
	}

	switch fields[0] {
	case "/level":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 {
			c.sendError("Usage: /level <1-100>")
			return true
		}

		level, err := strconv.Atoi(fields[1])
		if err != nil || level < 1 || level > game.MaxPlayerLevel {
			c.sendError(fmt.Sprintf("Usage: /level <1-%d>", game.MaxPlayerLevel))
			return true
		}
		if c.playerID == "" || world == nil {
			c.sendError("No active character to level.")
			return true
		}

		player, ok := world.SetPlayerLevel(c.playerID, level)
		if !ok || player == nil {
			c.sendError("No active character to level.")
			return true
		}

		if db != nil {
			char, err := db.GetCharacter(c.username, c.username)
			if err == nil && char != nil {
				char.Level = player.Level
				char.XP = player.Experience
				char.SkillPoints = player.SkillPoints
				char.SelectedBranch = player.SelectedBranch
				char.UnlockedSkills = append([]string(nil), player.UnlockedSkills...)
				char.Stats = database.Stats{
					Vitality:     player.BaseStats.Vitality,
					Strength:     player.BaseStats.Strength,
					Dexterity:    player.BaseStats.Dexterity,
					Intelligence: player.BaseStats.Intelligence,
					Wisdom:       player.BaseStats.Wisdom,
				}
				if err := db.SaveCharacter(c.username, char); err != nil {
					log.Printf("Failed to persist /level for %s: %v", c.username, err)
				}
			}
		}

		c.sendSystemChat(fmt.Sprintf("Level set to %d.", level))
		return true
	case "/qa-waypoint":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 || (!strings.EqualFold(fields[1], "combat") &&
			!strings.EqualFold(fields[1], "encounter") && !strings.EqualFold(fields[1], "verdant")) {
			c.sendError("Usage: /qa-waypoint <combat|encounter|verdant>")
			return true
		}
		if c.playerID == "" || world == nil {
			c.sendError("No active overworld character for QA waypoint.")
			return true
		}

		if _, ok := world.MovePlayerToQAWaypoint(c.playerID, fields[1]); !ok {
			c.sendError("No active overworld character for QA waypoint.")
			return true
		}

		if strings.EqualFold(fields[1], "combat") {
			c.sendSystemChat("QA waypoint set outside the east town gate; protection active for 5 minutes.")
		} else if strings.EqualFold(fields[1], "encounter") {
			c.sendSystemChat("QA waypoint set near a live overworld encounter; protection active for 5 minutes.")
		} else {
			c.sendSystemChat("QA waypoint set near Verdant Bastion; protection active for 5 minutes.")
		}
		return true
	case "/qa-loot-next":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 1 {
			c.sendError("Usage: /qa-loot-next")
			return true
		}
		if c.playerID == "" || world == nil || !world.ArmPlayerQAGuaranteedLoot(c.playerID) {
			c.sendError("No active character for QA loot check.")
			return true
		}

		c.sendSystemChat("Next enemy kill will produce a QA loot drop.")
		return true
	case "/qa-animation-ready":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		lowHealth := len(fields) == 2 && strings.EqualFold(fields[1], "low-health")
		persistent := len(fields) == 2 && strings.EqualFold(fields[1], "persistent")
		nearDeath := len(fields) == 2 && strings.EqualFold(fields[1], "near-death")
		if len(fields) > 2 || (len(fields) == 2 && !lowHealth && !persistent && !nearDeath) {
			c.sendError("Usage: /qa-animation-ready [low-health|persistent|near-death]")
			return true
		}
		if c.playerID == "" || world == nil || !world.PreparePlayerForAnimationQA(c.playerID, lowHealth, persistent, nearDeath) {
			c.sendError("No active character for animation readiness.")
			return true
		}

		message := "Animation QA readiness restored."
		if lowHealth {
			message = "Animation QA readiness restored at low health."
		} else if persistent {
			message = "Animation QA readiness restored for persistent-effect reconstruction."
		} else if nearDeath {
			message = "Animation QA readiness restored at one health for hostile death validation."
		}
		c.sendSystemChat(message)
		payload, _ := json.Marshal(map[string]bool{
			"lowHealth":  lowHealth,
			"persistent": persistent,
			"nearDeath":  nearDeath,
		})
		c.sendSafe(createMessage(MsgQAAnimationReady, payload))
		return true
	case "/qa-protection":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 2 || !strings.EqualFold(fields[1], "off") {
			c.sendError("Usage: /qa-protection off")
			return true
		}
		if c.playerID == "" || world == nil || !world.DisablePlayerQAProtection(c.playerID) {
			c.sendError("No active character for QA protection control.")
			return true
		}

		c.sendSystemChat("QA waypoint protection disabled; hostile damage is authoritative.")
		return true
	case "/qa-disconnect":
		if !isQAUsername(c.username) {
			c.sendError("QA command unavailable for this account.")
			return true
		}
		if len(fields) != 1 {
			c.sendError("Usage: /qa-disconnect")
			return true
		}

		c.sendSystemChat("QA reconnect fault scheduled.")
		c.triggerQADisconnect()
		return true
	default:
		return false
	}
}

func (c *Client) triggerQADisconnect() {
	if c.qaDisconnect != nil {
		c.qaDisconnect()
		return
	}
	if c.conn == nil {
		return
	}

	conn := c.conn
	go func() {
		// Let writePump flush the system chat before the server creates a real
		// transport interruption. NetworkManager must then resume the session.
		time.Sleep(150 * time.Millisecond)
		_ = conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseGoingAway, "QA reconnect fault"),
			time.Now().Add(time.Second),
		)
		_ = conn.Close()
	}()
}

func (c *Client) sendSystemChat(message string) {
	payload, _ := json.Marshal(ChatPayload{Message: message, Sender: "System", Channel: "server"})
	msg, _ := json.Marshal(Message{Type: MsgChat, Payload: payload})
	c.sendSafe(msg)
}

func (c *Client) sendSafe(data []byte) {
	defer func() {
		if r := recover(); r != nil {
			// Channel closed, client disconnected
		}
	}()
	if c.prioritySend != nil {
		c.prioritySend <- data
		return
	}
	c.send <- data
}

func (c *Client) sendError(msg string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from sendError panic: %v", r)
		}
	}()
	m := Message{
		Type:    MsgError,
		Payload: json.RawMessage(`"` + msg + `"`),
	}
	b, _ := json.Marshal(m)
	c.sendSafe(b)
}

// entityToSnapshot extracts fields we track for delta comparison
func socketedGemsFromDatabase(gems []database.SocketedGem) []game.SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]game.SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, game.SocketedGem{
			Type:    game.GemType(gem.Type),
			Quality: game.GemQuality(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func socketedGemsToDatabase(gems []game.SocketedGem) []database.SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]database.SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, database.SocketedGem{
			Type:    string(gem.Type),
			Quality: string(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func entityToSnapshot(e *game.Entity) *EntitySnapshot {
	if e == nil {
		return nil
	}

	e.Mu.RLock()
	keys := 0
	spent := 0
	for tid, r := range e.TalentRanks {
		nr, ok := game.NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		keys++
		spent += nr
	}
	derivedTalentPoints := 0
	if e.Level >= 5 {
		derivedTalentPoints = (e.Level / 5) - spent
		if derivedTalentPoints < 0 {
			derivedTalentPoints = 0
		}
	}
	stunDuration := 0.0
	if e.Stunned {
		stunDuration = time.Until(e.StunEndTime).Seconds()
		if stunDuration < 0 {
			stunDuration = 0
		}
	}
	slowDuration := 0.0
	if e.Slowed {
		slowDuration = time.Until(e.SlowEndTime).Seconds()
		if slowDuration < 0 {
			slowDuration = 0
		}
	}
	rootDuration := 0.0
	if e.Rooted {
		rootDuration = time.Until(e.RootEndTime).Seconds()
		if rootDuration < 0 {
			rootDuration = 0
		}
	}
	bleedDuration := 0.0
	bleedDamage := 0
	if e.Bleeding {
		bleedDuration = time.Until(e.BleedEndTime).Seconds()
		if bleedDuration < 0 {
			bleedDuration = 0
		}
		if e.BleedDamage > 0 {
			bleedDamage = e.BleedDamage
		}
	}
	poisonDuration := 0.0
	poisonDamage := 0
	if e.Poisoned {
		poisonDuration = time.Until(e.PoisonEndTime).Seconds()
		if poisonDuration < 0 {
			poisonDuration = 0
		}
		if e.PoisonDamage > 0 {
			poisonDamage = e.PoisonDamage
		}
	}
	weakPointDuration := 0.0
	if e.WeakPointMarked {
		weakPointDuration = time.Until(e.WeakPointEndTime).Seconds()
		if weakPointDuration < 0 {
			weakPointDuration = 0
		}
	}
	markWeaknessDuration := 0.0
	if e.MarkWeakness {
		markWeaknessDuration = time.Until(e.MarkWeaknessEndTime).Seconds()
		if markWeaknessDuration < 0 {
			markWeaknessDuration = 0
		}
	}
	spiritDuration := 0.0
	if e.SpiritsActive {
		spiritDuration = time.Until(e.SpiritEndTime).Seconds()
		if spiritDuration < 0 {
			spiritDuration = 0
		}
	}
	blessingResolveDuration := 0.0
	if e.BlessingResolveActive {
		blessingResolveDuration = time.Until(e.BlessingResolveEndTime).Seconds()
		if blessingResolveDuration < 0 {
			blessingResolveDuration = 0
		}
	}
	timeWarpDuration := 0.0
	if e.TimeWarpActive {
		timeWarpDuration = time.Until(e.TimeWarpEndTime).Seconds()
		if timeWarpDuration < 0 {
			timeWarpDuration = 0
		}
	}
	guardianEmbraceDuration := 0.0
	if e.GuardianEmbraceActive {
		guardianEmbraceDuration = time.Until(e.GuardianEmbraceEndTime).Seconds()
		if guardianEmbraceDuration < 0 {
			guardianEmbraceDuration = 0
		}
	}
	arcaneShieldDuration := 0.0
	if e.ArcaneShieldActive && e.ArcaneShieldHP > 0 {
		arcaneShieldDuration = time.Until(e.ArcaneShieldEndTime).Seconds()
		if arcaneShieldDuration < 0 {
			arcaneShieldDuration = 0
		}
	}
	divineInterventionDuration := 0.0
	if e.DivineInterventionActive {
		divineInterventionDuration = time.Until(e.DivineInterventionEndTime).Seconds()
		if divineInterventionDuration < 0 {
			divineInterventionDuration = 0
		}
	}
	spellFocusDuration := 0.0
	if e.SpellFocusActive {
		spellFocusDuration = time.Until(e.SpellFocusEndTime).Seconds()
		if spellFocusDuration < 0 {
			spellFocusDuration = 0
		}
	}
	swiftDuration := 0.0
	if e.SwiftActive {
		swiftDuration = time.Until(e.SwiftEndTime).Seconds()
		if swiftDuration < 0 {
			swiftDuration = 0
		}
	}
	ironFortressDuration := 0.0
	if e.IronFortressActive {
		ironFortressDuration = time.Until(e.IronFortressEndTime).Seconds()
		if ironFortressDuration < 0 {
			ironFortressDuration = 0
		}
	}
	guardianRoarDuration := 0.0
	if e.GuardianRoarActive {
		guardianRoarDuration = time.Until(e.GuardianRoarEndTime).Seconds()
		if guardianRoarDuration < 0 {
			guardianRoarDuration = 0
		}
	}
	berserkerModeDuration := 0.0
	if e.BerserkerModeActive {
		berserkerModeDuration = time.Until(e.BerserkerModeEndTime).Seconds()
		if berserkerModeDuration < 0 {
			berserkerModeDuration = 0
		}
	}
	lastStandDuration := 0.0
	if e.LastStandActive {
		lastStandDuration = time.Until(e.LastStandEndTime).Seconds()
		if lastStandDuration < 0 {
			lastStandDuration = 0
		}
	}
	serratedEdgesDuration := 0.0
	if e.SerratedEdgesActive {
		serratedEdgesDuration = time.Until(e.SerratedEdgesEndTime).Seconds()
		if serratedEdgesDuration < 0 {
			serratedEdgesDuration = 0
		}
	}
	poisonCoatingDuration := 0.0
	if e.PoisonCoatingActive {
		poisonCoatingDuration = time.Until(e.PoisonCoatingEndTime).Seconds()
		if poisonCoatingDuration < 0 {
			poisonCoatingDuration = 0
		}
	}
	stealthDuration := 0.0
	if e.StealthActive {
		stealthDuration = time.Until(e.StealthEndTime).Seconds()
		if stealthDuration < 0 {
			stealthDuration = 0
		}
	}
	zealDuration := 0.0
	if e.ZealActive {
		zealDuration = time.Until(e.ZealEndTime).Seconds()
		if zealDuration < 0 {
			zealDuration = 0
		}
	}

	snap := &EntitySnapshot{
		X:                          e.X,
		Z:                          e.Z,
		Y:                          e.Y,
		Rotation:                   e.Rotation,
		Health:                     e.Health,
		MaxHealth:                  e.MaxHealth,
		Mana:                       e.Mana,
		State:                      e.State,
		Level:                      e.Level,
		IsCharging:                 e.IsCharging,
		SpiritsActive:              e.SpiritsActive,
		SpiritsBoosted:             e.SpiritsBoosted,
		GuardianEmbraceActive:      e.GuardianEmbraceActive,
		BlessingResolveActive:      e.BlessingResolveActive,
		DivineInterventionActive:   e.DivineInterventionActive,
		ArcaneShieldActive:         e.ArcaneShieldActive,
		ArcaneShieldHP:             e.ArcaneShieldHP,
		TimeWarpActive:             e.TimeWarpActive,
		SpellFocusActive:           e.SpellFocusActive,
		SwiftActive:                e.SwiftActive,
		IronFortressActive:         e.IronFortressActive,
		GuardianRoarActive:         e.GuardianRoarActive,
		BerserkerModeActive:        e.BerserkerModeActive,
		LastStandActive:            e.LastStandActive,
		SerratedEdgesActive:        e.SerratedEdgesActive,
		PoisonCoatingActive:        e.PoisonCoatingActive,
		StealthActive:              e.StealthActive,
		ZealActive:                 e.ZealActive,
		Stunned:                    e.Stunned,
		StunDuration:               stunDuration,
		Slowed:                     e.Slowed,
		SlowFactor:                 e.SlowFactor,
		SlowDuration:               slowDuration,
		Rooted:                     e.Rooted,
		RootDuration:               rootDuration,
		Bleeding:                   e.Bleeding,
		BleedDuration:              bleedDuration,
		BleedDamage:                bleedDamage,
		Poisoned:                   e.Poisoned,
		PoisonDuration:             poisonDuration,
		PoisonDamage:               poisonDamage,
		WeakPointMarked:            e.WeakPointMarked,
		WeakPointDuration:          weakPointDuration,
		MarkWeakness:               e.MarkWeakness,
		MarkWeaknessDuration:       markWeaknessDuration,
		SpiritDuration:             spiritDuration,
		BlessingResolveDuration:    blessingResolveDuration,
		TimeWarpDuration:           timeWarpDuration,
		GuardianEmbraceDuration:    guardianEmbraceDuration,
		ArcaneShieldDuration:       arcaneShieldDuration,
		DivineInterventionDuration: divineInterventionDuration,
		SpellFocusDuration:         spellFocusDuration,
		SwiftDuration:              swiftDuration,
		IronFortressDuration:       ironFortressDuration,
		GuardianRoarDuration:       guardianRoarDuration,
		BerserkerModeDuration:      berserkerModeDuration,
		LastStandDuration:          lastStandDuration,
		SerratedEdgesDuration:      serratedEdgesDuration,
		PoisonCoatingDuration:      poisonCoatingDuration,
		StealthDuration:            stealthDuration,
		ZealDuration:               zealDuration,
		JumpProgress:               e.JumpProgress,
		TalentPoints:               derivedTalentPoints,
		TalentKeys:                 keys,
		TalentSpent:                spent,
		PartyID:                    e.PartyID,
		SocialStatus:               e.SocialStatus,
		EquipmentRevision:          e.EquipmentRevision,
	}
	e.Mu.RUnlock()

	return snap
}

// hasEntityChanged checks if entity state differs from last snapshot
// Returns true if any tracked field changed significantly
func hasEntityChanged(current *game.Entity, last *EntitySnapshot) bool {
	// Snapshot current values under lock to avoid races (TalentRanks is a map).
	current.Mu.RLock()
	cx := current.X
	cz := current.Z
	cy := current.Y
	crot := current.Rotation
	chealth := current.Health
	cmaxHealth := current.MaxHealth
	cmana := current.Mana
	cstate := current.State
	clevel := current.Level
	cisCharging := current.IsCharging
	cspiritsActive := current.SpiritsActive
	cspiritsBoosted := current.SpiritsBoosted
	cguardianEmbraceActive := current.GuardianEmbraceActive
	cblessingResolveActive := current.BlessingResolveActive
	cdivineInterventionActive := current.DivineInterventionActive
	carcaneShieldActive := current.ArcaneShieldActive
	carcaneShieldHP := current.ArcaneShieldHP
	ctimeWarpActive := current.TimeWarpActive
	cspellFocusActive := current.SpellFocusActive
	cswiftActive := current.SwiftActive
	cironFortressActive := current.IronFortressActive
	cguardianRoarActive := current.GuardianRoarActive
	cberserkerModeActive := current.BerserkerModeActive
	clastStandActive := current.LastStandActive
	cserratedEdgesActive := current.SerratedEdgesActive
	cpoisonCoatingActive := current.PoisonCoatingActive
	cstealthActive := current.StealthActive
	czealActive := current.ZealActive
	cstunned := current.Stunned
	cstunDuration := 0.0
	if cstunned {
		cstunDuration = time.Until(current.StunEndTime).Seconds()
		if cstunDuration < 0 {
			cstunDuration = 0
		}
	}
	cslowed := current.Slowed
	cslowFactor := current.SlowFactor
	cslowDuration := 0.0
	if cslowed {
		cslowDuration = time.Until(current.SlowEndTime).Seconds()
		if cslowDuration < 0 {
			cslowDuration = 0
		}
	}
	crooted := current.Rooted
	crootDuration := 0.0
	if crooted {
		crootDuration = time.Until(current.RootEndTime).Seconds()
		if crootDuration < 0 {
			crootDuration = 0
		}
	}
	cbleeding := current.Bleeding
	cbleedDuration := 0.0
	cbleedDamage := 0
	if cbleeding {
		cbleedDuration = time.Until(current.BleedEndTime).Seconds()
		if cbleedDuration < 0 {
			cbleedDuration = 0
		}
		if current.BleedDamage > 0 {
			cbleedDamage = current.BleedDamage
		}
	}
	cpoisoned := current.Poisoned
	cpoisonDuration := 0.0
	cpoisonDamage := 0
	if cpoisoned {
		cpoisonDuration = time.Until(current.PoisonEndTime).Seconds()
		if cpoisonDuration < 0 {
			cpoisonDuration = 0
		}
		if current.PoisonDamage > 0 {
			cpoisonDamage = current.PoisonDamage
		}
	}
	cweakPointMarked := current.WeakPointMarked
	cweakPointDuration := 0.0
	if cweakPointMarked {
		cweakPointDuration = time.Until(current.WeakPointEndTime).Seconds()
		if cweakPointDuration < 0 {
			cweakPointDuration = 0
		}
	}
	cmarkWeakness := current.MarkWeakness
	cmarkWeaknessDuration := 0.0
	if cmarkWeakness {
		cmarkWeaknessDuration = time.Until(current.MarkWeaknessEndTime).Seconds()
		if cmarkWeaknessDuration < 0 {
			cmarkWeaknessDuration = 0
		}
	}
	cspiritDuration := 0.0
	if cspiritsActive {
		cspiritDuration = time.Until(current.SpiritEndTime).Seconds()
		if cspiritDuration < 0 {
			cspiritDuration = 0
		}
	}
	cblessingResolveDuration := 0.0
	if cblessingResolveActive {
		cblessingResolveDuration = time.Until(current.BlessingResolveEndTime).Seconds()
		if cblessingResolveDuration < 0 {
			cblessingResolveDuration = 0
		}
	}
	ctimeWarpDuration := 0.0
	if ctimeWarpActive {
		ctimeWarpDuration = time.Until(current.TimeWarpEndTime).Seconds()
		if ctimeWarpDuration < 0 {
			ctimeWarpDuration = 0
		}
	}
	cguardianEmbraceDuration := 0.0
	if cguardianEmbraceActive {
		cguardianEmbraceDuration = time.Until(current.GuardianEmbraceEndTime).Seconds()
		if cguardianEmbraceDuration < 0 {
			cguardianEmbraceDuration = 0
		}
	}
	carcaneShieldDuration := 0.0
	if carcaneShieldActive && carcaneShieldHP > 0 {
		carcaneShieldDuration = time.Until(current.ArcaneShieldEndTime).Seconds()
		if carcaneShieldDuration < 0 {
			carcaneShieldDuration = 0
		}
	}
	cdivineInterventionDuration := 0.0
	if cdivineInterventionActive {
		cdivineInterventionDuration = time.Until(current.DivineInterventionEndTime).Seconds()
		if cdivineInterventionDuration < 0 {
			cdivineInterventionDuration = 0
		}
	}
	cspellFocusDuration := 0.0
	if cspellFocusActive {
		cspellFocusDuration = time.Until(current.SpellFocusEndTime).Seconds()
		if cspellFocusDuration < 0 {
			cspellFocusDuration = 0
		}
	}
	cswiftDuration := 0.0
	if cswiftActive {
		cswiftDuration = time.Until(current.SwiftEndTime).Seconds()
		if cswiftDuration < 0 {
			cswiftDuration = 0
		}
	}
	cironFortressDuration := 0.0
	if cironFortressActive {
		cironFortressDuration = time.Until(current.IronFortressEndTime).Seconds()
		if cironFortressDuration < 0 {
			cironFortressDuration = 0
		}
	}
	cguardianRoarDuration := 0.0
	if cguardianRoarActive {
		cguardianRoarDuration = time.Until(current.GuardianRoarEndTime).Seconds()
		if cguardianRoarDuration < 0 {
			cguardianRoarDuration = 0
		}
	}
	cberserkerModeDuration := 0.0
	if cberserkerModeActive {
		cberserkerModeDuration = time.Until(current.BerserkerModeEndTime).Seconds()
		if cberserkerModeDuration < 0 {
			cberserkerModeDuration = 0
		}
	}
	clastStandDuration := 0.0
	if clastStandActive {
		clastStandDuration = time.Until(current.LastStandEndTime).Seconds()
		if clastStandDuration < 0 {
			clastStandDuration = 0
		}
	}
	cserratedEdgesDuration := 0.0
	if cserratedEdgesActive {
		cserratedEdgesDuration = time.Until(current.SerratedEdgesEndTime).Seconds()
		if cserratedEdgesDuration < 0 {
			cserratedEdgesDuration = 0
		}
	}
	cpoisonCoatingDuration := 0.0
	if cpoisonCoatingActive {
		cpoisonCoatingDuration = time.Until(current.PoisonCoatingEndTime).Seconds()
		if cpoisonCoatingDuration < 0 {
			cpoisonCoatingDuration = 0
		}
	}
	cstealthDuration := 0.0
	if cstealthActive {
		cstealthDuration = time.Until(current.StealthEndTime).Seconds()
		if cstealthDuration < 0 {
			cstealthDuration = 0
		}
	}
	czealDuration := 0.0
	if czealActive {
		czealDuration = time.Until(current.ZealEndTime).Seconds()
		if czealDuration < 0 {
			czealDuration = 0
		}
	}
	ctalentPoints := current.TalentPoints
	cjumpProgress := current.JumpProgress
	ctalentKeys := 0
	ctalentSpent := 0
	for tid, r := range current.TalentRanks {
		nr, ok := game.NormalizeTalentRank(current.SubType, tid, r)
		if !ok {
			continue
		}
		ctalentKeys++
		ctalentSpent += nr
	}
	// Compute derived points for comparison (don't depend on stored field).
	ctalentPoints = 0
	if clevel >= 5 {
		ctalentPoints = (clevel / 5) - ctalentSpent
		if ctalentPoints < 0 {
			ctalentPoints = 0
		}
	}
	cpartyID := current.PartyID
	csocialStatus := current.SocialStatus
	cequipmentRevision := current.EquipmentRevision
	current.Mu.RUnlock()

	// Position change threshold (0.05 units = basically any movement)
	const posTolerance = 0.05
	dx := cx - last.X
	dz := cz - last.Z
	dy := cy - last.Y
	if dx*dx+dz*dz > posTolerance*posTolerance || dy*dy > posTolerance*posTolerance {
		return true
	}

	// Rotation change threshold (~3 degrees)
	const rotTolerance = 0.05
	dr := crot - last.Rotation
	if dr > rotTolerance || dr < -rotTolerance {
		return true
	}

	// Health/Mana changes are always significant
	if chealth != last.Health || cmaxHealth != last.MaxHealth {
		return true
	}
	if cmana != last.Mana {
		return true
	}

	// Talent changes are significant (UI needs timely updates)
	if ctalentPoints != last.TalentPoints || ctalentKeys != last.TalentKeys || ctalentSpent != last.TalentSpent {
		return true
	}

	// State changes are always significant
	if cstate != last.State {
		return true
	}
	if cstate == "JUMPING" && math.Abs(cjumpProgress-last.JumpProgress) > 0.01 {
		return true
	}

	// Charging state changes are always significant
	if cisCharging != last.IsCharging {
		return true
	}
	if cspiritsActive != last.SpiritsActive {
		return true
	}
	if cspiritsBoosted != last.SpiritsBoosted {
		return true
	}
	if cguardianEmbraceActive != last.GuardianEmbraceActive {
		return true
	}
	if cblessingResolveActive != last.BlessingResolveActive {
		return true
	}
	if cdivineInterventionActive != last.DivineInterventionActive {
		return true
	}
	if carcaneShieldActive != last.ArcaneShieldActive || carcaneShieldHP != last.ArcaneShieldHP {
		return true
	}
	if ctimeWarpActive != last.TimeWarpActive {
		return true
	}
	if cweakPointMarked != last.WeakPointMarked {
		return true
	}
	if cmarkWeakness != last.MarkWeakness {
		return true
	}
	if cspellFocusActive != last.SpellFocusActive {
		return true
	}
	if cswiftActive != last.SwiftActive {
		return true
	}
	if cironFortressActive != last.IronFortressActive ||
		cguardianRoarActive != last.GuardianRoarActive ||
		cberserkerModeActive != last.BerserkerModeActive ||
		clastStandActive != last.LastStandActive ||
		cserratedEdgesActive != last.SerratedEdgesActive ||
		cpoisonCoatingActive != last.PoisonCoatingActive ||
		cstealthActive != last.StealthActive ||
		czealActive != last.ZealActive {
		return true
	}
	if cpartyID != last.PartyID || csocialStatus != last.SocialStatus {
		return true
	}
	if cequipmentRevision != last.EquipmentRevision {
		return true
	}
	if cstunned != last.Stunned || math.Abs(cstunDuration-last.StunDuration) > 0.05 || cslowed != last.Slowed || math.Abs(cslowFactor-last.SlowFactor) > 0.0001 || math.Abs(cslowDuration-last.SlowDuration) > 0.05 || crooted != last.Rooted || math.Abs(crootDuration-last.RootDuration) > 0.05 || cbleeding != last.Bleeding || math.Abs(cbleedDuration-last.BleedDuration) > 0.05 || cbleedDamage != last.BleedDamage || cpoisoned != last.Poisoned || math.Abs(cpoisonDuration-last.PoisonDuration) > 0.05 || cpoisonDamage != last.PoisonDamage || math.Abs(cweakPointDuration-last.WeakPointDuration) > 0.05 || math.Abs(cmarkWeaknessDuration-last.MarkWeaknessDuration) > 0.05 || math.Abs(cspiritDuration-last.SpiritDuration) > 0.05 || math.Abs(cblessingResolveDuration-last.BlessingResolveDuration) > 0.05 || math.Abs(ctimeWarpDuration-last.TimeWarpDuration) > 0.05 || math.Abs(cguardianEmbraceDuration-last.GuardianEmbraceDuration) > 0.05 || math.Abs(carcaneShieldDuration-last.ArcaneShieldDuration) > 0.05 || math.Abs(cdivineInterventionDuration-last.DivineInterventionDuration) > 0.05 || math.Abs(cspellFocusDuration-last.SpellFocusDuration) > 0.05 || math.Abs(cswiftDuration-last.SwiftDuration) > 0.05 || math.Abs(cironFortressDuration-last.IronFortressDuration) > 0.05 || math.Abs(cguardianRoarDuration-last.GuardianRoarDuration) > 0.05 || math.Abs(cberserkerModeDuration-last.BerserkerModeDuration) > 0.05 || math.Abs(clastStandDuration-last.LastStandDuration) > 0.05 || math.Abs(cserratedEdgesDuration-last.SerratedEdgesDuration) > 0.05 || math.Abs(cpoisonCoatingDuration-last.PoisonCoatingDuration) > 0.05 || math.Abs(cstealthDuration-last.StealthDuration) > 0.05 || math.Abs(czealDuration-last.ZealDuration) > 0.05 {
		return true
	}

	return false
}

func broadcastState() {
	const stateBroadcastRadius = 200.0

	// 1. Copy active sessions to minimize lock time
	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client.playerID != "" {
			clients = append(clients, client)
		}
	}
	sessionsMu.Unlock()

	// 2. Process in parallel
	var wg sync.WaitGroup

	for _, client := range clients {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					// Client likely disconnected
				}
			}()

			// Keep actors known well outside the camera so jump visuals can start
			// before a remote jumper enters the local player's visible area.
			currentState := world.GetStateForPlayer(c.playerID, stateBroadcastRadius)
			playerEntity := world.GetEntityCopy(c.playerID)
			if playerEntity != nil && playerEntity.InstanceID != "" {
				world.UpdateDungeonRoomProgress(c.playerID, playerEntity.X, playerEntity.Z)
			}

			// Initialize lastState if nil (shouldn't happen, but safety check)
			if c.lastState == nil {
				c.lastState = make(map[string]*EntitySnapshot)
			}
			if c.seenIDs == nil {
				c.seenIDs = make(map[string]bool)
			}

			// Track current IDs to detect removals
			currentIDs := make(map[string]bool, len(currentState))
			for id := range currentState {
				currentIDs[id] = true
			}

			// Find removed entities (were in seenIDs but not in currentState)
			removed := make([]string, 0)
			for id := range c.seenIDs {
				if !currentIDs[id] {
					removed = append(removed, id)
					delete(c.lastState, id)
					delete(c.seenIDs, id)
				}
			}

			// Find changed/new entities
			changedState := make(map[string]*game.Entity)
			for id, entity := range currentState {
				lastSnap, existed := c.lastState[id]

				// ALWAYS include the player's own entity - they need full state for UI.
				// Equipment appearance is tracked for observers, while inventory, gold,
				// quests, and other private/self-only fields are not.
				if id == c.playerID {
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
					c.seenIDs[id] = true
					continue
				}

				// New entity or entity changed?
				if !existed {
					// New entity - always send full state
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
					c.seenIDs[id] = true
				} else if hasEntityChanged(entity, lastSnap) {
					// Changed entity - send updated state
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
				}
				// else: unchanged, skip sending
			}

			// If nothing changed and nothing removed, skip this broadcast
			if len(changedState) == 0 && len(removed) == 0 {
				return
			}

			var data []byte

			// Use delta format if client has seen entities before (not first sync)
			// First sync sends full state, subsequent sends ALWAYS use delta
			// (We can't mix state/delta or client will incorrectly remove entities)
			isFirstSync := len(c.seenIDs) == len(changedState) && len(removed) == 0
			env := &statepb.StateEnvelope{
				Version:      1,
				ServerTimeMs: uint64(time.Now().UnixMilli()),
			}

			if isFirstSync {
				full := &statepb.StateFull{Entities: make([]*statepb.Entity, 0, len(currentState))}
				for _, e := range currentState {
					full.Entities = append(full.Entities, entityToProto(e))
				}
				env.Payload = &statepb.StateEnvelope_Full{Full: full}

				// Update seenIDs with all current entities
				for id := range currentState {
					c.seenIDs[id] = true
				}
			} else {
				delta := &statepb.StateDelta{Entities: make([]*statepb.Entity, 0, len(changedState)), RemovedIds: removed}
				for _, e := range changedState {
					delta.Entities = append(delta.Entities, entityToProto(e))
				}
				env.Payload = &statepb.StateEnvelope_Delta{Delta: delta}
			}

			payload, err := proto.Marshal(env)
			if err != nil {
				return
			}

			// Wire format: "EDPB" + version byte + protobuf payload
			data = make([]byte, 0, 5+len(payload))
			data = append(data, stateProtoMagic...)
			data = append(data, stateProtoWireVersion)
			data = append(data, payload...)

			select {
			case c.send <- data:
			default:
			}

			if playerEntity != nil && playerEntity.InstanceID != "" {
				if roomState, ok := world.GetDungeonRoomSummary(playerEntity.InstanceID, c.playerID); ok {
					payloadBytes, _ := json.Marshal(roomState)
					roomStateMsg := Message{Type: MsgDungeonRoomState, Payload: payloadBytes}
					if roomStateData, err := json.Marshal(roomStateMsg); err == nil {
						select {
						case c.send <- roomStateData:
						default:
						}
					}
				}
			}
		}(client)
	}
	wg.Wait()
}

func statsToProto(s game.Stats) *statepb.Stats {
	return &statepb.Stats{
		Strength:     int32(s.Strength),
		Dexterity:    int32(s.Dexterity),
		Intelligence: int32(s.Intelligence),
		Wisdom:       int32(s.Wisdom),
		Vitality:     int32(s.Vitality),
	}
}

func itemToProto(i *game.Item) *statepb.Item {
	if i == nil {
		return nil
	}
	stats := make(map[string]int32, len(i.Stats))
	for k, v := range i.Stats {
		stats[k] = int32(v)
	}
	gems := make([]*statepb.SocketedGem, 0, len(i.Gems))
	for _, gem := range i.Gems {
		gemStats := make(map[string]int32, len(gem.Stats))
		for k, v := range gem.Stats {
			gemStats[k] = int32(v)
		}
		gems = append(gems, &statepb.SocketedGem{
			Type:    string(gem.Type),
			Quality: string(gem.Quality),
			Stats:   gemStats,
		})
	}
	return &statepb.Item{
		Id:               i.ID,
		Name:             i.Name,
		Type:             string(i.Type),
		Rarity:           string(i.Rarity),
		Slot:             i.Slot,
		Level:            int32(i.Level),
		Stats:            stats,
		Value:            int32(i.Value),
		Icon:             i.Icon,
		Description:      i.Description,
		Stack:            int32(i.Stack),
		MaxStack:         int32(i.MaxStack),
		Potency:          int32(i.Potency),
		Sockets:          int32(i.Sockets),
		GemType:          string(i.GemType),
		GemQuality:       string(i.GemQuality),
		Gems:             gems,
		SetId:            i.SetID,
		UniqueEffect:     i.UniqueEffect,
		StatScaleVersion: int32(i.StatScaleVersion),
	}
}

func questsToProto(qs []game.Quest) []*statepb.Quest {
	if qs == nil {
		return nil
	}
	out := make([]*statepb.Quest, 0, len(qs))
	for _, q := range qs {
		out = append(out, &statepb.Quest{
			Id:        q.ID,
			Type:      q.Type,
			Target:    q.Target,
			Count:     int32(q.Count),
			MaxCount:  int32(q.MaxCount),
			RewardXp:  int32(q.RewardXP),
			Completed: q.Completed,
			Accepted:  q.Accepted,
		})
	}
	return out
}

func entityToProto(e *game.Entity) *statepb.Entity {
	if e == nil {
		return nil
	}

	// Read-lock to avoid stale/racy reads while the world sim updates entities concurrently.
	// This is especially important for State/position consistency (ATTACKING vs MOVING).
	e.Mu.RLock()

	// Copy slices/maps/pointers while under the lock.
	unlockedSkills := append([]string(nil), e.UnlockedSkills...)
	skillRunes := make(map[string]string, len(e.SkillRunes))
	for skill, runeID := range e.SkillRunes {
		skillRunes[skill] = runeID
	}

	// Passive talents: ranked map (new) + derived unlocked list (legacy).
	talentRanks := make(map[string]int32)
	unlockedTalents := make([]string, 0)
	spentTalents := 0
	for tid, r := range e.TalentRanks {
		nr, ok := game.NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		talentRanks[tid] = int32(nr)
		spentTalents += nr
		unlockedTalents = append(unlockedTalents, tid)
	}
	sort.Strings(unlockedTalents)
	// TalentPoints are derived from level and normalized ranks. Compute here to avoid
	// relying on the stored field (which may be stale if stats weren't recalculated yet).
	derivedTalentPoints := 0
	if e.Level >= 5 {
		derivedTalentPoints = (e.Level / 5) - spentTalents
		if derivedTalentPoints < 0 {
			derivedTalentPoints = 0
		}
	}
	quests := append([]game.Quest(nil), e.Quests...)

	equipment := make(map[string]*statepb.Item, len(e.Equipment))
	for slot, it := range e.Equipment {
		itemCopy := it
		equipment[slot] = itemToProto(&itemCopy)
	}

	var lootItem *game.Item
	if e.LootItem != nil {
		li := *e.LootItem
		lootItem = &li
	}

	stunDuration := float32(0)
	if e.Stunned {
		remaining := time.Until(e.StunEndTime).Seconds()
		if remaining > 0 {
			stunDuration = float32(remaining)
		}
	}
	slowDuration := float32(0)
	if e.Slowed {
		remaining := time.Until(e.SlowEndTime).Seconds()
		if remaining > 0 {
			slowDuration = float32(remaining)
		}
	}
	rootDuration := float32(0)
	if e.Rooted {
		remaining := time.Until(e.RootEndTime).Seconds()
		if remaining > 0 {
			rootDuration = float32(remaining)
		}
	}
	bleedDuration := float32(0)
	bleedDamage := int32(0)
	if e.Bleeding {
		remaining := time.Until(e.BleedEndTime).Seconds()
		if remaining > 0 {
			bleedDuration = float32(remaining)
		}
		if e.BleedDamage > 0 {
			bleedDamage = int32(e.BleedDamage)
		}
	}
	poisonDuration := float32(0)
	poisonDamage := int32(0)
	if e.Poisoned {
		remaining := time.Until(e.PoisonEndTime).Seconds()
		if remaining > 0 {
			poisonDuration = float32(remaining)
		}
		if e.PoisonDamage > 0 {
			poisonDamage = int32(e.PoisonDamage)
		}
	}
	weakPointDuration := float32(0)
	if e.WeakPointMarked {
		remaining := time.Until(e.WeakPointEndTime).Seconds()
		if remaining > 0 {
			weakPointDuration = float32(remaining)
		}
	}
	markWeaknessDuration := float32(0)
	if e.MarkWeakness {
		remaining := time.Until(e.MarkWeaknessEndTime).Seconds()
		if remaining > 0 {
			markWeaknessDuration = float32(remaining)
		}
	}
	spiritDuration := float32(0)
	if e.SpiritsActive {
		remaining := time.Until(e.SpiritEndTime).Seconds()
		if remaining > 0 {
			spiritDuration = float32(remaining)
		}
	}
	blessingResolveDuration := float32(0)
	if e.BlessingResolveActive {
		remaining := time.Until(e.BlessingResolveEndTime).Seconds()
		if remaining > 0 {
			blessingResolveDuration = float32(remaining)
		}
	}
	timeWarpDuration := float32(0)
	if e.TimeWarpActive {
		remaining := time.Until(e.TimeWarpEndTime).Seconds()
		if remaining > 0 {
			timeWarpDuration = float32(remaining)
		}
	}
	guardianEmbraceDuration := float32(0)
	if e.GuardianEmbraceActive {
		remaining := time.Until(e.GuardianEmbraceEndTime).Seconds()
		if remaining > 0 {
			guardianEmbraceDuration = float32(remaining)
		}
	}
	arcaneShieldDuration := float32(0)
	if e.ArcaneShieldActive && e.ArcaneShieldHP > 0 {
		remaining := time.Until(e.ArcaneShieldEndTime).Seconds()
		if remaining > 0 {
			arcaneShieldDuration = float32(remaining)
		}
	}
	divineInterventionDuration := float32(0)
	if e.DivineInterventionActive {
		remaining := time.Until(e.DivineInterventionEndTime).Seconds()
		if remaining > 0 {
			divineInterventionDuration = float32(remaining)
		}
	}
	spellFocusDuration := float32(0)
	if e.SpellFocusActive {
		remaining := time.Until(e.SpellFocusEndTime).Seconds()
		if remaining > 0 {
			spellFocusDuration = float32(remaining)
		}
	}
	swiftDuration := float32(0)
	if e.SwiftActive {
		remaining := time.Until(e.SwiftEndTime).Seconds()
		if remaining > 0 {
			swiftDuration = float32(remaining)
		}
	}
	ironFortressDuration := float32(0)
	if e.IronFortressActive {
		if remaining := time.Until(e.IronFortressEndTime).Seconds(); remaining > 0 {
			ironFortressDuration = float32(remaining)
		}
	}
	guardianRoarDuration := float32(0)
	if e.GuardianRoarActive {
		if remaining := time.Until(e.GuardianRoarEndTime).Seconds(); remaining > 0 {
			guardianRoarDuration = float32(remaining)
		}
	}
	berserkerModeDuration := float32(0)
	if e.BerserkerModeActive {
		if remaining := time.Until(e.BerserkerModeEndTime).Seconds(); remaining > 0 {
			berserkerModeDuration = float32(remaining)
		}
	}
	lastStandDuration := float32(0)
	if e.LastStandActive {
		if remaining := time.Until(e.LastStandEndTime).Seconds(); remaining > 0 {
			lastStandDuration = float32(remaining)
		}
	}
	serratedEdgesDuration := float32(0)
	if e.SerratedEdgesActive {
		if remaining := time.Until(e.SerratedEdgesEndTime).Seconds(); remaining > 0 {
			serratedEdgesDuration = float32(remaining)
		}
	}
	poisonCoatingDuration := float32(0)
	if e.PoisonCoatingActive {
		if remaining := time.Until(e.PoisonCoatingEndTime).Seconds(); remaining > 0 {
			poisonCoatingDuration = float32(remaining)
		}
	}
	stealthDuration := float32(0)
	if e.StealthActive {
		if remaining := time.Until(e.StealthEndTime).Seconds(); remaining > 0 {
			stealthDuration = float32(remaining)
		}
	}
	zealDuration := float32(0)
	if e.ZealActive {
		if remaining := time.Until(e.ZealEndTime).Seconds(); remaining > 0 {
			zealDuration = float32(remaining)
		}
	}

	out := &statepb.Entity{
		Id:                         e.ID,
		InstanceId:                 e.InstanceID,
		Name:                       e.Name,
		Type:                       string(e.Type),
		SubType:                    e.SubType,
		X:                          float32(e.X),
		Y:                          float32(e.Y),
		Z:                          float32(e.Z),
		Rotation:                   float32(e.Rotation),
		Health:                     int32(e.Health),
		MaxHealth:                  int32(e.MaxHealth),
		Mana:                       int32(e.Mana),
		MaxMana:                    int32(e.MaxMana),
		Level:                      int32(e.Level),
		Experience:                 int32(e.Experience),
		MaxExperience:              int32(e.MaxExperience),
		Gold:                       int32(e.Gold),
		SkillPoints:                int32(e.SkillPoints),
		SelectedBranch:             e.SelectedBranch,
		UnlockedSkills:             unlockedSkills,
		SkillRunes:                 skillRunes,
		TalentPoints:               int32(derivedTalentPoints),
		UnlockedTalents:            unlockedTalents,
		TalentRanks:                talentRanks,
		BaseStats:                  statsToProto(e.BaseStats),
		Stats:                      statsToProto(e.Stats),
		Damage:                     int32(e.Damage),
		Defense:                    int32(e.Defense),
		Speed:                      float32(e.Speed),
		AttackSpeed:                float32(e.AttackSpeed),
		CooldownReduction:          float32(e.CooldownReduction),
		HpRegen:                    float32(e.HpRegen),
		ManaRegen:                  float32(e.ManaRegen),
		CastSpeed:                  float32(e.CastSpeed),
		Scale:                      float32(e.Scale),
		State:                      e.State,
		Equipment:                  equipment,
		Quests:                     questsToProto(quests),
		LootItem:                   itemToProto(lootItem),
		OwnerId:                    e.OwnerID,
		VelX:                       float32(e.VelX),
		VelZ:                       float32(e.VelZ),
		SpiritsActive:              e.SpiritsActive,
		SpiritsBoosted:             e.SpiritsBoosted,
		IsCharging:                 e.IsCharging,
		GuardianEmbraceActive:      e.GuardianEmbraceActive,
		BlessingResolveActive:      e.BlessingResolveActive,
		DivineInterventionActive:   e.DivineInterventionActive,
		ArcaneShieldActive:         e.ArcaneShieldActive,
		ArcaneShieldHp:             int32(e.ArcaneShieldHP),
		TimeWarpActive:             e.TimeWarpActive,
		SpellFocusActive:           e.SpellFocusActive,
		SwiftActive:                e.SwiftActive,
		IronFortressActive:         e.IronFortressActive,
		GuardianRoarActive:         e.GuardianRoarActive,
		BerserkerModeActive:        e.BerserkerModeActive,
		LastStandActive:            e.LastStandActive,
		SerratedEdgesActive:        e.SerratedEdgesActive,
		PoisonCoatingActive:        e.PoisonCoatingActive,
		StealthActive:              e.StealthActive,
		ZealActive:                 e.ZealActive,
		Stunned:                    e.Stunned,
		StunDuration:               stunDuration,
		Slowed:                     e.Slowed,
		SlowFactor:                 float32(e.SlowFactor),
		SlowDuration:               slowDuration,
		Rooted:                     e.Rooted,
		RootDuration:               rootDuration,
		Bleeding:                   e.Bleeding,
		BleedDuration:              bleedDuration,
		BleedDamage:                bleedDamage,
		Poisoned:                   e.Poisoned,
		PoisonDuration:             poisonDuration,
		PoisonDamage:               poisonDamage,
		WeakPointMarked:            e.WeakPointMarked,
		WeakPointDuration:          float32(weakPointDuration),
		MarkWeakness:               e.MarkWeakness,
		MarkWeaknessDuration:       markWeaknessDuration,
		SpiritDuration:             spiritDuration,
		BlessingResolveDuration:    blessingResolveDuration,
		TimeWarpDuration:           timeWarpDuration,
		GuardianEmbraceDuration:    guardianEmbraceDuration,
		ArcaneShieldDuration:       arcaneShieldDuration,
		DivineInterventionDuration: divineInterventionDuration,
		SpellFocusDuration:         spellFocusDuration,
		SwiftDuration:              swiftDuration,
		IronFortressDuration:       ironFortressDuration,
		GuardianRoarDuration:       guardianRoarDuration,
		BerserkerModeDuration:      berserkerModeDuration,
		LastStandDuration:          lastStandDuration,
		SerratedEdgesDuration:      serratedEdgesDuration,
		PoisonCoatingDuration:      poisonCoatingDuration,
		StealthDuration:            stealthDuration,
		ZealDuration:               zealDuration,
		JumpStartX:                 float32(e.JumpStartX),
		JumpStartY:                 float32(e.JumpStartY),
		JumpStartZ:                 float32(e.JumpStartZ),
		JumpTargetX:                float32(e.JumpTargetX),
		JumpTargetY:                float32(e.JumpTargetY),
		JumpTargetZ:                float32(e.JumpTargetZ),
		JumpDuration:               float32(e.JumpDuration),
		JumpHeight:                 float32(e.JumpHeight),
		JumpProgress:               float32(e.JumpProgress),
		PartyId:                    e.PartyID,
		SocialStatus:               e.SocialStatus,
		MoveSequence:               e.LastMoveSequence,
	}

	e.Mu.RUnlock()
	return out
}

// autoSetSocialStatus applies a system-driven social status change for the
// given player (0.37.4).  It respects SetPlayerSocialStatusAutomatic's
// preconditions, then acks the new status to the player's client so their
// dropdown stays in sync, and broadcasts a fresh MsgSocial to all sessions.
// No-op (no ack, no broadcast) when the precondition is not met.
func autoSetSocialStatus(c *Client, playerID, newStatus string) {
	status, changed := world.SetPlayerSocialStatusAutomatic(playerID, newStatus)
	if !changed {
		return
	}
	// Ack to the affected player so their UI dropdown reflects the new value.
	ackPayload, _ := json.Marshal(SocialStatusPayload{Status: status})
	c.sendSafe(createMessage(MsgSocialStatus, ackPayload))
	// Broadcast fresh list to all sessions.
	go broadcastSocialToAll()
}

func buildSocialList() []SocialEntry {
	var list []SocialEntry
	sessionsMu.Lock()
	ids := make([]string, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client.playerID != "" {
			ids = append(ids, client.playerID)
		}
	}
	sessionsMu.Unlock()

	for _, id := range ids {
		entity := world.GetEntity(id)
		if entity == nil {
			continue
		}
		entity.Mu.RLock()
		entry := SocialEntry{
			Name:         entity.Name,
			Class:        entity.SubType,
			Level:        entity.Level,
			SocialStatus: game.NormalizeSocialStatus(entity.SocialStatus),
		}
		entity.Mu.RUnlock()
		list = append(list, entry)
	}
	return list
}

// broadcastSocialToAll sends a fresh MsgSocial list to every active session.
// Called whenever a player's social status changes (0.37.3).
func broadcastSocialToAll() {
	list := buildSocialList()
	payload, _ := json.Marshal(list)
	msg := createMessage(MsgSocial, payload)

	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, c := range activeSessions {
		clients = append(clients, c)
	}
	sessionsMu.Unlock()

	for _, c := range clients {
		c.sendSafe(msg)
	}
}

// usernameToPlayerID returns the canonical playerID for a given username.
func usernameToPlayerID(username string) string {
	return "player-" + username
}

// playerIDToUsername strips the "player-" prefix to recover the username.
func playerIDToUsername(playerID string) string {
	return strings.TrimPrefix(playerID, "player-")
}

// buildFriendListPayload assembles a FriendListPayload for the given playerID.
// It reads accepted friends and pending incoming requests from the DB, then
// cross-references activeSessions to determine online status.
func buildFriendListPayload(playerID string) FriendListPayload {
	friends, err := db.GetFriends(playerID)
	if err != nil {
		log.Printf("buildFriendListPayload: DB error for %s: %v", playerID, err)
		return FriendListPayload{Friends: []FriendEntry{}, Pending: []string{}}
	}

	pendingDocs, err := db.GetPendingRequests(playerID)
	if err != nil {
		log.Printf("buildFriendListPayload: pending DB error for %s: %v", playerID, err)
		pendingDocs = nil
	}

	entries := make([]FriendEntry, 0, len(friends))
	for _, f := range friends {
		otherID := f.RequesterID
		if f.RequesterID == playerID {
			otherID = f.AddresseeID
		}
		otherUsername := playerIDToUsername(otherID)

		entry := FriendEntry{Username: otherUsername}

		sessionsMu.Lock()
		otherClient, online := activeSessions[otherUsername]
		sessionsMu.Unlock()

		if online && otherClient.playerID != "" {
			entry.Online = true
			entity := world.GetEntity(otherClient.playerID)
			if entity != nil {
				entity.Mu.RLock()
				entry.SocialStatus = game.NormalizeSocialStatus(entity.SocialStatus)
				entity.Mu.RUnlock()
			}
		}
		entries = append(entries, entry)
	}

	pendingUsernames := make([]string, 0, len(pendingDocs))
	for _, p := range pendingDocs {
		pendingUsernames = append(pendingUsernames, playerIDToUsername(p.RequesterID))
	}

	return FriendListPayload{Friends: entries, Pending: pendingUsernames}
}

// notifyFriendsPresence pushes a MsgFriendPresence packet to every online friend of username.
// Called on login (online=true) and disconnect (online=false).
func notifyFriendsPresence(username string, online bool) {
	playerID := usernameToPlayerID(username)
	friends, err := db.GetFriends(playerID)
	if err != nil {
		log.Printf("notifyFriendsPresence: DB error for %s: %v", username, err)
		return
	}

	payload, _ := json.Marshal(FriendPresencePayload{Username: username, Online: online})
	msg := createMessage(MsgFriendPresence, payload)

	for _, f := range friends {
		otherID := f.RequesterID
		if f.RequesterID == playerID {
			otherID = f.AddresseeID
		}
		otherUsername := playerIDToUsername(otherID)

		sessionsMu.Lock()
		otherClient, ok := activeSessions[otherUsername]
		sessionsMu.Unlock()
		if ok {
			otherClient.sendSafe(msg)
		}
	}
}

func broadcastTime() {
	// For game timer, maybe just send seconds elapsed since server start or a specific game time
	// Let's send current Unix timestamp
	now := time.Now().Unix()
	payload, _ := json.Marshal(map[string]int64{"time": now})
	msg := Message{
		Type:    "time",
		Payload: payload,
	}
	data, _ := json.Marshal(msg)
	broadcast <- BroadcastMessage{Type: "time", Data: data}
}

func saveAllPlayers() {
	// Create a snapshot of active sessions to avoid holding the lock during DB operations
	var clientsToSave []*Client
	sessionsMu.Lock()
	for _, client := range activeSessions {
		clientsToSave = append(clientsToSave, client)
	}
	sessionsMu.Unlock()

	for _, client := range clientsToSave {
		savePlayer(client)
	}
}

func savePlayer(client *Client) {
	if db == nil || world == nil || client == nil || client.playerID == "" || client.username == "" {
		return
	}

	entity := world.GetEntityCopy(client.playerID)
	if entity == nil {
		return
	}
	saveCharacterDB(client, entity)
}

func saveCharacterDB(client *Client, entity *game.Entity) {
	// Normalize talent ranks before persisting (class-only IDs; clamped ranks).
	// Derive a stable legacy unlocked_talents list (rank > 0) for backwards compatibility.
	normalizedRanks := make(map[string]int, len(entity.TalentRanks))
	unlockedTalents := make([]string, 0)
	for tid, r := range entity.TalentRanks {
		nr, ok := game.NormalizeTalentRank(entity.SubType, tid, r)
		if !ok {
			continue
		}
		cid, ok := game.CanonicalizeTalentID(entity.SubType, tid)
		if !ok {
			continue
		}
		normalizedRanks[cid] = nr
		unlockedTalents = append(unlockedTalents, cid)
	}
	sort.Strings(unlockedTalents)

	// Update DB character
	char := &database.Character{
		Name:       client.username,
		Class:      entity.SubType,
		Level:      entity.Level,
		XP:         entity.Experience,
		Gold:       entity.Gold,
		X:          entity.X,
		Y:          entity.Y,
		Z:          entity.Z,
		InstanceID: entity.InstanceID,
		LastLogout: time.Now(),
		Stats: database.Stats{
			Vitality:     entity.BaseStats.Vitality,
			Strength:     entity.BaseStats.Strength,
			Dexterity:    entity.BaseStats.Dexterity,
			Intelligence: entity.BaseStats.Intelligence,
			Wisdom:       entity.BaseStats.Wisdom,
		},
		SkillPoints:     entity.SkillPoints,
		SelectedBranch:  entity.SelectedBranch,
		UnlockedSkills:  entity.UnlockedSkills,
		SkillRunes:      entity.SkillRunes,
		UnlockedTalents: unlockedTalents,
		TalentRanks:     normalizedRanks,
		// Social
		PartyID: entity.PartyID,
	}

	// Convert Game Inventory to DB Inventory
	char.Inventory = make([]database.Item, 0)
	if len(entity.Inventory) > 0 {
		// Filter empty items
		validItems := make([]game.Item, 0)
		for _, item := range entity.Inventory {
			if item.ID != "" {
				validItems = append(validItems, item)
			}
		}

		char.Inventory = make([]database.Item, len(validItems))
		for i, item := range validItems {
			char.Inventory[i] = database.Item{
				ID:               item.ID,
				Name:             item.Name,
				Type:             string(item.Type),
				Rarity:           string(item.Rarity),
				Slot:             item.Slot,
				Level:            item.Level,
				Value:            item.Value,
				Icon:             item.Icon,
				Description:      item.Description,
				Stats:            item.Stats,
				Stack:            item.Stack,
				MaxStack:         item.MaxStack,
				Potency:          item.Potency,
				Sockets:          item.Sockets,
				Gems:             socketedGemsToDatabase(item.Gems),
				SetID:            item.SetID,
				UniqueEffect:     item.UniqueEffect,
				GemType:          string(item.GemType),
				GemQuality:       string(item.GemQuality),
				StatScaleVersion: item.StatScaleVersion,
			}
		}
	}

	// Convert Game Stash to DB Stash
	char.Stash = make([]database.Item, 0)
	if len(entity.Stash) > 0 {
		char.Stash = make([]database.Item, len(entity.Stash))
		for i, item := range entity.Stash {
			char.Stash[i] = database.Item{
				ID:               item.ID,
				Name:             item.Name,
				Type:             string(item.Type),
				Rarity:           string(item.Rarity),
				Slot:             item.Slot,
				Level:            item.Level,
				Value:            item.Value,
				Icon:             item.Icon,
				Description:      item.Description,
				Stats:            item.Stats,
				Stack:            item.Stack,
				MaxStack:         item.MaxStack,
				Potency:          item.Potency,
				Sockets:          item.Sockets,
				Gems:             socketedGemsToDatabase(item.Gems),
				SetID:            item.SetID,
				UniqueEffect:     item.UniqueEffect,
				GemType:          string(item.GemType),
				GemQuality:       string(item.GemQuality),
				StatScaleVersion: item.StatScaleVersion,
			}
		}
	}

	// Convert Game Buyback to DB Buyback
	char.Buyback = make([]database.Item, 0)
	if len(entity.Buyback) > 0 {
		char.Buyback = make([]database.Item, len(entity.Buyback))
		for i, item := range entity.Buyback {
			char.Buyback[i] = database.Item{
				ID:               item.ID,
				Name:             item.Name,
				Type:             string(item.Type),
				Rarity:           string(item.Rarity),
				Slot:             item.Slot,
				Level:            item.Level,
				Value:            item.Value,
				Icon:             item.Icon,
				Description:      item.Description,
				Stats:            item.Stats,
				Stack:            item.Stack,
				MaxStack:         item.MaxStack,
				Potency:          item.Potency,
				Sockets:          item.Sockets,
				Gems:             socketedGemsToDatabase(item.Gems),
				SetID:            item.SetID,
				UniqueEffect:     item.UniqueEffect,
				GemType:          string(item.GemType),
				GemQuality:       string(item.GemQuality),
				StatScaleVersion: item.StatScaleVersion,
			}
		}
	}

	// Convert Game Equipment to DB Equipment
	char.Equipment = make(map[string]database.Item)
	if len(entity.Equipment) > 0 {
		for slot, item := range entity.Equipment {
			char.Equipment[slot] = database.Item{
				ID:               item.ID,
				Name:             item.Name,
				Type:             string(item.Type),
				Rarity:           string(item.Rarity),
				Slot:             item.Slot,
				Level:            item.Level,
				Value:            item.Value,
				Icon:             item.Icon,
				Description:      item.Description,
				Stats:            item.Stats,
				Stack:            item.Stack,
				MaxStack:         item.MaxStack,
				Potency:          item.Potency,
				Sockets:          item.Sockets,
				Gems:             socketedGemsToDatabase(item.Gems),
				SetID:            item.SetID,
				UniqueEffect:     item.UniqueEffect,
				GemType:          string(item.GemType),
				GemQuality:       string(item.GemQuality),
				StatScaleVersion: item.StatScaleVersion,
			}
		}
	}

	// Convert Game Quests to DB Quests
	if len(entity.Quests) > 0 {
		char.Quests = make([]database.Quest, len(entity.Quests))
		for i, q := range entity.Quests {
			char.Quests[i] = database.Quest{
				ID:        q.ID,
				Type:      q.Type,
				Target:    q.Target,
				Count:     q.Count,
				MaxCount:  q.MaxCount,
				RewardXP:  q.RewardXP,
				Completed: q.Completed,
				Accepted:  q.Accepted,
			}
		}
	}
	char.LastDailyQuest = entity.LastDailyQuest

	if err := db.SaveCharacter(client.username, char); err != nil {
		log.Printf("Failed to save character for %s: %v", client.username, err)
	} else {
		log.Printf("Saved character for %s (Inv: %d, Equip: %d)", client.username, len(char.Inventory), len(char.Equipment))
	}
}

type SavedReport struct {
	Timestamp  string `json:"timestamp"`
	Username   string `json:"username"`
	ReportType string `json:"reportType"`
	Text       string `json:"text"`
}

func saveReport(username string, payload ReportPayload) {
	report := SavedReport{
		Timestamp:  time.Now().Format(time.RFC3339),
		Username:   username,
		ReportType: payload.ReportType,
		Text:       payload.Text,
	}

	filename := "bug_reports.json"
	var reports []SavedReport

	// Read existing
	data, err := os.ReadFile(filename)
	if err == nil {
		json.Unmarshal(data, &reports)
	}

	// Append
	reports = append(reports, report)

	// Write back
	newData, err := json.MarshalIndent(reports, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal reports: %v", err)
		return
	}

	if err := os.WriteFile(filename, newData, 0644); err != nil {
		log.Printf("Failed to write report file: %v", err)
	} else {
		log.Printf("Saved report from %s: %s", username, payload.ReportType)
	}
}
