# Explicit support-target admission

The desktop roster feature is in the parent899a8664. This follow-up rejects
explicit Healing Light/Divine Intervention targets that are already unavailable
when the server admits the command. Previously, a missing, dead, wrong-instance
or distant target ID could fall back to the caster and spend mana/cooldown;
zero-health and disconnected targets could receive the spell directly.

The dispatcher now checks a supplied target under its entity read lock before
combo/resource/skill-history mutation. It uses the existing friendly-type,
instance and15-unit range rules, adding positive health and connection checks.
Rejected commands retain the existing requirements-not-met feedback. Empty-ID
cursor casts and valid explicit self/ally casts retain their normal behavior.
This is admission validation, not a claim that the entire legacy handler is a
linearizable transaction against every parallel world tick.

Red36212 reproduced all14 invalid-target cases in4.522s. Focused61779 passed
three repetitions of the new invalid/valid target cases and existing dispatch,
party-support and Intervention tests under the race detector,39.563s. Full Go
regression, primary integration and native release acceptance remain pending.
No browser was restarted or modified for this isolated server change.

The native party test87906 on the unchanged parent ended with a Warden wipe,
but confirmed10,842 effective ally healing through roster selections. That is
evidence for the desktop input fix, not this server patch or a full clear.

Full server15215 ended with four assertions failing in391.199s, no race warning:
the all-selectable ability and dungeon-coordinate contracts supplied an enemy
ID even to the two friendly-target heals. Those fixtures now supply a wounded
friendly player at the same coordinates; acceptance and coordinate assertions
are retained. Focused7527 passed both complete contracts and explicit-target
cases under the race detector21.611s. A fresh full regression is still required.
