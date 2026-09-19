# Crowded casino rendering and balcony patron cutaway

The bounded controlled render uses the actual server catalog (16 tables/machines,
56 chairs), current two-floor interior and CasinoController, and40 fully equipped
procedural heroes across all four classes. It is not a connected40-player test,
performance measurement, device test or proof of earned currency. Existing
connected public/VIP gameplay and persistence evidence remains accepted.

## Finding and correction

The initial visual fixture manually isolated actors by floor. Source review
found this hid a real integration gap: the game cuts away the upstairs balcony
and furniture near the outer downstairs lanes but left upstairs actors visible.
A regression using the actual controller failed with a visible upstairs patron
while the balcony was hidden. The fixture now uses the actual cutaway/controller,
not manual per-floor actor visibility.

The controller now hides upper-floor patrons with the balcony and restores them
when it returns, while leaving lower-floor patrons visible from upstairs.
Already-hidden actors remain hidden; retired/dead actors are not revealed by
cleanup. Hidden upstairs actors are also excluded from pointer picking. Existing
nameplate presentation already excludes invisible actor meshes. No change to
seat ownership, wagers, Gold/EP rules, membership or networking.

## Evidence

- The recorded visibility regression fails before the fix.
-36 focused controller/nameplate/witness/VIP UI checks pass (81027,2.158s),
  including repeat snapshots, floor changes, scene exit, cleanup and picking.
- One native Chrome check passes in5.5seconds (81797;7.5s including launch),
  zero retries. Four High/Low public/VIP screenshots were inspected: occupied
  tables remain distinguishable, lower-floor circulation stays clear, upper
  patrons no longer float over the lower floor, and both floors remain populated
  when viewed from upstairs. These are controlled overview cameras, not actual
  phone/session-camera or table-hand interaction acceptance.
- Changed-source lint and diff checks pass.
-11 existing raycast-priority checks also pass (91779,0.984s); no targeting
  priority or combat-hitbox change outside the casino cutaway.

Artifacts: `/tmp/eidolon-casino-crowd-20260919-GCETAo/cutaway-results/` and
`cutaway-report/`. Initial manual-floor screenshots are kept separately as
`initial-isolated-floor-results/`; they are not cutaway acceptance.

## Delivery

This fix is local, not part of the already-pushed1.9.18 candidate. Batch it into
the next appropriate release with synchronized versions and cumulative notes;
do not interrupt the current deployment for it.

Draft player-facing patch note: “Casino upstairs patrons now follow the balcony
cutaway, so they no longer float over downstairs tables or intercept clicks
while their floor is hidden. Returning upstairs restores the full crowd.”
