# Range consumers — work after Alpha 1.0.35

Status: **partial category, now packaged in the unpublished
[1.0.36 candidate](2026-09-07-release36-combat.md)**. Earlier unversioned labels
below describe the individual implementation checkpoints. Base is the verified local
1.0.35 candidate `0088543`; the separate `release/35-with-forge` branch must keep
that tested source. This is not completion of the range/area or 160-talent gate.

The subsequent [Wizard ground-spell checkpoint](2026-09-07-ground-spell-talents.md)
records actual placement/area consumers, Meteor snapshot replication, offline
geometry repairs and final client/server/gameplay evidence. It remains unpublished.

The current overlay audit still reproduced both representative failures on that
base: five Aether Reach ranks reject a 17m Teleport, and five Battlefield Ministry
ranks leave the friendly actor at 10.2m uncleansed. Log
`/tmp/eidolon-talent-range-area-current.log`.

## First consumer: Teleport

A shared server range multiplier now applies existing additive talent bonuses
after the rune-adjusted base. Teleport consumes it after Blink's existing 15m →
22.5m base change. No new movement permission or changed wall policy is added.
The client uses the same range for targeting/intent and offline Teleport landing.
Wizard range metadata covers the existing server WIZ_29 (+3%), WIZ_35 (+4%) and
WIZ_38 (+2%) definitions. Aether Reach's old +3% copy is corrected to +4%.

The shared JSON contract covers untrained, one/five Aether ranks, Blink alone,
Blink plus Aether, stacked range talents with/without Blink, and the Technique
talent that must not extend range. Each server case actually casts just inside
and outside its boundary; rejection must not move, spend mana, start cooldown or
emit a movement effect. Success must pay and publish the exact destination.
Client cases check targeting and actual offline landing against the same numbers.

Before implementation, six of eight client cases and five server inside-boundary
cases failed. Retained logs: `/tmp/eidolon-teleport-range-before-{client,server}.log`.
The expanded client regression passes **31 tests**, with lint, in
`/tmp/eidolon-teleport-range-expanded-client.log` and
`/tmp/eidolon-teleport-range-lint.log`.

The first new ranked dungeon probe used a non-dungeon instance ID and therefore
did not invoke dungeon constraints. Its failure is retained in
`/tmp/eidolon-teleport-range-expanded-server.log`. The corrected fixture uses the
production `dungeon_` prefix and asserts that precondition. It checks a target
beyond the original 15m edge through both a solid wall and an open doorway at
world offset 60000, including the published visual destination. Run results are
recorded separately; do not mistake the malformed-fixture failure for a newly
introduced wall bypass.

The corrected server race checks **pass in 7.180 seconds**, including all shared
inside/outside cases, the new ranked wall/doorway cases and the existing dungeon
movement-ability suite. Log `/tmp/eidolon-teleport-range-expanded-server-corrected.log`.
The Teleport-only full client suite passed **184 suites / 2,572 tests in
112.702 seconds**, `/tmp/eidolon-talent-range-working-client.log`. No release is
marked ready.

## Second consumer: Scorch Beam

The server now scales the existing 18m beam before wall clipping, broad-phase
query and final body-padded hit checks. Local cast intent and predicted meshes
consume the same multiplier. Remote events already carry the final endpoint;
their presentation now preserves that endpoint instead of reconstructing an
untrained 18m beam from private/missing talent data. Tests deliberately omit
remote ranks and provide stale local ranks/layout to verify that distinction.

Offline Scorch Beam previously hit only 15m despite its 18m online/visual reach.
It now uses the shared 18m base plus talents, horizontal aim (including elevated
realms), canonical wall clipping and target-body padding. This is an intentional
offline parity repair, not an untrained online range change.

The seven-case shared JSON contract covers baseline, single/five Aether ranks,
Runic Precision, Mana Geometry, stacked bonuses and unrelated Technique ranks.
Before implementation **15 of 21 client checks failed**; server ranked endpoints
also failed. Logs `/tmp/eidolon-beam-range-before-{client,server}.log`.
After implementation **70 client checks pass**, including both quality levels,
actual predicted/remote meshes, offline cover and the existing Wizard/Teleport
regressions. Log `/tmp/eidolon-beam-range-after-client.log`.

Server boundary cases cast at world offset 60000 against ordinary and 4x-scale
targets just inside/outside body-padded reach. Separate cases retain cover,
doorways, side/behind misses, friendly-player protection and instance isolation.
The first extended-room fixture expected 21.6m in a room ending at 21.5m; the
server correctly clipped that last 0.1m. Preserve the failed run at
`/tmp/eidolon-beam-range-after-server.log`. The corrected fixture extends the
receiving room while retaining its original gap and doorway. The expanded
Teleport/beam/directional-wall **race suite passes in 22.505 seconds**, log
`/tmp/eidolon-beam-range-after-server-corrected.log`.

Preparing the real-server purchase route exposed another accessibility bug:
desktop specialization hid all 14 general talents, although the phone panel had
already been repaired in 1.0.32. All twelve desktop class/branch probes reproduced
the omission (`/tmp/eidolon-desktop-general-talents-before.log`). The desktop
filter now retains general talents alongside its ten relevant skill talents.
Its existing optimistic purchase interaction remains a separate UX concern;
the gameplay route must prove accepted geometry and saved ranks, not rely on
optimistic client rank values as proof of server acceptance.

Expanded full client checks pass **185 suites / 2,608 tests in 109.2 seconds**,
`/tmp/eidolon-beam-range-full-client.log`; lint passes in
`/tmp/eidolon-beam-range-expanded-lint.log`. The isolated `beam-walls` gameplay
route **passes in 53.1 seconds (51.1-second test body)**, log
`/tmp/eidolon-beam-range-gameplay.log`. The browser route uses normal menu training and hotbar casts at
zero/five Aether ranks, compares actual meshes with accepted server endpoints
at both qualities with/without cover, and checks the saved rank after login.
All eight rank/quality/cover combinations match the accepted endpoints; the
fresh login retains five ranks. Browser failures are empty, credential scanning
passes and the route exits successfully after disposable container/data cleanup.
It uses a prepared level-100 disposable character, not earned progression or
proof of remote multiplayer play. Runtime and selected browser source stayed
unchanged throughout that run. No range release is ready yet.

## Third/fourth consumers: Arcane Missiles and Weak Point Mark

Working after checkpoint `2fc71f3` (Teleport/beam), not a separately versioned
release. Arcane Missiles now uses the talent-adjusted 18m homing acquisition
range in both explicit-target validation and cursor fallback. A rejected target
still produces the normal three unguided missiles and an accepted paid cast;
the rejected ID must not survive in any projectile or ability event. This does
not yet change projectile travel/lifetime or speed.

Weak Point Mark now applies Rogue Quick Draw's existing global +3% range per
rank to both target paths (10m → 11.5m at five ranks). Invalid targets still reject
before mana/cooldown/event consumption. Quick Draw's old projectile-damage copy
is corrected to the actual range effect, with client range metadata and cast
intent updated for these two working consumers only. Other Rogue range consumers
must follow before a range release; metadata alone does not implement them.

Offline selection now separates caster reach from the cursor pick radius,
uses horizontal coordinates and canonical cover, and rejects friendly heroes,
dead actors and protected NPCs. Weak Point Mark preflights before the shared
cast spends resources or emits its visual. Unguided offline missiles now launch
toward the cursor with the server's ±0.2-radian spread instead of retaining the
old upward/outward homing-launch pattern without a homing target. Existing
targeted offline homing animation, projectile speed/lifetime and online
projectile simulation remain unchanged in this step.

The new shared eight-case contract covers both classes, baseline, one/five
relevant ranks, stacked Wizard ranks and unrelated Rogue Mastery. Server cases
test just inside/outside body-padded reach for normal/4x-scale targets, with
explicit/cursor selection and resource/event/projectile outcomes. Before fixes,
**17 of 24 client checks failed** and the ranked server target probes failed;
logs `/tmp/eidolon-target-range-before-{client,server}.log`.

The expanded targeted race suite passes **17.311 seconds**, including actual
projectile updates and impacts through a doorway beyond untrained homing range,
wall rejection, friendly protection, dead targets and other-instance targets.
Log `/tmp/eidolon-target-range-expanded-server.log`. The first focused race run
also passed in 13.770 seconds. Expanded client selection checks pass **30 tests**
in 1.017 seconds, `/tmp/eidolon-target-range-expanded-client.log`; the subsequent
full suite additionally covers the new unguided launch-direction assertions.

The full client suite passes **186 suites / 2,638 tests in 149.080 seconds**,
`/tmp/eidolon-target-range-full-client.log`; final lint passes in
`/tmp/eidolon-target-range-final-lint.log`. The full server race suite **passes**:
root package 14.467 seconds, game package 262.633 seconds, remaining packages
pass/cached or have no tests. Log `/tmp/eidolon-target-range-full-server.log`,
session `37764` exits zero, runtime checkpoint `9532f19`.
The isolated `direct-skills`
browser route passes for **Rogue in 32.7 seconds (30.3-second body)** and
**Cleric in 22.9 seconds (19.6-second body)**, log
`/tmp/eidolon-target-range-gameplay.log`. Credential scan and disposable cleanup
also pass; session `16329` exits zero. Runtime and selected browser sources stayed
unchanged during the route. The browser route retains the Cleric comparison and adds Rogue
normal-menu Quick Draw purchases with an independent authoritative-state rank
observer, ordinary enemy marking, fresh login and saved 11.5m cast intent. It
does **not** prove a boundary hit: its enemy is deliberately close enough for
the existing interaction flow. Exact boundary and missile-impact evidence comes
from the server tests above, not this browser smoke. Real multiplayer/phone and
the remaining range/area/talent gates are still open.

## Rogue melee and movement consumers

Working after `b6063c3` / targeted-range runtime `9532f19`, still unversioned.
Backstab, Shadow Lunge and the server's legacy Shadow Strike now apply Quick
Draw to their actual target checks. Shadow Lunge applies the multiplier after
Extended's 10m → 15m base. The client now advertises the real 2.5m Backstab and
10m Shadow Lunge bases (previously 3m and 12m), then applies ranks/runes. The
legacy Shadow Strike has a matching cast-intent range but is not added as a new
player skill or offline handler; it remains a server-supported legacy ability.

Offline Backstab and Shadow Lunge preflight target reach/cover before paying or
presenting a cast. Backstab uses the same nearest-body acquisition as the
server instead of an additional client-only facing cone; its facing damage
bonus remains. Shadowstep's offline landing is now implemented. Behind-target
landings preserve elevation and use canonical point recovery plus full-path
wall clipping, not just a walkable destination. This does not change ordinary
capsule collision or claim complete parity for every offline rune effect.

The twelve-case shared contract covers baseline/five ranks, a single rank,
Extended baseline/trained, Cripple/Shadow Clone, Shadowstep, and legacy Strike.
Server casts test both sides of the body-padded boundary with a 4x-scale target
and both explicit/cursor input. They assert paid successful casts, behind-target
landing and movement lock, retained damage/slow/bleed, and free rejection with
unchanged position/resources/effects. All **32 initial client checks failed**;
ranked server checks failed as well. Logs
`/tmp/eidolon-rogue-range-before-{client,server}.log`.

Expanded wall/doorway cases target enemies beyond the untrained body-padded
limit. Offline tests exercise actual Shadowstep casts and the point-constraint
helper's wall, doorway, outside-landing and start-recovery cases at world offsets.
Focused client checks pass **76 tests in 2.160 seconds**, and expanded geometry
checks pass **48 tests in 1.764 seconds**. Logs
`/tmp/eidolon-rogue-range-after-client.log` and
`/tmp/eidolon-rogue-range-expanded-client.log`.

The same path exposed a missing advertised effect: Shadow Lunge's skill-tree
description and offline implementation apply bleed, but the server did not.
The new baseline probe fails on both inside explicit/cursor casts before the
repair (`/tmp/eidolon-lunge-bleed-before-server.log`). The authoritative skill
now applies the existing Rogue movement-strike bleed model, 10 seconds at
10 + Dexterity/2 damage per tick with the caster as source, independently of its
rune. A paired actual-dispatch test proves that Death Spiral consumes it for
the existing Dexterity/2 finisher bonus. No bleed stacking or new finisher
balance model is introduced. Final focused server race checks pass in
**13.678 seconds**, `/tmp/eidolon-rogue-range-final-server.log`.

The full client suite passes **187 suites / 2,676 tests in 121.815 seconds**,
`/tmp/eidolon-rogue-range-full-client.log`, with final lint at
`/tmp/eidolon-rogue-range-final-lint.log`. The browser route adds an ordinary hotbar Shadow Lunge against the
existing real enemy after marking, checking server acceptance, player movement
and an attributed positive bleed tick. It retains rank purchases, login
persistence and the Cleric control. It is prepared functional gameplay, not an
earned run, exact range-boundary browser proof or physical-phone sign-off.

The first browser repeat **failed at the real bleed-tick assertion**, despite
accepted movement and the passing finisher test. Preserve
`/tmp/eidolon-rogue-range-gameplay.log`; its credential scan/cleanup passed.
Investigation found that `world_update_entity.go` processed bleed only inside the
player branch, never for enemies. An actual enemy-update regression reproduced
zero ticks and unchanged health (`/tmp/eidolon-enemy-bleed-before-server.log`).
The player tick logic is now shared with enemy/NPC updates, before enemy AI;
damage keeps its source/instance, adds enemy threat, respects one-second cadence
and expiry, and resolves lethal damage through the normal death/credit path.
This also activates existing enemy bleeds from other sources, not just Lunge.

The focused corrected movement/bleed race checks pass in **11.467 seconds**,
`/tmp/eidolon-rogue-range-bleed-fixed-server.log`. Additional shared actor-type
cadence/expiry and once-only owner kill-credit tests accompany the full race run.
Its first attempt hit a test-fixture compile error (`XP` instead of the actual
`Experience` field), retained at `/tmp/eidolon-rogue-range-full-server.log`.
The corrected full race run is separate, as is the unchanged browser assertion
repeat at `/tmp/eidolon-rogue-range-gameplay-bleed-fixed.log`. Neither repeat's
completion is inferred from the earlier focused tests.

The bleed-fixed browser repeat still failed its original-target assertion. An
additional observation-only run (`/tmp/eidolon-rogue-range-gameplay-diagnostic.log`)
showed an accepted Lunge and a **69-damage attributed bleed tick on another
enemy**, while the originally marked enemy remained unbled. The test moved the
cursor and immediately pressed the key without confirming which moving actor
was hovered. The repeat now uses the same ordinary projected-hover confirmation
as its original mark check before pressing Lunge. The positive tick assertion
is retained; no synthetic damage, server state mutation or direct cast API was
substituted. Both failed repeats and their successful credential scans/cleanup
are retained as evidence.

The first compiling full race run failed in **282.927 seconds** on the new
kill-credit test: it read `Experience` immediately without the owner lock while
the normal asynchronous death-reward goroutine was still running. The retained
log includes that fixture race, not a passing full suite. A focused reproduction
at `/tmp/eidolon-bleed-kill-diagnostic.log` confirmed it. The fixture now observes
the reward under the owner lock with a bounded wait and requires exactly 20 XP
after two tick attempts on the dead enemy. The corrected focused race checks
pass in **3.523 seconds**, `/tmp/eidolon-bleed-reward-corrected.log`.
The new full race run is `/tmp/eidolon-rogue-range-full-server-final.log` and the
reacquired browser run is `/tmp/eidolon-rogue-range-gameplay-reacquired.log`;
their results remain separate gates. The final browser repeat **passes**:
Rogue **27.8 seconds (25.8-second body)** includes trained movement, an attributed
positive bleed tick, saved Quick Draw ranks and cast intent; Cleric **17.1 seconds
(15.2-second body)** retains empty rejection and ordinary marking. Credential
scan and disposable cleanup pass, session `88952` exits zero. Runtime and selected
browser source were unchanged throughout that repeat. Final lint passes at
`/tmp/eidolon-rogue-range-handoff-lint.log`. The final full server race suite
**passes**, including game in **230.350 seconds**, at
`/tmp/eidolon-rogue-range-full-server-final.log` for runtime `18f1636`.
Its earlier failed fixture runs remain retained and do not count as passes.

Follow-up from this trace: poison ticking is also still located in the player
branch. Investigate actual enemy poison outcomes with paired casts/ticks before
claiming that every Rogue damage-over-time consumer is working. No poison fix
or whole bleed/rune/area audit completion is claimed in this step.

## Enemy poison follow-up — server verified, not published

Actual Poison Coating → Piercing Throw and poisoned Fan of Knives casts applied
the status but never damaged enemies on their world updates. A separate spread
probe reached an enemy across a dungeon wall. These failures are retained in
`/tmp/eidolon-poison-before-server.log`; they establish two runtime defects,
not just incorrect talent text.

Enemy/NPC updates now process poison before AI, and players use the same tick
helper. Poison and bleed share attributed damage, enemy threat and normal
death handling; the existing one-second cadence, expiry and player lethal-damage
protection remain intact. Poison spread now uses canonical dungeon walk geometry
as well as the existing body-aware five-metre radius and hostility rules.

Focused race checks pass in **3.979 seconds** at
`/tmp/eidolon-poison-final-focused-server.log`. Coverage includes actual coated
basic attacks (observing their ordinary asynchronous impact), coated Piercing
Throw and poisoned Fan of Knives through actual enemy updates; player/enemy/NPC
cadence and expiry; attributed once-only kill rewards; lethal bleed before
poison; Divine Intervention; oversized spread boundary, friendly/instance
exclusion, and wall-versus-doorway spread. Earlier narrower passing runs remain
at `/tmp/eidolon-poison-after-server.log` and
`/tmp/eidolon-poison-expanded-server.log`.

The full server race suite **passes** at
`/tmp/eidolon-poison-full-server.log` (session `87479`, exit zero): root package
**18.502 seconds**, game **278.453 seconds**, all other packages pass or have
no tests. Runtime/tests were unchanged throughout the run. No new poison browser
route, public deployment, full set-bonus balance audit or whole range/area
completion is claimed. This remains unversioned local work after `18f1636`,
not part of the queued 1.0.35 source.

## Projectile travel trace — still unresolved

Ordinary server projectiles expire after
five seconds in `world_update_entity.go` (traps use sixty); Fireball speed is
20m/s or 12m/s with Magma, while the offline projectile has a ten-second baseline.
Client Fireball intent uses 36m and the server ability-spec entry says 18m.
These are distinct existing values, not a single authoritative travel limit.
Do not overwrite actual baseline travel with a convenient spec value merely to
make a talent test pass. Trace and document the intended cast, travel and homing
limits; pair real outcomes before changing them. Beam endpoints and projectile
expiry must remain consistent with their replicated presentation.

## Required next work before a range release

- Continue Wizard and Rogue actual consumers, not just Teleport: direct target
  validation, cone/beam reach, directional projectile travel/lifetime, placement
  bounds and relevant runes. Preserve base behavior where no ranks are allocated.
- Next placement/projectile boundaries: Flame Whip's cone is implemented below;
  the remaining ground placements and directional projectiles still need their
  real range consumers traced and connected. Do not change only a search radius while retaining an
  old final hit/movement check.
- Update client chase/targeting and local/remote presentation for every changed
  consumer. Teleport's helper alone must not be wired globally ahead of working
  server consumers. Current metadata does not mean all corresponding spells work.
- Extend the new Flame Whip resolved-shape path to each newly repaired area
  consumer: `AbilityEvent` now supports optional radius/arc, but other abilities
  still use fixed/rune geometry locally. Remote actors do not carry private
  talent allocations. Publish final shapes instead of guessing ranks from the
  viewer; pair predicted and accepted local geometry as each consumer changes.
- Pair inside/outside boundary casts with unchanged LOS, walls, height, instance,
  relationship and oversized-target checks. Add real-server gameplay and saved
  rank checks before publication, then separate patch notes/version metadata.
- Keep area consumers (including the still-failing Purifying Wave probe), other
  talent/copy gaps, physical phones and the full 1.1–1.10 scope open.

### Cone implementation contract

`TalentBonus.SkillAoe` explicitly means **radius**, not angle. For Flame Whip,
apply the independent range multiplier to its 12m reach, then the AoE-radius
multiplier to that reach; sum ranks within each bonus category. Thus five Aether
Reach ranks give 14.4m, five Volatile Insight ranks 13.8m, and five Mana Geometry
ranks 14.52m (both of that talent's declared benefits). Do not reinterpret AoE
as cone-angle widening or silently drop one benefit. Base angle stays 90°;
Nova Cascade changes it to 360° without changing the resolved radius. Record
combined-rank fixtures before implementing this rule in server and client.

The server's resolved shape must survive every existing transport layer:
`game.AbilityEvent` → `AbilityPayload` in `main.go` → the ability-message handler
→ `AbilityController` → boundary visual options. Carry optional resolved radius
and arc in accepted events; observers must not need the caster's private talent
ranks. Preserve legacy events without those fields. Local accepted casts currently
return early because their effects were predicted: explicitly reconcile changed
shape/360° presentation without replaying every ordinary cast or applying damage
on the client. The offline handler also currently uses a 3D centre-only 12m
distance and no dungeon-cover check; pair planar body-aware hits and wall checks
with the online geometry, rather than fixing only the targeting ring.

Required evidence: baseline/range-only/area-only/combined ranks; inside/outside
small and oversized bodies; ordinary angle exclusions versus a real Teleport →
Whip combo; dungeon wall/doorway, hostility and instance isolation; serialized
shape plus local/remote High/Low presentation. This contract is not evidence
that any cone, general AoE or physical-phone gate is already closed.

### Flame Whip implementation — local, verification ongoing

The shared six-case `testdata/flame_whip_shape.json` covers baseline, Aether
Reach, Runic Precision, Volatile Insight, Mana Geometry and all four combined.
The initial actual-cast server probes failed on ranked hit boundaries and
missing serialized radius/arc (`/tmp/eidolon-whip-before-server.log`). Client
probes failed **13/20** on range, oversized planar hits and remote shape
(`/tmp/eidolon-whip-before-client.log`). These failures are retained.

The server now computes Flame Whip's final radius from both talent categories
and publishes radius/arc through `AbilityEvent`, the tested production payload
mapper and the existing ability message. Ordinary casts publish 90°, actual
Teleport → Whip dispatch publishes 360°. Normal walls, body padding, damage and
stun handling remain in the authoritative handler. Client intent, offline hits
and predicted boundary radii use the same contract. Offline hits are planar,
body-aware and dungeon-cover-aware; its successful Teleport can now complete
Nova Cascade within three seconds, but an intervening cast or expiry prevents it.
Runic Precision and Mana Geometry text now describes their server definitions;
this does not establish that every other range/area consumer is repaired.

Remote casts use the accepted shape even without private ranks. Local effects
remain immediate: an unchanged prediction is retained; a changed accepted
footprint replaces only the existing Whip effect, without replaying animation
or applying local multiplayer damage. Legacy unshaped local messages do not
replay casts. Full-circle art omits the misleading pair of radial cone edges.

Expanded checks pass: **35 client tests** across three suites in **2.652 seconds**
(`/tmp/eidolon-whip-expanded-client.log`); focused server race tests including
the payload wire mapping and actual combo/wall dispatch pass (root **1.083s**,
game **10.266s**, `/tmp/eidolon-whip-expanded-server.log`). High/Low tests inspect
the actual boundary mesh scale and ring arc, not only a metadata label. Local
message-handler reconciliation, unchanged/duplicate acceptance, remote routing,
offline cover and combo expiry/intervening casts are covered. Lint passes at
`/tmp/eidolon-whip-lint.log`.

Full client/server race suites and the new isolated `whip-shape` browser route
are running separately, at `/tmp/eidolon-whip-full-client.log`,
`/tmp/eidolon-whip-full-server.log`, and `/tmp/eidolon-whip-gameplay.log`.
The browser route uses a separate fresh prepared Wizard, normal Pyromancer
selection, normal Mana Geometry purchases, High/Low casts in a real dungeon,
accepted-event/actual-mesh observations and fresh-login rank persistence. It
does not itself claim exact enemy hit boundaries, a multiplayer combo session,
earned progression or physical-phone evidence. Runtime and selected browser
source are frozen during that run. No new version/publication or whole
range/area completion is claimed yet.

The first full client run failed **2/2,704** tests in **145.034 seconds**: two
callout mocks still expected four visual-controller arguments, while the actual
network handler now forwards the accepted payload as its fifth argument. Their
assertions now require the complete forwarded payload and retain facing/callout
checks. The first browser run failed before casting because the new dedicated
`-whip` prepared character was missing from the disposable server's QA allowlist;
its `/level 100` preparation never completed. This is a route setup failure,
not cone-play evidence. The route-specific account is now included in the same
isolated-only list as the other prepared routes. Original failure logs above
remain retained; corrected runs use separate paths.

The corrected isolated browser route **passes in 43.0 seconds (40.0-second
body)** at `/tmp/eidolon-whip-gameplay-allowlisted.log`, session `84472` exits
zero after credential scan and disposable cleanup. At both High and Low, normal
untrained casts publish/render 12m and five normally purchased Mana Geometry
ranks publish/render 14.52m; the accepted arc and actual ring geometry agree.
Fresh login retains all five ranks. No runtime or selected route source changed
during the repeat. Full client and server suites remain separate gates.

Additional combo-access limitation found by tracing `skills.go`: changing
specialization replaces the unlocked-skill list with the selected branch.
Teleport and Flame Whip belong to different branches. The paired combo unit
fixture explicitly unlocks both and proves dispatch/shape, not an ordinary
same-loadout combo. Do not treat that fixture as evidence of a usable cross-branch
build; resolve player-facing combo access in the build/combat follow-up instead
of hiding this limitation behind a prepared fixture.

Final full client verification **passes all 188 suites / 2,704 tests in
141.262 seconds**, `/tmp/eidolon-whip-full-client-corrected.log`, session `66916`
exit zero. Final lint passes at `/tmp/eidolon-whip-final-lint.log`. Full server
race verification **passes** at `/tmp/eidolon-whip-full-server.log`, session
`92379` exit zero: root **16.391 seconds**, game **310.466 seconds**, remaining
packages pass or have no tests. Runtime remained unchanged throughout both
full suites and the passing browser repeat. Additional test-only rotated-angle,
friendly/dead/other-instance and CC-immune cases then pass in the final focused
race suite (root **1.060 seconds**, game **12.507 seconds**),
`/tmp/eidolon-whip-final-focused-server.log`. No new runtime fix was needed for
those retained targeting rules. This is a locally verified checkpoint, not a
versioned release or completion of all range/area consumers.

Next source-backed placement targets: Gravity Well clamps placement to 18m,
Meteor Drop and Inferno Cataclysm to 20m before their existing dungeon-floor
validation; client intent has matching untrained distances. Their actual talent
consumers remain disconnected. Keep placement range independent of effect
radius, preserve rune-adjusted bases, and verify both the initial cast and any
delayed/periodic impacts. Inferno currently encodes radius in projectile `Scale`
(radius / 5); Meteor also has a separate 1.65× presentation scale. These paths
must remain consistent when adding AoE bonuses and remote accepted shapes.

1.0.29 is fully verified: CI `34078663504` passed every job and uncached public
manifest/login/script/backend identity matched `bc96862` / Alpha 1.0.29 at
04:06:20.318 UTC. Only queued 1.0.30 `c3247e8` was pushed next; CI `34081910599`
is running. Do not push another successor before whole-CI success and a fresh
post-terminal uncached public identity check.
