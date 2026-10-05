package database

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
	"golang.org/x/crypto/bcrypt"
)

func TestOwnerCasinoSnapshotHidesSecretsAndSelectsOwnOnly(t *testing.T) {
	state := []byte(`{"phase":"playing","roundId":"private-round","timedOutSeats":{"player-owner":"private-token"},"players":[{"playerId":"player-owner","name":"Own name","seat":1,"buyIn":100,"sessionId":"private-own-session","paid":false},{"playerId":"player-other","name":"private-other-name","seat":2,"buyIn":"private-invalid-other-buyin"}],"round":{"deck":["private-deck"],"burns":["private-burns"],"dealer":["private-hole"],"players":[{"playerId":"player-owner","seat":1,"cards":[3,16],"stack":80,"committed":20,"privateReceipt":"private-round-receipt"},{"playerId":"player-other","cards":["private-other-cards"]}]}}`)
	candidate := ownerCasinoCandidate{"public-poker", "public-poker", "poker", "gold", ""}
	row := ownerCasinoSource{ID: candidate.ID, Version: 1, State: state}
	entry, err := snapshotOwnerCasinoRecord(row, candidate, "owner")
	if err != nil || entry == nil || entry.Participant.BuyIn != 100 || entry.RoundPlayer.Stack != 80 || len(entry.RoundPlayer.Cards) != 2 {
		t.Fatal("own cards/stakes lost", err)
	}
	data, _ := json.Marshal(entry)
	if strings.Contains(string(data), "private-") || strings.Contains(string(data), "player-other") || strings.Contains(string(data), "player-owner") {
		t.Fatal("casino secret/identity leaked")
	}
	row.State = []byte(`{"phase":"betting","players":[{"playerId":"player-other","seat":2,"sessionId":"private-other"}]}`)
	if entry, err := snapshotOwnerCasinoRecord(row, candidate, "owner"); err != nil || entry != nil {
		t.Fatal("unrelated table participation exported")
	}
	row.Pending = &ownerCasinoPending{Currency: "gold", Amount: -100}
	if entry, err := snapshotOwnerCasinoRecord(row, candidate, "owner"); err != nil || entry == nil || entry.Pending.Amount != -100 || entry.Participant != nil {
		t.Fatal("own pending join intent lost")
	}
	for _, items := range []string{`[{"playerId":"player-owner"},{"playerId":"player-owner"}]`, `[{"playerId":null}]`, `[null]`} {
		row.State = []byte(`{"phase":"betting","players":` + items + `}`)
		if _, err := snapshotOwnerCasinoRecord(row, candidate, "owner"); err != errOwnerExportSection {
			t.Fatal("malformed/duplicate own selector accepted")
		}
	}
	for _, item := range ownerCasinoCandidates("owner") {
		if item.Game == "slots" && item.Currency == "ep" && item.Theme == "fire" {
			row = ownerCasinoSource{ID: item.ID, Version: 1, State: []byte(`{"owner":"player-owner","session":{"currency":"ep","theme":"fire","bet":2,"freeSpins":3,"bonus":true,"bonusOffers":["private-hidden-one","private-hidden-two","private-hidden-three"],"last":{"payout":4,"bonusPicked":-1,"bonusPayout":0,"stages":["private-stage-plan"]}},"owed":4,"payment":"spin"}`)}
			entry, err := snapshotOwnerCasinoRecord(row, item, "owner")
			if err != nil || entry == nil || entry.Slot.FreeSpins != 3 || !entry.Slot.Bonus || *entry.RecordedOwed != 4 {
				t.Fatal("own slot entitlement lost", err)
			}
			data, _ := json.Marshal(entry)
			if strings.Contains(string(data), "private-") || strings.Contains(string(data), "bonusOffers") || strings.Contains(string(data), "stages") {
				t.Fatal("future bonus/cascade data leaked")
			}
			row.State = []byte(strings.Replace(string(row.State), `"owner":"player-owner"`, `"owner":"player-other"`, 1))
			if _, err := snapshotOwnerCasinoRecord(row, item, "owner"); err != errOwnerExportSection {
				t.Fatal("borrowed slot owner accepted")
			}
		}
	}
	for _, source := range []any{ownerCasinoSource{}} {
		data, _ := json.Marshal(source)
		if string(data) != "{}" {
			t.Fatal("private source DTO exposed")
		}
	}
}

func TestOwnerCasinoExportReadFencesAndClosedProjection(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("synthetic owner proof"), bcrypt.MinCost)
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, scenario := range []string{"valid", "empty", "oversized", "unknown-record", "duplicate-record", "malformed", "reset-after-read", "output-limit"} {
		mt.Run(scenario, func(mt *mtest.T) {
			ns := mt.DB.Name() + "." + mt.Coll.Name()
			proof := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, bson.D{{Key: "password_hash", Value: string(hash)}})
			id := "public-blackjack"
			if scenario == "unknown-record" {
				id = "private-arbitrary-table"
			}
			body := []byte(`{"phase":"betting","players":[{"playerId":"player-owner","seat":1,"bet":20}]}`)
			if scenario == "malformed" {
				body = []byte(`null`)
			}
			row := bson.D{{Key: "within_bound", Value: scenario != "oversized"}, {Key: "entry", Value: bson.M{"_id": id, "version": 1, "state": body}}}
			page := mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, row)
			if scenario == "empty" {
				page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			if scenario == "duplicate-record" {
				page = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch, row, row)
			}
			last := proof
			if scenario == "reset-after-read" {
				last = mtest.CreateCursorResponse(0, ns, mtest.FirstBatch)
			}
			mt.AddMockResponses(proof, page, last)
			budget := maximumOwnerExportResponse
			if scenario == "output-limit" {
				budget = 1
			}
			data, err := (&DB{users: mt.Coll, blackjackTables: mt.Coll}).readOwnerExportQuery(context.Background(), "owner", "synthetic owner proof", OwnerExportQuery{Section: "casino"}, time.Now(), budget)
			if scenario == "valid" || scenario == "empty" {
				if err != nil || !json.Valid(data) {
					mt.Fatal("valid casino section failed", err)
				}
			} else if err != errOwnerExportSection || data != nil {
				mt.Fatal("invalid/reset source returned partial file")
			}
			for _, event := range mt.GetAllStartedEvents() {
				if event.CommandName != "find" && event.CommandName != "aggregate" {
					mt.Fatal("read executed casino mutation", event.CommandName)
				}
				if event.CommandName == "aggregate" {
					stages, _ := event.Command.Lookup("pipeline").Array().Values()
					match := stages[0].Document().Lookup("$match").Document()
					ids, _ := match.Lookup("_id").Document().Lookup("$in").Array().Values()
					if len(ids) != 37 {
						mt.Fatal("unbounded/all-player casino scan")
					}
					projection := stages[3].Document().Lookup("$project").Document()
					for _, field := range []string{"pending", "pending.next_state", "last_transfer_id", "last_accepted"} {
						if projection.Lookup(field).Type != 0 {
							mt.Fatal("private transfer metadata decoded", field)
						}
					}
				}
			}
		})
	}
}

func TestOwnerCasinoMalformedOwnStateFailsWithoutPartialEntry(t *testing.T) {
	var slot ownerCasinoCandidate
	for _, candidate := range ownerCasinoCandidates("owner") {
		if candidate.Reference == "slots-ep-fire" {
			slot = candidate
		}
	}
	valid := `{"owner":"player-owner","session":{"currency":"ep","theme":"fire","bet":2,"freeSpins":3,"bonus":true,"last":{"payout":4,"bonusPicked":-1}},"owed":4,"payment":"spin"}`
	for _, change := range [][2]string{
		{`"currency":"ep"`, `"currency":"gold"`},
		{`"theme":"fire"`, `"theme":"water"`},
		{`"bet":2`, `"bet":101`},
		{`"freeSpins":3`, `"freeSpins":13`},
		{`"payout":4`, `"payout":401`},
		{`"bonusPicked":-1`, `"bonusPicked":3`},
		{`"bonusPicked":-1`, `"bonusPicked":-1,"bonusPayout":1`},
		{`"owed":4`, `"owed":5`},
		{`"payment":"spin"`, `"payment":"bonus"`},
		{`"payment":"spin"`, `"payment":""`},
	} {
		body := []byte(strings.Replace(valid, change[0], change[1], 1))
		if entry, err := snapshotOwnerCasinoRecord(ownerCasinoSource{ID: slot.ID, Version: 1, State: body}, slot, "owner"); entry != nil || err != errOwnerExportSection {
			t.Fatal("invalid own slot state returned partial data", change)
		}
	}
	poker := ownerCasinoCandidate{"vip-poker", "vip-poker", "poker", "ep", ""}
	for _, body := range []string{
		`{"phase":"playing","round":{"currency":"gold","players":[{"playerId":"player-owner"}]}}`,
		`{"phase":"playing","round":{"currency":"ep","players":[{"playerId":"player-owner","cards":[3,3]}]}}`,
		`{"phase":"playing","round":{"currency":"ep","players":[{"playerId":"player-owner","cards":[52]}]}}`,
		`{"phase":"playing","players":[{"playerId":"player-owner","seat":6}]}`,
	} {
		if entry, err := snapshotOwnerCasinoRecord(ownerCasinoSource{ID: poker.ID, Version: 1, State: []byte(body)}, poker, "owner"); entry != nil || err != errOwnerExportSection {
			t.Fatal("invalid own poker state returned partial data")
		}
	}
}
