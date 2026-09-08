# Coordinated progression — experimental core implementation

**Isolated candidate only. Do not merge, package or deploy this intermediate
curve/combat change. Quest/room/weekly/Vigil budgets, promised reward migration,
authored preparation and earned campaign verification remain incomplete.**
The active root/release branches still use the old curve.

## Implemented together in this candidate

- Integer bounded thresholds `100 + 25 × (level − 1)²`, cap 100, 7,973,625 XP
  to reach cap. Client/server check all 100 thresholds against one shared fixture.
- Ordinary/elite combat budgets are 10%/20% of the enemy-level threshold; bosses
  use 35% of selected run level (enemy level if no run). Old realm multipliers
  and the flat two-million boss addition are removed. Boss XP remains personal
  for each eligible recipient, not divided among party members. Ordinary/elite
  party XP uses the existing 10%-per-member bonus and sharing for two or more
  eligible members; a one-member party does not gain an XP bonus. Difficulty and
  Fortune apply once through the existing pipeline. Gold/drop policies unchanged.
- Snapshot, new-character and QA-level save paths persist `progression_version`.
  Login validates/migrates before publishing an entity. Legacy unprocessed room
  XP earns its pending levels on the stored curve before converting the remainder.
  Base-stat growth adds only that delta; earned levels/allocations/gold/spending
  survive. Current-version reloads are identity. Capped bar sentinels are never
  additional Resonance. Genuine pending cap overflow remains an award.
  Login also retains nonnegative saved unspent skill points instead of resetting
  them to zero, and heals a previously pending level-up after gear/stat loading.
  Actual session/reconnect verification remains a separate gate.
- Both curve formats are understood for forward migration and rollback. A bridge
  release retaining curve 1 **must ship before curve 2 activates**; deploying this
  candidate directly would leave the older server unable to read curve-2 saves
  safely during rollback. The bridge release is not implemented/verified yet.
- Offline XP now applies every earned level in an award, stops at 100, and sends
  only overflow/new capped awards into Resonance. Authoritative/remote actors
  reject local XP and level-up calls. Invalid/fractional/unsafe numeric awards
  cannot mutate state. This is component progression, not an offline game mode
  or proof that offline stats, reward sources and UI fully match multiplayer.

## Evidence and discovered failures

Initial Go migration/snapshot checks **76539 PASS / root 1.066s / game 1.073s**.
First BSON progression/state round-trip **62636 FAIL / root 0.059s** because the
fixture expected a sparse Resonance-rank map after production normalization.
The exact expected map now includes the normal zero-valued power/fortune ranks;
three repeated save/migration passes **33905 / root 1.080s / game 1.083s**.
Client threshold/all-four-class progression/authority/invalid-input checks
**39862 PASS / 13 tests / 2.598s**.

Three race repeats of migration, snapshot, candidate budgets, class-to-cap,
Resonance and production boss recipients **5330 PASS / root 1.070s / game
14.117s**. Actual Normal level-30 boss gives **7,393 XP** to each eligible solo,
two-player or five-player recipient and leaves a zero-XP level-30 character at
30, not 46. Explicit production-budget assertions then pass three repetitions
**29580 / 8.589s**. These prepared deaths are not earned boss playthroughs.

Rollback/idempotence checks **81120 FAIL / game 12.307s** catch real int64
overflow when multiplying two large legacy values during same-version reload.
Same-version remainder now bypasses multiplication; cross-version products
always include one bounded factor. Unsupported versions, levels, negative XP
and values beyond exact JS integer representation reject before state mutation.
The corrected suite includes room-level transitions and repeated rollback.
Corrected three-repeat suite **42999 PASS / root 1.090s / game 25.912s**,
log `/tmp/eidolon-coordinated-xp-compat-final.log`. Full lint **98373 PASS** and
diff check pass. All those handles are closed. Full client/server and real login/earned
campaign checks are still required; targeted passes do not approve activation.

Full client **90196 PASS / 221 suites / 3,318 tests / 142.350s** on clean
**3de3ea4** (runtime **7dc401c**), log
`/tmp/eidolon-coordinated-xp-full-client.log`. No browser/earned progression is
claimed. Subsequent login point/healing changes are server-only; three compile/
migration/progression race repetitions **24607 PASS / root 1.091s / game
13.567s**, log `/tmp/eidolon-coordinated-xp-login-followup.log`. Actual reconnect
validation remains open. All owned handles are terminal.

Accepted reward/kill requirement protection is now implemented and passes
targeted production/BSON checks; see [the quote record](2026-09-08-accepted-quest-quotes.md).
Actual database sessions and full regression remain separate gates.

Full corrected server race **78923 PASS** on6076da6 (root15.726s,
game334.140s) after the failures/corrections recorded in the quote report.
Actual database sessions/bridge and earned gameplay remain open. All core
validation handles are now terminal; subsequent reward tuning has its own
isolated worktree and evidence.

Next: tune overlapping quest/source budgets and add
authored realm preparation. Do not use today's million-XP quest catalog with the
new curve as a playable balance result. Validate the compatibility bridge before
any release that can write curve-2 saves.
