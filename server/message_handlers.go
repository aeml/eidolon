package main

// messageHandlers is the module-owned dispatch registry. New feature slices
// register here instead of extending the legacy switch in client_dispatch.go;
// the policy registry remains the mandatory admission gate before dispatch.
type messageHandler func(*Client, Message)

var messageHandlers = map[string]messageHandler{
	MsgTradingSearch:     handleMsgTradingSearch,
	MsgTradingMyAuctions: handleMsgTradingMyAuctions,
	MsgTradingCreate:     handleMsgTradingCreate,
	MsgTradingBid:        handleMsgTradingBid,
	MsgTradingBuyout:     handleMsgTradingBuyout,
	MsgTradingCollect:    handleMsgTradingCollect,
	MsgTradingCancel:     handleMsgTradingCancel,
	MsgTradeRequest:      handleDirectTradeRequest,
	MsgTradeOffer:        handleDirectTradeOffer,
	MsgTradeConfirm:      handleDirectTradeConfirm,
	MsgTradeCancel:       handleDirectTradeCancel,

	MsgPartyInvite:     handleMsgPartyInvite,
	MsgPartyResponse:   handleMsgPartyResponse,
	MsgPartyLeave:      handleMsgPartyLeave,
	MsgPartyKick:       handleMsgPartyKick,
	MsgPartyPromote:    handleMsgPartyPromote,
	MsgPartyReadyCheck: handleMsgPartyReadyCheck,
	MsgPartyReady:      handleMsgPartyReady,
	MsgPartyLootRule:   handleMsgPartyLootRule,
	MsgSocial:          handleMsgSocial,
	MsgSocialStatus:    handleMsgSocialStatus,

	MsgFriendList:    handleMsgFriendList,
	MsgFriendRequest: handleMsgFriendRequest,
	MsgFriendAccept:  handleMsgFriendAccept,
	MsgFriendDecline: handleMsgFriendDecline,
	MsgFriendRemove:  handleMsgFriendRemove,

	MsgGuildGet:          handleMsgGuildGet,
	MsgGuildCreate:       handleMsgGuildCreate,
	MsgGuildInvite:       handleMsgGuildInvite,
	MsgGuildRespond:      handleMsgGuildRespond,
	MsgGuildLeave:        handleMsgGuildLeave,
	MsgGuildKick:         handleMsgGuildKick,
	MsgGuildSetRank:      handleMsgGuildSetRank,
	MsgGuildTransfer:     handleMsgGuildTransfer,
	MsgGuildSetMOTD:      handleMsgGuildSetMOTD,
	MsgGuildDisband:      handleMsgGuildDisband,
	MsgGuildClaimLeader:  handleMsgGuildClaimLeader,
	MsgGuildBankDeposit:  handleMsgGuildBankDeposit,
	MsgGuildBankWithdraw: handleMsgGuildBankWithdraw,
	MsgGuildLeaderboard:  handleMsgGuildLeaderboard,

	MsgDuelRequest:    handleMsgDuelRequest,
	MsgDuelRespond:    handleMsgDuelRespond,
	MsgArenaQueue:     handleMsgArenaQueue,
	MsgArenaLeave:     handleMsgArenaLeave,
	MsgPvPGet:         handleMsgPvPGet,
	MsgPvPLeaderboard: handleMsgPvPLeaderboard,
	MsgPvPFlag:        handleMsgPvPFlag,

	MsgEndgameGet:   handleMsgEndgameGet,
	MsgEndgameSpend: handleMsgEndgameSpend,
	MsgRaidConvert:  handleMsgRaidConvert,
	MsgRaidEnter:    handleMsgRaidEnter,
}
