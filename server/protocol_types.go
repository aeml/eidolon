package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
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
	Scale                      float64
	BodyRadius                 float64
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
	GuildID                    string
	GuildTag                   string
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
	policyMu     sync.Mutex
	messageRates map[string]*messageRateBucket
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
	MsgPartyReadyCheck  = "party_ready_check"
	MsgPartyReady       = "party_ready"
	MsgPartyLootRule    = "party_loot_rule"
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
	MsgTradeRequest      = "trade_request"
	MsgTradeOffer        = "trade_offer"
	MsgTradeConfirm      = "trade_confirm"
	MsgTradeCancel       = "trade_cancel"
	MsgTradeUpdate       = "trade_update"
	MsgTradeComplete     = "trade_complete"
	MsgInventoryMove     = "inventory_move"
	MsgInventorySort     = "inventory_sort"
	MsgEnterDungeon      = "enter_dungeon"
	MsgEnterInstance     = "enter_instance"
	MsgSplitStack        = "split_stack"
	MsgGetDungeonStatus  = "get_dungeon_status"
	MsgResetDungeon      = "reset_dungeon"
	MsgTelegraph         = "telegraph"
	MsgProjectileImpact  = "projectile_impact"
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

	// Guilds
	MsgGuildGet          = "guild_get"
	MsgGuildCreate       = "guild_create"
	MsgGuildInvite       = "guild_invite"
	MsgGuildRespond      = "guild_respond"
	MsgGuildLeave        = "guild_leave"
	MsgGuildKick         = "guild_kick"
	MsgGuildSetRank      = "guild_set_rank"
	MsgGuildTransfer     = "guild_transfer"
	MsgGuildSetMOTD      = "guild_set_motd"
	MsgGuildDisband      = "guild_disband"
	MsgGuildClaimLeader  = "guild_claim_leader"
	MsgGuildBankDeposit  = "guild_bank_deposit"
	MsgGuildBankWithdraw = "guild_bank_withdraw"
	MsgGuildUpdate       = "guild_update"
	MsgGuildLeaderboard  = "guild_leaderboard"

	// Consent-based PvP and arenas
	MsgDuelRequest    = "duel_request"
	MsgDuelRespond    = "duel_respond"
	MsgArenaQueue     = "arena_queue"
	MsgArenaLeave     = "arena_leave"
	MsgPvPGet         = "pvp_get"
	MsgPvPUpdate      = "pvp_update"
	MsgPvPLeaderboard = "pvp_leaderboard"
	MsgPvPFlag        = "pvp_flag"

	// Max-level Resonance progression
	MsgEndgameGet    = "endgame_get"
	MsgEndgameSpend  = "endgame_spend"
	MsgEndgameUpdate = "endgame_update"
	MsgRaidConvert   = "raid_convert"
	MsgRaidEnter     = "raid_enter"
	MsgRaidStatus    = "raid_status"
)

type SplitStackPayload struct {
	Slot   int `json:"slot"`
	Amount int `json:"amount"`
}

type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type GuildLeaderboardPayload struct {
	DungeonType string `json:"dungeonType"`
	Difficulty  string `json:"difficulty"`
	RunLevel    int    `json:"runLevel"`
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

type GuildCreatePayload struct {
	Name string `json:"name"`
	Tag  string `json:"tag"`
}

type GuildTargetPayload struct {
	Username string `json:"username"`
}

type GuildRespondPayload struct {
	GuildID string `json:"guildId"`
	Accept  bool   `json:"accept"`
}

type GuildRankPayload struct {
	PlayerID string `json:"playerId"`
	Rank     string `json:"rank"`
}

type GuildBankPayload struct {
	Gold   int    `json:"gold,omitempty"`
	ItemID string `json:"itemId,omitempty"`
}

type GuildMOTDPayload struct {
	MOTD string `json:"motd"`
}

type DuelRespondPayload struct {
	RequesterID string `json:"requesterId"`
	Accept      bool   `json:"accept"`
}

type ArenaQueuePayload struct {
	TeamSize int `json:"teamSize"`
}

type PvPFlagPayload struct {
	Enabled bool `json:"enabled"`
}

type EndgameSpendPayload struct {
	Trait string `json:"trait"`
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

type PartyReadyPayload struct {
	Ready bool `json:"ready"`
}

type PartyLootRulePayload struct {
	Rule           string `json:"rule"`
	MasterLooterID string `json:"masterLooterId,omitempty"`
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
	Query    string `json:"query"`
	ItemType string `json:"itemType,omitempty"`
	Rarity   string `json:"rarity,omitempty"`
	MinLevel int    `json:"minLevel,omitempty"`
	MaxLevel int    `json:"maxLevel,omitempty"`
}

type TradingCreatePayload struct {
	SlotIndex int `json:"slotIndex"`
	Bid       int `json:"bid"`
	Buyout    int `json:"buyout"`
	Duration  int `json:"duration"`
}

type TradeRequestPayload struct {
	TargetName string `json:"targetName"`
}

type TradeOfferPayload struct {
	TradeID string   `json:"tradeId"`
	ItemIDs []string `json:"itemIds"`
	Gold    int      `json:"gold"`
}

type TradeActionPayload struct {
	TradeID string `json:"tradeId"`
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
	TargetID   string `json:"targetId"`
	Amount     int    `json:"amount"`
	SourceID   string `json:"sourceId"`
	Kind       string `json:"kind,omitempty"`
	InstanceID string `json:"instanceId,omitempty"`
}

type ProjectileImpactPayload struct {
	ProjectileID   string  `json:"projectileId"`
	ProjectileType string  `json:"projectileType"`
	SourceID       string  `json:"sourceId"`
	TargetID       string  `json:"targetId,omitempty"`
	InstanceID     string  `json:"instanceId,omitempty"`
	SkillName      string  `json:"skillName,omitempty"`
	X              float64 `json:"x"`
	Y              float64 `json:"y"`
	Z              float64 `json:"z"`
	DirectionX     float64 `json:"directionX"`
	DirectionZ     float64 `json:"directionZ"`
	Radius         float64 `json:"radius,omitempty"`
	Terminal       bool    `json:"terminal"`
}

type ComboPayload struct {
	PlayerID  string `json:"playerId"`
	ComboID   string `json:"comboId"`
	ComboName string `json:"comboName"`
}

type TelegraphPayload struct {
	SourceID   string  `json:"sourceId"`
	X          float64 `json:"x"`
	Z          float64 `json:"z"`
	Radius     float64 `json:"radius"`
	Duration   float64 `json:"duration"`
	Theme      string  `json:"theme,omitempty"`
	Attack     string  `json:"attack,omitempty"`
	ThreatTier string  `json:"threatTier,omitempty"`
	Label      string  `json:"label,omitempty"`
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
	Message     string `json:"message"`
	Sender      string `json:"sender"`
	Channel     string `json:"channel,omitempty"`
	Recipient   string `json:"recipient,omitempty"`
	TimestampMs int64  `json:"timestampMs,omitempty"`
	History     bool   `json:"history,omitempty"`
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
