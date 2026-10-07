package main

import (
	"fmt"
	"regexp"
	"strings"
	"testing"
)

// Retain fixed startup failure counts from each driver without exposing bot
// IDs or raw payloads. The cohort formerly lost these causes on early failure.
func loadAdmissionDiagnostics(output string) []string {
	var evidence []string
	for _, reason := range []string{"admission_busy", "admission_rejected", "admission_timeout", "admission_connection_closed", "invalid_admission_response", "unexpected_admission_response", "admission_write_failed", "prepared_workload_requires_character", "party_requires_prepared_class"} {
		pattern := regexp.MustCompile(`(?m)Bot [0-9]+ startup admission failed \(` + reason + `\)\.$`)
		if count := len(pattern.FindAllString(output, -1)); count > 0 {
			evidence = append(evidence, fmt.Sprintf("Admission failure coverage: stage=%s count=%d", reason, count))
		}
	}
	return evidence
}

func TestLoadAdmissionDiagnosticsOnlyKeepClosedAggregateCauses(t *testing.T) {
	output := strings.Join([]string{
		"2026/10/07 04:00:00 Bot 91 startup admission failed (admission_busy).",
		"2026/10/07 04:00:00 Bot 17 startup admission failed (admission_busy).",
		"Bot 0 startup admission failed (admission_timeout).",
		"Bot private-account startup admission failed (admission_busy).",
		"Bot 2 startup admission failed (private-account).",
		"Bot 3 startup admission failed (admission_rejected). account=private-account",
		"raw socket payload private-account",
	}, "\n")
	got := loadAdmissionDiagnostics(output)
	if len(got) != 2 || got[0] != "Admission failure coverage: stage=admission_busy count=2" || got[1] != "Admission failure coverage: stage=admission_timeout count=1" {
		t.Fatal("closed aggregate admission evidence missing or private text retained", got)
	}
	for _, reason := range []string{"admission_rejected", "admission_connection_closed", "invalid_admission_response", "unexpected_admission_response", "admission_write_failed", "prepared_workload_requires_character", "party_requires_prepared_class"} {
		got := loadAdmissionDiagnostics("Bot 0 startup admission failed (" + reason + ").")
		if len(got) != 1 || got[0] != "Admission failure coverage: stage="+reason+" count=1" {
			t.Fatal("known admission cause omitted", reason)
		}
	}
}

// Allow only the fixed diagnostic schema, never an arbitrary class/name suffix.
var combinedRoleEvidencePattern = regexp.MustCompile(`Party role coverage: class=(?:Fighter|Cleric|Rogue|Wizard) participants=[0-9]+ confirmed=[0-9]+ min_impacts=[0-9]+ damage_events=[0-9]+ heal_events=[0-9]+ accepted_casts=[0-9]+ denied_casts=[0-9]+ unmatched_damage_events=[0-9]+$`)

var encounterActivityEvidencePattern = regexp.MustCompile(`Party activity coverage: class=(?:Fighter|Cleric|Rogue|Wizard) pending_cast_steps=\d+ regroup_steps=\d+ cohort_wait_steps=\d+ no_target_steps=\d+ pursuit_steps=\d+$`)
var encounterFailureEvidencePattern = regexp.MustCompile(`Failure coverage: group=\d+ stage=(?:foreign_instance|checkpoint_position|unexpected_town|dungeon_request|dungeon_timeout|initial_entry_timeout|cast_timeout|server_rejection|server_rate_limit|server_rate_limit_raid_enter|server_rate_limit_move|server_rate_limit_attack|server_rate_limit_ability|server_rate_limit_recall|server_rate_limit_respawn|server_recovery_context|server_respawn_required|recovery_echo_timeout|recovery_town_state_timeout|recovery_town_dead|recovery_outside_town|recovery_wrong_scene|weekly_phase_envelope|weekly_phase_scene|weekly_phase_inactive|weekly_phase_identity|weekly_phase_order|event_envelope|event_identity|event_order|event_expired|event_missing_wave|event_view_timeout|event_level|event_request|unclassified)$`)

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
		"Failure coverage: group=0 stage=event_envelope",
		"Failure coverage: group=0 stage=event_identity",
		"Failure coverage: group=0 stage=event_order",
		"Failure coverage: group=0 stage=event_expired",
		"Failure coverage: group=0 stage=event_missing_wave",
		"Failure coverage: group=0 stage=event_view_timeout",
		"Failure coverage: group=0 stage=event_level",
		"Failure coverage: group=0 stage=event_request",
		"Failure coverage: group=0 stage=server_recovery_context",
		"Failure coverage: group=0 stage=server_respawn_required",
		"Failure coverage: group=0 stage=recovery_echo_timeout",
		"Failure coverage: group=0 stage=recovery_town_state_timeout",
		"Failure coverage: group=0 stage=recovery_town_dead",
		"Failure coverage: group=0 stage=recovery_outside_town",
		"Failure coverage: group=0 stage=recovery_wrong_scene",
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
