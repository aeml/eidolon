package game

import "testing"

func TestSetPlayerGuildIdentity(t *testing.T) {
	w := NewWorld(nil)
	t.Cleanup(w.StopBackground)
	w.AddEntity(&Entity{ID: "member", Type: TypePlayer})

	if !w.SetPlayerGuildIdentity("member", "guild-1", "DUSK", "Dusk Watch") {
		t.Fatal("first guild identity update should report a change")
	}
	member := w.GetEntityCopy("member")
	if member.GuildID != "guild-1" || member.GuildTag != "DUSK" || member.GuildName != "Dusk Watch" {
		t.Fatalf("guild identity = %q/%q", member.GuildID, member.GuildTag)
	}
	if w.SetPlayerGuildIdentity("member", "guild-1", "DUSK", "Dusk Watch") {
		t.Fatal("identical guild identity should be a no-op")
	}
	if !w.SetPlayerGuildIdentity("member", "guild-1", "DUSK", "Dusk Guard") || w.GetEntityCopy("member").GuildName != "Dusk Guard" {
		t.Fatal("guild name cache did not refresh independently of tag/ID")
	}
	if !w.SetPlayerGuildIdentity("member", "", "", "") {
		t.Fatal("clearing guild identity should report a change")
	}
	if w.GetEntityCopy("member").GuildName != "" {
		t.Fatal("cleared guild left a stale name cache")
	}
}
