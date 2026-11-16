# Alpha 1.79.79 wardrobe readiness correction

Correction source: `d70df7b82e8164eb6cecadf9bcb4f2f7c6eda3dc`.
The second 1.79.79 source `a1feaefbb20f044f7d89258a4b1e1be614df12a4`
fails native CI39078548890 in Fighter's connected wardrobe case. Client/server
and all three browser jobs succeed; native reports146passes/one failure/one skip.
Release inputs, both deployments and live QA are skipped. Public1.79.78 remains
the last accepted release. This correction is locally qualified, not deployed.

Removing real chest gear under a full armor garment leaves the visible outfit,
item count and signature unchanged. The old fixture waited for appearance alone
before immediately comparing real equipment, so a normal replication interval
could leave its two snapshots at different gear states. The failed comparison
shows an extra chest object in the local snapshot at that moment.

Every phase now waits for the exact intended real equipment on both clients,
using the original equipment snapshot with explicitly omitted main-hand/chest
slots for the removal phases. Equality alone cannot accept two stale snapshots.
All earlier appearance, equipment, signature, stats, currency, saved Low-quality
and relogin assertions remain. Timeouts and zero-retry policy are unchanged.
No runtime, model, gear/cosmetic rule, server, workflow, script, version or patch
note changes. The earlier29-geometry/cache correction remains intact.

One focused Fighter native case passes once in46.993seconds through all nine
phases. Both clients explicitly observe hidden chest removal while the outfit
still renders nine items, then the restored chest after clearing the outfit.
All paired equipment/signature snapshots agree. Actual System Chrome/AMD native
rendering, local/remote models, normal purchase/equip/relogin paths and saved Low
preference remain checked. This is a synthetic returning-player fixture, not
earned EP, whole-campaign, all-class final art or performance acceptance. The
private wrapper requests2CPU/512MiB for its API and1CPU/512MiB for Mongo. Its
owned API/Mongo/image/network are confirmed absent after completion. Lint passes.

Private correction evidence:
`/home/aeml/.local/share/eidolon-wardrobe-readiness-20261018/.qa-wardrobe-readiness`.
Frozen17-file inventory SHA-256:
`37a9fcee486940ab46f5d55092b44c7fb31d6ede7772893642dbcb13cbbefff9`.
The terminal failed a1run, original logs and sanitized readiness/context copies
are frozen in48files under the main worktree's `.qa-release79-corrected`, SHA-256
`ba50bc617bb44a5beb819f6b93aca23679bb6841b822701279ce7c5978d3ecd5`.
The original677client failure retains its separate15-file parent. None is retried
or overwritten to manufacture a passing history. The corrected same-version
source still requires its own exact CI, deployment and public verification.

Full original goal remains active. Prepared1.79.80 world/effects/movement/recovery
work stays isolated until the current release is accepted. Human campaign/phone
feedback and soak/stress remain deferred, not passed. No access/channel change.
