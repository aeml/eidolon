# Audio reference integration — September 29

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
