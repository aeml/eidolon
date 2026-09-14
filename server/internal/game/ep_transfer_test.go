package game

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestEPCasinoSettlementPinsPrivateSnapshotWithoutPowerOrGold(t *testing.T) {
	w, p := loadoutFixture()
	p.EP, p.Gold, p.Disconnected = 100, 9876, true
	stats, xp := p.Stats, p.Experience
	// No active membership or casino scene: prior hands still settle offline.
	if live, err := w.ApplyDurablePlayerEPTransfer(p.ID, "casino:round:stake", -100); !live || err != nil || !p.UnjournaledSave {
		t.Fatal("funded transfer not pinned", err)
	}
	if _, err := w.ApplyDurablePlayerEPTransfer(p.ID, "casino:round:return", 250); err != nil {
		t.Fatal(err)
	}
	if p.EP != 250 || p.Gold != 9876 || p.Stats != stats || p.Experience != xp || len(p.GoldCreditReceipts) != 0 {
		t.Fatal("EP settlement changed non-EP rewards")
	}
	if summary := w.Economy.Drain(time.Now()); summary.SourceTotal != 0 || summary.SinkTotal != 0 {
		t.Fatal("EP altered public Gold economy telemetry", summary)
	}
	copy := w.GetEntityCopy(p.ID)
	copy.EPCasinoReceipts["casino:round:stake"] = 99
	if p.EPCasinoReceipts["casino:round:stake"] != -100 || copy.EP != 250 {
		t.Fatal("EP snapshot aliases live receipt")
	}
	public, _ := json.Marshal(w.copyEntity(p))
	if strings.Contains(string(public), "casino:round:") || strings.Contains(string(public), `"ep"`) {
		t.Fatal("private EP ledger broadcast")
	}
	if live, err := w.ApplyDurablePlayerEPTransfer("absent", "casino:round:return", 250); live || err != nil {
		t.Fatal("absent recipient treated as live", err)
	}
}
