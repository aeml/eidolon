# Alpha 1.44 — audio integration candidate

Unreleased partial candidate. Earlier ordered release prerequisites remain
open; runtime identity is unchanged. Final listening/mix approval is not claimed.

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
