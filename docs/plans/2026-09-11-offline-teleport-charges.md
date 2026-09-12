# Offline Temporal Weave charges — unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

The actual four-piece Temporal Weave bonus promises two Teleport charges. Server
casts already implement a full-pair recharge restarted by either cast. Offline
casting ignored the bonus and imposed ordinary cooldown after the first cast.
Tests equip actual0/3/4/6set pieces, rather than injecting ActiveSetBonuses.

93758 reproduced five failures/ten controls0.725s. Offline Teleport now commits
one charge only after normal paid admission and landing. The spare clears the
specific cooldown and, for the legacy primary-slot path, its second cooldown
gate. Consuming the spare starts the normal committed trained/set-adjusted
cooldown. Recharge ages during stun, lazily restoring the pair on the next
accepted cast after expiry. Every cast pays its normal mana cost. Set removal
uses normal single-cast cooldown; rejected or multiplayer-owned casts cannot
consume/grant these explicitly offline-only fields.

36907 passed six suites131tests1.482s+lint. Expanded35324 passed six suites133
tests1.613s+lint: Technique/Leyline cooldown and mana scaling apply once, spending
the spare restarts rather than shortens recharge, and an unaffordable second
cast retains the spare/timer until a later paid cast. Logs
`/tmp/eidolon-offline-charges-{red,green,final,lint}-20260911.log`.

The parent85ee5a5b Phase/aura integration passed55247:358suites5143tests133.36s
and full lint. Server source was unchanged from full Warp regressionb1c9e8fc.
Primary development was fast-forwarded to that accepted85ee5a5b. This later
charge change still requires its own full integration before joining primary.

Native earned/equipped-set use, all-rune visible boundaries on both clients,
fresh saves and versioned release remain required. Current1.0.63deployment has
none of these later Teleport changes. Full1.1/160talent/phone/party-clear gates
remain open; tests of charges do not establish completeTeleport acceptance.
