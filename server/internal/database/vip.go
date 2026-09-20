package database

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const VIPMonthlyEP = 100

// Trusted membership records, not client requests or purchased inventory items.
// Each record represents one membership/billing month. Payment integration is
// intentionally absent; operators can provision records using cmd/vip-period.
type VIPPeriod struct {
	ID       string    `bson:"id" json:"id"`
	StartsAt time.Time `bson:"starts_at" json:"startsAt"`
	EndsAt   time.Time `bson:"ends_at" json:"endsAt"`
	Revoked  bool      `bson:"revoked" json:"revoked"`
}

func NewVIPPeriod(start, end time.Time) (VIPPeriod, error) {
	start, end = start.UTC().Truncate(time.Second), end.UTC().Truncate(time.Second)
	if start.IsZero() || end.IsZero() || end.Sub(start) < 27*24*time.Hour || end.Sub(start) > 32*24*time.Hour {
		return VIPPeriod{}, errors.New("a VIP period must represent one membership month (27–32 days)")
	}
	return VIPPeriod{ID: fmt.Sprintf("vip-%d-%d", start.Unix(), end.Unix()), StartsAt: start, EndsAt: end}, nil
}

func ValidateVIPPeriods(periods []VIPPeriod) error {
	ordered := append([]VIPPeriod(nil), periods...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].StartsAt.Before(ordered[j].StartsAt) })
	for i, p := range ordered {
		canonical, err := NewVIPPeriod(p.StartsAt, p.EndsAt)
		if err != nil || p.ID != canonical.ID || !p.StartsAt.Equal(canonical.StartsAt) || !p.EndsAt.Equal(canonical.EndsAt) {
			return errors.New("invalid trusted VIP period")
		}
		if i > 0 && p.StartsAt.Before(ordered[i-1].EndsAt) {
			return errors.New("overlapping VIP periods")
		}
	}
	return nil
}

func (db *DB) GetVIPPeriods(username string) ([]VIPPeriod, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var account struct {
		Periods []VIPPeriod `bson:"vip_periods"`
	}
	if err := db.users.FindOne(ctx, bson.M{"username": username}, options.FindOne().SetProjection(bson.M{"vip_periods": 1})).Decode(&account); err != nil {
		return nil, err
	}
	if err := ValidateVIPPeriods(account.Periods); err != nil {
		return nil, err
	}
	return account.Periods, nil
}

// Administrative-only method: no public HTTP/WebSocket/chat handler exposes it.
// The non-overlap predicate and append are one account-document update, so two
// operator processes cannot create overlapping months and duplicate allowances.
func (db *DB) ProvisionVIPPeriod(username string, period VIPPeriod) (bool, error) {
	if username == "" || period.Revoked {
		return false, errors.New("invalid VIP provisioning request")
	}
	if err := ValidateVIPPeriods([]VIPPeriod{period}); err != nil {
		return false, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	filter := bson.M{"username": username, "vip_periods": bson.M{"$not": bson.M{"$elemMatch": bson.M{
		"starts_at": bson.M{"$lt": period.EndsAt}, "ends_at": bson.M{"$gt": period.StartsAt},
	}}}}
	result, err := db.users.UpdateOne(ctx, filter, bson.M{"$push": bson.M{"vip_periods": period}})
	if err != nil {
		return false, err
	}
	if result.MatchedCount == 1 {
		return true, nil
	}
	periods, err := db.GetVIPPeriods(username)
	if err != nil {
		return false, err
	}
	for _, existing := range periods {
		if existing.ID == period.ID && !existing.Revoked {
			return false, nil
		}
	}
	return false, errors.New("VIP period overlaps an existing or revoked membership month")
}

func (db *DB) RevokeVIPPeriod(username, periodID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	result, err := db.users.UpdateOne(ctx, bson.M{"username": username, "vip_periods.id": periodID}, bson.M{"$set": bson.M{"vip_periods.$.revoked": true}})
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return errors.New("membership month not found")
	}
	return nil
}

// Apply every earned, unclaimed month, including months spent offline. Existing
// receipts survive spending, expiry and revocation. Revocation stops access/new
// grants; it never converts cosmetics/EP into debt or Gold.
// Administrators receive the current UTC calendar month's allowance. A paid
// membership starting in that month fulfills the same entitlement, in either
// order. Admin receipts remain after role removal; they cannot be spent/reset.
// Past admin months are not inferred from today's role (no historical authority).
func ApplyVIPAllowance(ep *int, receipts *map[string]int, periods []VIPPeriod, now time.Time, administrator ...bool) (int, time.Time, error) {
	if ep == nil || receipts == nil || *ep < 0 {
		return 0, time.Time{}, errors.New("invalid EP wallet")
	}
	if err := ValidateVIPPeriods(periods); err != nil {
		return 0, time.Time{}, err
	}
	var until time.Time
	var due []string
	grants := 0
	adminMonth := "vip-admin-" + now.UTC().Format("2006-01")
	paidThisMonth := false
	for _, period := range periods {
		if period.Revoked || now.Before(period.StartsAt) {
			continue
		}
		if now.Before(period.EndsAt) {
			until = period.EndsAt
		}
		periodMonth := "vip-admin-" + period.StartsAt.UTC().Format("2006-01")
		if periodMonth == adminMonth {
			paidThisMonth = true
		}
		adminAmount, adminClaimed := (*receipts)[periodMonth]
		if adminClaimed && adminAmount != VIPMonthlyEP {
			return 0, time.Time{}, errors.New("VIP administrator allowance receipt mismatch")
		}
		if amount, claimed := (*receipts)[period.ID]; claimed {
			if amount != VIPMonthlyEP {
				return 0, time.Time{}, errors.New("VIP allowance receipt mismatch")
			}
		} else {
			due = append(due, period.ID)
			if !adminClaimed {
				grants++
			}
		}
	}
	if len(administrator) > 0 && administrator[0] {
		utc := now.UTC()
		end := time.Date(utc.Year(), utc.Month()+1, 1, 0, 0, 0, 0, time.UTC)
		if end.After(until) {
			until = end
		}
		if amount, claimed := (*receipts)[adminMonth]; claimed {
			if amount != VIPMonthlyEP {
				return 0, time.Time{}, errors.New("VIP administrator allowance receipt mismatch")
			}
		} else {
			due = append(due, adminMonth)
			if !paidThisMonth {
				grants++
			}
		}
	}
	maxInt := int(^uint(0) >> 1)
	if grants > (maxInt-*ep)/VIPMonthlyEP {
		return 0, time.Time{}, errors.New("EP balance limit reached")
	}
	amount := grants * VIPMonthlyEP
	if len(due) != 0 {
		if *receipts == nil {
			*receipts = make(map[string]int)
		}
		for _, id := range due {
			(*receipts)[id] = VIPMonthlyEP
		}
		*ep += amount
	}
	return amount, until, nil
}
