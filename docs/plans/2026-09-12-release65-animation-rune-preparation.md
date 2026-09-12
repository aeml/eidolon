# Release65 persistent animation QA — explicit base-rune preparation

Runtime parent f9eb1f30 is already published as Alpha1.0.65. Final live QA in
CI34683452640 failed; publication is not final animation acceptance. This is a
QA-only candidate, with no runtime/balance/version/patch-history change.

The failed Wizard matrix expected two layers but observed four. Its base-cast
expectation always models no rune, while persistent QA characters retain their
prior rune selections. The real Teleport Warp presentation has four layers;
its base spell has two. The retained failure does not identify the active rune,
so this is a reproduced fixture defect and a supported explanation, not proof
that every observed live failure has been resolved.

Before each base cast, the matrix now opens the existing rune UI and clicks
the currently selected rune to remove it, then waits for authoritative saved
state to acknowledge removal. It does not mutate the player or send a synthetic
network command. Preparation rechecks state after opening the tab, avoids
re-equipping a rune already removed, and fails on an unknown saved rune rather
than guessing. The base ability is cleared while level100 permits its normal
toggle, before the moving-cast probe temporarily reduces level to1. Explicit
variant casts retain their requested rune. Every cast verifies the actual rune
before input, and layer failures now include skill/rune/presentation diagnostics.

The `animation-reuse` isolated route runs the SAME selected class characters
twice with `--repeat-each=2 --retries=0` in one disposable server/database.
Restrict with existing `EIDOLON_ANIMATION_QA_CLASS=Wizard` for the exact current
regression. First-pass rune choices persist into the second fresh browser
session. Ordinary `animations` and full release routes retain their coverage.

## Evidence and remaining gates

Initial helper test run failed because the new removal export was absent.
Three-suite helper/presentation pass:29tests2.648s. Real desktop SkillTreeUI
tests exercise the actual toggle callback with immutable pre-ack state and
verify Warp4→base2 and Beacon3→base2 only after modeled server acknowledgement.
An initially incorrect authored Beacon expectation (2 instead of3) was corrected
against the existing manifest; no runtime visual or assertion budget changed.
Expanded4suites70PASS7.291s; final route/helper/mobile regressions6suites
89PASS4.315s. Full lint, shell syntax and whitespace pass. Browser assets
prepared; Playwright lists two repeats, which is discovery, not native execution.

Logs `/tmp/eidolon-release65-rune-preparation-{red,green,expanded,final,gate,lint-gate,assets,list}-20260912.log`.
Native same-character first/second matrix, full regression and final live
acceptance remain required. No master push or deployment is claimed here.
The separate Whirlwind late Idle snapshot and moving Fireball ten-frame sample
remain open. Their assertions, sampling window, retries and performance limits
are unchanged; this preparation correction does not excuse those failures.
