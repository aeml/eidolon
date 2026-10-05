package database

import (
	"encoding/json"
	"errors"
	"time"
)

var errOwnerProfileSnapshot = errors.New("owner account profile could not be encoded within its budget")

// Prepared source projection, not a query, endpoint or authorization mechanism.
// The eventual reader must retrieve these fields together from one account,
// using the authenticated owner's identity. It must not combine an account
// document with a recovery address supplied by a client or another account.
type ownerProfileSource struct {
	Username      string                  `bson:"username" json:"-"`
	PublicName    string                  `bson:"public_name" json:"-"`
	Email         string                  `bson:"email" json:"-"`
	CreatedAt     time.Time               `bson:"created_at" json:"-"`
	RecoveryEmail recoveryEmail           `bson:"recovery_email" json:"-"`
	VIPPeriods    []VIPPeriod             `bson:"vip_periods" json:"-"`
	Characters    []ownerCharacterSummary `bson:"character_roster" json:"-"`
	Moderation    struct {
		Mute       *ChatMuteNotice `bson:"mute"`
		Suspension *ChatMuteNotice `bson:"suspension"`
		NameChange *ChatMuteNotice `bson:"name_change"`
	} `bson:"chat_moderation" json:"-"`
}

type ownerProfileSnapshot struct {
	Format      string              `json:"format"`
	Version     int                 `json:"version"`
	GeneratedAt time.Time           `json:"generated_at"`
	Coverage    ownerExportCoverage `json:"coverage"`
	Profile     ownerAccountProfile `json:"profile"`
}

// Explicit output types never embed User, recoveryAccount or staff records.
// The submitted registration address is deliberately separate from an address
// verified through recovery. Neither address is account-ownership proof here.
type ownerAccountProfile struct {
	Username              string                        `json:"username"`
	PublicName            string                        `json:"public_name"`
	SubmittedEmail        string                        `json:"submitted_email"`
	CreatedAt             *time.Time                    `json:"created_at,omitempty"`
	VerifiedRecoveryEmail *ownerVerifiedRecoveryAddress `json:"verified_recovery_email,omitempty"`
	VIPPeriods            []ownerVIPPeriod              `json:"vip_periods"`
	Characters            []ownerCharacterSummary       `json:"character_roster"`
	ModerationNotices     []ownerModerationNotice       `json:"current_public_moderation_notices"`
}

type ownerCharacterSummary struct {
	Name  string `bson:"name" json:"name"`
	Class string `bson:"class" json:"class"`
	Level int    `bson:"level" json:"level"`
}

type ownerVIPPeriod struct {
	ID       string    `json:"id"`
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
	Revoked  bool      `json:"revoked"`
}

type ownerModerationNotice struct {
	ID           string     `json:"id"`
	Kind         string     `json:"kind"`
	StartedAt    time.Time  `json:"started_at"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	PublicReason string     `json:"public_reason"`
	Active       bool       `json:"active_at_read"`
}

type ownerVerifiedRecoveryAddress struct {
	Address    string    `json:"address"`
	VerifiedAt time.Time `json:"verified_at"`
}

func encodeOwnerProfileSnapshot(source ownerProfileSource, provedOwner string, generatedAt time.Time, maxBytes int) ([]byte, error) {
	// This identity fence is additional defense, not proof of authentication.
	if provedOwner == "" || source.Username != provedOwner || generatedAt.IsZero() || maxBytes < 1 {
		return nil, errOwnerProfileSnapshot
	}
	profile := ownerAccountProfile{Username: source.Username, PublicName: source.PublicName, SubmittedEmail: source.Email}
	profile.Characters = append([]ownerCharacterSummary{}, source.Characters...)
	profile.VIPPeriods = make([]ownerVIPPeriod, 0, len(source.VIPPeriods))
	if ValidateVIPPeriods(source.VIPPeriods) != nil {
		return nil, errOwnerProfileSnapshot
	}
	for _, period := range source.VIPPeriods {
		profile.VIPPeriods = append(profile.VIPPeriods, ownerVIPPeriod{period.ID, period.StartsAt.UTC(), period.EndsAt.UTC(), period.Revoked})
	}
	profile.ModerationNotices = make([]ownerModerationNotice, 0, 3)
	for index, notice := range []*ChatMuteNotice{source.Moderation.Mute, source.Moderation.Suspension, source.Moderation.NameChange} {
		if notice == nil {
			continue
		}
		if !notice.Valid() {
			return nil, errOwnerProfileSnapshot
		}
		kind := notice.Kind
		if kind == "" {
			kind = ChatModerationMute
		}
		if kind != []string{ChatModerationMute, ModerationSuspend, ModerationRequireNameChange}[index] {
			return nil, errOwnerProfileSnapshot
		}
		view := ownerModerationNotice{ID: notice.ID, Kind: kind, StartedAt: notice.StartedAt.UTC(), PublicReason: notice.Reason, Active: notice.Active(generatedAt)}
		if !notice.ExpiresAt.IsZero() {
			expires := notice.ExpiresAt.UTC()
			view.ExpiresAt = &expires
		}
		profile.ModerationNotices = append(profile.ModerationNotices, view)
	}
	if !source.CreatedAt.IsZero() {
		created := source.CreatedAt.UTC()
		profile.CreatedAt = &created
	}
	if !source.RecoveryEmail.VerifiedAt.IsZero() && ValidRecoveryEmail(source.RecoveryEmail.Address) {
		profile.VerifiedRecoveryEmail = &ownerVerifiedRecoveryAddress{
			Address: source.RecoveryEmail.Address, VerifiedAt: source.RecoveryEmail.VerifiedAt.UTC(),
		}
	}
	encoded, err := json.Marshal(ownerProfileSnapshot{
		Format: "eidolon-owner-account-profile", Version: 1, GeneratedAt: generatedAt.UTC(), Coverage: ownerSectionCoverage("profile"), Profile: profile,
	})
	// Response-size bound, not an input/allocation bound. The eventual reader
	// needs its own admission and bounded projection before enabling delivery.
	if err != nil || len(encoded) > maxBytes {
		return nil, errOwnerProfileSnapshot
	}
	return encoded, nil
}
