package operations

// OutcomeCounts count completed calls, including retries, not unique financial
// effects or money totals. Failed includes any returned error (even ambiguous
// acknowledgements); a zero error count is not a durability certification.
// Timing covers returned calls, including failures/retries, not in-flight work
// or unique payouts. Zero TimedSamples means timing is unavailable. Durations
// are monotonic elapsed microseconds; TotalMicros saturates at uint64 maximum.
// InFlight is a current active-call gauge, not queue depth. InFlightKnown keeps
// older/missing measurements distinct from observed idle state.
type OutcomeCounts struct {
	InFlight      uint64 `json:"inFlight"`
	InFlightKnown bool   `json:"inFlightKnown"`
	Completed     uint64 `json:"completed"`
	Failed        uint64 `json:"failed"`
	TimedSamples  uint64 `json:"timedSamples"`
	TotalMicros   uint64 `json:"totalMicros"`
	MaxMicros     uint64 `json:"maxMicros"`
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
	RealtimeUpdate    OutcomeCounts `json:"realtimeUpdate"`
	StateBroadcast    OutcomeCounts `json:"stateBroadcast"`
}

type outcomeInput struct {
	Completed, Failed                    *uint64
	TimedSamples, TotalMicros, MaxMicros *uint64
	InFlight                             *uint64
	InFlightKnown                        *bool
}

type operationalInput struct {
	CharacterJournal, CharacterCommit, CharacterCleanup, CharacterRecovery, CasinoGold, CasinoEP *outcomeInput
	RealtimeUpdate, StateBroadcast                                                               *outcomeInput
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
	// Older servers lack both frame phases. Keep their gauges/timing unavailable,
	// rather than treating them as observed idle. A partial new pair is invalid.
	if input.RealtimeUpdate != nil || input.StateBroadcast != nil {
		for _, phase := range []*outcomeInput{input.RealtimeUpdate, input.StateBroadcast} {
			if phase == nil || phase.Completed == nil || phase.Failed == nil {
				return nil, false
			}
		}
		inputs = append(inputs, input.RealtimeUpdate, input.StateBroadcast)
		outputs = append(outputs, &result.RealtimeUpdate, &result.StateBroadcast)
	}
	for index, counts := range inputs {
		if *counts.Failed > *counts.Completed {
			return nil, false
		}
		*outputs[index] = OutcomeCounts{Completed: *counts.Completed, Failed: *counts.Failed}
		// Legacy/partial gauges are unavailable, not a measured idle state.
		if counts.InFlight != nil && counts.InFlightKnown != nil {
			if !*counts.InFlightKnown && *counts.InFlight != 0 {
				return nil, false
			}
			outputs[index].InFlight = *counts.InFlight
			outputs[index].InFlightKnown = *counts.InFlightKnown
		}
		// Older/missing timing fields mean unavailable, not measured zero.
		if counts.TimedSamples == nil || counts.TotalMicros == nil || counts.MaxMicros == nil {
			continue
		}
		if *counts.TimedSamples > *counts.Completed || *counts.MaxMicros > *counts.TotalMicros ||
			(*counts.TimedSamples == 0 && (*counts.TotalMicros != 0 || *counts.MaxMicros != 0)) {
			return nil, false
		}
		if *counts.TimedSamples > 0 && (*counts.TotalMicros / *counts.TimedSamples > *counts.MaxMicros ||
			(*counts.TotalMicros / *counts.TimedSamples == *counts.MaxMicros && *counts.TotalMicros%*counts.TimedSamples != 0)) {
			return nil, false // A mean cannot exceed the maximum; no product overflow.
		}
		outputs[index].TimedSamples = *counts.TimedSamples
		outputs[index].TotalMicros = *counts.TotalMicros
		outputs[index].MaxMicros = *counts.MaxMicros
	}
	return result, true
}
