package main

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

var guildBankTransferMu sync.Mutex

type guildMemberView struct {
	PlayerID   string    `json:"playerId"`
	Username   string    `json:"username"`
	Rank       string    `json:"rank"`
	Online     bool      `json:"online"`
	Class      string    `json:"class,omitempty"`
	Level      int       `json:"level,omitempty"`
	JoinedAt   time.Time `json:"joinedAt"`
	LastOnline time.Time `json:"lastOnline"`
}

type guildView struct {
	ID          string                     `json:"id"`
	Name        string                     `json:"name"`
	Tag         string                     `json:"tag"`
	MOTD        string                     `json:"motd,omitempty"`
	LeaderID    string                     `json:"leaderId"`
	Members     []guildMemberView          `json:"members"`
	Bank        database.GuildBank         `json:"bank"`
	Audit       []database.GuildAuditEntry `json:"audit,omitempty"`
	Permissions map[string]bool            `json:"permissions"`
	CreatedAt   time.Time                  `json:"createdAt"`
}

type guildStatePayload struct {
	Guild   *guildView             `json:"guild"`
	Invites []database.GuildInvite `json:"invites"`
}

func handleMsgGuildGet(client *Client, _ Message) {
	sendGuildState(client)
}

func handleMsgGuildLeaderboard(client *Client, message Message) {
	var request GuildLeaderboardPayload
	if len(message.Payload) > 0 && json.Unmarshal(message.Payload, &request) != nil {
		client.sendError("invalid guild leaderboard request")
		return
	}
	if request.DungeonType == "" {
		request.DungeonType = "umbral_nexus"
	}
	if err := game.ValidateDungeonTypeEntry(game.MaxPlayerLevel, request.DungeonType); err != nil || request.DungeonType == "crypt" {
		client.sendError("invalid leaderboard dungeon")
		return
	}
	if request.Difficulty == "" {
		request.Difficulty = string(game.DifficultyMythic)
	}
	if request.Difficulty != string(game.DifficultyNormal) && request.Difficulty != string(game.DifficultyHeroic) && request.Difficulty != string(game.DifficultyMythic) {
		client.sendError("invalid leaderboard difficulty")
		return
	}
	if request.RunLevel == 0 {
		request.RunLevel = game.MaxPlayerLevel
	}
	if !game.CanSelectDungeonRunLevel(game.MaxPlayerLevel, request.RunLevel) {
		client.sendError("invalid leaderboard run level")
		return
	}
	runs, err := db.GuildDungeonLeaderboard(request.DungeonType, request.Difficulty, request.RunLevel, 20, time.Now().UTC())
	if err != nil {
		client.sendError("guild leaderboard unavailable")
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"season": database.CurrentGuildDungeonSeason(time.Now().UTC()), "runs": runs,
		"dungeonType": request.DungeonType, "difficulty": request.Difficulty, "runLevel": request.RunLevel,
	})
	client.sendSafe(createMessage(MsgGuildLeaderboard, payload))
}

func recordGuildDungeonCompletion(event game.DungeonCompletionEvent) {
	type guildGroup struct {
		guild *database.Guild
		count int
	}
	groups := make(map[string]*guildGroup)
	for _, playerID := range event.Participants {
		guild, err := db.GetGuildForPlayer(playerID)
		if err != nil || guild == nil {
			continue
		}
		group := groups[guild.ID]
		if group == nil {
			group = &guildGroup{guild: guild}
			groups[guild.ID] = group
		}
		group.count++
	}
	for _, group := range groups {
		if group.count < 2 {
			continue
		}
		err := db.RecordGuildDungeonRun(database.GuildDungeonRun{
			GuildID: group.guild.ID, GuildName: group.guild.Name, GuildTag: group.guild.Tag,
			DungeonType: event.DungeonType, Difficulty: string(event.Difficulty), RunLevel: event.RunLevel,
			DurationMS: event.Duration.Milliseconds(), MemberCount: group.count,
		})
		if err != nil {
			log.Printf("record guild dungeon run %s: %v", group.guild.ID, err)
			continue
		}
		broadcastGuildUpdate(group.guild.ID)
	}
}

func handleMsgGuildCreate(client *Client, message Message) {
	var payload GuildCreatePayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid guild creation payload")
		return
	}
	guild, err := db.CreateGuild(payload.Name, payload.Tag, client.playerID, client.username)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	client.sendSystemChat("Guild [" + guild.Tag + "] " + guild.Name + " created.")
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildInvite(client *Client, message Message) {
	var payload GuildTargetPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || strings.TrimSpace(payload.Username) == "" {
		client.sendError("invalid guild invite payload")
		return
	}
	targetUser, err := db.GetUser(strings.TrimSpace(payload.Username))
	if err != nil || targetUser == nil {
		client.sendError("player not found")
		return
	}
	if strings.EqualFold(targetUser.Username, client.username) || chatService.shouldFilter(targetUser.Username, client.username) || chatService.shouldFilter(client.username, targetUser.Username) {
		client.sendError("player is not available for guild invites")
		return
	}
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil || guild == nil {
		client.sendError("you are not in a guild")
		return
	}
	if err := db.InviteToGuild(guild.ID, client.playerID, usernameToPlayerID(targetUser.Username)); err != nil {
		client.sendError(err.Error())
		return
	}
	client.sendSystemChat("Guild invite sent to " + targetUser.Username + ".")
	if target := activeClientByUsername(targetUser.Username); target != nil {
		sendGuildState(target)
	}
}

func handleMsgGuildRespond(client *Client, message Message) {
	var payload GuildRespondPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.GuildID == "" {
		client.sendError("invalid guild response payload")
		return
	}
	guild, err := db.RespondGuildInvite(client.playerID, payload.GuildID, client.username, payload.Accept)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	if guild == nil {
		client.sendSystemChat("Guild invite declined.")
		sendGuildState(client)
		return
	}
	client.sendSystemChat("Joined [" + guild.Tag + "] " + guild.Name + ".")
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildLeave(client *Client, _ Message) {
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil || guild == nil {
		client.sendError("you are not in a guild")
		return
	}
	updated, disbanded, err := db.LeaveGuild(client.playerID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	client.sendSystemChat("You left the guild.")
	sendGuildState(client)
	if !disbanded && updated != nil {
		broadcastGuildUpdate(updated.ID)
	}
}

func handleMsgGuildKick(client *Client, message Message) {
	var payload GuildTargetPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.Username == "" {
		client.sendError("invalid guild kick payload")
		return
	}
	targetID := usernameToPlayerID(payload.Username)
	guild, err := db.KickGuildMember(client.playerID, targetID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	broadcastGuildUpdate(guild.ID)
	if target := activeClientByUsername(payload.Username); target != nil {
		target.sendSystemChat("You were removed from the guild.")
		sendGuildState(target)
	}
}

func handleMsgGuildSetRank(client *Client, message Message) {
	var payload GuildRankPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.PlayerID == "" {
		client.sendError("invalid guild rank payload")
		return
	}
	guild, err := db.SetGuildMemberRank(client.playerID, payload.PlayerID, strings.ToLower(payload.Rank))
	if err != nil {
		client.sendError(err.Error())
		return
	}
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildTransfer(client *Client, message Message) {
	var payload GuildRankPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || payload.PlayerID == "" {
		client.sendError("invalid guild transfer payload")
		return
	}
	guild, err := db.TransferGuildLeadership(client.playerID, payload.PlayerID)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildSetMOTD(client *Client, message Message) {
	var payload GuildMOTDPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil {
		client.sendError("invalid guild message payload")
		return
	}
	guild, err := db.SetGuildMOTD(client.playerID, payload.MOTD)
	if err != nil {
		client.sendError(err.Error())
		return
	}
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildDisband(client *Client, _ Message) {
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil || guild == nil {
		client.sendError("you are not in a guild")
		return
	}
	members := append([]database.GuildMember(nil), guild.Members...)
	if _, err := db.DisbandGuild(client.playerID); err != nil {
		client.sendError(err.Error())
		return
	}
	for _, member := range members {
		if target := getClientByPlayerID(member.PlayerID); target != nil {
			target.sendSystemChat("The guild was disbanded.")
			sendGuildState(target)
		}
	}
}

func handleMsgGuildClaimLeader(client *Client, _ Message) {
	guild, err := db.ClaimInactiveGuildLeadership(client.playerID, time.Now().UTC())
	if err != nil {
		client.sendError(err.Error())
		return
	}
	client.sendSystemChat("Inactive guild leadership claimed.")
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildBankDeposit(client *Client, message Message) {
	var payload GuildBankPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || (payload.Gold <= 0 && payload.ItemID == "") {
		client.sendError("invalid guild bank deposit")
		return
	}
	guildBankTransferMu.Lock()
	defer guildBankTransferMu.Unlock()
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil || guild == nil {
		client.sendError("you are not in a guild")
		return
	}
	if payload.Gold > 0 {
		if err := world.DebitPlayerGold(client.playerID, payload.Gold); err != nil {
			client.sendError(err.Error())
			return
		}
		updated, err := db.DepositGuildGold(guild.ID, client.playerID, payload.Gold)
		if err != nil {
			_ = world.CreditPlayerGold(client.playerID, payload.Gold)
			client.sendError(err.Error())
			return
		}
		guild = updated
	} else {
		item, err := world.DebitPlayerItem(client.playerID, payload.ItemID)
		if err != nil {
			client.sendError(err.Error())
			return
		}
		updated, err := db.DepositGuildItem(guild.ID, client.playerID, databaseItem(item))
		if err != nil {
			_ = world.CreditPlayerItem(client.playerID, item)
			client.sendError(err.Error())
			return
		}
		guild = updated
		sendInventoryForPlayer(client.playerID)
	}
	savePlayer(client)
	broadcastGuildUpdate(guild.ID)
}

func handleMsgGuildBankWithdraw(client *Client, message Message) {
	var payload GuildBankPayload
	if err := json.Unmarshal(message.Payload, &payload); err != nil || (payload.Gold <= 0 && payload.ItemID == "") {
		client.sendError("invalid guild bank withdrawal")
		return
	}
	guildBankTransferMu.Lock()
	defer guildBankTransferMu.Unlock()
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil || guild == nil {
		client.sendError("you are not in a guild")
		return
	}
	if payload.Gold > 0 {
		updated, err := db.WithdrawGuildGold(guild.ID, client.playerID, payload.Gold)
		if err != nil {
			client.sendError(err.Error())
			return
		}
		if err := world.CreditPlayerGold(client.playerID, payload.Gold); err != nil {
			_, _ = db.DepositGuildGold(guild.ID, client.playerID, payload.Gold)
			client.sendError(err.Error())
			return
		}
		guild = updated
	} else {
		updated, stored, err := db.WithdrawGuildItem(guild.ID, client.playerID, payload.ItemID)
		if err != nil {
			client.sendError(err.Error())
			return
		}
		item := gameItemFromDatabase(*stored)
		if err := world.CreditPlayerItem(client.playerID, item); err != nil {
			_, _ = db.DepositGuildItem(guild.ID, client.playerID, *stored)
			client.sendError(err.Error())
			return
		}
		guild = updated
		sendInventoryForPlayer(client.playerID)
	}
	savePlayer(client)
	broadcastGuildUpdate(guild.ID)
}

func sendGuildState(client *Client) {
	if client == nil || client.playerID == "" || db == nil {
		return
	}
	guild, err := db.GetGuildForPlayer(client.playerID)
	if err != nil {
		log.Printf("load guild state for %s: %v", client.username, err)
		return
	}
	invites := []database.GuildInvite{}
	if guild == nil {
		if loaded, err := db.GetGuildInvites(client.playerID); err == nil {
			invites = loaded
		}
	}
	payload := guildStatePayload{Invites: invites}
	if guild != nil {
		world.SetPlayerGuildIdentity(client.playerID, guild.ID, guild.Tag)
		payload.Guild = buildGuildView(guild, client.playerID)
	} else {
		world.SetPlayerGuildIdentity(client.playerID, "", "")
	}
	encoded, _ := json.Marshal(payload)
	client.sendSafe(createMessage(MsgGuildUpdate, encoded))
}

func buildGuildView(guild *database.Guild, viewerID string) *guildView {
	view := &guildView{
		ID: guild.ID, Name: guild.Name, Tag: guild.Tag, MOTD: guild.MOTD, LeaderID: guild.LeaderID,
		Members: make([]guildMemberView, 0, len(guild.Members)), Bank: guild.Bank,
		Permissions: map[string]bool{}, CreatedAt: guild.CreatedAt,
	}
	viewerRank := database.GuildRankMember
	for _, member := range guild.Members {
		memberView := guildMemberView{PlayerID: member.PlayerID, Username: member.Username, Rank: member.Rank, JoinedAt: member.JoinedAt, LastOnline: member.LastOnline}
		if member.PlayerID == viewerID {
			viewerRank = member.Rank
		}
		if memberClient := getClientByPlayerID(member.PlayerID); memberClient != nil {
			memberView.Online = true
			if entity := world.GetEntityCopy(member.PlayerID); entity != nil {
				memberView.Class = entity.SubType
				memberView.Level = entity.Level
			}
		}
		view.Members = append(view.Members, memberView)
	}
	for _, permission := range []string{database.GuildPermissionInvite, database.GuildPermissionKick, database.GuildPermissionSetRank, database.GuildPermissionWithdrawBank, database.GuildPermissionViewAudit, database.GuildPermissionManageMOTD} {
		view.Permissions[permission] = database.GuildRankCan(viewerRank, permission)
	}
	view.Permissions["disband"] = guild.LeaderID == viewerID
	if viewerRank == database.GuildRankOfficer {
		for _, member := range guild.Members {
			if member.PlayerID == guild.LeaderID && !member.LastOnline.IsZero() && time.Since(member.LastOnline) >= database.GuildInactiveLeaderAfter {
				view.Permissions["claim_leadership"] = true
			}
		}
	}
	if view.Permissions[database.GuildPermissionViewAudit] {
		view.Audit = guild.Audit
	}
	return view
}

func broadcastGuildUpdate(guildID string) {
	guild, err := db.GetGuildByID(guildID)
	if err != nil || guild == nil {
		return
	}
	for _, member := range guild.Members {
		if client := getClientByPlayerID(member.PlayerID); client != nil {
			sendGuildState(client)
		}
	}
}

func touchAndBroadcastGuildPresence(playerID string, at time.Time) {
	if db == nil || playerID == "" {
		return
	}
	if err := db.TouchGuildMember(playerID, at); err != nil {
		log.Printf("touch guild member %s: %v", playerID, err)
		return
	}
	guild, err := db.GetGuildForPlayer(playerID)
	if err == nil && guild != nil {
		broadcastGuildUpdate(guild.ID)
	}
}
