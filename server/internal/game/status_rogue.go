package game

import "time"

// Caller owns the recipient lock. Never restrict enemy debuff expiry to the
// player update branch; a stunned recipient still advances these deadlines.
func expireRogueTargetDebuffsLocked(target *Entity, now time.Time) {
	if target.WeakPointMarked && !now.Before(target.WeakPointEndTime) {
		target.WeakPointMarked = false
		target.WeakPointEndTime = time.Time{}
	}
	if target.AccuracyReduction > 0 && !now.Before(target.AccuracyReductionEndTime) {
		target.AccuracyReduction = 0
		target.AccuracyReductionEndTime = time.Time{}
	}
}
