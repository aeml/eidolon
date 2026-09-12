# Time Warp Mastery — meaningful duration upgrade, unreleased

WIZ_25 previously advertised and calculated damage for a non-damaging support
spell. The upgrade now grants4% Time Warp duration per rank, preserving the
existing ID, five-rank limit and paid ranks. Haste remains50%, the cooldown
benefit remains20percentage points, and base duration/cost/cooldown remain
8seconds/50mana/60seconds. Existing general duration training stacks additively:
Mastery alone gives8/8.32/9.6seconds at0/1/5ranks; five Mastery plus five
Prismatic Control ranks gives11.2seconds. The caster snapshots the duration for
each eligible ally; recipient ranks and later caster-rank changes cannot alter it.

The chosen benefit is explicit duration, not a new attack or stronger haste.
UI copy and canonical offline metadata match the server definition and its shared
duration contract. Spell Focus, Shield, Teleport and damaging spells receive no
duration or phantom damage from this skill-specific Mastery.

## Evidence

- Offline RED: four trained failures and34passing controls,0.484s. The first
  server attempt failed compilation in the new fixture's grid-update call, not
  gameplay. Correcting placement before insertion gave four actual trained-cast
  failures for both caster and ally,0.156s, with baseline controls passing.
- Initial duration repair exposed a separate upper-bound defect: raw rank99
  produced39.68seconds rather than the five-rank9.6. The shared skill-bonus
  reader did not clamp to the definition's maximum. A separate diagnostic
  reproduced oversized bonuses for all160definitions in0.007s.
- The reader now clamps each rank without mutating the saved build; negative
  ranks remain ignored. Legal ranks retain their existing values. The160-entry
  boundary check does not prove every talent's gameplay consumer is complete.
- Final34289: full lint and7suites/160client tests passed1.907s, covering actual
  offline paid casts, costs, cooldowns, unchanged haste strength, natural expiry,
  invalid ranks, duration composition, copy/contracts and surrounding Focus/QA.
- Final16527: repeated3xGo-race checks passed10.274s, including actual paid
  caster/recipient casts, stored deadlines, expiry restoring stats, other-skill
  isolation, all160rank boundaries and existing Wizard duration/Focus behavior.

Logs: `/tmp/eidolon-time-warp-mastery-client-{red,green,final}-20260912.log`,
`/tmp/eidolon-time-warp-mastery-server-{red,red-corrected,green,final}-20260912.log`,
`/tmp/eidolon-talent-boundary-red-20260912.log`.

## Remaining gates

Full combined regression passed on a955a7de (365 suites/5,423 client tests,
lint, full Go race suite); see the Wizard/Shattering integration record.
Primary now contains this runtime through3d1d2467. It is not in release63,
whose separate complete normal CI/live gate has passed.

Native69275 on clean3d1d2467 failed at the final High-quality post-login receipt
assertion (about1.3m). Untrained High, trained Low/High, all20 paid ranks and
Mastery5 Low duration/recipient/expiry checks passed first. WIZ34rank4 exercised
an actual rate rejection: unchanged points, released controls, then an accepted
new tap. Log `/tmp/eidolon-time-warp-mastery-native-20260912.log`; retained
artifact `/tmp/eidolon-time-warp-mastery-failure-unDK7r`. The Mastery5Low image
was inspected. Credential scan passed0; disposable services were removed.

The test installed its message observer only in the original page.
`loginAndEnterWorld` opens a fresh document; resetting receipt arrays there
cannot reinstall the old handler. Extracted an idempotent observer and installed
it after the fresh login too, with a pre-cast check on both clients. Added tests
for fresh documents, single forwarding, preserved return/receiver and rendered
radius capture. Three suites/56tests passed0.799s plus lint; logs
`/tmp/eidolon-time-warp-observer-{tests,lint}-20260912.log`.

The corrected native rerun is still required: do not count the earlier partial
pass as complete saved-build/High-quality acceptance. No runtime, duration,
radius, payment, receipt or expiry requirement was weakened. Earned progression,
balance and versioned publication remain open. Soak stays off and the complete
1.1–1.10 goal remains active.
