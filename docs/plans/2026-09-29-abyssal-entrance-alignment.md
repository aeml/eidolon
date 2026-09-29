# Abyssal Well approach and carved threshold

Local candidate following a3e5017c. Not deployed or final art acceptance.

The Water entrance gains a constructed pointed arch, a forward portal at
root-relative (0,6.3,22.09), a lower visible silhouette and dark rather than
emissive well water. The gathering marker moves south-offset48 to32 and the
existing road extends16m. Legacy bounds, interaction radius23.448455929756165,
solids, bypass, dungeon admission and saved state remain unchanged.

A reused beveled foundation initially put stone and water at the same height.
High/Low cutaway checks caught80 changed pixels outside the reveal. Lowering
the stone top from3.1 to3.0 resolves this coplanarity; a geometry regression
requires separation. The old hero fixture was inside the blocked radius;
it now uses reachable(-35,-15), explicitly checked outside radius+1.25.
No reveal shader or pixel acceptance threshold was weakened.

Verification:
- Initial37 entrance/population/atlas checks passed17.981s.
- Final23 entrance checks passed1.219s, including raw/batched portal access,
  unchanged bounds and water/stone clearance. An invocation without the ESM
  runtime flag failed before tests; corrected invocation passed.
- High/phone-sized Low approach checks passed in the initial46.8s four-case
  batch; screenshots inspected. Both initial cutaway cases failed as above.
- Final High/Low cutaway2 passed14.6s: hero55/55 and46/46 reference pixels,
  unchanged outside the reveal. No broad performance or connected-play claim.
- Generator verifies456 exclusions/eight readings; scoped lint/diff pass.
- Approach artifacts: /tmp/eidolon-abyssal-approach-0929.
  Final cutaway artifacts: /tmp/eidolon-abyssal-cutaway-clearance-0929.

The portal is clearer at normal zoom, but broad flat platform/terrain,
sparse forecourt composition and procedural actors remain visibly unfinished.
This is an entrance improvement, not Diablo/PoE-level acceptance.
The full ordered roadmap and pending release gates remain open.
