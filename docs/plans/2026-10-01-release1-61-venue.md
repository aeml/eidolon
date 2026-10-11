# Alpha 1.61 casino venue preparation

October 1, 2026. This is unpublished interaction work, not a packaged 1.61
release or closure of the casino acceptance gate. It inherits local 1.59 and
1.60 preparation and the preceding 1.58 source version. Publication remains
ordered after each predecessor's exact CI and independent public acceptance.

## Dialogue lifetime and access

A reproduced controller defect left the entrance dialogue open after a zone
change, blocking normal world clicks. Casino entrance, guard, downstairs and
exit dialogues now belong to the current character, zone and floor. A zone or
floor change, disconnect, death, character replacement, seated session or
controller disposal retires the dialogue. Replacing or closing it retires its
old buttons; an old confirmation cannot send a new entry/floor request or recall
the character from a different scene. Confirming one current action closes the
dialogue before dispatch and cannot send twice.

Each dialogue has an accessible name. The non-VIP guard retains the owner's
requested message and shows visibly disabled lounge access with a reachable
Close button. VIP state changes retire stale guard invitations. These are
presentation safeguards, not permission grants: existing server checks still
authorize entry, movement, membership and floor transfers.

## Retained venue scope

The [accepted casino expansion](2026-09-20-casino-expansion.md) remains the
foundation: a shared casino instance, equal isolated 112×112 public/VIP floors,
46 stations per floor, door dialogue/signage, the west-side stash, physical
seating, camera handoff, visible same-floor patrons and restored world controls.
Each floor has four blackjack, four Hold'em, two roulette, four baccarat and
32 slot stations. No room dimensions, furniture, collision geometry, wagers,
saved outcomes, Gold/EP boundaries or monthly allowances change in this slice.
The retained expansion receipts are not newly repeated 1.61 earned playtests.

## Focused evidence and remaining release work

The new zone-change test failed against the old controller, reproducing the
open dialogue. After the fix, three controller/map/navigation suites passed
42 checks in 3.629 seconds, including the existing seated camera/input and
cleanup coverage. Scoped lint and whitespace checks passed.

The existing native Chrome stairs fixture passed at 390×844 in 9.4 seconds,
then in 9.6 seconds after the disabled control gained its muted style. The final
render was inspected. It retains actual Actor movement and collision checks,
adds accessible guard/disabled access assertions and observes dialogue cleanup
after a prepared zone change. Artifacts:
`/tmp/eidolon-1-61-door-lifetime-muted-1001`. This is a prepared interaction
fixture, not a connected wager, physical-phone certification or full-hall
performance approval. No new browser matrix, long soak or production account
mutation was used.

Complete the venue requirement review and ordered predecessor acceptance before
aligning versions, adding cumulative player patch notes and publishing 1.61.
Retain each later game's rules, settlement and interaction requirements for
1.62–1.65 and the full E gate at 1.70. The overall 1.11–1.99 roadmap remains
active. Markdown was source-reviewed; a rendered documentation preview was
unavailable.
