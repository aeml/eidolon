# Guardian Roar Mastery and caster protection

Candidate based on611024d4; production65 and the hosted regression retain their
own frozen sources. This is part of the1.1 core-talent usability requirement,
not another ordinary1.0.x release.

FTR_09 previously granted skill damage to an ability that deals no damage.
Replace that ineffective benefit with4% protective buff duration per rank,
maximum20%, preserving its saved ID, five ranks and one-point purchase price.
The client description and offline consumer change alongside the server
definition. Rank5 lasts12s instead of10s. The actual Shield Slam combo produces
18s instead of15s. Existing generic duration bonuses remain additive after
the combo: rank5 Mastery plus both generic rank5 bonuses produces15.5s or23.25s.
This does not increase damage, taunt threat, protection strength, range or cost.

Twelve paired paid server casts cover rank0/1/5, generic ranks0/5 and an actual
paid Shield Slam opener versus no combo. Near party members inherit the caster
deadline, not their own training; far/other-instance members are excluded.
Tests retain normal35mana/cooldown admission, no damage, immutable existing
cast deadlines and restoration at expiry. A separate ordinary-purchase test
buys five ranks, rejects a sixth without spending points and casts the result.
Named Mastery cannot affect other skills.

The protective-stat test initially used zero-defense actors, which could not
detect a missing percentage buff. Giving caster and ally the same legal five
Shieldwall Training ranks makes that control meaningful (10defense becomes12).
It exposed a second real bug: the recipient loop skipped the caster without
refreshing its stats. Refresh the caster after the loop, before publishing the
cast, while retaining this cast's existing equipment-based boss-taunt permission.
An intermediate placement before the loop broke two existing synthetic set
fixtures; that failed regression is retained, not relabeled as acceptance.

Offline paid casts check rank0/1/5 with and without generic training, nearby/far
recipients, unchanged protection strength/mana/cooldown and expiry even while
stunned. Multiplayer prediction must not run offline effects. Existing server
defense and offline damage-reduction formulas are not claimed to be equivalent
by this duration repair; wider combat parity remains separate work.

The existing native Guardian Roar area route now also reads explicit server
remaining durations, buys FTR_09 through the phone UI, checks description and
per-purchase point costs, confirms the buff survives the old10s deadline and
then naturally expires, and repeats after fresh login at Low quality. Existing
five area/rank/quality checks remain intact. Wait for a prior buff to expire
before fixture readiness; never assign ranks, timers or a fake clock. The300s
route budget includes these added real-time expiry checks. It is prepared QA,
not earned progression. Native execution and screenshots remain pending while
production predeploy/final-live QA owns the GPU.

Evidence:

- Client RED:5failed/4passed4.995s; server RED:8trained duration cases plus
  purchase/definition fail1.326s. Strength-controlled RED also exposes missing
  caster protection, game1.091s.
- Final focused client:7suites/206tests pass12.592s, including full wrapper
  contracts, Roar area, generic duration and Iron Fortress controls.
- Final focused server race checks pass35.151s, including both previously
  failing boss-taunt set controls, party recipients and Iron Fortress duration.
- Full lint and Playwright discovery pass; these are not native acceptance.
- Logs `/tmp/eidolon-guardian-roar-mastery-{client-red,server-red,server-strength-red,client-green,server-green,client-final,server-final,lint,discovery}-20260912.log`.

Full combined regression and actual native purchase/save/expiry validation
remain required before release. Four-player dungeon/earned progression and
the remainder of the1.1–1.10 roadmap are not closed by this repair.
