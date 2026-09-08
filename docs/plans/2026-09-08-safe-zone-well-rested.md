# Safe-zone recovery and Well Rested

Requested September 8, 2026. Status: implementation in progress, NOT live.
Part of the active full-roadmap goal: implement as a coordinated 1.0.x feature
after urgent blockers, and include it in 1.1 recovery and progression acceptance.

Development branch `work/well-rested-20260908` in
`/tmp/eidolon-well-rested-ZL0PZY` now implements the server registry, recovery,
persisted fractional bank, final stat modifier, enemy-kill-only XP multiplier,
protobuf replication, desktop/phone timer and High/Low golden-elemental aura.
Initial foundation af7ed63 passed full Go race/Jest, but its first real-process
test found fixed simulation ticks slowed recovery under load. Corrected d650c72
uses per-player elapsed monotonic server time, retaining fixed combat/movement
steps and resetting the clock on disconnect/resume. The corrected actual
four-class recovery/cap/death/expiry/restart test passed31.984s on owned local
Mongo; no production data was involved. Hardware Chrome gallery and phone
rendered checks pass; screenshot inspection also corrected timer label wrapping.
Detailed contract/evidence live in that branch's
`docs/plans/2026-09-08-well-rested-implementation.md`.

Additional23:52 checkpoint, development commit97977a9: the existing144-session
matrix passes with exact requested town recovery across three fresh processes;
new actual token-resume/live-handoff and north-gate movement/expiry/return tests
pass. No disabled town healing or fake movement/warp commands. All tests used
owned loopback Mongo and the exact d650c72 race binary; projects removed after
clean normal drains. Other older resource workflow assumptions and integrated
browser/earned-play gates are still open.

This is not a versioned/staged release. It follows staged57, requires schema9,
and must not publish inherited57 metadata. Existing town-based resource tests,
normal boundary travel, reconnect variations, offline parity decision and
rested/unrested earned gameplay/balance remain open before its release gate.

## Requested behavior

- Town, and every future designated safe zone, restores **10% of maximum health
  and 10% of maximum mana per second** to living characters, capped at maximum.
- Each second spent in a safe zone earns **one second of Well Rested duration**.
  Presence is sufficient: no sitting emote or separate rest action is required.
- Stored duration caps at **7,200 seconds (two hours)**. It does not count down
  inside a safe zone; it counts down only while outside one.
- While active, Well Rested increases **all stats by 10%** and **XP from enemy
  kills by 25%**. Quest turn-ins and unrelated XP sources do not receive the kill
  bonus. Max-level XP conversion must retain the established cap rules.
- Active characters have an attractive surrounding particle aura, inspired by
  the player's Conquer Online Lucky Time reference. Create Eidolon's own effect:
  subtle orbiting gold/elemental motes and a soft halo, not a solid box or a large
  opaque effect. Keep enemies, telegraphs, equipment and the hero readable.
- Outside safe zones, the requested **.01 per-stat passive regeneration remains
  unchanged**. Safe-zone healing is a distinct rule, not a global regen increase.

## Implementation requirements

- Use one authoritative safe-zone definition for protection, rest accumulation,
  recovery and replicated UI state. Avoid a town-only coordinate check duplicated
  across systems; future safe zones must opt into the same contract.
- Recovery requires a living character; it never revives a corpse or bypasses
  explicit Respawn. Define safe-zone recovery as the total 10%-per-second passive
  recovery there, rather than accidentally stacking another percentage refill.
- Use elapsed simulation time with retained fractions, not rounded frame counts;
  server authority prevents client clocks, reloads or repeated boundary crossings
  from granting duplicate duration/healing. Partial seconds and the cap are stable.
- Persist remaining duration with the character's full save/recovery contract.
  Proposed baseline: offline characters neither earn nor spend rest time. Make
  this explicit in patch notes; confirm any different offline policy before build.
- Define an explicit stat map before implementation. Preserve the user's “all
  stats” request: do not silently implement only one attribute or just damage.
  Cover primary attributes, derived combat/resource stats and bounded percentage
  stats without applying the same 10% twice through both base and derived paths.
  Document rounding, caps, movement/cooldown interpretation and maximum-resource
  changes on expiry. Never refill current HP/MP merely by toggling the buff.
- Apply kill XP once in the common authoritative enemy-reward path, including
  ordinary/elite/boss and eligible shared-party kill rewards. Define ordering with
  other multipliers; do not multiply quest, exploration or room-clear payouts.
- Replicate active status and remaining duration to local/remote players. Show a
  readable buff icon, percentage description, countdown and safe-zone paused/
  accumulating state on desktop and phone. The aura follows the correct actor,
  appears after reconnect, and cleans up on expiry, removal and scene changes.
- Honor reduced effects and graphics settings; avoid one light per particle,
  shared-material recoloring, particle leaks and party-sized visual clutter.

## Required acceptance

- [ ] Safe-zone registry, boundaries, living-only healing, fractional ticks, caps,
  full resources and future non-town zone tests.
- [ ] Accumulate inside, pause consumption inside, consume outside, cap at7200,
  expiry, rapid crossing and reconnect/crash-save tests with exact duration.
- [ ] Stat-map tests across all classes, equipment, percentages and expiry; no
  double multiplication, compounding recalculation or HP/MP refill exploit.
- [ ] Exactly25% eligible kill-XP bonus; party/boss, existing multipliers and
  max-level coverage; quest and other unrelated XP demonstrably unchanged.
- [ ] Real-input town→combat→town and reconnect verification, not only prepared
  component scenes. Recheck first-hour/campaign pacing rested and unrested.
- [ ] Inspect aura and duration UI on desktop, portrait/landscape phone, both
  graphics qualities and reduced-effects settings, including groups and expiry.
- [ ] Publish versioned notes/login metadata and pass the ordered CI/live gate.

Do not claim that this feature is delivered because it has been added to the
roadmap. Current no-rest balance results are not final evidence for rested play.
