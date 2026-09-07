# Wizard duration consumers — work in progress for Alpha 1.0.32

Separate checkout `/tmp/eidolon-talent-duration-gDeDtl`, branch
`work/talent-duration`, based on `8171c2e`. Not merged, published or
verified live. Do not publish ahead of the 1.0.26–1.0.31 queue.

Paired real dispatches reproduce missing duration bonuses for Spell Focus,
Arcane Shield, Time Warp, Gravity Well's root/slow, Flame Whip's stun, Scorch
Beam's armor reduction and Teleport's Phase protection. Rank-zero baselines pass;
ranked durations fail. The same test checks that Arcane Stability combines with
Extended Shield's rune-adjusted base: 30 seconds × 1.25 = 37.5 seconds. Combining
five Arcane Stability and five Prismatic Control ranks gives 43.5 seconds, not a
separate multiplicative bonus per talent. Initial logs:
`/tmp/eidolon-1-0-32-duration-{before,expanded-before}.log`.

The helper snapshots additive applicable duration ranks after rune base changes.
All eight handlers consume it. Focused actual-cast tests now pass (0.463 seconds),
including Time Warp sharing its caster deadline with an unranked ally, unchanged
Time Warp cooldown, unchanged shield absorption, and shield expiry after its
ranked deadline. Removing ranks after casting does not recompute an active timer.
Source serialization already carries remaining server durations to owner/remote
effects and the buff tracker; actual browser timer/expiry proof is still required.

This is a timed Wizard buff/debuff correction, not an all-duration-talent claim.
Projectile/zone lifetimes, other classes, broader mastery/crit effects and the
remaining range/area probes stay open. Do not scale movement locks, cooldowns,
impact delays or replicated remaining timers with the new helper. Talent copy
identifies actual duration benefits rather than shield strength or flat CC seconds.
Full race checks pass: root 8.737 seconds and game package 136.202 seconds, log
`/tmp/eidolon-1-0-32-duration-server.log`. The subsequent shared two-entry
Go/JavaScript definition/copy contract has two passing client tests and passing
lint. Final focused race/contract passed in 3.957 seconds; the initial full client
suite passed 178 suites / 2,484 tests in 94.515 seconds.

The first real phone route failed in 17.5 seconds: its baseline server shield
duration was 19.986 seconds, but the Arcane Stability purchase button did not
exist after branch C selection. Source inspection proved the phone branch filter
excluded all 14 general talents in every class. Thirteen new regressions fail
before correction (all twelve class/branch pairs plus deliberate Wizard purchase),
and pass after preserving general talents alongside the active branch's ten skill
talents. No ranks are bought optimistically or granted by this change. Log
`/tmp/eidolon-1-0-32-duration-browser.log`, session `56827` closed; scanning and
disposable cleanup passed. The old QA build-version label was independently caught
by version alignment tests and is corrected to 1.0.32. Keep both failures recorded.

The candidate now has separate `time on your side` patch notes and aligned
login/package/server/deployment metadata. Focused version/copy/phone checks pass
304 tests, plus lint and shell syntax. The Arcane Shield diagnostic was promoted
to durable consumer tests; the separate overlay now retains range and area only.
Projectile/zone/other-class duration work remains open despite that promotion.

Corrected real-phone timer/purchase/expiry/login check **passed in 42.8 seconds**,
session `85718` closed, log `/tmp/eidolon-1-0-32-duration-browser-corrected.log`.
Server snapshots reported 19.969 seconds unranked and 24.974 seconds ranked. The
shield remained active and visible after 21 real seconds, then a later server
inactive snapshot cleared absorption and the attached effect. Fresh login in
landscape retained five ranks and reported 24.982 seconds. Browser errors were
empty, credential scanning and exact cleanup passed. Portrait/landscape captures
were visually inspected; the shield is visible. The fixture's level notification
and small hover-oriented buff controls are not a physical-phone usability pass.

Final client checks pass **178 suites / 2,498 tests in 101.749 seconds**, plus lint
and shell syntax. A further real-browser check explicitly covers the HUD badge's
accessible timer label and removal at expiry (not a touch-friendly details-sheet
claim). This final browser repeat **passed in 39.8 seconds**, session `54081`
closed, log `/tmp/eidolon-1-0-32-duration-badge-final.log`. Rank-zero and rank-five
server timers were 19.979 and 24.985 seconds; fresh-login landscape reported
24.990 seconds. The visible badge's accessible timer label matched the extended
duration, then the badge and effect were removed after the server expiry. Scanning
and disposable cleanup passed. It does not prove the hover-based details UI is
comfortable to use on a physical phone.

The final versioned race suite **failed**, session `72847` closed, game package
189.502 seconds: `TestTripwireRootsForThreeSecondsAndRespectsCCImmunity/ordinary_enemy`
reported `rooted=false`. There was no race-detector report. Twenty unchanged
focused repetitions passed in 5.212 seconds, log
`/tmp/eidolon-1-0-32-tripwire-repeat.log`. The original fixture includes randomly
spawned overworld enemies and a single-target trap, an investigation lead rather
than a proven attribution of the missing root. No assertion, runtime or fixture
was weakened. The unchanged full-suite rerun **passed**, session `27964` closed,
game package 158.469 seconds (other tested packages cached), log
`/tmp/eidolon-1-0-32-server-unchanged-repeat.log`. The candidate is locally verified
for its stated scope; keep the first Tripwire failure and unresolved attribution
as evidence, not a silently repaired runtime bug. The separate audit still fails its
two intended range/area probes, log `/tmp/eidolon-1-0-32-remaining-audit.log`.
