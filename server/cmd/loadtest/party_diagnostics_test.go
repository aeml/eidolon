package main

import "testing"

func TestPartyRoleDiagnosticsKeepZeroImpactAndSeparateClasses(t *testing.T) {
	p, _ := partyFixture()
	for i := range p.members {
		p.members[i].confirmed = true
		p.members[i].casts = 2
		p.members[i].denials = uint64(i)
		p.members[i].damage = uint64(i + 1)
	}
	p.members[1].damage = 0
	p.members[1].heals = 3
	p.members[2].damage = 0 // Accepted casts are not proof of a real impact.
	p.members[2].confirmed = false
	got := p.counts()
	if got.formed || got.members != 3 || got.minImpacts != 0 || got.damage != 5 || got.heals != 3 {
		t.Fatalf("existing every-member gate changed: %+v", got)
	}
	for role, expected := range [4]partyRoleCounts{
		{participants: 1, confirmed: 1, minImpacts: 1, damage: 1, casts: 2},
		{participants: 1, confirmed: 1, minImpacts: 3, heals: 3, casts: 2, denials: 1},
		{participants: 1, minImpacts: 0, casts: 2, denials: 2},
		{participants: 1, confirmed: 1, minImpacts: 4, damage: 4, casts: 2, denials: 3},
	} {
		if got.roles[role] != expected {
			t.Fatalf("role %s: got %+v, want %+v", partyLoadClasses[role], got.roles[role], expected)
		}
	}
}

func TestPartyRoleDiagnosticsMergeGroupsWithoutLosingZeroMinimum(t *testing.T) {
	var total partyRoleCounts
	total.merge(partyRoleCounts{})
	total.merge(partyRoleCounts{participants: 1, confirmed: 1, minImpacts: 5, damage: 5, casts: 2})
	total.merge(partyRoleCounts{}) // Empty groups do not fabricate a zero minimum.
	if total.minImpacts != 5 {
		t.Fatalf("empty group changed observed minimum: %+v", total)
	}
	total.merge(partyRoleCounts{participants: 1, minImpacts: 0, casts: 3, denials: 4})
	total.merge(partyRoleCounts{participants: 1, confirmed: 1, minImpacts: 7, heals: 7})
	expected := partyRoleCounts{participants: 3, confirmed: 2, minImpacts: 0, damage: 5, heals: 7, casts: 5, denials: 4}
	if total != expected {
		t.Fatalf("zero participant concealed by aggregate: got %+v, want %+v", total, expected)
	}
}

func TestPartyRoleDiagnosticsCountRepeatedRaidClasses(t *testing.T) {
	var p partyLoad
	p.members = make([]partyLoadMember, 10)
	for i := range p.members {
		p.members[i].confirmed = true
		p.members[i].damage = uint64(i + 1)
	}
	got := p.counts()
	for role, participants := range [4]uint64{3, 3, 2, 2} {
		if got.roles[role].participants != participants || got.roles[role].confirmed != participants || got.roles[role].minImpacts != uint64(role+1) {
			t.Fatalf("role %s lost a repeated raid member: %+v", partyLoadClasses[role], got.roles[role])
		}
	}
}
