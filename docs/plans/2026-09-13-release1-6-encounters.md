# Alpha 1.6.0 — dungeons and raids worth repeating

Develop separately from the frozen1.5 release9c61d0d5. Runtime stays1.5 until
this milestone is packaged. The full1.1–1.10 goal remains active.

## Scope

- Improve existing dungeon/raid encounter identity, readable mechanics and pacing.
  Preserve attackable bosses, ability admission, generated walkable layout and
  exit/reconnect foundations already delivered; do not treat this milestone as
  permission to postpone broken basics.
- Differentiate all four crystal-defense events with realm-specific gameplay and
  understandable group jobs, not just different colours or names. Preserve full
  raid clear requirements, repair NPC/event state, waves and earned quest receipts.
- Improve party preparation, wipe recovery and lockout explanations so groups can
  understand what remains, retry safely and avoid losing earned progress.
- Preserve the full four-dungeon → four-raid/crystal repair → resonance portal →
  Dark King campaign and the four Eidolons' role in his phases.
- Use four appropriately prepared characters for relevant group checks: Fighter
  tank with Strong gear, Agile Rogue and Brilliant Wizard damage, Wise Cleric
  healing; at least Uncommon/Rare equipment. Do not add level-based stat scaling
  or compensate for a broken encounter with fabricated kills/clear receipts.
- Package, publish and verify1.6 with patch notes and synchronized login version.

## Verification timing

Follow the user's feature-first direction: targeted changed-encounter/group checks,
relevant build and release smoke. Full earned campaign/raid group progression and
cross-device/endurance matrices remain required for consolidated final stabilization
after all features are added; do not claim those complete from unit checks or a
prepared fixture. Reuse unchanged passing evidence and do not start another soak.

## Implementation checkpoint — September 13

03:29: encounter/preparation batch complete locally. Existing realm bosses now
use genuinely different, locked-at-windup footprints in the same damage pipeline:
Earth three-circle directed fissure, Water target-position surge, Fire three
eruption pockets, Air six-circle perimeter with safe center. Dark/unknown bosses
retain their existing slam and Dark King phase gates. Exact same circle data
drives warnings and impact; overlapping circles cause one hit, one group callout
includes movement advice, defenses/shields remain honored. Existing10s special
cadence/2s reaction window and ordinary damage budgets retained, not inflated.

Guide includes collapsible four-role/gear/rest/ready-check preparation and exact
per-realm ritual assignments; explains five-minute empty expiry, personal re-entry,
wave recovery and destructive resets. Desktop reset now confirms/cancels explicitly
like the existing phone route. Dark King card distinguishes weekly reward lockout
from raid entry, reads actual DB claim status, and shows next Monday00:00UTC reset.
Unavailable DB is explicitly unknown, never advertised as an available cache.

Focused menu/phone/preparation21 PASS2.464s; DB boundary/unavailable tests PASS;
existing occupied-reset dispatch PASS and new unknown-cache dispatch PASS0.087s.
Actual AI delayed fissure observed with four role-appropriate characters wearing
14 legal level30 items (5Rare/9Uncommon via existing real role-affix generator):
tank survives one overlap hit, healer/Wizard/Rogue move clear and take no damage.
Focused pattern/defense run PASS4.193s, final single-hit group check PASS2.098s.
Client multi-marker/single-callout test plus vigil tests4 PASS0.785s; changed lint
PASS. This is a short functional group check, not an earned dungeon/raid clear.

Next: merge1.5 phone correctiond8323180, package1.6 notes/version and relevant
build checks. Wait for1.5 exact deployment verification before publishing1.6.
1.5 CI34734694245 terminalFAIL only568×320 bag/recovery layout; fixed in1.5WT,
exact landscape cases2PASS12.5s, pushedd83231809994317aac31dcf1c901ae5e22791e2d.
ReplacementCI34735541628 is running; do not restart old terminal runs.

All four repair events now have server-owned objectives alongside their existing
6/8/10 attackers: Earth holds a central ward for eight defended seconds; Water
carries two memories from the eastern font back to Maelin; Fire channels three
ordered vents for two uninterrupted seconds each; Air passes four ordered anchors
between different participants. No client credit requests or inventory tokens.
Each wave requires both its objective and all attackers defeated. Only living,
connected original participants near the chamber contribute. An unattended/wiped
ritual resets its current objective, preserves cleared waves and cannot advance.
Existing restart recovery, saved quest receipts and manual Ilyra turn-ins remain.

Realm-specific Maelin dialogue links those jobs to the keepers' mistakes and the
Eidolons' covenant. The room snapshot carries current objectives, personal carrier/
relay instructions and exact floor-marker footprints through reconnect. Markers
remain visible at Low quality without adding collisions or hit targets. The quest
tracker now shows the active repair instead of telling players to leave as soon
as the guardian dies. Completion still returns the player to Ilyra.

Focused Crystal Go checks PASS; existing crystal art/consumer tests16 PASS; new
marker/tracker tests3 PASS; changed JS lint PASS. Actual four-realm Low-quality
marker rendering inspected in `/tmp/eidolon-1-6-vigils.png`. The lifecycle fixture
uses explicit attacker/near-finished-channel setup; this is not earned raid proof.
No broad matrix or soak. Runtime remains1.5 pending remaining1.6 work/package.

Next: party preparation and lockout/retry guidance, encounter/pacing review,
targeted prepared group checks, then1.6 notes/version/build/publication. Dungeons
use the requested four role-appropriate Uncommon/Rare characters. Elemental raids
require5–10 actual members: retain that admission rule and add a fifth prepared
participant for raid checks, rather than weakening admission to fit a fixture.
Full earned campaign/raid group progression remains final consolidated validation.

Publishing dependency:1.5 original CI34734291355 failed only two obsolete daily
Gold assertions. Correction96000be3 is pushed and merged here; replacement
CI34734694245 is running. Do not rerun the old terminal job or call1.5 live yet.
