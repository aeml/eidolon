# Audio reference integration — September 29

## Follow-up: ability-family identity (on be44cb7a)

Local cast presentation now passes its skill name into the existing class cue.
Fourteen short synthesized signatures distinguish steel/guard/force, blade/
shadow/trap, fire/arcane/gravity/time/frost and healing/radiant/summon actions.
Known aliases resolve consistently, retaining Frost Nova's non-fire override.
Each uses at most two voices and ends within0.35s. Existing class cooldowns,
combat bus, mute, danger reservation and local-only filtering are unchanged.
Calls without skill metadata retain the old class cue. No combat values,
cast timing, remote-party noise or asset downloads were added.

46 focused audio/lifecycle checks passed in1.438s; scoped lint/diff passed.
Two hardware-Chrome audio tests passed9.6s: fourteen actual OfflineAudioContext
renders have distinct sample hashes, finite bounded output, silent tails after
0.4s and complete combat-bus mute. Existing live-context voice budget/suspension
recovery also passes. Artifacts:/tmp/eidolon-ability-audio-0929. This is signal
and integration evidence, not a human listening or busy-fight mix approval.
These remain synthesized accents, not finished weapon foley or cinematic sound.
No runtime bump, deployment or ordered-release gate waiver.

## Earlier combined integration

Local combined candidate based on 2cfde25c. Runtime identity stays Alpha
1.38.0. No push, deployment or release-gate acceptance.

Integrated independent combat/movement, interface/loot/casino and ambience
buses, persistent accessible settings on desktop and phone, camera-relative
danger panning/attenuation, and nine synthesized ambient profiles. Instance
identity takes precedence over reused world coordinates; casino floors differ.
Ambient layers crossfade, reuse noise buffers and keep at most two live layers.
Mute/hidden tab/logout stop ambience; engine destruction releases voices,
media, context and visibility listener. Existing visual warnings are unchanged.

These are original code-generated sounds, not imported recordings. They are
a functional sound-design foundation, not approved cinematic music, foley or
a final listening/mix review. Existing per-class actions and casino cues are
preserved. No new actor asset dependency.

74 checks in six suites passed (2.902s). Scoped lint and diff checks passed.
Five browser checks passed (27.6s), including actual OfflineAudioContext stereo
samples for all profiles, left/right danger and complete mute, plus touch
settings/activation at 360x800, 390x844 and 844x390. Artifacts:
 /tmp/eidolon-audio-integrated-0929

Browser sample amplitude/direction checks are not a human listening assessment.
No full campaign or long soak repeated. Shipped patch history and version
identity retained; only the settings hunk was taken from the older root HTML.

Next: improve and review reference-scene composition/materials and the combined
play experience. Owner-deferred 1.39/1.40 acceptance is still unassumed.
