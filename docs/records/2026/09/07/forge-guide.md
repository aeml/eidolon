# Alpha 1.0.35 — the forge answers

Player reports September 7: upgrades/potency only appear after reopening the Forge;
the dungeon guide offers 30/40/50 runs for the 70-minimum fire/air dungeons and
60-minimum water dungeon (named Abyssal Well in the game).

## Causes and changes

The full-state equipment handler refreshed Forge details, but the delta handler
did not. A shared open-forge refresh now runs after equipment/material updates
are applied, including direct inventory replies. Selected tabs and occupied
slots stay selected; empty slots clear stale detail panels. Current item level,
stats, potency, next costs and affordability update without reopening. Hidden
Forge lists do not rebuild or open in response to replication.

A further packet-order test found that the full-state path did not consume an
included inventory field. It now hydrates those authoritative materials before
refreshing the Forge, matching the delta path. No purchase result is simulated
locally, and the server's costs and item calculations are unchanged.

The guide previously built its global run-level list only once. It now rebuilds
on family changes, filters unlocked bands against the server-published entry
floor (known defaults during rolling deployment), preserves a compatible selected
level, and disables an empty list with an explanation. New Molten Core/Tempest
Spire choices begin at 70; Abyssal Well begins at 60. Saved active runs retain
their original locked scaling, including older low-scaled runs; server scaling
and existing instance/reward rules are not changed by this UI correction.

## Evidence so far

- Original two-report regression: **13 failed / 15 passed**, log
  `/tmp/eidolon-forge-guide-before.log`. Failures directly show unchanged level
  text, stale material affordability/details and incorrect family choices.
- Initial repaired coverage: **104 focused tests pass**; full client suite
  **182 suites / 2,532 tests passes in 97.173 seconds**, with lint. These precede
  1.0.34 integration and the additional full-state/material-reply coverage.
- The new packet-order probe failed on full-state inventory consumption;
  retained log `/tmp/eidolon-forge-guide-packets.log`. After repair, **87 tests
  pass** across three suites, `/tmp/eidolon-forge-guide-packets-fixed.log`.
- The isolated `forge-guide` route prepares a newly registered disposable local
  account with one staff and exact materials, then uses ordinary town interaction
  and purchase controls for +1/+10 levels and two potency ranks. It checks open
  selection/cost updates, depleted-material disabling, whole-item fresh-login
  persistence and the real guide's family choices. This is functional QA, not
  earned progression. The route cannot target production and is included in
  the full isolated suite. Its terminal result is still pending at this entry.

Remaining before release: inspect the real-server result, run desktop/phone
rendered regressions, add separate 1.0.35 notes/version metadata, repeat final
checks and preserve the ordered CI/live publication gates. This does not close
the wider Forge phone redesign, campaign or 1.1–1.10 scope.

## Ordinary-interaction failure retained

The first real-server route and its diagnostic repeat both failed to open the
Forge before any purchase. The diagnostic confirmed the character stopped at
`[-23.088, 217.647]` with the Forge at `[-28, 218]`, pending/hovered target both
`forge-1`, menu not paused, and interaction range 4m. The remaining distance was
about 4.9m. The Forge still used a whole-rendered-mesh AABB rather than the current
town-structure footprint system. This is an additional approach defect, not a
purchase-refresh failure or permission to bypass interaction in QA.

Two new collision probes fail before the correction. The candidate adds the
current hearth/anvil footprint (5.35 × 6.4 local units), excluding decorative
overhangs and the low foundation. Forge creation now uses the existing oriented
collider lifecycle alongside stash/trading-house structures. Tests require both
batched and unbatched models to block the hearth while allowing an approach. The
initial probe used a 0.5m capsule; the next real run still stopped at 4.46m because
the actual hero capsule is **1.25m**. That failure is retained in
`/tmp/eidolon-forge-guide-collider-gameplay.log`. The corrected probe uses the
full-size hero and checks all four approach sides. Forge interaction now reaches
6m from its center, allowing use from outside the solid hearth/anvil, without
changing combat or other NPC ranges. The same ordinary click/purchase route is
being repeated; no debug movement or direct window opening is substituted.

Retained logs: `/tmp/eidolon-forge-guide-gameplay.log`,
`/tmp/eidolon-forge-guide-interaction-diagnostic.log`,
`/tmp/eidolon-forge-collider-before.log`. Both failed browser runs completed their
credential scan and exact disposable cleanup.

The full-size approach correction then passed all purchase/refresh assertions
and whole-item fresh-login comparison. The route failed next because empty
saved inventory slots decoded into zero-valued objects, which were hydrated as
nameless Common items. Retained log:
`/tmp/eidolon-forge-guide-full-size-gameplay.log`. Item hydration now treats
records with neither ID nor name as vacant, while preserving named legacy items
and identified equipment. The empty-bag assertion remains strict; it is not
replaced with a filter that hides these phantom records.

The next run passed Forge approach, all purchases, selected UI, whole saved item
and an actually empty saved bag, then stopped trying to project the guide from
the forge-side camera. The route now reuses the existing ordinary ground-click
and camera-settling guide navigation instead of assuming that distant NPC is in
view. Retained log: `/tmp/eidolon-forge-guide-empty-slots-gameplay.log`. This is a
QA navigation precondition change, not a game-world teleport or entry bypass.

The navigation repeat completed every gameplay assertion but failed the final
browser-error check on `/null` icon requests. The fixture used the noncanonical
name “Wizard Staff”; it now uses the existing Wooden Staff base item. Forge icon
assignment also explicitly clears unavailable artwork instead of interpolating
a null URL, preserving legacy-item details without a broken request. A focused
regression checks this fallback in upgrade, potency and socket lists. Retained
log: `/tmp/eidolon-forge-guide-navigation-gameplay.log`.

The canonical-item repeat **passes in 23.9 seconds** (21.9-second test body),
`/tmp/eidolon-forge-guide-canonical-gameplay.log`, including the strict final
browser-error check, credential scan and cleanup. Combined focused coverage
passes 101 tests. Alpha 1.0.35 notes and login/package/runtime versions are now
synchronized. Final versioned client/server/anonymous checks are in progress.

The first final client run passes 2,554 tests but fails one old mesh-residency
fixture that expects Forge's retired AABB path. The fixture now loads the actual
procedural Forge, verifies its oriented hearth dimensions and removal callback,
and still requires render residency after immediate loading. The old failure is
retained in `/tmp/eidolon-forge-guide-final-client.log`; no collision assertion
is simply removed. The corrected full suite is being repeated.

The corrected final client run **passes 183 suites / 2,556 tests in 171.286
seconds**, and lint passes; `/tmp/eidolon-forge-guide-final-client-corrected.log`
and `/tmp/eidolon-forge-guide-final-lint.log`, session `33841` closed successfully.
The final server race suite also **passes** (root 18.106 seconds, game 311.656
seconds), `/tmp/eidolon-forge-guide-final-server.log`, session `99410` closed.
The final anonymous run and subsequent versioned real-server repeat remain to
be completed before committing the candidate.

Final anonymous browser regression **passes 46/46 in 8.9 minutes**,
`/tmp/eidolon-forge-guide-final-anonymous.log`, session `31468` closed. All three
new family-choice captures were visually inspected (desktop 1280×720, portrait
390×844, landscape 844×390): controls use the existing scroll area, phone footer
keeps the selected run summary/action readable, and portrait chat remains visible.
This is not physical-device sign-off. Only the final versioned functional repeat
remains before the local candidate commit.

The final versioned real-server repeat **passes in 23.2 seconds** (21.1-second
body), `/tmp/eidolon-forge-guide-final-gameplay.log`, session `44255` closed
successfully. Ordinary Forge interaction, +1/+10 upgrades, two potency ranks,
live selected details/costs, material exhaustion, whole-item fresh-login
persistence, an actually empty bag and server-fed family choices all pass.
Final browser errors, credential scan and exact isolated cleanup pass. The local
candidate is ready for commit as `release/35-with-forge`; publication must follow
1.0.29–1.0.34 in order. 1.0.28 is now fully verified live; 1.0.29 CI `34078663504`
is running. These receipts do not claim a physical-phone Forge redesign or a
full campaign/raid completion.
