package database

import (
	"errors"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Naming convention of existing disposable automation accounts, not a claim
// to detect every bot or a rule that QA/admin privileges imply test accounts.
const adminTestAccountPattern = `^(codex-|codexq-|codexqa-|loadtest-|resource-journal-)`

func IsAdminTestAccount(account string) bool {
	account = strings.ToLower(account)
	for _, prefix := range []string{"codex-", "codexq-", "codexqa-", "loadtest-", "resource-journal-"} {
		if strings.HasPrefix(account, prefix) {
			return true
		}
	}
	return false
}

func ValidAdminPopulation(population string) bool {
	return population == "" || population == "real" || population == "all" || population == "tests"
}

func AdminPopulationIncludes(account, population string) bool {
	if !ValidAdminPopulation(population) {
		return false
	}
	return population == "all" || (population == "tests") == IsAdminTestAccount(account)
}

func addAdminPopulationFilter(filter bson.M, population string) error {
	if !ValidAdminPopulation(population) {
		return errors.New("invalid player population")
	}
	pattern := primitive.Regex{Pattern: adminTestAccountPattern, Options: "i"}
	clauses := bson.A{bson.M{"actor": pattern}, bson.M{"target": pattern}}
	switch population {
	case "all":
	case "tests":
		filter["$and"] = bson.A{bson.M{"$or": clauses}}
	default:
		filter["$nor"] = clauses
	}
	return nil
}

func adminActivityDay(day string, now time.Time, retention int) (time.Time, time.Time, error) {
	start, err := time.Parse("2006-01-02", day)
	today := now.UTC().Truncate(24 * time.Hour)
	if err != nil || start.After(today) || start.Before(today.AddDate(0, 0, -retention+1)) {
		return time.Time{}, time.Time{}, errors.New("choose a UTC day within retained activity")
	}
	return start, start.AddDate(0, 0, 1), nil
}

type AdminDailyActivity struct {
	Day                  string `json:"day"`
	UniqueLogins         int    `json:"uniqueLogins"`
	ClosedSessionSeconds int64  `json:"closedSessionSeconds"`
	MissingDurations     int    `json:"missingDurations"`
	Complete             bool   `json:"complete"`
}

// Events have already passed account/population filtering. Count login accounts
// once, not resumes or administrator reads. Time is closed authenticated
// connection time clipped to this UTC day, not active gameplay or AFK detection.
func summarizeAdminDaily(events []AdminActivity, day string, start, end time.Time, complete bool) AdminDailyActivity {
	result := AdminDailyActivity{Day: day, Complete: complete}
	accounts := map[string]bool{}
	for _, event := range events {
		if event.Result != "success" {
			continue
		}
		inDay := !event.At.Before(start) && event.At.Before(end)
		if event.Action == "login" && inDay {
			accounts[event.Actor] = true
		}
		if event.Action != "disconnect" {
			continue
		}
		if event.SessionStartedAt == nil {
			if inDay {
				result.MissingDurations++
			}
			continue
		}
		from, to := *event.SessionStartedAt, event.At
		if from.Before(start) {
			from = start
		}
		if to.After(end) {
			to = end
		}
		if to.After(from) {
			result.ClosedSessionSeconds += int64(to.Sub(from).Seconds())
		}
	}
	result.UniqueLogins = len(accounts)
	return result
}
