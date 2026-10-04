package operations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type notifiedEventWriter struct {
	strings.Builder
	events int
	cancel context.CancelFunc
}

func (writer *notifiedEventWriter) Write(body []byte) (int, error) {
	count, err := writer.Builder.Write(body)
	writer.events++
	if writer.events == 2 {
		writer.cancel()
	}
	return count, err
}

func TestMonitorActualFailureToLocalTLSNotificationAndRecovery(t *testing.T) {
	for _, rejectFirst := range []bool{false, true} {
		t.Run(fmt.Sprintf("firstDeliveryRejected=%t", rejectFirst), func(t *testing.T) {
			var polls, mails, clockCalls atomic.Int32
			mailPayloads := make(chan map[string]any, 2)
			notifier := fixtureNotifier(t, func(w http.ResponseWriter, r *http.Request) {
				var payload map[string]any
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Error(err)
				}
				mailPayloads <- payload
				code := 0
				if mails.Add(1) == 1 && rejectFirst {
					code = 503
				}
				fmt.Fprintf(w, `{"ErrorCode":%d,"MessageID":"synthetic-receipt","Message":"private-provider-marker"}`, code)
			})
			// Advance the test-only clock by exactly the explicitly chosen mail
			// interval. No minute-long sleep or relaxation of production bounds.
			notifier.now = func() time.Time { return time.Unix(int64(clockCalls.Add(1))*60, 0) }
			health := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				if polls.Add(1) == 1 {
					w.WriteHeader(503)
					fmt.Fprint(w, "private-player-marker")
					return
				}
				fmt.Fprint(w, `{"status":"ok","database":"ready","commit":"abcdef1","version":"Alpha 1.78.0","player":"private-player-marker"}`)
			}))
			defer health.Close()
			probe, _ := NewProbe(health.URL+"/healthz", "", time.Second)
			detector, _ := NewDetector(1, 1, time.Minute)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			output := &notifiedEventWriter{cancel: cancel}
			if err := MonitorWithNotifier(ctx, probe, detector, time.Second, output, notifier); err != nil {
				t.Fatal(err)
			}
			if mails.Load() != 2 || polls.Load() != 2 || output.events != 2 {
				t.Fatal("failure/recovery did not traverse real HTTP, detector, mail adapter and output")
			}
			lines := strings.Split(strings.TrimSpace(output.String()), "\n")
			for index, kind := range []string{"outage", "recovered"} {
				var event Event
				if err := json.Unmarshal([]byte(lines[index]), &event); err != nil {
					t.Fatal(err)
				}
				want := "accepted"
				if index == 0 && rejectFirst {
					want = "unconfirmed"
				}
				if event.Notice.Kind != kind || event.Delivery != want {
					t.Fatalf("wrong notice/delivery: %+v", event)
				}
				payload := <-mailPayloads
				if payload["Subject"] != "Eidolon monitor: "+kind || strings.Contains(payload["TextBody"].(string), "private-") {
					t.Fatal("mail carried a private peer field or wrong incident")
				}
			}
			if strings.Contains(output.String(), "private-") || strings.Contains(output.String(), "example.invalid") || strings.Contains(output.String(), "synthetic-operator-token") {
				t.Fatal("private provider/configuration text reached monitor output")
			}
		})
	}
}
