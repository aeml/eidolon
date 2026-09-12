# Offline Teleport Phase — unreleased functional repair

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

Separate worktree based onb1c9e8fc; the running1.0.63deployment is untouched.
The server already grants the rune one second of gameplay invulnerability with
Wizard duration training. Offline Teleport previously granted none.

66178 reproduced seven failures/ten controls0.681s. The offline rune now grants
that one-second window, or1.2seconds with five Prismatic Control ranks. Damage
is blocked before shield absorption, death saves and retaliation. Its timer
expires during stun; death and explicit respawn clear it. Other runes, rejected
casts, replicas and multiplayer-owned actors cannot gain this local effect.
Initial19995 passed four suites80tests1.311s plus full lint.

Periodic probes25358 then found four failures0.709s: because wound processing
precedes timer expiry, a frame crossing the deadline could suppress an extra
tick. Periodic damage now passes each tick's elapsed position within its frame
to the receiver. Phase compares that offset to the remaining window; its timer
still decrements exactly once. Direct hits use offsetzero, and non-Phase wound
calls keep their existing two-argument shape. One2second frame and split frames
all protect the first1second tick and admit the second2second tick for a1.2second
Phase. Exactly-at-deadline damage is not protected, matching server Before.

11040 passed six suites157tests1.906s plus full lint. Logs:
`/tmp/eidolon-offline-phase-{red,green,periodic-red,final,lint}-20260911.log`.
This is functional coverage, not native/visual/persistence/release acceptance.
Teleport's set charges, both-client rune presentation/trained burst boundaries
and the wider utilityMastery decisions remain outstanding.

The parent Warp/landing candidate's full regression17718 completed successfully:
357suites5107tests132.31s and lint; Go race root18.679s/game329.893s, database
1.100s/lifecycle1.023s. Logs `/tmp/eidolon-teleport-warp-{full-client,full-lint,full-server}-20260911.log`.
That frozenb1c9e8fc result is not full acceptance of this later Phase change.
