# Alpha 1.0.41 candidate — training with a critical edge

Status: local candidate, not published. It follows corrected 1.0.40 ancestry;
do not skip 1.0.37–40 or push root ahead of their individual CI/live gates.
Current integration source: **52d78ee09073d743947392fbc8e9375189ec03ef**.

## Player-facing scope

- Equipment and applicable generic/skill-specific critical training compose in
  one ordinary roll, including retained attacker snapshots. Invalid or duplicate
  legacy ranks cannot inflate bonuses. Rogue critical talent text is corrected.
- Backstab's ordinary critical is applied once after armor, including Cloak and
  Ambush guarantees; Lucky stays independent. Fireball splash starts at 40% raw
  damage, respects dungeon walls and applies each recipient's debuffs separately.
- Implemented offline attacks, skills, projectiles and periodic damage consume
  critical training, retain attacker attribution and show critical feedback.
  Offline Backstab/Implosion sequences use normal successful casts. Projectile
  flight/splash respects canonical walls and does not predict online damage.
- Separate 1.0.41 patch notes precede retained 1.0.40 history. Login, manifest,
  package/lockfile, server, container, deployment, CI and isolated-QA defaults agree.

## Evidence and remaining gate

The [critical evidence](2026-09-07-talent-critical-chance.md) retains the original
failures, deterministic actual-cast rank/control matrices, composition and
projectile regressions, full server race results and offline integration checks.
Browser source **a93194b** passes normal purchases, accepted targeted primary
casts with positive authoritative cooldowns and saved ranks after fresh login:
Rogue 21.7s, Wizard 19.5s, Fighter 21.6s. These level-prepared characters are not
earned-progression evidence, and nine browser hits do not prove critical rates.

Version/history/default checks pass **214 tests in 0.970s**. Full candidate client
regression passes **208 suites / 3,080 tests in 82.118s**; actual-consumer probes
pass **0.890s**. Full server race checks pass (root **9.851s**, game **185.709s**),
and lint passes. The anonymous browser suite completes with **47 passes / six
failures in 3.0 minutes**: one HUD module-import failure, two quest acceptance
touch assertions and three status-to-chat transitions. These require diagnosis;
the candidate is not ready for publication. Logs use `/tmp/eidolon-release41-*.log`.

No full-talent, offline-parity, phone-device or dungeon/raid completion is claimed.
Bleed/poison source consumption, unimplemented offline Avenging Seraph, older
base/stat/rune differences and actual paid Explosive Trap coverage remain audit
work. Human playtesting and physical-phone evidence remain separate requirements.

## Publication

Publish only after the corrected 1.0.40 release has completed every CI/live job
and fresh public manifest, login/main-script and healthy database-ready backend
all agree on its exact SHA/version. Then verify this candidate's own deployment
the same way. The [execution ledger](2026-09-05-roadmap-execution.md) is the current
publication record, not the local version label.
