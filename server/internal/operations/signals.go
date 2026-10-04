package operations

// OutcomeCounts count completed calls, including retries, not unique financial
// effects or money totals. Failed includes any returned error (even ambiguous
// acknowledgements); a zero error count is not a durability certification.
type OutcomeCounts struct {
	Completed uint64 `json:"completed"`
	Failed    uint64 `json:"failed"`
}

// OperationalMetrics is fixed-size aggregate process-lifetime instrumentation.
// Never add player IDs, amounts, error strings, filenames or arbitrary labels.
type OperationalMetrics struct {
	CharacterJournal  OutcomeCounts `json:"characterJournal"`
	CharacterCommit   OutcomeCounts `json:"characterCommit"`
	CharacterCleanup  OutcomeCounts `json:"characterCleanup"`
	CharacterRecovery OutcomeCounts `json:"characterRecovery"`
	CasinoGold        OutcomeCounts `json:"casinoGold"`
	CasinoEP          OutcomeCounts `json:"casinoEP"`
}

type outcomeInput struct {
	Completed, Failed *uint64
}

type operationalInput struct {
	CharacterJournal, CharacterCommit, CharacterCleanup, CharacterRecovery, CasinoGold, CasinoEP *outcomeInput
}

func (input *operationalInput) metrics() (*OperationalMetrics, bool) {
	if input == nil {
		return nil, true
	}
	inputs := []*outcomeInput{input.CharacterJournal, input.CharacterCommit, input.CharacterCleanup, input.CharacterRecovery, input.CasinoGold, input.CasinoEP}
	for _, counts := range inputs {
		if counts == nil || counts.Completed == nil || counts.Failed == nil {
			return nil, true // Missing measurements must not masquerade as zeros.
		}
	}
	result := &OperationalMetrics{}
	outputs := []*OutcomeCounts{&result.CharacterJournal, &result.CharacterCommit, &result.CharacterCleanup, &result.CharacterRecovery, &result.CasinoGold, &result.CasinoEP}
	for index, counts := range inputs {
		if *counts.Failed > *counts.Completed {
			return nil, false
		}
		*outputs[index] = OutcomeCounts{Completed: *counts.Completed, Failed: *counts.Failed}
	}
	return result, true
}
