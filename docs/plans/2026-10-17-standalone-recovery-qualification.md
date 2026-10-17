# Standalone recovery-point qualification

Code: `e201443ed5aaf12318267a011d6045ec0d30f563`, based on the
[qualified transfer candidate](2026-10-17-backup-transfer-qualification.md).
This is validated operator tooling awaiting ordered integration and publication
after Alpha 1.79.77 acceptance. It does not complete 1.81 or the full game goal.

`server/deploy/create_recovery_point.sh` explicitly captures a coordinated Mongo,
private-journal and immutable-image set without deploying a different server.
It verifies only the unique point created by its invocation and restarts the
same originally running API container/image. Stopped, created and absent APIs
stay stopped or absent. Paused, transitional, ambiguous and unknown initial
states refuse before capture; unexpected restoration states also refuse.
It does not source `.env`, recreate a container, migrate data, select an old
point, restore data, schedule snapshots, prune files or transfer private data.

Raw upgrade backups, standalone snapshots and Mongo restores now acquire the
existing deployment fd9 / `logs/deploy.lock` protocol. A genuine inherited
descriptor permits nested deployment capture; an unrelated descriptor cannot
bypass a held lock. Overlap refuses before Docker access. This coordinates
these operator tools, not arbitrary external writers or database clients.
Existing raw upgrade success still leaves the old API stopped for its caller.

The upgrade capture flushes selected artifacts/directories and then its
completion marker; it no longer flushes the entire filesystem. Failed final
flushes and standalone verification remove only the new point's marker while
retaining partial files and attempting to restore original availability.
Failed restart returns an error while retaining a valid completed point.
Running-state verification does not establish HTTP readiness; operators must
check readiness and normal account access separately.

## Evidence

- 27 current standalone-recovery regressions plus 23 unchanged transfer checks
  pass across two Jest suites; changed-file lint, shell syntax, formatting and
  whitespace checks pass. Real `flock` contention, inherited descriptors, API
  states, capture/restart/durability failures, future-dated older points and
  verification failures are covered using synthetic Docker/sync fixtures.
- 62 existing shell scenarios pass across three Go top-level tests: 26 verifier,
  eight coordinated-point restore gates and 28 Mongo restore guards. These use
  Go 1.22.2 stdlib-only file invocations, not an application Go 1.27.2 build.
- One owned Docker backup/restore rehearsal passes in 29.58 seconds. Actual
  Mongo 7.0.14 archives/indexes, gzip/tar, immutable image capture, private journal
  ownership/bytes and injected dump failure are checked. The original API ID and
  image survive a standalone capture despite replacement of its mutable tag.
  Existing schema-12 synthetic resources, Gold/EP, membership, cosmetics,
  receipts and a pending wager retain their exact values. The API is a writer
  stand-in; this does not prove game shutdown, current-schema gameplay, earned
  progression, HTTP readiness or a production recovery objective.
- The Docker project uses network-none services and no host ports. Independent
  post-run checks find no owned containers, volumes or project images.
- Transfer sender/receiver/verifier and its 23-test file remain byte-identical
  to their qualified parent; the expanded operator guide is new documentation.

Private evidence directory:
`/home/aeml/.local/share/eidolon-standalone-recovery-review-20261017/.qa-standalone-recovery`.
The frozen 17-file `qualified-evidence-inventory.json` SHA-256 is
`4cac24df54e9ff6553e43e7c6a7cfd48b30f53a43c43d666e90a50a2f1f8a501`.
It records exact source bytes, logs, cleanup and parent inventories.

Original failures remain retained: raw capture ignored an existing deployment
lock (three files, `ce8d686290d491bbe5cf1ac9c006557407eab6669c29706a2bd4339c38c0d782`);
failed final flush retained `COMPLETE` (five,
`d99a81347d04d17ef32d4d179efe9b0b78eb94e6a87853b4eb276787defa1221`);
all eight unusual/inconsistent API states were accepted (four,
`e7c4c0ffafd44baa4e22745ca8a5c02f71e56350fc2341c7ccae356a5c210bfa`).
The first native fixture omitted the copied verifier and failed (seven,
`175eb972f8df8e7149f3e31b9f39fe8586f1b632f1e2fd4068e34f275bd79f50`);
that fixture was corrected before the successful run. A qualification observer
initially overcounted top-level tests by matching child-case prefixes (three,
`9ca86ebcc102f914bee01c99caf1b2e0c2e1e5b0f80074296c1f53053f8420e2`);
only the observer expression changed, without rerunning unchanged passing tests.

## Publication boundary and remaining work

Selecting both transfer and standalone components adds two client suites and
50 checks: expected total 804 suites / 12,502 tests on the current 1.79.77 base.
Engine modules remain 513; there are no new browser cases, app/schema/dependency,
asset, game-rule or service-configuration changes. Exact-source full CI and
deployment acceptance are still required after integration.

No production capture/restore or external private-data transfer occurred.
Off-machine destination/access, retention, acceptable lost progress, desired
restoration time and final recovery ownership remain owner decisions. Scheduling
stays disabled. Current-schema integrated recovery and final candidate operations
remain open. Full original world/art/game/combat/audio/performance/device/
security/operations/F1–F5/beta/1.99 scope stays active. Human campaign/phone
feedback and soak/stress remain deferred, not passed.
