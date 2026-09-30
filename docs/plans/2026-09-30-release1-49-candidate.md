# Alpha1.49 — session/resource-lifetime candidate

Prepared September30,2026. Corrected148 is independently accepted and its final
source and acceptance receipt are merged. Metadata, login and cumulative history
target1.49.0. Corrected source is now independently accepted live; the
[public acceptance receipt](2026-09-30-release1-49-acceptance.md) records its
exact CI, identity, document and changed-asset checks.

## Scoped fixes

- Scene retirement collects active/dormant chunk actors, remote players, effects,
  hazards, caches and queued work. Invalidate late loads before cleanup. Preserve
  the local player through transitions and reinsert it in the correct active
  chunk even at unchanged coordinates. Restore borrowed casino poses before
  mesh-pool reuse.
- Identity-owned socket handlers retire on transport replacement/destruction,
  preserving application/replacement handlers and borrowed open transports.
  Owned retry work cannot recover a retired engine.
- Persistent menu registrations use session owners; teardown retires child
  menus, observers, previews, audio, map/HUD listeners and owned GPU contexts
  without destroying shared markup or replacement-owner handlers.
- Delayed ground attacks capture engine/player/model/instance ownership. Loot
  deadlines belong to exact records; confirmation/retirement cancels them.
  Keep normal timing, confirmation authority and suppression behavior unchanged.
- Temporary combo/respec windows own their nodes, timers and exact close callback;
  retired asynchronous callbacks cannot reopen or mutate replacement windows.

## Verification

Full reproduction and incremental evidence are in the
[lifetime work receipt](2026-09-30-release1-49-lifetime-work.md). Preserve earlier
unaffected coverage rather than repeat campaigns or indefinite soaks.

Latest148 integration: nine impacted suites114checks5.180s and eight native
High/Low cases50.8s with real GameEngine/RenderSystem/NetworkManager owners.
Three session retirements, repeated town/dungeon/casino-floor/gear/death changes,
three transport recoveries and full92-station/232-seat venue visits are covered.
Production-default batching remains registered through transitions, warm-repeat
buffer counts match and final helper roots/buffers/group are released. Full
casino activates all five games on both floors three times, with prepared live
round clocks and50queued spins/reel work; leaving cancels its owned work.
Exact catalog snapshot is checked against Go CasinoTables. Mandatory browser
partition now236cases, exactly once; no omitted previous owner/appearance cases.

These are bounded local native resource trends, not a heap/driver-byte census,
authenticated production-save proof, casino fairness/settlement, handset FPS,
100-player capacity or universal leak freedom. Cached hidden furniture and
application-owned sockets are intentional, not leaks or falsely claimed freed
resources. Normal deployment/live checks still gate release acceptance.

No progression/economy/combat-stat/access-policy changes or database migration;
no privileged nginx/DNS changes. Actor assets, human pacing and real-phone party/
dungeon observations remain owner-deferred. Integrated presentation150 and later
roadmap milestones remain open; this does not declare final art or beta ready.
