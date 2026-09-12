# Tripwire — paid damage and critical talents

Unreleased 1.1.0 candidate, based on integrated Fortress and Blade Storm8561a773.
The actual server trap omitted its skill identity and damage multiplier, making
ROG_23 Mastery and ROG_24 Technique ineffective. Offline Tripwire only rooted.
This is a real consumer repair, not a new talent or a change to purchased ranks.

The trap now snapshots base20+Dexterity with the applicable damage multiplier
and retains its Tripwire identity for the existing critical calculation. Offline
hits use the same named damage/critical path and normal recipient damage method.
Both paths reject hits across dungeon walls. Offline triggering additionally
rejects friendly, dead, inactive, remote/online and cross-instance recipients,
uses horizontal proximity like the server, expires after60seconds and respects
CC immunity. Cost25mana, cooldown15seconds, base root3seconds, foot placement
and existing trap radius remain unchanged. No trigger-area/rune redesign here.

Actual paid-cast regressions first failed9client cases and server talent/identity
checks. Tests now cover legal server purchases and actual trap creation/update
at Mastery0/1/5 × Technique0/1/5, controlled critical boundary, mana, root and
single consumption; disconnected floor rectangles cannot trigger/consume traps.
Offline tests additionally cover CC immunity and exclusion cases. The shared
Rogue damage contract now includes Tripwire as its seventh damaging profile.
The older effect-routing fake was replaced with a real Imp while retaining its
effect parent/disposal assertions.

Focused server race checks PASS25.587seconds, including shared Rogue contracts,
duration, actual critical projectiles and Blade Storm. Final client6suites84tests
PASS5.502seconds. Full lint, prepared assets and diff checks passed. Logs:
`/tmp/eidolon-tripwire-damage-*-20260912.log`. Full CI and a real in-game paid,
trained/saved trap/damage/root route remain required before integration. These
results do not close all160talents, dungeon balance or the 1.1 release gate.

Full CI34711930441 on d4a0017f exposed six failures in the independently shared
offline paid-Mastery suite (409other suites/6389tests passed). It assumed every
non-instant profile emitted a traveling projectile and supplied no effect scene,
so adding Tripwire correctly exposed a missing trap-fixture path. The shared
profile now identifies Tripwire as a trap; that suite uses a real effect scene,
checks its actual stored cast damage after equipment/ranks change, triggers it
through Rogue.update, and asserts root and single consumption. Existing moving
projectile assertions remain unchanged. Corrected focused3suites82tests PASS
3.555s/lint/diff; shared server/paid trap race PASS15.013s. Logs
`/tmp/eidolon-tripwire-{offline-contract-corrected,kind-server}-20260912.log`.
Full corrected local client95636 PASSED410suites6395tests360.246seconds.
Exact efda8f9f CI34712331175 client also PASSED410/6395/135.117seconds and
server passed; three browser shards remain active at this entry. Original
CI34711930441 is terminalFAILED with the retained six fixture failures; no
running job was canceled or replaced. Native trap acceptance remains required.

CI34712331175 subsequently completed SUCCESS on efda8f9f, including all three
browser shards. No native/deployment pass is inferred from those manually
skipped jobs. A new real-input Tripwire route is authored: normal town recovery,
level-only/waypoint preparation, ordinary enemy chase across a placed trap,
paid0/1/5 Mastery and Technique purchases, High/Low and saved ranks, actual trap
replica/amount/removal and target root/expiry. No target-position, hit, rank or
timer injection. Critical outcomes remain random (observed damage must equal
stored base or its double); exact Technique probability boundaries retain their
deterministic receiving tests. Healthy ordinary Skeletons are required so death
cannot replace root-expiry evidence. This is prepared ability QA, not earned
first-hour or dungeon balance.

Route is allowlisted and included once in full QA with zero retries. Updated
both independent stage/command lists. Four suites103tests PASS3.938s plus full
lint/diff/assets, including real-message observer ownership and gate failure/
cleanup contracts. Logs `/tmp/eidolon-tripwire-native-*-20260912.log`.
Native execution is queued behind the active four-player run. App/runtime source
is unchanged from accepted efda8f9f; retain a combined full regression after
integration instead of attributing the earlier CI to these newly authored tests.

## Draft 1.1.0 patch note

- Fixed Tripwire's damage and critical talents not affecting triggered traps.
  Offline traps now deal their intended damage, respect friendly targets and
  crowd-control immunity, and expire correctly. Traps cannot trigger through
  dungeon walls.
