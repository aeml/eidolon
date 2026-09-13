package arena

import (
	"testing"
	"time"
)

func TestSeasonPrizeUsesEarnedWinsAndFinishingRating(t *testing.T) {
	for _, tc := range []struct {
		rating, wins int
		medal        string
		honor        int
	}{{2000, 9, "Unqualified", 0}, {900, 10, "Bronze", 250}, {1199, 50, "Bronze", 250},
		{1200, 25, "Silver", 600}, {1500, 49, "Silver", 600}, {1500, 50, "Gold", 1200}} {
		medal, honor := SeasonPrize(tc.rating, tc.wins)
		if medal != tc.medal || honor != tc.honor {
			t.Fatalf("%+v got %s/%d", tc, medal, honor)
		}
	}
	december := time.Date(2026, 12, 31, 23, 0, 0, 0, time.UTC)
	if CurrentSeason(december) != "2026-Q4" || !SeasonEnd(december).Equal(time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatal("quarter/year boundary is not UTC")
	}
}
