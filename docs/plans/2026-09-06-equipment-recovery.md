# Alpha 1.0.28 — every item in its place

Status: local candidate, not published. Publication order remains in the
[execution ledger](2026-09-05-roadmap-execution.md). This is an inventory integrity
and usability repair within the 1.1 readiness gate, not closure of that milestone.

## Confirmed defects

The first earned Wizard readiness route equipped a loose gem through an ordinary
desktop bag click. The unsupported `equipment.gem` entry survived login and was
not represented by one of the 14 character-sheet slots. Desktop click and Actor
validation only excluded materials/relics; the server accepted any item/target
slot whose strings matched. Stats, set bonuses and unique effects considered
every saved equipment entry. Separately, unequip attempted stack merges directly
into the live bag: if the full stack would not fit, partial merges remained while
the original equipped stack was retained, permitting duplication on retry.

Six new client regressions and the server rejection/recovery/stat checks fail
against the old behavior. The source-derived finding agrees with the ordinary
played save; it is not a hypothetical malformed-request-only case.

## Implementation and compatibility

- Client and server restrict new equips to the 14 real slots and resolve generic
  rings/trinkets into their two real slots. Loose gems, materials, relics and
  unsupported types/slots cannot become equipment. Socketed gems remain part of
  legal gear and retain their bonuses. Earlier real-slot gear with omitted
  slot/type descriptors remains active; new requests still require a matching
  item slot.
- Unsupported saved records stay intact for recovery, but are excluded from
  stat, set and unique-effect calculations. Nothing is silently deleted or
  relocated on login. The bag exposes **Recover stored items** on both input
  styles; phones open a readable recovery panel with Back to bag and persistent
  chat below it.
- Recovery requests include the expected item ID. Server-side validation rejects
  stale identity; a staged inventory copy makes stack merging all-or-nothing.
  Successful recovery saves immediately. Normal equipment swaps are staged too,
  and legacy omitted stack counts are treated as one item when returning gear.
- `equipment_result` provides non-blocking, item-specific feedback instead of a
  generic error alert. The bag result precedes the success receipt. A full bag
  leaves ownership and quantities unchanged and permits a later retry.
- Version 1.0.28 has its own player notes, synchronized login/package/manifest/
  server/build metadata, and retains all older patch-note entries. This patch
  does not change XP, gold, quest prerequisites, dungeon gates or enemy strength.

## Verification and retained failures

Initial focused checks pass **18 client tests** and race-enabled server checks.
The first full client run exposed an obsolete test-only `OFF_HAND` type; the
fixture now uses `ARMOR`, matching actual generated shields/tomes, without
weakening comparison assertions. The versioned full client run subsequently
passes **169 suites / 2,416 tests in 61.595 seconds**, with lint passing. The final
repeat after both equipment-arrival refresh regressions passes **169 suites /
2,418 tests in 95.787 seconds**; final lint and shell syntax also pass. Full Go race tests passed
before and after the structured result addition; the original game package took
182.409 seconds, and the unchanged package is cached in the final run. Logs:
`/tmp/eidolon-equipment-{slots-red,slots-go-red,slots-green,slots-go-green,client-full,server-full}.log`
and `/tmp/eidolon-1-0-28-{client-final,client-arrival-final,lint-verified,server-final}.log`.

The first real-server legacy-save route reached the full-bag rejection, then
failed expecting chat feedback: the server used the generic alert error route.
The new structured result addresses this observed feedback defect. That first
run is not a recovery/persistence pass; log
`/tmp/eidolon-1-0-28-equipment-recovery.log`, session `31391` closed, credential
scan and exact disposable cleanup completed.

The phone fixture first had two setup mistakes (`ui.update`/`ui.updateUI` do not
exist); those failures do not establish layout defects. Correct production UI
setup then passed the three main sizes but failed the 568×320 bag-space check.
Removing repeated optional guidance in that short-screen recovery state made
the initial geometry suite pass. Visual inspection then showed a partially
clipped recovery button despite its nominal 44px height. Expanded recovery now
uses its own phone panel, and tests measure visible hit area as well as actual
pointer acquisition. **All seven checks pass in 46.6 seconds**: four recovery
sizes and three existing bag/detail layouts. The final 568×320 capture was
visually inspected. These are desktop touch-emulated fixtures, not physical
phone sign-off. Logs `/tmp/eidolon-1-0-28-recovery-layout{,-second,-third,-final}.log`
and `/tmp/eidolon-1-0-28-recovery-panel-layout.log`; capture
`/tmp/eidolon-equipment-recovery-568.png`.

The second real-server run conserved the 23 gems and removed the unsupported
slot, but the recovery panel stayed visible: inventory delivery precedes the
equipment delta. Both full-state and delta equipment hydration now refresh the
recovery panel; two added regressions pass. The third and fourth runs then passed
those gameplay checks but failed in the direct Mongo test reader. A diagnostic
run located the error at character selection. An isolated `mongosh` 7.0.14
reproduction returned `undefined` for an optional-chained array `find` on a
known-present character, while ordinary access returned that character. The
reader now uses explicit shape checks and ordinary array access, and converts
BSON stack values to numbers before summation. No game persistence behavior or
assertion was weakened to fix this helper. Failure logs remain
`/tmp/eidolon-1-0-28-equipment-recovery{-second,-third,-fourth,-diagnostic}.log`.

The corrected real-server route **passes in 11.4 seconds** (10.0-second body),
including exact database state and fresh-login verification. Session `8894` is
closed, credential scanning passed and run-owned disposable resources were
cleaned up. Log `/tmp/eidolon-1-0-28-equipment-recovery-verified.log`.
It registers a new
empty disposable account, seeds exactly that account's old-style save **before
its first world entry**, and then uses normal UI actions. The fixture has 25
occupied bag slots, an 18/20 gem stack and a five-gem unsupported equipment stack.
It proves failed recovery changes nothing, a legal sword equip frees a slot,
recovery conserves 18+5 gems, re-equipping a loose gem is rejected, and both direct
database inspection and fresh login preserve the result. This is explicitly a
legacy-save fixture, not earned progression evidence, and cannot target a live
database. It is included in full isolated predeploy QA on a separately named
disposable account. The four phone recovery layouts are included in anonymous
browser CI. No production character has been modified by these checks.

The existing real-server phone inventory route also **passes in 36.2 seconds**
(34.1-second body), covering 390×844 and 844×390 with ordinary combat loot,
authoritative equip/unequip, canceled and confirmed drops, manual pickup and
reconnect persistence. It uses the established prepared level-30 functional
fixture, not a fresh-progression measurement. Credential scan and exact cleanup
passed; session `40985` is closed. Log
`/tmp/eidolon-1-0-28-phone-inventory.log`. Anonymous test discovery includes all
four new recovery layouts; discovery is not another browser pass.

The failed fresh-ready Imp hunt remains a failed balance/strategy measurement;
correcting this equipment defect does not retroactively validate it. Repeat with
lawful gear and appropriate Wizard spacing/defensive choices before judging
first-dungeon readiness. Talent-consumer and full first-hour/campaign work remains
open in [fresh progression evidence](fresh-progression-evidence.md).
