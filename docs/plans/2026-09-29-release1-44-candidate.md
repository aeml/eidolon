# Alpha 1.44 — audio integration candidate

## Accepted predecessor — September30

Public1.43frontend release.json and backend healthz now agree on exact
132e1a844c610f0b3dc1e917d01a37544140ee4e/Alpha1.43.0, database ready. Root
independent normal-DNS IPv4 checks verify cache-bypassed login version/latest
patch entry/main release key, exact stamped main/Actor/ability clips/gait
grounding/enemy-death grounding/corpse/combat-feedback modules and first-party
font bytes against the exact1.43checkout, using the real publishing transform.
CI36668039885attempt1 completed success with all ten jobs, including
live109745012948. Root independently revalidated terminal SHA/attempt/jobs
and repeated public frontend/backend/database checks. [Acceptance receipt](2026-09-30-release1-43-acceptance.md).
1.44 still requires its own exact-source CI and live acceptance.

Unreleased integrated candidate on the prepared1.43 branch. Runtime/package/
login/CI/default build identities and cumulative notes identify1.44.0.
Ordered1.43 publication is accepted. Final listening/mix approval
is not claimed; human observations are not a new publication permission gate.

## Confirmed impact identity — September30

Close the remaining all-hits-use-one-cue gap: authoritative damage kind now
selects distinct physical/fire/cold/lightning/arcane/holy/shadow contact accents.
These are original short synthesized sounds, not cast announcements, external
recordings or claims of finished weapon foley. Local bleed/poison/hazard ticks
use one much quieter voice. Only positive finite confirmed damage involving
the local player sounds; unrelated remote fights and zero/invalid events do not.
Existing floating text, damage, action presentation and combat timing remain.
Legacy/unknown kinds keep their previous generic fallback; generic authored
media cannot override recognized typed impacts. Combat bus, cooldown, voice
budget, danger reservation, mute and suspension/lifetime behavior are retained.

Five focused profile/audio, real damage-dispatch, cast and version suites pass
434checks6.155s. Dispatch covers legacy and five typed local damage packets,
preserving the remote attacker refresh. Scoped lint/whitespace pass. First
Chrome trial failed two import requests with net::ERR_NETWORK_CHANGED even
on loopback; trace response confirms the actual network failure rather than
a missing module. No test suppression or source fix is attributed to it.
One bounded rerun with stable source passes3cases15.7s, including actual eight
distinct OfflineAudioContext sample hashes, finite bounded peaks, silent tails
after0.25s, periodic RMS less than one third of every ordinary impact and
complete combat-bus mute. Existing fourteen cast-family and live-context
voice-budget/suspension checks also pass. Artifacts:
/tmp/eidolon-1-44-typed-impacts-final-0930; failed trace retained in
/tmp/eidolon-1-44-typed-impacts-0930. Signal evidence is not human listening/mix
approval. Patch history records this contact improvement in1.44, not a separate
version. Ordered1.43 live acceptance now permits publishing this candidate.

## Current upstream integration — September30

### CI fixture correction — September30

Candidate89d3baf8 CI36671909093 failed one Jest suite before loading its tests:
the friend-toast fixture's partial AudioManager mock omitted the new public
AUDIO_BUSES export used by UIManager. Production exports and channel controls
remain intact; the mock now supplies the same frozen combat/interface/ambience
list. No tests or deployment gates were removed. The corrected friend-toast,
AudioManager, typed-impact, UI settings and phone settings suites pass89checks
in3.9s, with scoped lint and whitespace passing. An initial local command named
a nonexistent UIManagerAudioSettings suite; that command failed and is not
counted as passing evidence. The explicit existing-suite command is the receipt.
The corrected source still requires a new exact-head CI/live acceptance.

Merged master132e1a844c610f0b3dc1e917d01a37544140ee4e into the prepared
candidate. Preserve1.44 identities, its cumulative patch entry and website
files, while carrying the accepted1.42 first-party font,1.43 dependency patches,
current Wizard/Maelin animation fixture, strict browser diagnostics and scoped
Pages proxy template. README conflict resolved to1.44 source/1.42 accepted live,
not an unverified1.43 acceptance. Eleven focused audio, font, loader, publishing,
version and browser-helper suites pass503checks6.799s with the patched toolchain;
full lint and whitespace checks pass. Existing unchanged audio rendering/
suspension/phone evidence remains applicable, not rerun for document changes.
1.43 CI36668039885 subsequently passed its ordered publication prerequisite. This merge
does not apply the staged privileged nginx configuration or deploy1.44.

## Draft patch notes

- Distinct short cast cues for fourteen ability families across all four
  classes, including fire, arcane, gravity and time magic. Existing local-only
  playback, combat volume controls and danger priority are preserved.
- Short typed impact signatures with quieter periodic contact; zero/invalid
  damage and unrelated remote fights do not add local hit sounds.

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
