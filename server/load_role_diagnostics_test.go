package main

import (
	"regexp"
	"testing"
)

// Allow only the fixed diagnostic schema, never an arbitrary class/name suffix.
var combinedRoleEvidencePattern = regexp.MustCompile(`Party role coverage: class=(?:Fighter|Cleric|Rogue|Wizard) participants=[0-9]+ confirmed=[0-9]+ min_impacts=[0-9]+ damage_events=[0-9]+ heal_events=[0-9]+ accepted_casts=[0-9]+ denied_casts=[0-9]+$`)

func TestCombinedRoleEvidenceOnlyKeepsFixedClassCounts(t *testing.T) {
	valid := "Party role coverage: class=Cleric participants=5 confirmed=5 min_impacts=0 damage_events=0 heal_events=7 accepted_casts=8 denied_casts=1"
	if got := combinedRoleEvidencePattern.FindString("2026/10/06 00:00:00 " + valid); got != valid {
		t.Fatal("fixed aggregate evidence was lost")
	}
	for _, unsafe := range []string{
		"Party role coverage: class=private-account participants=5 confirmed=5 min_impacts=0 damage_events=0 heal_events=7 accepted_casts=8 denied_casts=1",
		valid + " username=private-account",
		"Party role coverage: class=Cleric participants=-1 confirmed=5 min_impacts=0 damage_events=0 heal_events=7 accepted_casts=8 denied_casts=1",
	} {
		if combinedRoleEvidencePattern.MatchString(unsafe) {
			t.Fatal("unapproved diagnostic fields accepted")
		}
	}
}
