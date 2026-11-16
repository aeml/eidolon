# Alpha 1.38 — party progression fairness

Isolated 1.38.0 candidate prepared; not a deployed or accepted milestone.

## Retained kill-credit contract

`party_kill_credit.go` gives connected party members throughout an actual
dungeon/raid kill credit without a damage-contribution requirement. Downed
members count. Overworld and the shared Dark Realm use a server-owned 110-unit
radius (roughly two normal desktop screens), independent of client zoom.
Different instances, absent members and disconnected actors are excluded.
The eligibility snapshot is taken before asynchronous rewards so arriving
after a kill does not earn it and leaving afterward does not revoke it.

Existing real death/ability-path tests cover tank/healer/DPS recipients,
downed allies, distance boundaries, remote dungeon members, cross-instance
exclusion, delayed delivery and individual manual story turn-ins. These are
prepared reward-path checks, not another earned dungeon clear or human party
playtest. Existing UI guidance already states the sharing rules.

## Disconnected room-reward leak

Room-clear rewards have a separate recipient loop. It checked instance and
death state but not disconnection. Entities retained for the reconnect window
therefore earned room XP/Gold and shrine healing/Sanctuary while offline.
The new regression reproduces this via `SetEntityDisconnected`, not by removing
the actor. Adding the missing disconnect guard rejects these rewards without
changing the resume window or party membership.

The test retains an active recipient, excludes another instance, and checks
that reconnecting cannot replay an already-cleared room. It failed before the
fix and passes after it. Scoped room, party kill/ability/snapshot, manual
turn-in and resume-membership checks passed with race detection in 4.624s.
No production accounts or long campaign/raid runs were used.

This fix preserves existing room-reward rules: room bonuses still require
living presence, unlike kill credit which includes downed members. It does
not turn shrine restoration into resurrection. No XP split, Gold rate, party
size, quest acceptance, or 15-minute dungeon-resume policy changed.

## Remaining before closing

- Publish after 1.35–1.37 with CI and independent live checks.
  Owner party pacing/feel feedback remains a playtest input.

## Attribution and reconnect review

Seraph impacts pass the owner to the normal death pipeline; bleed and poison
resolve their stored owner ID before the same call. Three prepared lethal-path
checks now exercise these consumers with a remote downed party member, a
disconnected member and a different-instance member. Eligible players receive
one kill objective and rewards, absent players receive none, and subsequent
status ticks cannot pay twice. The focused race run passed in 1.533s. These
are attribution checks, not proof of learned status skills or an earned clear.

Reviewed normal disconnect handling: it marks the entity disconnected before
snapshotting, retains it for resume and saves while holding character ownership.
Resume clears disconnection on the same retained entity, so kill-time credit
is not recomputed or replayed by joining again. Existing session/persistence
and kill-snapshot coverage is retained; this review did not run another live
login test or claim crash durability before asynchronous awards reach a save.

Shared desktop/phone party guidance now distinguishes living-only room bonuses
and shrines from downed-eligible kill credit. Fifty social/phone checks passed
in 1.221s. No new dialogs, reward rates or party admission gates were added.

## Downed level-up health

Exact-package follow-up also added a zero-health/non-DEAD room recipient. It
reproduced shrine restoration before the normal death-state transition. The
room loop now requires positive health as well as connection and non-DEAD state.
The regression retains a living recipient, ordinary dead player, disconnected
resume entity and other-instance player, and still rejects replay on reconnect.
Two older positive reward fixtures omitted health entirely; they now explicitly
represent living players. Their reward amounts and assertions are unchanged.

The full scoped exact-package selection passed with race detection in16.260s:
room rewards/hooks/concurrent settlement, party membership/kill-time boundaries,
normal ability and periodic/summon attribution, individual story turn-ins,
downed level-up behavior and inherited capped reward receipts. The initial run
failed only those two zero-default-health positive fixtures; it was not accepted
as green.358 client/guidance/version/history checks passed in5.160s, plus scoped
lint and whitespace. No long encounter replay, production account or new
database migration was required.

Extending all three periodic/summon cases to cross a level boundary reproduced
another defect: the common XP grant filled a downed ally's health bar while
retaining its DEAD state. Level-up healing now requires positive health and a
non-DEAD state; XP, stat growth and skill progression still apply normally.
Living characters retain their existing level-up heal. A focused four-state
check covers living, dead, zero-health-before-death-processing and inconsistent
positive-health/dead inputs. These checks plus the extended real kill paths,
normal cap progression, quest rewards and delayed recipient snapshots passed
with race detection in 3.957s. No resurrection mechanic or reward-rate change.

Packaging: the new disconnected/zero-health conditions in
`dungeon_runtime.go` and `party_room_presence_test.go` belong to 1.38. The
adjacent capped reward receipt changes belong to 1.37; do not mix milestones.
The periodic attribution test and shared party-guidance change also belong
to 1.38, not the prepared 1.35 package.
The living-only level-up heal and `party_levelup_test.go` belong to 1.38 too.
`progression.go` also contains 1.37 receipt/weekly work: exclude this new heal
guard when packaging 1.37, and include it with the 1.38 party fix and tests.
