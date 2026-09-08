# Resource reconnect defect — required before 1.1 acceptance

Status: confirmed defect with an unreleased implementation candidate, not yet
release-ready or assigned a published patch. Preserve .01 passive regen.

Candidate `work/resource-persistence-20260908` at3a7d756 (tested runtime5cf6acb,
browser-tested28ebabc,
token-tested ea5d539, runtimea9f5960) implements versioned resource restoration and per-account
session/save ordering. Broader live tests found and fixed close/send and character
ID publication races that a green unit suite missed. The corrected race-built
server passes144 saved sessions and five consecutive ordinary Fireball/two
repeated Joins/overlapping login/old cleanup/new-owner command/final-save runs.
The harness now fails on abnormal child exit or race/panic log markers and checks
fresh saves at BSON timestamp precision against a pre-close baseline. All eight
four-class alive/dead token-resume and ordinary recovery cases pass. Actual
desktop Wizard browser casts, ordinary password logins, hostile death/death-screen
login, Respawn button and living Recall also pass with depleted/dead bars retained.
The candidate now journals complete pending saves before Mongo writes, retries
before stale hydration and pins the live copy if local journaling fails. Actual
race-built Mongo rejection/restart recovery and already-committed receipt replay
with a later gold credit pass, as do the repeated handoff/token cases. This is
not arbitrary crash/network-outage or concurrent offline-credit proof. Full Go
race75477 passed (game342.717s) and144-session matrix30872 passed210.581s on5cf6acb,
both normal0 with actual child exit/log checks enforced. No owned local test
handles remain active at16:13 UTC.
Shutdown admission/drain, delayed network/storage failures, pending-save versus
offline-credit ordering, PvP/instance recovery, broader device/class play and
rollback still remain open; the whole acceptance list is not closed.
Execution details and exact handles are in the roadmap execution ledger and
the candidate's `2026-09-08-resource-persistence-implementation.md`.

On release46/45df969, actual fixture reuse had2575HP/1685mana before disconnect.
The next normal login returned2080HP/1190mana with the SAME2575/1685maxima.
Both deficits equal495, exactly the level100 flat resource bonus `(100-1)*5`.
The QA fixture log is `/tmp/eidolon-release46-prepared-fixture-gameplay.log`.
The first prepared-fixture browser test passed29.2s; its following Verdant route
was still active when this defect was recorded. No whole-route pass implied.

`server/client_dispatch.go` initializes current HP/mana as saved Vitality or
Intelligence multiplied by10. Recalculation then includes the flat level bonus,
gear and other modifiers in maxima. `database.Character` has no current HP/mana
or alive/dead resource snapshot; `characterSnapshot` therefore cannot preserve
them. Reconnect may remove resources from a full character or replenish a
depleted one. The earlier explanation that release46's starting deficit came
only from preceding casts was incomplete: login reconstruction itself supplies
1190mana. The initial predeploy1216mana sample follows normal regeneration.

## Implementation and acceptance

- Persist a versioned, optional authoritative resource snapshot, distinguishing
  missing legacy data from valid zero mana/zero health. Take it under the same
  lock/snapshot as the rest of character persistence; cover autosave, disconnect,
  duplicate-session replacement and explicit save paths.
- Restore after canonical level/equipment/talent stats are loaded. Clamp only
  when the resulting maximum has genuinely changed; do not manufacture a full
  bar or a base-stat-derived value on each login. Preserve unrelated equipment,
  quests, XP/Resonance, points, gold and active dungeon progress.
- Define/test one-time legacy migration, ordinary death/reconnect/respawn,
  interrupted instance recovery, PvP entry/exit and max-stat changes. Zero HP
  must not produce an alive unplayable character or bypass normal death recovery.
- Keep fractional regeneration transient and .01 per stat. Do not introduce
  offline regeneration, reconnect healing, or a new gameplay recovery policy as
  an incidental effect. Audit rollback compatibility before publication.
- Verify actual Mongo/WebSocket save/load for all four classes, levels1/30/100,
  empty/partial/full resources, gear-modified maxima, zero mana and dead state;
  repeat login cycles must not accumulate resources. Use real browser casts,
  incoming damage, ordinary reconnect and death-screen recovery as well as unit
  and race checks. Record elapsed regeneration separately from saved values.

The explicit level100 prepared-QA initialization fixes a test precondition only.
It does not close this gameplay defect, fresh-campaign pacing, or 1.1 acceptance.
