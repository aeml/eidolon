package main

import (
	"strings"
	"testing"
)

func TestAdminModerationLateAuthorityDenialIsAudited(t *testing.T) {
	for _, action := range []string{MsgAdminChatModeration, MsgAdminChatModerationTarget} {
		for _, stage := range []string{"revocation", "role-outage", "replacement"} {
			t.Run(action+"/"+stage, func(t *testing.T) {
				client, roles := adminReadFixture(t)
				moderation := chatModerationStoreFixture(t)
				moderationTargetFixture(t)
				activities := &adminCompletionActivityStore{fakeAdminActivityStore: &fakeAdminActivityStore{}, afterAppend: func() {
					changeAdminAuthorityForTest(client, roles, stage)
				}}
				adminActivities = activities
				var id string
				if action == MsgAdminChatModeration {
					result := moderateChat(t, client, validAdminChatMutePayload)
					id = result.ID
					if result.Success || result.Authorized || moderation.calls != 0 {
						t.Fatal("late authority change admitted sanction", result, moderation.calls)
					}
				} else {
					result := previewModerationTarget(t, client, validModerationTargetPayload)
					id = "target-request-000001"
					if strings.Contains(result, `"target":`) || strings.Contains(result, `"authorized":true`) || strings.Contains(result, `"success":true`) {
						t.Fatal("late authority change exposed target", result)
					}
				}
				if len(activities.events) != 2 {
					t.Fatal("late authority denial was absent from history", activities.events)
				}
				denial := activities.events[1]
				if denial.Actor != client.username || denial.RequestID != id || denial.Action != action || denial.Result == "success" || strings.Contains(denial.Summary, "Private evidence") {
					t.Fatal("incorrect or unsafe late denial", denial)
				}
			})
		}
	}
}
