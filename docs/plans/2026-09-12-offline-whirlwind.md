# Offline Whirlwind consumer — 1.1 candidate, not released

Follow-on to damage-buff candidate37d00650. Its full client regression completed
384 suites/5900 tests in351.766s before this separate worktree was changed.
Production release65 has independent frozen source and native GPU acceptance.

## Runtime correction

Replace the old Strength-only0.2s loop and extra legacy visual with the ordinary
paid cast's canonical spin presentation and an offline counterpart of
`server/internal/game/ability_whirlwind.go`:

- Capture floor((0.8*Damage+2*Strength)*1.3*skill training) once at cast; the
  Damage term includes active Fighter buffs, without multiplying Strength too.
- Two half-second pulses, first on cast; Extended uses four pulses over2s
  without increasing the total damage budget. Cumulative integer division
  preserves remainder damage. Later stat/rune/talent changes cannot rewrite it.
- Fixed6m visual boundary plus target body radius, canonical floor-segment
  checks, same-instance living hostile recipients and no replica mutation.
- Bloodwhirl heals2% max health per newly hit enemy, once per cast, through
  ordinary poison/missing-health policy. Later arrivals can contribute once.
  Bladestorm pulls each eligible enemy once, respecting CC immunity and death.
- Actual paid Charge→Whirlwind casts use the normal3s combo window for+50%
  budget. Locked/mana/CD/stun rejects do not create a spin or a new cast record.
- Death, removal, scene/engine change, cancellation and authority changes clear
  the transient state and presentation. Expired windows never replay missed
  pulses. Live windows can catch up at most four total pulses. Real lethal
  Thorns ends the channel without resurrecting the caster. Charge/Shattering
  movement and Whirlwind both advance when active; neither pauses the other.

## Focused evidence and fixture corrections

Initial unchanged-source RED15failed/1passed1.956s. First green had one erroneous
outside-radius fixture: its default Actor radius1.25 reaches7.25m, so7m is not
outside a6m spin. Move only that fixture to7.26; keep the positive6.4m/.5body
edge check. Expanded run had one combo fixture failure because it had never
unlocked Charge; explicitly unlock and assert the real20-mana payment and prior
cast record before testing the3s boundary. No admission rules were bypassed.

Five focused suites/152 tests PASS5.111s: actual casts, budgets/timing, buffs,
critical/recipient hit path, rune mechanics, geometry, scope, combo, rejection,
reflection, concurrent movement and neighboring Charge/buff/duration/presentation
regressions. Small final guards avoid altering an active charge's state when
the spin ends and exclude non-actor healthless recipients. Final rerun passes
the same152 tests in3.879s; full lint and diff checks pass.
Logs `/tmp/eidolon-offline-whirlwind-{red,green,expanded,final}-20260912.log`.
Final logs `/tmp/eidolon-offline-whirlwind-{accepted-focused,lint}-20260912.log`.

Full combined regression, real-input rendered/native lifecycle, saved builds,
measured balance and all remaining1.1 requirements are still mandatory. Neither
this offline test suite nor an earlier server pass is proof of those broader
gates. Do not publish this partial candidate as a completed1.1 milestone.
