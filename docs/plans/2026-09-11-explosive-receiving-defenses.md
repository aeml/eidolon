# Explosive shields — receiving defenses and dungeon geometry

> Historical development evidence, imported with the receiving-defense changes.
> This document's source hashes and phase-cap results describe that development
> branch, not the narrower release64 build. See
> [release64 scope and gates](2026-09-12-release64-receiving-defenses.md) for the
> current candidate: existing release63 campaign/economy and Dark King behavior
> are retained; the separate phase-cap change remains pending.
Unreleased follow-up to basic impact ordering on695578b0. Part of the open1.1
combat/dungeon gate; this does not complete the full1.1–1.10 roadmap.

## Reproduced failure

The initial race run failed in0.282s. A real paid explosive shield broken by a
paid Flame Whip in an accepted duel never damaged the hostile player, never
consumed that player's shield and never triggered its explosive rune. A real
enemy basic attack also detonated the shield through a closed dungeon wall;
the doorway-positive control retained damage. Log
`/tmp/eidolon-explosive-defense-red.log`.

## Implementation

- Explosion receipts retain depletion-time location, instance, owner and party.
  A movement or recast cannot rewrite the old blast or consume the new shield.
- Blasts check ordinary hostility, including party protection, PvP consent and
  safe zones; dead, disconnected and other-instance targets are excluded.
- Canonical dungeon walk geometry blocks blasts through solid walls. The radius
  includes visible actor bodies instead of requiring their center inside it.
- Stored absorption is the blast budget, without a new critical roll or outgoing
  owner bonuses. PvP scaling/capping happens once, followed by current receiving
  reductions, invulnerability, shielding, reflection and Dark King phase limits.
- Basic attacks and delayed boss slams now queue reactions after HP/death
  bookkeeping and release actor locks before flushing. The legacy temporary
  unlock adapter is removed. A second shield can detonate once on depletion
  without the original hit subsequently overwriting a chained death.
- Normal damage events, enemy threat and ordinary death/party-credit handling
  remain in use. No PvP damage is admitted after the match stops permitting it.

## Verification

-2717 focused race PASS1.471s after implementation.
-17149 broader shield/reflection/slam/Dark King/impact/near-death race PASS34.456s.
-17778 three-repeat run failed7.352s because the new lethal-duel test waited
  through ordinary scheduled match restoration and inspected full HP afterward.
  It now waits for the actual elimination callback, drains the attack and stops
  only its disposable world's later restoration before checking the corpse.
  This changes test observation, not production death or duel behavior.
-5172 corrected three-repeat race PASS2.307s: real basic lethal chain, PvP burst
  cap, stacked receiving reductions, shields, immutable queued origin/recast,
  joined-party protection, ended-round and disconnected exclusions.
-93891 expanded three-repeat race PASS2.321s adds two real paid Fireballs in
  parallel World.Update: each explosive shield detonates once and each player
  receives the exact71 HP loss. Body-at-radius-edge and outside-body controls
  use a real paid shield and scheduled enemy attack.

Logs `/tmp/eidolon-explosive-defense-{green,broad,repeated,repeated-final,concurrent}.log`.
Full current-source Go regression remains required, followed by merged native
combat/party/character/save acceptance. Prepared capacities/stats test impact
mechanics; they are not earned-gear or four-player dungeon-clear evidence.
Raw/inherited wound outgoing budgets, all-class talent/save/native feedback,
campaign, economy, phone and remaining version gates are still open.

## Unreleased patch-note draft

Explosive Arcane Shields now respect dungeon walls and can damage valid PvP
opponents. Their blasts respect defensive effects and PvP damage limits, leave
party members and neutral players unharmed, and correctly chain with other
explosive shields without applying a shield's explosion twice.

## Full server acceptance on9446887c

93579 completed with exit0 on unchanged9446887cf4e8e57744a9123f218b9720e4fd24fb.
Full Go race passed all packages: root19.196s, game330.065s, loadtest1.020s,
database1.111s and lifecycle1.023s; remaining packages have no tests. Log
`/tmp/eidolon-explosive-defense-full-server.log`. This closes this source's full
server regression gate. Merged/native/four-role/save acceptance remains open;
the patch is still unpublished and has not been assigned a release version.
