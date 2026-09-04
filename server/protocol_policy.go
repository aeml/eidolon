package main

import (
	"fmt"
	"time"
)

type messageAccess uint8

const (
	accessPublic messageAccess = iota
	accessAuthenticated
	accessCharacter
)

type messagePolicy struct {
	access          messageAccess
	maxPayloadBytes int
	burst           int
	window          time.Duration
}

type messageRateBucket struct {
	tokens  float64
	updated time.Time
}

func policy(access messageAccess, maxPayloadBytes, burst int, window time.Duration) messagePolicy {
	return messagePolicy{
		access:          access,
		maxPayloadBytes: maxPayloadBytes,
		burst:           burst,
		window:          window,
	}
}

// inboundMessagePolicies is the protocol contract for every client-to-server
// message. Adding a switch case without adding a policy makes the new message
// unreachable by design, so authentication, payload size, and rate limits
// cannot be accidentally omitted.
var inboundMessagePolicies = map[string]messagePolicy{
	MsgRegister:      policy(accessPublic, 8<<10, 5, time.Minute),
	MsgLogin:         policy(accessPublic, 8<<10, 5, time.Minute),
	MsgResumeSession: policy(accessPublic, 4<<10, 10, time.Minute),
	MsgJoin:          policy(accessAuthenticated, 2<<10, 3, 10*time.Second),

	MsgMove:    policy(accessCharacter, 2<<10, 90, time.Second),
	MsgJump:    policy(accessCharacter, 2<<10, 12, time.Second),
	MsgAttack:  policy(accessCharacter, 2<<10, 30, time.Second),
	MsgPickup:  policy(accessCharacter, 2<<10, 20, time.Second),
	MsgAbility: policy(accessCharacter, 4<<10, 30, time.Second),
	MsgChat:    policy(accessCharacter, 2<<10, 5, 5*time.Second),

	MsgEnterDungeon:     policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgGetDungeonStatus: policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgResetDungeon:     policy(accessCharacter, 1<<10, 3, 10*time.Second),

	MsgEquip:             policy(accessCharacter, 2<<10, 20, time.Second),
	MsgUnequip:           policy(accessCharacter, 2<<10, 20, time.Second),
	MsgInventoryMove:     policy(accessCharacter, 2<<10, 30, time.Second),
	MsgInventorySort:     policy(accessCharacter, 1<<10, 5, time.Second),
	MsgSplitStack:        policy(accessCharacter, 2<<10, 20, time.Second),
	MsgBuyGamble:         policy(accessCharacter, 2<<10, 10, time.Second),
	MsgSell:              policy(accessCharacter, 2<<10, 10, time.Second),
	MsgBuyback:           policy(accessCharacter, 2<<10, 10, time.Second),
	MsgStashDeposit:      policy(accessCharacter, 2<<10, 15, time.Second),
	MsgStashWithdraw:     policy(accessCharacter, 2<<10, 15, time.Second),
	MsgForgeUpgrade:      policy(accessCharacter, 2<<10, 10, time.Second),
	MsgForgePotency:      policy(accessCharacter, 2<<10, 10, time.Second),
	MsgForgeSocket:       policy(accessCharacter, 2<<10, 10, time.Second),
	MsgForgeInsertGem:    policy(accessCharacter, 2<<10, 10, time.Second),
	MsgForgeCombineGem:   policy(accessCharacter, 2<<10, 10, time.Second),
	MsgForgeRemoveGem:    policy(accessCharacter, 2<<10, 10, time.Second),
	MsgTradingSearch:     policy(accessCharacter, 4<<10, 10, time.Second),
	MsgTradingMyAuctions: policy(accessCharacter, 1<<10, 10, time.Second),
	MsgTradingCreate:     policy(accessCharacter, 4<<10, 10, time.Second),
	MsgTradingBid:        policy(accessCharacter, 2<<10, 10, time.Second),
	MsgTradingBuyout:     policy(accessCharacter, 2<<10, 10, time.Second),
	MsgTradingCollect:    policy(accessCharacter, 2<<10, 10, time.Second),
	MsgTradingCancel:     policy(accessCharacter, 2<<10, 10, time.Second),
	MsgTradeRequest:      policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgTradeOffer:        policy(accessCharacter, 8<<10, 10, time.Second),
	MsgTradeConfirm:      policy(accessCharacter, 1<<10, 10, time.Second),
	MsgTradeCancel:       policy(accessCharacter, 1<<10, 10, time.Second),

	MsgPartyInvite:       policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgPartyResponse:     policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgPartyLeave:        policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgPartyKick:         policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgPartyPromote:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgPartyReadyCheck:   policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgPartyReady:        policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgPartyLootRule:     policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgSocial:            policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgSocialStatus:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgFriendList:        policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgFriendRequest:     policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgFriendAccept:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgFriendDecline:     policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgFriendRemove:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildGet:          policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgGuildCreate:       policy(accessCharacter, 2<<10, 3, time.Minute),
	MsgGuildInvite:       policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildRespond:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildLeave:        policy(accessCharacter, 1<<10, 3, 10*time.Second),
	MsgGuildKick:         policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildSetRank:      policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildTransfer:     policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgGuildSetMOTD:      policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgGuildDisband:      policy(accessCharacter, 1<<10, 2, time.Minute),
	MsgGuildClaimLeader:  policy(accessCharacter, 1<<10, 2, time.Minute),
	MsgGuildBankDeposit:  policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildBankWithdraw: policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGuildLeaderboard:  policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgDuelRequest:       policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgDuelRespond:       policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgArenaQueue:        policy(accessCharacter, 1<<10, 3, 10*time.Second),
	MsgArenaLeave:        policy(accessCharacter, 1<<10, 3, 10*time.Second),
	MsgPvPGet:            policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgPvPLeaderboard:    policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgPvPFlag:           policy(accessCharacter, 1<<10, 3, 10*time.Second),
	MsgEndgameGet:        policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgEndgameSpend:      policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgRaidConvert:       policy(accessCharacter, 1<<10, 2, time.Minute),
	MsgRaidEnter:         policy(accessCharacter, 1<<10, 2, time.Minute),

	MsgRespawn:       policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgRecall:        policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgReport:        policy(accessCharacter, 16<<10, 2, time.Minute),
	MsgRequestQuests: policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgAcceptQuest:   policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgCompleteQuest: policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgSelectBranch:  policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgUnlockSkill:   policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgUnlockTalent:  policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgResetTalents:  policy(accessCharacter, 1<<10, 5, 10*time.Second),
	MsgRespec:        policy(accessCharacter, 2<<10, 5, 10*time.Second),
	MsgRespecCost:    policy(accessCharacter, 1<<10, 10, 10*time.Second),
	MsgSelectRune:    policy(accessCharacter, 2<<10, 10, 10*time.Second),
	MsgGetRunes:      policy(accessCharacter, 1<<10, 10, 10*time.Second),
}

func (c *Client) handleMessage(msg Message) {
	if err := c.acceptInboundMessage(msg, time.Now()); err != nil {
		c.sendError(err.Error())
		return
	}
	if handler := messageHandlers[msg.Type]; handler != nil {
		handler(c, msg)
		return
	}
	c.dispatchMessage(msg)
}

func (c *Client) acceptInboundMessage(msg Message, now time.Time) error {
	p, known := inboundMessagePolicies[msg.Type]
	if !known {
		return fmt.Errorf("unsupported message type")
	}
	if len(msg.Payload) > p.maxPayloadBytes {
		return fmt.Errorf("message payload too large")
	}
	if p.access >= accessAuthenticated && c.username == "" {
		return fmt.Errorf("authentication required")
	}
	if p.access >= accessCharacter && c.playerID == "" {
		return fmt.Errorf("active character required")
	}
	if !c.consumeMessageRate(msg.Type, p, now) {
		return fmt.Errorf("message rate limit exceeded")
	}
	return nil
}

func (c *Client) consumeMessageRate(messageType string, p messagePolicy, now time.Time) bool {
	c.policyMu.Lock()
	defer c.policyMu.Unlock()

	if c.messageRates == nil {
		c.messageRates = make(map[string]*messageRateBucket)
	}
	bucket := c.messageRates[messageType]
	if bucket == nil {
		bucket = &messageRateBucket{tokens: float64(p.burst), updated: now}
		c.messageRates[messageType] = bucket
	}

	if now.After(bucket.updated) {
		refill := now.Sub(bucket.updated).Seconds() * float64(p.burst) / p.window.Seconds()
		bucket.tokens = min(float64(p.burst), bucket.tokens+refill)
		bucket.updated = now
	}
	if bucket.tokens < 1 {
		return false
	}
	bucket.tokens--
	return true
}
