package main

import (
	"regexp"
	"testing"
)

// Allow only the fixed diagnostic schema, never an arbitrary class/name suffix.
var combinedRoleEvidencePattern = regexp.MustCompile(`Party role coverage: class=(?:Fighter|Cleric|Rogue|Wizard) participants=[0-9]+ confirmed=[0-9]+ min_impacts=[0-9]+ damage_events=[0-9]+ heal_events=[0-9]+ accepted_casts=[0-9]+ denied_casts=[0-9]+ unmatched_damage_events=[0-9]+$`)

var encounterActivityEvidencePattern = regexp.MustCompile(`Party activity coverage: class=(?:Fighter|Cleric|Rogue|Wizard) pending_cast_steps=\d+ regroup_steps=\d+ cohort_wait_steps=\d+ no_target_steps=\d+ pursuit_steps=\d+$`)
var encounterFailureEvidencePattern = regexp.MustCompile(`Failure coverage: group=\d+ stage=(?:foreign_instance|checkpoint_position|unexpected_town|dungeon_request|dungeon_timeout|initial_entry_timeout|cast_timeout|server_rejection|server_rate_limit|server_rate_limit_raid_enter|server_rate_limit_move|server_rate_limit_attack|server_rate_limit_ability|server_rate_limit_recall|server_rate_limit_respawn|weekly_phase_envelope|weekly_phase_scene|weekly_phase_inactive|weekly_phase_identity|weekly_phase_order|unclassified)$`)

// These fields already exist in the driver. Keep their closed schema, not raw
// error/actor/session text, and never use diagnostics to grant outcome credit.
func encounterLoadDiagnostics(line string) []string {
	var evidence []string
	for _, pattern := range []*regexp.Regexp{combinedRoleEvidencePattern, encounterActivityEvidencePattern, encounterFailureEvidencePattern} {
		if match := pattern.FindString(line); match != "" {
			evidence = append(evidence, match)
		}
	}
	return evidence
}

func TestCombinedRoleEvidenceOnlyKeepsFixedClassCounts(t *testing.T) {
	valid := "Party role coverage: class=Cleric participants=5 confirmed=5 min_impacts=0 damage_events=0 heal_events=7 accepted_casts=8 denied_casts=1 unmatched_damage_events=3"
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

func TestEncounterDiagnosticsKeepOnlyFixedFields(t *testing.T) {
	for _, valid := range []string{
		"Party role coverage: class=Fighter participants=2 confirmed=2 min_impacts=1 damage_events=7 heal_events=0 accepted_casts=8 denied_casts=1 unmatched_damage_events=3",
		"Party activity coverage: class=Cleric pending_cast_steps=1 regroup_steps=2 cohort_wait_steps=3 no_target_steps=4 pursuit_steps=5",
		"Failure coverage: group=0 stage=cast_timeout",
		"Failure coverage: group=0 stage=server_rate_limit_raid_enter",
		"Failure coverage: group=0 stage=unclassified",
	} {
		got := encounterLoadDiagnostics("2026/10/06 00:00:00 " + valid)
		if len(got) != 1 || got[0] != valid {
			t.Fatal("fixed encounter evidence lost", got)
		}
		if len(encounterLoadDiagnostics(valid+" account=private-marker")) != 0 {
			t.Fatal("private trailing field accepted")
		}
	}
	for _, unsafe := range []string{
		"Failure coverage: group=private-marker stage=cast_timeout",
		"Failure coverage: group=0 stage=private_account_error",
		"Failure coverage: group=0 stage=none",
		"Failure coverage: group=-1 stage=cast_timeout",
		"Party activity coverage: class=private-marker pending_cast_steps=1 regroup_steps=2 cohort_wait_steps=3 no_target_steps=4 pursuit_steps=5",
		"Party activity coverage: class=Cleric pending_cast_steps=-1 regroup_steps=2 cohort_wait_steps=3 no_target_steps=4 pursuit_steps=5",
		"raw socket payload with private-marker",
	} {
		if len(encounterLoadDiagnostics(unsafe)) != 0 {
			t.Fatal("unapproved encounter diagnostics accepted")
		}
	}
}
