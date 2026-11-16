# Alpha 1.0.38 — landscape chat remains reachable

Correction to `b071aff`, not a new version. The original candidate and previous
chat-focus correction remain preserved. Do not publish later versions before
the corrected 1.0.38 CI/live gate, and carry this correction through every queued
descendant before its publication.

## Failure and reproduction

CI **34130749050** passes client/server and browser-smoke checks, then fails
predeploy Purifying Wave gameplay. Its baseline and trained radius casts pass,
but the saved-login landscape flow cannot collapse expanded chat: the actual
trace names `Speak to Archmage Ilyra` in `#objectives-panel` as the pointer
interceptor. Chat and the tracker both use HUD+1 stacking; the later tracker
paints above chat. The retry then reuses the selected specialization and cannot
tap its disabled Active specialization button. Both deployments are skipped.
Log: `/tmp/eidolon-release38-chat-correction-ci-failure.log`.

The new anonymous fixture uses real UI/quest rendering, a populated story
objective and normal touch actions. It opens chat in portrait, rotates into the
tested viewport and checks actual hit-testing before collapsing chat and opening
the journal. It fails at **844×390 and 568×320** before repair; portrait passes
(**1 pass / 2 fail, 10.5s**). The retained screenshot shows the story objective
painted across the chat header. It does not require accounts, synthetic clicks,
forced taps or a hidden tracker.

## Repair and verification

Checkpoint **`ace87c8`** raises expanded phone chat one HUD layer, still below
ordinary windows/modals. The compact tracker stays present and becomes tappable
again after chat collapses. Three viewport checks pass **12.7s**, and inspected
landscape captures show the chat header unobstructed. The test joins the ordinary
anonymous browser suite; the existing 1.0.38 patch notes gain the player-facing
chat correction without removing older entries.

Purifying QA now uses a separately allowlisted retry character. An opt-in probe
intentionally fails only after baseline/trained/saved checks finish, then repeats
the entire untrained scenario on retry. Both attempts verify accepted **8 / 9.2 /
9.2** radii and matching rendered boundaries, **16.4s / 20.2s**. The runner's
reported flaky result is the explicitly injected failure, not an unexplained
flaky success. Credential scan passes with zero sanitizations; cleanup completes.
Log: `/tmp/eidolon-release38-phone-chat-retry.log`.

Full client regression passes **196 suites / 2,898 tests / 105.014s**;
version/default checks pass **213 / 1.64s**; lint, shell syntax and whitespace
checks pass. Server source is unchanged from `b071aff`, whose Go CI passed.
Logs: `/tmp/eidolon-release38-phone-chat-full-client.log`,
`/tmp/eidolon-release38-phone-chat-contract.log`,
`/tmp/eidolon-release38-phone-chat-final-lint.log`.

The full anonymous suite passes **50/50 checks / 5.0 minutes** in
`/tmp/eidolon-release38-phone-chat-anonymous.log`. All local test handles are
terminal success. Publication remains open at this checkpoint.
Public checks at **14:36:31.152 UTC** still
return matching frontend manifest/login/runtime and healthy/ready backend for
**Alpha 1.0.37 / `2e37508505c9ff67e160886e2a91fad89196f25f`**.

This corrects the identified landscape interaction failure; it does not claim
physical-phone sign-off, the full phone redesign or completion of 1.1–1.10.

Carry-forward inspection identifies two conflicts with queued 1.0.39: union
the anonymous test lists, and retain 1.0.39's existing `--z-window + 1` expanded
chat layer (needed for its party sheet), rather than lowering it to this earlier
version's `--z-hud + 2`. Preserve later behavior and verify the populated-chat
regression again after merging. Original queued branches remain unchanged.
