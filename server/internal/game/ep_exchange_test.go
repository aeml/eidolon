package game

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

const epTestID = "01234567-89ab-4cde-8fab-0123456789ab"

func TestEPExchangeRequiresSafeLivingCharacter(t *testing.T) {
	for _, condition := range []string{"town", "outside", "dead", "combat", "dungeon"} {
		t.Run(condition, func(t *testing.T) {
			w, p := loadoutFixture()
			p.Gold = 2_000_000
			switch condition {
			case "outside":
				p.Z = 500
			case "dead":
				p.Health = 0
			case "combat":
				p.LastAttackTime = time.Now()
			case "dungeon":
				p.InstanceID = "dungeon"
			}
			before := p.Stats
			err := w.ExchangeGoldForEP(p.ID, epTestID, 1)
			if condition == "town" {
				if err != nil || p.EP != 1 || p.Gold != 1_000_000 || !p.UnjournaledSave {
					t.Fatal("exchange failed", err)
				}
				copy := w.GetEntityCopy(p.ID)
				copy.EPExchangeReceipts[epTestID] = 9
				if copy.EP != 1 || p.EPExchangeReceipts[epTestID] != 1 {
					t.Fatal("snapshot omitted wallet or aliased receipts")
				}
				public, _ := json.Marshal(w.copyEntity(p))
				if strings.Contains(string(public), `"ep"`) || strings.Contains(string(public), epTestID) {
					t.Fatal("private wallet broadcast publicly")
				}
			} else if err == nil || p.EP != 0 || p.Gold != 2_000_000 || len(p.EPExchangeReceipts) != 0 {
				t.Fatal("unsafe exchange mutated wallets", err)
			}
			if before != p.Stats {
				t.Fatal("EP changed combat stats")
			}
		})
	}
}
