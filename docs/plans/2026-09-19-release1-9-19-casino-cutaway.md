# Alpha 1.9.19 — a place for every patron

Status: packaged locally, **not pushed or live**. Alpha1.9.18 run35471538108
is still being monitored by Luna; do not supersede it. Keep the full1.10 scope.

## Included

Upstairs casino patrons now follow the actual balcony cutaway, including pointer
selection and nameplate visibility. Returning to a visible upper floor restores
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

## Next

Accept1.9.18 from its terminal CI result and public exact identities first.
The prepared Tidestar run remains the next missing raid; coordinate this next
release's native browser jobs with that long run rather than overlapping them.
When published, delegate its exact CI run to Luna and independently verify the
public frontend/backend identity, readiness, notes and served cutaway code.
