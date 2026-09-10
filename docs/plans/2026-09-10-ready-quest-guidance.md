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

This is focused DOM evidence only. Full regressions, actual browser verification
and integration/release acceptance remain pending. The original rendered issue
is preserved under`/tmp/eidolon-fresh-empty-stash-failure-KyAEhw/test-results/`.
That campaign separately failed at missing empty-stash state; this presentation
correction does not fix or reinterpret the campaign failure. No version or push.
