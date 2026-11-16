# Interrupted Work Recovery

## Workspace reconciliation

The root checkout had intentionally accumulated 644 local-only documentation ledger commits while production releases were pushed from independent worktrees. The complete ledger line is preserved at `archive/root-ledger-never-push-20260914-296d747f`. Local `master` now matches `origin/master` at `a22e42afc5ee8e4e503023eaa09cee704082799c`, and current work continues on `work/admin-role-20260915`.

## Public-event acceptance

The interrupted `TestPublicEventActualPartyFullClear` run had received a correction for empty initial movement context but had not been rerun. Recovery work established that its all-Wizard, basic-attack-only fixture was underprepared and that treating an ordinary player death as a disconnect could not exercise normal recovery.

The corrected acceptance now uses a legal max-Vitality level-100 allocation with generated Legendary equipment. Death recovery, if needed, uses a fresh movement context, an ordinary town respawn, a proven return from town, bounded retries, and the authoritative event expiry.

Terminal result on September 15, 2026:

- Air public event completed in 2 minutes 16 seconds.
- All three defense waves and the champion completed.
- Four connected clients each observed all four waves.
- Clients delivered 59, 52, 56, and 62 accepted event hits.
- No client died in the accepted run.
- Saved Gold and max-level kill progression were verified.
- No level, EP, special Gold purse, runtime grant, accelerated clock, or test-only server command was used.

## Nightly soak

Nightly soak run `34925251215` completed 30 healthy minutes, with 100 clients, 4,451,855 frames, zero client errors, and 30 healthy runtime samples. A host package upgrade then restarted Docker/containerd and deleted the disposable Mongo container. The harness correctly failed health and cleanup found `/var/run/docker.sock` unavailable.

No game source correction is indicated. A new uninterrupted 24-hour soak remains an operational acceptance task; host package maintenance must not run while the soak runner is active.
