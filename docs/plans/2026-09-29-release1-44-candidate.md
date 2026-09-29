# Alpha 1.44 — audio integration candidate

Unreleased integrated candidate on the prepared1.43 branch. Runtime/package/
login/CI/default build identities and cumulative notes identify1.44.0.
Earlier ordered release prerequisites remain open. Final listening/mix approval
is not claimed; human observations are not a new publication permission gate.

## Draft patch notes

- Distinct short cast cues for fourteen ability families across all four
  classes, including fire, arcane, gravity and time magic. Existing local-only
  playback, combat volume controls and danger priority are preserved.

- Independent combat, interface and ambience volume controls, saved per device
  and available in desktop and phone settings.
- Regional ambience for town, elemental realms, Dark Realm, dungeons and both
  casino floors, with bounded crossfades and cleanup.
- Camera-relative danger sounds preserve visual warnings and reduced-detail
  behavior; volume/mute settings apply consistently.
- Generated cue overlap is capped, with priority and reserved capacity for
  danger warnings.
- Muting, hiding the tab or suspending browser audio clears pending effects.
  Returning restores eligible ambience without replaying stale combat/UI sounds.
- Rejected playback no longer consumes a sound cooldown; partial cue failures
  and logout release their owned audio resources.

Evidence: [audio integration](2026-09-29-audio-reference-integration.md) and
[voice ownership/recovery](2026-09-29-audio-voice-lifecycle.md).
Sounds are original code-generated cues/beds, not a finished cinematic score.
Remaining: richer impact/foley identity where needed, representative listening/
busy-mix approval, and ordered packaging/deployment. No full1.44 acceptance.

## Ordered integration and verification

The three scoped audio commitsc61a5c09/ab978fbf/fe7fb026 merge cleanly onto
prepared1.43f8d8c4c7 as613d37d9/3a4d2754/255f9e51. Actual source comparisons
match048aec6e for all audio modules, Actor's cue arguments, network warning
dispatch, settings and UIManager. Remaining runtime differences are1.45 loot
labels, not missing audio dependencies. Website files remain equalad22dea7.

Six existing audio/lifecycle/settings/dispatch seam suites pass86 checks
in3.719s; full lint, shell syntax and whitespace pass. Four hardware-Chrome
checks pass16.7s: actual fourteen-family audio rendering/combat mute, live
voice-budget/suspension recovery, directional danger/master controls and
390x844 reachable phone settings. Evidence:
/tmp/eidolon-1-44-integrated-audio-0930. Reuse the unchanged nine-profile
ambience sample/mute/crossfade evidence rather than rerendering it for metadata.
No human listening claim or whole campaign replay.

Runtime/package/login/build/history labels are synchronized. Direct identity,
unique cumulative-history ordering and registered browser-file existence
checks pass; standard CI still applies before live acceptance. Fetch/merge
master before eventual ordered publication and preserve any new website work.
Final bus mix, richer weapon foley/score where needed and human enjoyment stay
open for the integrated quality review; technically distinct sample hashes
alone do not meet that quality bar. No production terrain flag, schema/save/
access reset, combat rebalance or closed-beta admission change.
