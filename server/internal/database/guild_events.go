package database

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
)

type GuildEventRSVP struct {
	PlayerID string `bson:"player_id" json:"playerId"`
	Role     string `bson:"role" json:"role"`
	Status   string `bson:"status" json:"status"`
}

type GuildEvent struct {
	ID              string           `bson:"id" json:"id"`
	Title           string           `bson:"title" json:"title"`
	Activity        string           `bson:"activity" json:"activity"`
	StartsAt        time.Time        `bson:"starts_at" json:"startsAt"`
	DurationMinutes int              `bson:"duration_minutes" json:"durationMinutes"`
	Capacity        int              `bson:"capacity" json:"capacity"`
	CreatorID       string           `bson:"creator_id" json:"creatorId"`
	Cancelled       bool             `bson:"cancelled" json:"cancelled"`
	CancelledAt     time.Time        `bson:"cancelled_at,omitempty" json:"cancelledAt,omitempty"`
	Revision        int              `bson:"revision" json:"revision"`
	RSVPs           []GuildEventRSVP `bson:"rsvps" json:"rsvps"`
}

type GuildEventRequest struct {
	Action          string    `json:"action"`
	EventID         string    `json:"eventId"`
	Revision        int       `json:"revision"`
	Title           string    `json:"title"`
	Activity        string    `json:"activity"`
	StartsAt        time.Time `json:"startsAt"`
	DurationMinutes int       `json:"durationMinutes"`
	Capacity        int       `json:"capacity"`
	Role            string    `json:"role"`
	Status          string    `json:"status"`
}

// Calendar views never expose departed members or retain unbounded history.
func VisibleGuildEvents(guild *Guild, now time.Time) []GuildEvent {
	events := []GuildEvent{}
	for _, event := range guild.Events {
		endedAt := event.StartsAt.Add(time.Duration(event.DurationMinutes) * time.Minute)
		if event.Cancelled && !event.CancelledAt.IsZero() {
			endedAt = event.CancelledAt
		}
		if endedAt.Before(now.Add(-7 * 24 * time.Hour)) {
			continue
		}
		event.RSVPs = append([]GuildEventRSVP{}, event.RSVPs...)
		kept := event.RSVPs[:0]
		for _, rsvp := range event.RSVPs {
			if guildMember(guild, rsvp.PlayerID) != nil {
				kept = append(kept, rsvp)
			}
		}
		event.RSVPs = kept
		events = append(events, event)
	}
	sort.Slice(events, func(i, j int) bool { return events[i].StartsAt.Before(events[j].StartsAt) })
	return events
}

func applyGuildEvent(guild *Guild, actorID string, request GuildEventRequest, now time.Time) error {
	if guildMember(guild, actorID) == nil {
		return errors.New("guild membership required")
	}
	if request.Action == "create" || request.Action == "edit" || request.Action == "cancel" {
		if err := requireGuildPermission(guild, actorID, GuildPermissionManageEvents); err != nil {
			return err
		}
	} else if request.Action != "rsvp" && request.Action != "withdraw" {
		return errors.New("unknown guild event action")
	}
	if request.Action == "create" || request.Action == "edit" {
		if strings.IndexFunc(request.Title, unicode.IsControl) >= 0 {
			return errors.New("event title must contain printable characters")
		}
		request.Title = strings.TrimSpace(request.Title)
		if utf8.RuneCountInString(request.Title) < 3 || utf8.RuneCountInString(request.Title) > 80 {
			return errors.New("event title must contain 3–80 printable characters")
		}
		if request.Activity == "" || len(request.Activity) > 80 || request.StartsAt.Before(now.Add(time.Minute)) || request.StartsAt.After(now.Add(90*24*time.Hour)) {
			return errors.New("choose an activity and a start time between one minute and 90 days from now")
		}
		if request.DurationMinutes < 30 || request.DurationMinutes > 360 || request.Capacity < 2 || request.Capacity > GuildMemberLimit {
			return errors.New("events require 2–100 seats and a duration of 30–360 minutes")
		}
	}
	guild.Events = VisibleGuildEvents(guild, now)
	if request.Action == "create" {
		if len(guild.Events) >= 20 {
			return errors.New("calendar holds 20 events; finished events expire after seven days")
		}
		id, err := newGuildID()
		if err != nil {
			return err
		}
		guild.Events = append(guild.Events, GuildEvent{ID: id, Title: request.Title, Activity: request.Activity, StartsAt: request.StartsAt.UTC(), DurationMinutes: request.DurationMinutes, Capacity: request.Capacity, CreatorID: actorID, Revision: 1, RSVPs: []GuildEventRSVP{}})
		return nil
	}
	for i := range guild.Events {
		event := &guild.Events[i]
		if event.ID != request.EventID {
			continue
		}
		if event.Cancelled || !now.Before(event.StartsAt.Add(time.Duration(event.DurationMinutes)*time.Minute)) {
			return errors.New("event is cancelled or finished")
		}
		switch request.Action {
		case "edit", "cancel":
			if request.Revision != event.Revision {
				return errors.New("event changed; refresh before editing")
			}
			if request.Action == "cancel" {
				event.Cancelled = true
				event.CancelledAt = now.UTC()
			} else {
				going := 0
				for _, rsvp := range event.RSVPs {
					if rsvp.Status == "going" {
						going++
					}
				}
				if request.Capacity < going {
					return errors.New("capacity cannot be smaller than confirmed sign-ups")
				}
				event.Title, event.Activity, event.StartsAt = request.Title, request.Activity, request.StartsAt.UTC()
				event.DurationMinutes, event.Capacity = request.DurationMinutes, request.Capacity
				// A reschedule requires renewed consent; do not carry a promise to a new time.
				for j := range event.RSVPs {
					event.RSVPs[j].Status = "tentative"
				}
			}
		case "rsvp", "withdraw":
			if request.Action == "rsvp" {
				if request.Revision != event.Revision {
					return errors.New("event was rescheduled; review it before signing up")
				}
				if request.Status != "going" && request.Status != "tentative" {
					return errors.New("choose going or tentative")
				}
				if request.Role != "tank" && request.Role != "healer" && request.Role != "damage" && request.Role != "flexible" {
					return errors.New("choose a valid role")
				}
				going := 0
				for _, rsvp := range event.RSVPs {
					if rsvp.PlayerID != actorID && rsvp.Status == "going" {
						going++
					}
				}
				if request.Status == "going" && going >= event.Capacity {
					return errors.New("event is full; sign up as tentative")
				}
			}
			kept := event.RSVPs[:0]
			for _, rsvp := range event.RSVPs {
				if rsvp.PlayerID != actorID {
					kept = append(kept, rsvp)
				}
			}
			event.RSVPs = kept
			if request.Action == "rsvp" {
				event.RSVPs = append(event.RSVPs, GuildEventRSVP{PlayerID: actorID, Role: request.Role, Status: request.Status})
			}
		}
		if request.Action == "edit" || request.Action == "cancel" {
			event.Revision++
		}
		return nil
	}
	return errors.New("guild event not found")
}

func (db *DB) ChangeGuildEvent(actorID string, request GuildEventRequest, now time.Time) (*Guild, error) {
	if db == nil || db.guilds == nil {
		return nil, errors.New("guild service unavailable")
	}
	db.guildMu.Lock()
	defer db.guildMu.Unlock()
	guild, err := db.getGuildForPlayer(actorID)
	if err != nil {
		return nil, err
	}
	if guild == nil {
		return nil, errors.New("guild not found")
	}
	if err := applyGuildEvent(guild, actorID, request, now); err != nil {
		return nil, err
	}
	previousVersion := guild.Version
	guild.Version++
	guild.UpdatedAt = now.UTC()
	guild.Audit = appendBoundedGuildAudit(guild.Audit, GuildAuditEntry{At: now.UTC(), ActorID: actorID, Action: "event_" + request.Action, TargetID: request.EventID})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.guilds.ReplaceOne(ctx, bson.M{"id": guild.ID, "version": previousVersion}, guild)
	if err != nil {
		return nil, err
	}
	if result.ModifiedCount == 0 {
		return nil, errors.New("guild changed; refresh and try again")
	}
	return guild, nil
}
