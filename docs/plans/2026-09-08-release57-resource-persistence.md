# Alpha 1.0.57 — the Chronicle remembers

Status: staged candidate, not published. Must follow the verified 1.0.56 schema-7
bridge and the complete ordered release queue. The execution ledger in the main
workspace records current CI/live identity; a local version label is not proof of
deployment.

## Player-facing scope

- Persist versioned health, mana and death state; keep current live resources and
  cooldowns on rejoin. Preserve zero mana, and do not heal during offline time.
- Serialize account ownership, accepted character work, reconnects and saves;
  journal full pending snapshots and recover them before stale login admission.
- Drain accepted work and final character snapshots on orderly shutdown. An
  abrupt process loss recovers durable state, not every unsaved combat frame.
- Recover listing deposits, bids, refunds, buyouts, seller proceeds and item
  deliveries once through durable decisions and character receipts. Validate
  selected item identity/stack and start listing duration at first publication.
- Keep dead-only Respawn recovery, living Recall rules and .01 passive regen.
  Well Rested, safe-zone percentage recovery and expanded campaign/balance work
  are separate upcoming changes.

## Deployment and recovery

The schema-8 target must pass its read-only compatibility check before replacing
the running API. The deployment script serializes its own invocations and verifies
that its URI targets the Compose Mongo service being backed up. For a schema
increase it stops the prior API, archives the entire game database, private logs/
pending saves, and immutable previous image; checks compression and hashes;
synchronizes files; and marks the recovery point complete before starting the
target. A backup failure before migration attempts to restart the unchanged API.

Backups are private and ignored by git cleanup, retained without automatic
deletion. Local backups do not cover loss of the machine: operators must arrange
off-machine storage and retain required credentials separately. Recovery after
schema8 requires this release or a verified compatible successor. An older
backup restore is a separately approved loss of subsequent progress, not a
normal rollback. Never remove schema markers, journals or receipts to force an
older writer to start. See [deployment instructions](../../server/deploy/README_LINUX.md).

## Acceptance evidence and remaining gate

The predecessor implementation passed two actual race-built schema7 save →
schema8 cast/listing → pending journal/process kill → rejected schema7 → repeated
schema8 recovery sequences with exact resources, gold, items and receipts.
Versioned candidate client suite passes240 suites/3405 tests. Full server race
tests pass; final deployment guards are rechecked separately. Disposable backup
tests exercise failed-dump restart, private-file bytes/ownership, actual restore
of zero mana/resources/receipts/schema/indexes, and absence of a previous API.
The fixture uses a signal-handling placeholder, not the game server: these tests
complement, rather than replace, actual game shutdown/replay acceptance.

Before publication: rendered version/notes check, final server regression closure,
all preceding releases' CI/live gates, and then this release's full CI, deployment
backup receipt, public identity agreement and real-input live gameplay checks.
No whole-roadmap, physical-phone or full-raid acceptance is claimed here.
