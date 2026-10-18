# Level-10 legacy branch-selection fixture correction

CI39099732220 for source cd98a2dfea114ed78686ee54982856d59c3a0996 failed
`TestBuildRequestValidationAndLegacyCompatibility`: the level-one fixture
expected a branch selection to succeed after selection correctly moved to
level10. The source gate and actual level9/10 session proof remain unchanged.

The corrected existing case first sends a legacy request at level9 and requires
an unchanged branch plus a level10 error. It then reaches level10 and retains
all malformed request-ID assertions, successful legacy selection and absence of
unsolicited correlated receipts. No gameplay, persistence, deadline, CI coverage
or economy rule changes.

Focused Go race checks pass:34 test/subtest outcomes across the main and game
packages; five opt-in integration cases skip explicitly. These checks are not
new actual API/Mongo/session or deployment evidence. The original failed CI
log remains in the owned publication evidence. Other jobs were still running
when the failure was diagnosed; no current deployment acceptance is claimed.

The new recall/quest-object casts, outside-click dismissal, melee, Earth fence
and roof requirements remain in a separate owned candidate until qualified.
