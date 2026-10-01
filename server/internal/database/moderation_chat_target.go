package database

import (
	"context"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Staff must choose the subject explicitly; a report author is not its accused
// player. This bounded preview exposes no credentials, saves or private receipts.
type ChatModerationTarget struct {
	AccountID primitive.ObjectID `json:"accountId"`
	Account   string             `json:"account"`
	Revision  int64              `json:"revision"`
	Notice    *ChatMuteNotice    `json:"notice,omitempty"`
}

func (target ChatModerationTarget) Valid() bool {
	return !target.AccountID.IsZero() && strings.TrimSpace(target.Account) != "" &&
		boundedActivityText(target.Account, 256, true) && target.Revision >= 0 && target.Revision <= MaximumChatModerationReceipts &&
		(target.Notice == nil || target.Notice.Valid())
}

func projectChatModerationTarget(accountID primitive.ObjectID, username string, state AccountChatModeration, now time.Time) (ChatModerationTarget, error) {
	if err := state.validate(); err != nil {
		return ChatModerationTarget{}, err
	}
	target := ChatModerationTarget{AccountID: accountID, Account: username, Revision: state.Revision, Notice: state.ActiveNotice(now)}
	if now.IsZero() || !target.Valid() {
		return ChatModerationTarget{}, errors.New("invalid moderation target")
	}
	return target, nil
}

func (db *DB) ReadChatModerationTarget(actor, username string) (ChatModerationTarget, error) {
	unavailable := errors.New("chat moderation target unavailable")
	if db == nil || db.users == nil || actor == "" || strings.TrimSpace(username) == "" || !boundedActivityText(username, 256, true) {
		return ChatModerationTarget{}, unavailable
	}
	allowed, err := db.HasAdminRole(actor)
	if err != nil || !allowed {
		return ChatModerationTarget{}, unavailable
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record struct {
		ID       primitive.ObjectID    `bson:"_id"`
		Username string                `bson:"username"`
		State    AccountChatModeration `bson:"chat_moderation"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(
		bson.M{"_id": 1, "username": 1, "chat_moderation": 1})).Decode(&record); err != nil {
		return ChatModerationTarget{}, unavailable
	}
	allowed, err = db.HasAdminRole(actor)
	if err != nil || !allowed {
		return ChatModerationTarget{}, unavailable
	}
	return projectChatModerationTarget(record.ID, record.Username, record.State, time.Now())
}
