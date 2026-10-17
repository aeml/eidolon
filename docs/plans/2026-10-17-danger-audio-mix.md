# Danger-warning mix protection

The production audio owner reserves two generated voices for danger warnings,
but those voices previously competed with unchanged full-volume combat sounds
and the regional ambience. Reserving voices prevents dropped warnings; it does
not create room in the mix. This candidate adds that missing presentation step.

Accepted warnings briefly lower ordinary generated combat audio to35% and world
ambience to55%, without raising the warning or changing the player's combat,
ambience, interface or master settings. Warning direction and attenuation stay
intact. A12ms attack avoids an abrupt level step; the envelope holds through the
warning's source lifetime and recovers over140ms. Overlapping accepted warnings
continue from the current level and extend the hold. A newly opened ambience
layer joins the remaining envelope. There are no timers or per-frame updates.

Warnings retain their direct combat-bus route; ordinary generated combat and
both active/fading ambience layers share two separately owned mix gains. Muting
combat, hiding the document or losing audio focus cancels pending attenuation.
Teardown disconnects the derived gains once. Rejected, muted, cooldown-blocked
or partially failed warnings do not start a new envelope. Interface audio and
the optional injected authored-media path retain their existing routing; actual
GameEngine/UIManager production owners use the generated Web Audio path.

Six new behavioral cases fail before implementation. Their original source,
test and log are preserved in the three-file negative packet, SHA-256:
`e9b28e3de325f00213236f0df0cb9cb2688e2677825ad100be239da6c6abfef1`.
The first integrated focused run has68passes/two failures from old minimal audio
fixtures lacking the new mix node/linear-ramp API. Its log remains retained.
Updating those fixtures preserves their original typed-contact, fallback,
voice-budget and cleanup assertions. The final70cases in seven suites pass;
full lint passes. The new suite adds six client cases, one suite and no browser
case; unchanged cast/contact checks are not counted as additional executions.

Three existing System Chrome browser cases pass without retries, with GPU
disabled: confirmed impact types, ability families and directional warnings.
The warning case also renders real Web Audio buffers with the production
Fireball cue, regional Fire ambience and warning. Subtracting the independently
rendered warning isolates the background signal. During the hold, RMS ratios
are0.3499999946for combat and0.5500000111for ambience; recovered ambience is
sample-for-sample unchanged with ratio1. Direction, mute, bus/master controls,
distinct contact signatures and quiet periodic ticks keep their prior checks.
This is rendered-signal and lifecycle evidence, not native-GPU, physical-phone,
earned combat, subjective listening or complete busy-group-mix acceptance.

Private evidence:
`/home/aeml/.local/share/eidolon-danger-audio-mix-20261017/.qa-danger-mix`.
The candidate remains isolated pending exact74deployment acceptance and selection
into a coherent subsequent milestone. Full class/combat/audio, world/art,
performance, supported-device, operations, owner and beta/1.99 gates remain open.
Human campaign/phone feedback and soak/stress remain deferred.
