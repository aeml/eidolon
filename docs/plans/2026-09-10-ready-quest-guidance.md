# Ready quest guidance — unpublished correction

The fresh earned Wizard run on primary98f757f9 captured a ready8/8seed quest
open with Ilyra, while the top guidance card still said "Re-orient after recalling."
Source:`buildTownRecoveryObjective` allowed explicit Recall/Respawn context to
precede any active story, including one ready for immediate manual turn-in.

This isolated correction is based on socket298ecde0. A genuinely claimable,
accepted, uncompleted quest in town suppresses that generic recovery card. The
existing tracked objective then supplies its named NPC and Complete Quest hint.
No extra duplicate guidance card, forced tracking, auto-claim, quest mutation,
reward change, recovery-mechanics change or completed-contract resurrection.
Explicit recovery remains for incomplete quests; unaccepted/completed/zero-goal
entries do not count as a ready turn-in. Daily turn-ins receive the same treatment.

-58878 RED:5failed/8passed tests0.856seconds reproduces precedence on desktop,
  phone, Recall/Respawn and daily readiness.
-35056 TERMINAL0:68tests/3suites1.732seconds plus lint/diff checksNode24.18.0.
  The existing Chronicle, objectives and mobile suites retain incomplete-quest
  recovery, tracking and journal behavior. Rendering checks use the actual
  objective entry, not a fabricated extra Next Step card for story quests.
- Logs`/tmp/eidolon-ready-quest-guidance-{red,focused,lint}.log`.

## Browser follow-up

71c9d7c7 added two cases to the existing required interface suite. First native
14561 TERMINAL1: desktop passed, but the phone case incorrectly demanded the
desktop hint inside the intentionally compact52px tracker. Existing phone CSS
hides that detail; the screenshot showed the correct readable title and Ready
status. Archive`/tmp/eidolon-ready-guidance-failure-gctzmQ` retains that failure.

5b55fcd2 corrects the phone assertion to follow the existing design: a minimum
44px tracker opens the journal, which explicitly says to return to Archmage Ilyra;
closing returns to the ready objective without claiming the quest. Full desktop
hints remain required. No CSS expansion, hidden failure, forced tracking or
removal of the manual-turn-in invariant. These are browser clicks at emulated
phone dimensions, not physical touch-device acceptance.

87718 TERMINAL0 on clean5b55fcd2:4cases4.1/5.5/5.6/5.2seconds,22.4seconds total,
zero retries, system Chrome/Node24.18.0. Covers Recall/Respawn guidance plus the
existing desktop/phone daily/lore journal interactions. Lint and4case discovery
passed. Archive`/tmp/eidolon-ready-guidance-proof-ZKlmjD` retains report/results,
native/lint/focused logs; no game accounts or API containers were used. The
41980listener was absent after completion. Manually inspected390px journal:
readable turn-in NPC,8/8objective, quoted fixture rewards and close control within
viewport. This prepared UI scene is not earned progression or world rendering.

Full regressions and integration/release acceptance remain pending. The original rendered issue
is preserved under`/tmp/eidolon-fresh-empty-stash-failure-KyAEhw/test-results/`.
That campaign separately failed at missing empty-stash state; this presentation
correction does not fix or reinterpret the campaign failure. No version or push.
