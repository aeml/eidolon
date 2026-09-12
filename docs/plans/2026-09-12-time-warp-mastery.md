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

The existing native Time Warp route retains untrained and area/general-duration
controls, then buys WIZ_25 through the phone menu. It checks the new11.2second
duration on both clients, unchanged recipient stats, expiry, Low and High after
fresh login. Purchases now verify exact point spending on acceptance and no
spending on rate rejection. The expanded case was discovered, not executed.

Full client/server integration, the expanded native route, earned progression
and balance, and a versioned publication with patch notes are still required.
Primary remains97cd447b; this work is not merged or in release63. CI34660899212
is in its required self-hosted predeploy on separatef866df68. No competing
native/full run is started. Soak remains cancelled and full1.1–1.10 stays open.
