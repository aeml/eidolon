package database

import (
	"reflect"
	"testing"

	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestCasinoSlotPagingUsesBoundedSortedKeysetAndRetainsPrivateIntent(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	for _, after := range []string{"", "slots:test-a"} {
		mt.Run(after, func(mt *mtest.T) {
			want := BlackjackTableRecord{TableID: "slots:test-b", Version: 2, State: []byte(`{"privateOwner":"retain","freeSpins":5}`),
				Pending: &BlackjackTransfer{ID: "casino:paging:pending", PlayerID: "player-owner", Currency: "gold", Amount: 20, NextState: []byte(`{"private":"frozen"}`)}}
			mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, want)))
			got, err := (&DB{blackjackTables: mt.Coll}).CasinoSlotRecordsPage(after, 25)
			if err != nil || len(got) != 1 || !reflect.DeepEqual(got[0], want) {
				mt.Fatal("page lost private recovery state", err)
			}
			command := mt.GetStartedEvent().Command
			if command.Lookup("limit").Int64() != 25 || command.Lookup("batchSize").Int32() != 25 || command.Lookup("sort").Document().Lookup("_id").Int32() != 1 {
				mt.Fatal("slot scan was unbounded/unsorted", command)
			}
			identity := command.Lookup("filter").Document().Lookup("_id").Document()
			if identity.Lookup("$regex").StringValue() != "^slots:" {
				mt.Fatal("slot page lost record family", command)
			}
			if after != "" {
				if identity.Lookup("$gt").StringValue() != after {
					mt.Fatal("page did not advance after exact last key", command)
				}
			} else if _, err := identity.LookupErr("$gt"); err == nil {
				mt.Fatal("first page unexpectedly skipped records")
			}
		})
	}
}

func TestCasinoSlotPagingRejectsInvalidLimitsAndCorruptRecords(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))
	mt.Run("invalid query", func(mt *mtest.T) {
		repo := &DB{blackjackTables: mt.Coll}
		for _, limit := range []int{0, -1, 51} {
			if _, err := repo.CasinoSlotRecordsPage("", limit); err == nil {
				mt.Fatal("unsafe page limit accepted")
			}
		}
		if _, err := repo.CasinoSlotRecordsPage("public-blackjack", 25); err == nil {
			mt.Fatal("foreign cursor accepted")
		}
		if len(mt.GetAllStartedEvents()) != 0 {
			mt.Fatal("invalid query reached storage")
		}
	})
	mt.Run("corrupt saved version", func(mt *mtest.T) {
		mt.AddMockResponses(tradeResponse(mt, directTradeDocument(mt.T, BlackjackTableRecord{TableID: "slots:test", Version: 0, State: []byte(`{}`)})))
		if records, err := (&DB{blackjackTables: mt.Coll}).CasinoSlotRecordsPage("", 25); err == nil || records != nil {
			mt.Fatal("corrupt recovery page accepted")
		}
	})
}
