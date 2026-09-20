package main

import (
	"eidolon-server/internal/database"
	"encoding/json"
	"errors"
	"time"
)

var loadVIPPeriods = func(username string) ([]database.VIPPeriod, error) {
	if db == nil {
		return nil, nil
	}
	return db.GetVIPPeriods(username)
}

// Account work is serialized by join/resume/handleMessage. Trust only the
// account repository, never payload periods, client flags or current EP balance.
func refreshVIPMembershipLocked(c *Client, now time.Time) (int, error) {
	if c.username == "" || c.playerID == "" || world == nil {
		return 0, errors.New("character unavailable")
	}
	periods, err := loadVIPPeriods(c.username)
	if err != nil {
		world.ClearVIPAccess(c.playerID)
		return 0, err
	}
	administrator := false
	if adminRoles != nil {
		var roleErr error
		administrator, roleErr = adminRoles.HasAdminRole(c.username)
		if roleErr != nil {
			world.ClearVIPAccess(c.playerID)
			return 0, roleErr
		}
	}
	snapshot := world.GetEntityCopy(c.playerID)
	if snapshot == nil {
		return 0, errors.New("character unavailable")
	}
	// A read-only projection avoids journal writes when there is no new month.
	receiptCount := len(snapshot.VIPAllowanceReceipts)
	due, _, err := database.ApplyVIPAllowance(&snapshot.EP, &snapshot.VIPAllowanceReceipts, periods, now, administrator)
	if err != nil {
		world.ClearVIPAccess(c.playerID)
		return 0, err
	}
	failedCharacterSaves.Lock()
	pendingSave := failedCharacterSaves.users[c.username]
	failedCharacterSaves.Unlock()
	if due > 0 || len(snapshot.VIPAllowanceReceipts) != receiptCount || pendingSave || snapshot.UnjournaledSave {
		if characterSaveJournal == nil || characterSaveCommitter == nil {
			world.ClearVIPAccess(c.playerID)
			return 0, errors.New("character persistence unavailable")
		}
		if err := retryPendingCharacterSaveLocked(c.username); err != nil {
			world.ClearVIPAccess(c.playerID)
			return 0, err
		}
	}
	amount, err := world.RefreshVIP(c.playerID, periods, now, administrator)
	if err != nil {
		return 0, err
	}
	updated := world.GetEntityCopy(c.playerID)
	if updated == nil {
		return 0, errors.New("character unavailable")
	}
	if amount > 0 || len(updated.VIPAllowanceReceipts) != receiptCount {
		if err := saveCharacterDB(c, updated); err != nil {
			world.ClearVIPAccess(c.playerID)
			return 0, err
		}
	}
	return amount, nil
}

func sendVIPStatus(c *Client) {
	if c.username == "" || c.playerID == "" || world == nil {
		return
	}
	now := time.Now()
	awarded, err := refreshVIPMembershipLocked(c, now)
	p := world.GetEntityCopy(c.playerID)
	if p == nil {
		return
	}
	message := "No active VIP membership. EP ownership alone does not grant VIP access."
	if now.Before(p.VIPUntil) {
		message = "VIP membership active. Each recorded membership month grants 100 EP once, with no stat or progression bonuses."
	}
	if err != nil {
		message = "VIP membership could not be refreshed. No new allowance is confirmed; please try again."
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"success": err == nil, "message": message, "active": err == nil && now.Before(p.VIPUntil),
		"until": p.VIPUntil, "monthlyEP": database.VIPMonthlyEP, "awardedEP": awarded,
		"ep": p.EP, "gold": p.Gold, "goldPerEP": database.GoldPerEP,
	})
	c.sendSafe(createMessage(MsgVIPStatus, payload))
}
