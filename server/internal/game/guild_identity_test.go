package game

import "testing"

func TestSetPlayerGuildIdentity(t *testing.T) {
	w := NewWorld(nil)
	w.AddEntity(&Entity{ID: "member", Type: TypePlayer})

	if !w.SetPlayerGuildIdentity("member", "guild-1", "DUSK") {
		t.Fatal("first guild identity update should report a change")
	}
	member := w.GetEntityCopy("member")
	if member.GuildID != "guild-1" || member.GuildTag != "DUSK" {
		t.Fatalf("guild identity = %q/%q", member.GuildID, member.GuildTag)
	}
	if w.SetPlayerGuildIdentity("member", "guild-1", "DUSK") {
		t.Fatal("identical guild identity should be a no-op")
	}
	if !w.SetPlayerGuildIdentity("member", "", "") {
		t.Fatal("clearing guild identity should report a change")
	}
}
