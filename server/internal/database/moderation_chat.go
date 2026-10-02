package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	ChatModerationMute            = "mute"
	ChatModerationRevoke          = "revoke"
	ModerationSuspend             = "suspend"
	ModerationRequireNameChange   = "require_name_change"
	MaximumChatModerationReceipts = 256
	// Storage safety ceiling, not a default punishment or approved staff policy.
	MaximumChatMuteSeconds int64 = 30 * 24 * 60 * 60
)

var ErrChatModerationConflict = errors.New("chat moderation changed or request identity reused")

// All three response types have owner approval. Full enforcement and connected
// acceptance remain deployment gates; persistence alone does not activate them.
// Account _id is immutable; display-name changes cannot bypass this state.
type ChatModerationRequest struct {
	ID               string `json:"id"`
	ReportID         string `json:"reportId"`
	ExpectedRevision int64  `json:"expectedRevision"`
	Action           string `json:"action"`
	DurationSeconds  int64  `json:"durationSeconds"`
	NoticeID         string `json:"noticeId"`
	PublicReason     string `json:"publicReason"`
	PrivateReason    string `json:"privateReason"`
	Confirmed        bool   `json:"confirmed"`
}

type ChatMuteNotice struct {
	Kind      string    `bson:"kind,omitempty" json:"kind,omitempty"`
	ID        string    `bson:"id" json:"id"`
	StartedAt time.Time `bson:"started_at" json:"startedAt"`
	ExpiresAt time.Time `bson:"expires_at" json:"expiresAt"`
	Reason    string    `bson:"reason" json:"reason"`
}

func (n ChatMuteNotice) Valid() bool {
	if !validChatNoticeID(n.ID) || n.StartedAt.IsZero() || strings.TrimSpace(n.Reason) == "" || !boundedActivityText(n.Reason, 600, true) {
		return false
	}
	if n.Kind == ModerationRequireNameChange {
		return n.ExpiresAt.IsZero() // Ends through an accepted name change or an explicit reversal, never silent expiry.
	}
	return (n.Kind == "" || n.Kind == ChatModerationMute || n.Kind == ModerationSuspend) &&
		n.ExpiresAt.After(n.StartedAt) && n.ExpiresAt.Sub(n.StartedAt) <= time.Duration(MaximumChatMuteSeconds)*time.Second
}

func (n ChatMuteNotice) Active(now time.Time) bool {
	return n.Valid() && !now.IsZero() && !now.Before(n.StartedAt) &&
		(n.Kind == ModerationRequireNameChange || now.Before(n.ExpiresAt))
}

// Never marshal private staff receipts as an account or player response.
type ChatModerationReceipt struct {
	RequestID     string         `bson:"request_id" json:"-"`
	Fingerprint   string         `bson:"fingerprint" json:"-"`
	Actor         string         `bson:"actor" json:"-"`
	ReportID      string         `bson:"report_id" json:"-"`
	At            time.Time      `bson:"at" json:"-"`
	Revision      int64          `bson:"revision" json:"-"`
	Action        string         `bson:"action" json:"-"`
	Notice        ChatMuteNotice `bson:"notice" json:"-"`
	PrivateReason string         `bson:"private_reason" json:"-"`
}

type AccountChatModeration struct {
	Revision   int64                            `bson:"revision" json:"-"`
	Mute       *ChatMuteNotice                  `bson:"mute,omitempty" json:"-"`
	Suspension *ChatMuteNotice                  `bson:"suspension,omitempty" json:"-"`
	NameChange *ChatMuteNotice                  `bson:"name_change,omitempty" json:"-"`
	Receipts   map[string]ChatModerationReceipt `bson:"receipts,omitempty" json:"-"`
}

func (r ChatModerationRequest) Validate() error {
	id, err := primitive.ObjectIDFromHex(r.ReportID)
	text := func(value string, max int) bool {
		return strings.TrimSpace(value) != "" && boundedActivityText(value, max, true)
	}
	if err != nil || id.IsZero() || id.Hex() != r.ReportID ||
		!adminOperationRequestID.MatchString(r.ID) || !r.Confirmed ||
		r.ExpectedRevision < 0 || r.ExpectedRevision >= MaximumChatModerationReceipts ||
		!text(r.PrivateReason, 1600) {
		return errors.New("invalid chat moderation request")
	}
	switch r.Action {
	case ChatModerationMute, ModerationSuspend:
		// Reserve at least one reversal here; preparation also reserves one
		// for every other restriction using the current account state.
		if r.ExpectedRevision >= MaximumChatModerationReceipts-1 || r.NoticeID != "" || r.DurationSeconds < 1 || r.DurationSeconds > MaximumChatMuteSeconds || !text(r.PublicReason, 600) {
			return errors.New("invalid chat mute")
		}
	case ModerationRequireNameChange:
		if r.ExpectedRevision >= MaximumChatModerationReceipts-1 || r.NoticeID != "" || r.DurationSeconds != 0 || !text(r.PublicReason, 600) {
			return errors.New("invalid required name change")
		}
	case ChatModerationRevoke:
		if !validChatNoticeID(r.NoticeID) || r.DurationSeconds != 0 || r.PublicReason != "" {
			return errors.New("invalid chat mute reversal")
		}
	default:
		return errors.New("unsupported chat moderation action")
	}
	return nil
}

func validChatNoticeID(value string) bool {
	decoded, err := hex.DecodeString(value)
	return err == nil && len(decoded) == sha256.Size && hex.EncodeToString(decoded) == value
}

func (r ChatModerationRequest) identities(actor string, accountID primitive.ObjectID) (string, string) {
	identity, _ := json.Marshal([]string{actor, accountID.Hex(), r.ID})
	hash := sha256.Sum256(identity)
	fields, _ := json.Marshal([]interface{}{actor, accountID.Hex(), r.ID, r.ReportID,
		r.ExpectedRevision, r.Action, r.DurationSeconds, r.NoticeID, r.PublicReason, r.PrivateReason})
	fingerprint := sha256.Sum256(fields)
	return hex.EncodeToString(hash[:]), hex.EncodeToString(fingerprint[:])
}

func (r ChatModerationReceipt) matches(actor string, accountID primitive.ObjectID, request ChatModerationRequest) bool {
	identity, fingerprint := request.identities(actor, accountID)
	if r.RequestID != request.ID || r.Fingerprint != fingerprint ||
		r.Actor != AdminActivityAccountKey(actor) || r.ReportID != request.ReportID ||
		r.At.IsZero() || !r.At.Equal(r.At.UTC().Truncate(time.Millisecond)) ||
		r.Revision != request.ExpectedRevision+1 || r.Action != request.Action || r.PrivateReason != request.PrivateReason {
		return false
	}
	if request.Action != ChatModerationRevoke {
		kind := r.Notice.Kind
		if kind == "" {
			kind = ChatModerationMute
		}
		expires := r.At.Add(time.Duration(request.DurationSeconds) * time.Second)
		if request.Action == ModerationRequireNameChange {
			expires = time.Time{}
		}
		return kind == request.Action && r.Notice.Valid() && r.Notice.ID == identity && r.Notice.StartedAt.Equal(r.At) &&
			r.Notice.ExpiresAt.Equal(expires) && r.Notice.Reason == request.PublicReason
	}
	return r.Notice.ID == request.NoticeID && r.Notice.StartedAt.IsZero() && r.Notice.ExpiresAt.IsZero() && r.Notice.Reason == ""
}

// Exact retries return the original receipt, including its original expiry;
// they never restart a timer. Reversal targets the quoted notice, not whatever
// later mute another reviewer might have issued. Inputs are not modified.
func PrepareChatModeration(state AccountChatModeration, actor string, accountID primitive.ObjectID,
	request ChatModerationRequest, now time.Time) (AccountChatModeration, ChatModerationReceipt, bool, error) {
	if err := request.Validate(); err != nil || actor == "" || accountID.IsZero() || now.IsZero() {
		return state, ChatModerationReceipt{}, false, errors.New("invalid chat moderation request")
	}
	if err := state.validate(); err != nil {
		return state, ChatModerationReceipt{}, false, err
	}
	identity, fingerprint := request.identities(actor, accountID)
	if receipt, found := state.Receipts[identity]; found {
		if !receipt.matches(actor, accountID, request) {
			return state, ChatModerationReceipt{}, false, ErrChatModerationConflict
		}
		return state, receipt, true, nil
	}
	if state.Revision != request.ExpectedRevision || len(state.Receipts) >= MaximumChatModerationReceipts ||
		(request.Action == ChatModerationRevoke && state.noticeByID(request.NoticeID) == nil) {
		return state, ChatModerationReceipt{}, false, ErrChatModerationConflict
	}
	at := now.UTC().Truncate(time.Millisecond)
	receipt := ChatModerationReceipt{RequestID: request.ID, Fingerprint: fingerprint,
		Actor: AdminActivityAccountKey(actor), ReportID: request.ReportID, At: at,
		Revision: request.ExpectedRevision + 1, Action: request.Action, PrivateReason: request.PrivateReason}
	next := state
	next.Revision = receipt.Revision
	next.Receipts = make(map[string]ChatModerationReceipt, len(state.Receipts)+1)
	for key, value := range state.Receipts {
		next.Receipts[key] = value
	}
	if request.Action != ChatModerationRevoke {
		receipt.Notice = ChatMuteNotice{Kind: request.Action, ID: identity, StartedAt: at,
			ExpiresAt: at.Add(time.Duration(request.DurationSeconds) * time.Second), Reason: request.PublicReason}
		if request.Action == ModerationRequireNameChange {
			receipt.Notice.ExpiresAt = time.Time{}
		}
		notice := receipt.Notice
		switch request.Action {
		case ChatModerationMute:
			next.Mute = &notice
		case ModerationSuspend:
			next.Suspension = &notice
		case ModerationRequireNameChange:
			next.NameChange = &notice
		}
	} else {
		receipt.Notice.ID = request.NoticeID
		if next.Mute != nil && next.Mute.ID == request.NoticeID {
			next.Mute = nil
		}
		if next.Suspension != nil && next.Suspension.ID == request.NoticeID {
			next.Suspension = nil
		}
		if next.NameChange != nil && next.NameChange.ID == request.NoticeID {
			next.NameChange = nil
		}
	}
	// Reserve one durable reversal (or name completion) for each remaining notice.
	// Include expired notices: staff can still explicitly withdraw their record.
	remaining := 0
	for _, notice := range []*ChatMuteNotice{next.Mute, next.Suspension, next.NameChange} {
		if notice != nil {
			remaining++
		}
	}
	if next.Revision+int64(remaining) > MaximumChatModerationReceipts {
		return state, ChatModerationReceipt{}, false, ErrChatModerationConflict
	}
	next.Receipts[identity] = receipt
	return next, receipt, false, nil
}

// Public projection never exposes the case ID, staff account or private reason.
// Expiry is read-time only: no sweep, account write or history deletion needed.
func (s AccountChatModeration) ActiveNotice(now time.Time) *ChatMuteNotice {
	if s.validate() != nil || s.Mute == nil || !s.Mute.Active(now) {
		return nil
	}
	notice := *s.Mute
	return &notice
}

func (s AccountChatModeration) noticeByID(id string) *ChatMuteNotice {
	for _, notice := range []*ChatMuteNotice{s.Mute, s.Suspension, s.NameChange} {
		if notice != nil && notice.ID == id {
			return notice
		}
	}
	return nil
}

// Independent copies in a stable order; never expose private staff receipts.
func (s AccountChatModeration) ActiveNotices(now time.Time) []ChatMuteNotice {
	if s.validate() != nil {
		return nil
	}
	var notices []ChatMuteNotice
	for _, notice := range []*ChatMuteNotice{s.Mute, s.Suspension, s.NameChange} {
		if notice != nil && notice.Active(now) {
			notices = append(notices, *notice)
		}
	}
	return notices
}

func (s AccountChatModeration) validate() error {
	if s.Revision < 0 || s.Revision > MaximumChatModerationReceipts || int64(len(s.Receipts)) != s.Revision {
		return ErrChatModerationConflict
	}
	remaining := 0
	for kind, notice := range map[string]*ChatMuteNotice{ChatModerationMute: s.Mute, ModerationSuspend: s.Suspension, ModerationRequireNameChange: s.NameChange} {
		if notice == nil {
			continue
		}
		remaining++
		receipt, found := s.Receipts[notice.ID]
		noticeKind := notice.Kind
		if noticeKind == "" {
			noticeKind = ChatModerationMute
		}
		if !found || receipt.Action != kind || noticeKind != kind || !notice.Valid() ||
			receipt.Notice != *notice || !notice.StartedAt.Equal(receipt.At) {
			return ErrChatModerationConflict
		}
	}
	if s.Revision+int64(remaining) > MaximumChatModerationReceipts {
		return ErrChatModerationConflict
	}
	return nil
}

// The authenticated owner is supplied by the server, never a request payload.
// Project only moderation, not credentials, email, roles or character saves.
func (db *DB) OwnChatMuteNotice(username string) (*ChatMuteNotice, error) {
	if db == nil || db.users == nil || username == "" {
		return nil, errors.New("chat moderation store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record struct {
		State AccountChatModeration `bson:"chat_moderation"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(bson.M{"chat_moderation": 1})).Decode(&record); err != nil {
		return nil, err
	}
	if err := record.State.validate(); err != nil {
		return nil, err
	}
	return record.State.ActiveNotice(time.Now()), nil
}

// Authentication supplies username; clients cannot request another account.
// Suspension enforcement and private appeal presentation share this projection.
func (db *DB) OwnModerationNotices(username string) ([]ChatMuteNotice, error) {
	if db == nil || db.users == nil || username == "" {
		return nil, errors.New("moderation store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var record struct {
		State AccountChatModeration `bson:"chat_moderation"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(bson.M{"chat_moderation": 1})).Decode(&record); err != nil {
		return nil, err
	}
	if err := record.State.validate(); err != nil {
		return nil, err
	}
	return record.State.ActiveNotices(time.Now()), nil
}

func chatModerationFilter(accountID primitive.ObjectID, revision int64) bson.M {
	filter := bson.M{"_id": accountID}
	if revision == 0 {
		filter["$or"] = bson.A{bson.M{"chat_moderation.revision": 0}, bson.M{"chat_moderation": bson.M{"$exists": false}}}
	} else {
		filter["chat_moderation.revision"] = revision
	}
	return filter
}

func (db *DB) ReadAccountChatModeration(accountID primitive.ObjectID) (AccountChatModeration, error) {
	if db == nil || db.users == nil || accountID.IsZero() {
		return AccountChatModeration{}, errors.New("chat moderation store unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return db.readAccountChatModeration(ctx, accountID)
}

func (db *DB) readAccountChatModeration(ctx context.Context, accountID primitive.ObjectID) (AccountChatModeration, error) {
	var record struct {
		State AccountChatModeration `bson:"chat_moderation"`
	}
	err := db.users.FindOne(ctx, bson.M{"_id": accountID}, options.FindOne().SetProjection(bson.M{"chat_moderation": 1})).Decode(&record)
	if err == nil {
		err = record.State.validate()
	}
	return record.State, err
}

// State and its staff receipt commit together in one existing account document.
// This does not resolve the case. Future handlers must fence the current staff
// session and admit the action to activity history before calling this store.
func (db *DB) ApplyChatModeration(actor string, accountID primitive.ObjectID, request ChatModerationRequest) (ChatModerationReceipt, error) {
	if err := request.Validate(); err != nil {
		return ChatModerationReceipt{}, err
	}
	if db == nil || db.users == nil || db.reports == nil || actor == "" || accountID.IsZero() {
		return ChatModerationReceipt{}, errors.New("chat moderation store unavailable")
	}
	allowed, err := db.HasAdminRole(actor)
	if err != nil || !allowed {
		return ChatModerationReceipt{}, errors.New("administrator role is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	state, err := db.readAccountChatModeration(ctx, accountID)
	if err != nil {
		return ChatModerationReceipt{}, err
	}
	next, receipt, replay, err := PrepareChatModeration(state, actor, accountID, request, time.Now())
	if err != nil || replay {
		return receipt, err
	}
	caseID, _ := primitive.ObjectIDFromHex(request.ReportID)
	if err := db.reports.FindOne(ctx, bson.M{"_id": caseID, "report_type": bson.M{"$in": bson.A{"Player Report", "Moderation Appeal"}}},
		options.FindOne().SetProjection(bson.M{"_id": 1})).Err(); err != nil {
		return ChatModerationReceipt{}, errors.New("conduct case or appeal is required")
	}
	result, err := db.users.UpdateOne(ctx, chatModerationFilter(accountID, state.Revision), bson.M{"$set": bson.M{"chat_moderation": next}})
	if err != nil {
		// An uncertain write is not success; an explicit identical retry reads
		// the durable receipt instead of extending or duplicating the mute.
		return ChatModerationReceipt{}, err
	}
	if result.MatchedCount == 1 {
		return receipt, nil
	}
	current, err := db.readAccountChatModeration(ctx, accountID)
	if err != nil {
		return ChatModerationReceipt{}, err
	}
	identity, _ := request.identities(actor, accountID)
	if saved, ok := current.Receipts[identity]; ok && saved.matches(actor, accountID, request) {
		return saved, nil
	}
	return ChatModerationReceipt{}, ErrChatModerationConflict
}
