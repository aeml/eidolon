# Fighter damage-buff native owner and party gate — party acceptance still open

## September12 first native result and phone-input correction

Full component CI34695408928 passed on6814147c (client398suites6276tests128.997s;
server and all three browser jobs succeeded; native/deployment skipped).
Native11597 FAILED3.2m after all owner rank0/1/5, fifteen purchases, saved ranks,
High/Low status/effects and natural expiry checks passed. Party setup then
expected movement from an empty-ground phone tap. Actual position remained at
120,200. Source `GameEngineMovement.handlePrimaryClick` explicitly makes phone
ground taps clear targeting, not walk; movement is through the joystick. This
is a test-input error, not a confirmed character-control regression.

Archive `/tmp/eidolon-fighter-buff-setup-failure-2InrBH`; original
`/tmp/eidolon-fighter-buff-current-native-20260912.log`. Scan0/owned services and
ports clear. Main agent viewed the saved Low Last Stand status screenshot.
No party sharing result was reached; prior wording about ground movement was
an incorrect test assumption and is superseded here.

The correction uses a real touch on the visible joystick and releases it in
finally, then requires neutral input, >3units local movement, >2units seen by
the other client and <10units final separation for the existing buff radius.
No scene-position assignment, hidden movement message or weakened paid-buff
assertion. Regression RED1fail1pass; four suites82tests GREEN3.258s, full lint
and diff passed. Logs `/tmp/eidolon-fighter-buff-joystick-{red,tests,lint}-20260912.log`.
Fresh full native and corrected CI remain required.

## September12 current-integration replay preparation

Ported f27c003a/0f15acd8 onto accepted7f4df79a in a separate worktree, preserving
both owner and real Cleric recipient coverage. The full gate retains Smoke
Bomb and all older stages; original runtime skill/rank/party rules are unchanged.
Both status panels now close through their existing visible Close button, as
the completed Fortress replay demonstrated. Buff cards are scrolled into view
and checked against the viewport before screenshots. No forced input or
synthetic receipt replaces the paid-cast/expiry/stat-restoration checks.

Seven focused suites128tests passed7.775s, including native observers/enrollment,
actual buff replication, offline owner/recipient expiry, gate order and phone
status behavior. Lint/assets/bash syntax/diff passed. Logs
`/tmp/eidolon-fighter-buff-current-{tests,lint,assets}-20260912.log`.
Native execution remains pending while party7792 owns the single GPU lane.
This preparation is not owner/party gameplay acceptance or a release.

Based on06f62f1b in a separate worktree while its hosted rehearsal and the
separate release65 native pipeline remain frozen. This document is not browser
acceptance evidence. Local GPU must stay available to release65 until terminal.

The new `fighter-buff-mastery` isolated route registers one dedicated allowlisted
Fighter plus a separately allowlisted Cleric and disables Playwright retries. Full timed QA enrolls it once after
Whirlwind, preserving every existing stage and cleanup/credential scan behavior.

## Browser scenario

- Explicit QA level100 is fixture preparation, not earned progression. Select
  the Berserker specialization through phone Skills. Buy five ordinary
  Shieldwall ranks for a positive defense baseline; never inject gear or stats.
- Move to the existing combat waypoint, outside town's10%-per-second healing.
  Wait for previously banked Well Rested to expire naturally so its changing
  stat bonus cannot distort the damage comparison. Do not clear or extend buffs.
- Cast Berserker Edge and Last Stand through actual hotbar taps at named ranks
  0,1,5. Purchase all Mastery ranks through ordinary mobile Talents, checking
  one-point cost, acknowledgements, accurate text and disabled max-rank buttons.
  Existing allowlisted readiness preparation restores ordinary mana/cooldowns
  and supplies Last Stand's below30% health precondition; no input bypass.
- Require an actual accepted ability receipt, zero mana cost, explicit owner
  strength/damage/defense state, bounded duration, attached visible mesh in High,
  matching status-card text, natural server expiry and complete stat/effect/UI
  restoration. Preserve screenshots and raw owner receipt evidence.
- Fresh document/login must retain all15 purchased ranks and point balance.
  Recast both trained buffs in landscape Low with the same wire/visual/expiry
  assertions. This verifies saved training, not active-buff persistence on logout.

The serialized observer forwards each message once and returns its original
result. It filters owner ID and skill, never invents missing multipliers or
expiry, resets observations without nesting wrappers, retains rejection, and
bounds captured state samples.

## Real party recipient extension

After the saved-owner checks, launch a second system-Chrome process with its
own mobile context and a real Cleric login. Prepare level/readiness with the
existing allowlist only, move outside town, and let banked Well Rested expire.
An actual ground tap separates the models. Invite by the normal phone Party
form and accept on the other client; require a two-member roster and a Cleric
recipient with zero Fighter Mastery ranks.

In both High and Low, a real owner hotbar cast must deliver1.8 strength and the
matching Damage/defense stats to the Cleric, without a recipient cast receipt.
Require bounded shared15s duration, both owner and recipient attached effects
visible on both clients, recipient+80% Damage card, natural authoritative expiry,
recipient stat restoration and removal of both clients' local/remote effects.
Retain recipient screenshots and both receipt sets. Always close the extra
browser in finally. Explicit test budget is now600s for owner plus party phases.
This remains a stat/render/lifecycle scenario; actual damage-impact gameplay
and the four-player dungeon clear are separate required acceptance.

## Local verification

Initial observer3 tests pass; route-enrollment test correctly RED before script
integration. First integrated run failed31 timing-contract cases because only
the command list, not its parallel stage-name list, had the new entry. Update
both lists without weakening order/failure/cleanup contracts. Final8suites83
tests PASS4.286s; changed lint, shell syntax and diff checks pass. Client vendor
dependencies prepared; Playwright listing loads one test without executing it.
Logs `/tmp/eidolon-fighter-buff-native-{red,focused,focused-final,prepare,list}-20260912.log`.

Party extension:6suites104tests PASS3.067s (observer/route/order/replication/
offline buff regressions), changed lint, shell syntax and diff pass. Log
`/tmp/eidolon-fighter-buff-party-gate-focused-20260912.log`. These checks do not
execute the browser scenario; owner and party native acceptance remain unproven.

Execute through the existing wrapper once the production GPU is free. Retain
terminal evidence and investigate failures; do not loosen checks to obtain a
pass. Full roadmap, saved-build/party/native/balance acceptance and versioned
deployment remain open.
