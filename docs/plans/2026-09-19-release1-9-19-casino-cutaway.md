# Alpha 1.9.19 — a place for every patron

Status: packaged locally, **not pushed or live**. Alpha1.9.18 run35471538108
passed and its public identity/source checks match. Keep the full1.10 scope.

## Included

Upstairs casino patrons now follow the actual balcony cutaway, including pointer
selection, nameplate visibility and independently rendered attached status art.
Well Rested and other buffs keep their normal state; only their aura visibility
follows the floor. Returning to a visible upper floor restores
the patrons; lower-floor players remain visible from upstairs. Already-hidden
or retired actors are not unconditionally revealed. No changes to seating,
wagers, currency, membership, rewards or encounter mechanics.

The login label, package/lock, release manifest, server/build/deploy/QA defaults
and CI-generated manifest agree on Alpha1.9.19. Cumulative player-facing notes
are added above the preserved1.9.18 history. Roadmap resource persistence is
reconciled against the implemented save/load path without claiming the separate
full-session verification item complete.

## Retained verification

-47 focused casino/nameplate/VIP/witness/pointer tests passed for the actual fix.
- One5.5second native High/Low public/VIP crowd render, zero retries; four images
  inspected and archived. See [review, artifacts and limits](2026-09-19-casino-crowd-review.md).
-268 version/history consistency checks pass (4106,2.293s), plus changed-file
  lint, Bash syntax and diff checks. No repeated broad encounter or save matrix.
- Follow-up: a real attached Well Rested effect exposed the separate world-space
  aura gap. Its regression failed before correction;29 controller/status-effect
  checks pass afterward (91575,2.18s). Updated crowded-floor render with40 real
  status effects passes7.7seconds (5109,10.9s including startup), zero retries.
  Visible aura counts match visible patrons in all four views. High public and
  Low VIP screenshots were inspected; artifacts are preserved as `aura-results/`
  and `aura-report/` beside the earlier crowd artifacts. No buff-state mutation.

## Next

Tidestar's latest run terminated on a QA pointer-wait timeout; its artifacts are
preserved and it is not counted as a clear. The bounded wait/diagnostic follow-up
passes51 focused checks without changing gameplay or completion assertions.
No raid or other local browser run is active, so publishing can use native QA.
When published, delegate its exact CI run to Luna and independently verify the
public frontend/backend identity, readiness, notes and served cutaway code.
