# Shared casino zone — implementation handoff

Release status: shipped in **Alpha1.9.1 c8741288**, exactCI34771598671 all ten jobs
SUCCESS; public client/backend identities and database readiness independently
verified September13. Local-only descriptions below preserve implementation
history, not current deployment status. Full1.10 acceptance remains separate.

User revision: **EP means Eidolon Points**. Planned sources are a monthly VIP
allowance of **100 EP monthly** and **1,000,000 Gold → 1 EP** exchange. Latest
spending rule is **cosmetics only**, superseding earlier EP wagering plans.
No reverse exchange, indirect Gold payouts or gameplay power; payment integration
is excluded. See [approved EP policy](2026-09-09-town-casino-roadmap.md#ep-economy--approved-direction-not-implemented).
This is roadmap policy, not delivered wallet/exchange/cosmetic functionality.
Current upstairs gate is explicitly **You must be a VIP to enter**.

## Delivered code (not yet deployed)

Follow-on [quick-play changes](2026-09-13-casino-quick-play.md) remove redundant
wager confirmations and add animated reels and bounded auto-spin queues. These
also remain local, along with the shared-door/zone delivery below.

- Town door opens a native, keyboard/touch accessible dialogue with **Enter
  Casino**. A nearby entrance button provides a touch-friendly alternative.
  The old town shell is a closed facade; the stash/Trading House remain outside.
- `lanternhold-casino` is a single permanent shared instance, type `casino`.
  Server entry checks door proximity, living state, trade/action restrictions.
  Existing instance delivery/reconnect transport is reused, without dungeon
  party ownership, difficulty, boss spawns or private copies.
- 68×76-unit hall with broad central circulation, marble/obsidian inlays,
  Fourfold medallions, velvet runners, amber colonnade, lounges and a second-storey
  balcony/upper gallery. Balcony cutaway reveals ground machines when nearby.
- Five independent Gold blackjack tables, one real-player Hold'em table and four
  existing elemental machines: 36 table seats plus four machine seats. Other
  visitors can circulate in the same room. This is finite seating, not a claim
  of unlimited server or table capacity.
- Blackjack records/caches/ticks are table-specific; old primary table ID and
  existing receipts are preserved. Pending account fences survive failed reads.
  Existing poker/slot ownership, private cards, games and payouts are retained.
- Seated authority moves from overworld to the casino instance. Saved seated
  characters project to a walkable casino exit position, not a chair; reconnect
  receives the shared scene and saved position. Casino is a registered safe zone.
- Guard uses an established procedural humanoid and the requested dialogue.
  Server-authoritative ground bounds/height reject stair or jump bypasses.
  No EP wallet, conversion, grants, VIP purchase or playable upstairs game is
  implied. Existing Recall and the interior exit dialogue return to Lanternhold.

## Focused evidence

- Casino world/seat/gate tests PASS; pending-owner, save projection and separate
  blackjack cache tests PASS. Changed client lint and four CasinoController
  tests PASS. Existing fixtures now explicitly use the shared scene.
- Actual disposable Mongo two-table test PASS0.219s: two distinct rounds,20/40
  Gold debits, duplicate commands do not double-debit (300→240), one table can
  advance without advancing the other, seated view selects the correct record.
  Owned Mongo stopped afterward; exact created test records cleaned up.
- Three focused browser fixtures PASS19.9s: seated equipment/camera/phone
  controls, native VIP guard dialogue/blocked stair walking, and309 actual town/
  public-event approach samples against537 scenery colliders with0blocked.
  Phone guard screenshot inspected at
  `/tmp/eidolon-casino-vip-guard-phone-20260913.png`.
- Connected two-player door/shared-zone/guard/return route PASS44.9s, including
  the guest's real QA-triggered reconnect and restoration of outdoor terrain on
  exit. Both participants shared the same scene; the first could leave without
  moving the second. No Gold was spent merely entering/talking. Final screenshot
  `/tmp/eidolon-casino-interior-20260913.png` inspected: dedicated floor and indoor
  map markers replace the previously overlapping town paving/service markers.
  This is functional/visual evidence, not a populated-floor performance benchmark.
- Early fixture failures were corrected: missing baseURL, camera-clipped movement
  distance, and the second QA account missing the disconnect-command allowlist.
  One earlier connected pass (46.5s) exposed the town-floor overlay visually;
  fixed the shared scene's terrain visibility and verified both entry/exit states.
  No gameplay assertions were weakened. Server legacy-position recovery tests
  also pass: old facade guests relocate outside; saved upstairs heights cannot
  grant VIP. The permanent casino no longer uses the 15-minute dungeon timeout.
- All owned casinozone0913 temporary containers/data/images were cleaned up;
  no live accounts were used. New code remains local until the milestone release.

No full campaign, class matrix, load trial or soak started for this change.
Complete1.10 acceptance/release remains separate; current public release is1.9.
