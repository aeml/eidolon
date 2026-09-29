# Bastion and contact reference integration — September 29

Local combined reference candidate, based on contact commit `14370800`.
Not deployed; runtime identity remains 1.38.0. This is not the final ordered
1.42 release package: its populated-world review also exercises the 1.43
contact presentation.

## Changes assembled

Ruined Bastion silhouette, carved reachable gate, animated opaque portal,
world-scaled stone and bark, cutaway shader preservation, south-facing grave
road/atlas arrival, chipped paving, planted edges and improved grove masonry.
Ground cover is nonblocking. Existing entrance gameplay bounds remain intact.
Client footprints, server spawn exclusions and admin-landing geometry now
agree on the six relocated grave markers; no other generated solids changed.

The clean candidate deliberately retains the existing forest distribution.
Its generated spawn file has 126 solids/eight readings, not the root's 456:
the extra 330 tree exclusions belong with the later woodland/recovery transfer.
Do not replace these manifests with root files before integrating that dependency.

## Evidence

- 63 geometry/material/placement/cutaway unit tests passed in 3.256s.
- Server WorldPopulation and AdminTeleportCanonicalObstructions selection
  passed in .203s. The old impossible-spawn fixture used the marker's previous
  coordinates; it now looks up the actual generated Bastion marker, retaining
  the blocked-sector assertion.
- Entrance gallery and phone Low populated scene passed in the initial
  19.5s run. Desktop failed before render: trace confirms Chrome
  net::ERR_NETWORK_CHANGED on local module requests, not missing source.
- Desktop recheck and all ten entrance cutaway cases passed in 56.4s.
  Strict outside-cutaway pixel invariance remains unchanged.
- Sampled 1,534 points at <=.5m spacing along the complete Bastion road with
  radius1.25 against the actual candidate collision builders: zero blocked.
  The ad-hoc headless check needed the generator's canvas stub and the
  CollisionManager null-means-clear contract; neither required game changes.
- Both manifest generation checks, scoped ESLint and whitespace pass.
- Artifacts: /tmp/eidolon-bastion-integrated-0929 and
  /tmp/eidolon-bastion-integration-recheck-0929.
- Inspected desktop and phone gate approach plus desktop body-impact capture.
  The production-renderer scene now includes the contact/recoil timeline.
  These prepared hits do not constitute a newly authenticated fight.

## Remaining quality and integration work

The assembled scene is still too plain: muddy low-detail ground, sparse
composition and fallback actor anatomy. Do not interpret checks as visual,
performance or enjoyment approval. Next integrate ground composition, lighting
and woodland with its placement/recovery dependencies, plus remaining town and
effect-hierarchy changes. Elevation/rock activation and audio are separate
unfinished integration work. No extra entrance-only micro-polish or campaign soak.

The 1.39/1.40 owner release decision remains unassumed. Preserve all shipped
fixes, schema15 safeguards, account data and release history. No production
state, access policy or version changed in this integration.
