# Alpha 1.0.63 — Wizard support and build recovery

Prepared candidate, not published or live-accepted. Based directly on verified
production0231c948/Alpha1.0.62, preserving the website, analytics and all existing
patch-note entries. Root execution-ledger commits are excluded from publication.

## Included scope

- Time Warp's trained party reach and caster-centered low/high-quality cast
  rings; offline canonical cooldown, duration, set reach and stat expiry.
- Offline Spell Focus's trained cooldown/duration, next-damage charge including
  Fireball, utility/rejected-cast preservation and expiry.
- Correlated build-action admission rejections so the phone menu unlocks without
  spending or automatic retries. Existing admission limits stay unchanged.
- Separate retained live animation evidence for each class and multiplayer stage.
- A native two-client Time Warp release check using its own allowlisted Wizard
  and a normally registered second player. Normal walking, touch purchases,
  accepted casts, both-client stats/visuals/expiry and saved ranks are required.

Login, package/lockfile, release manifest, server/container/deploy/CI and local QA
versions advance together to1.0.63. Player-facing patch notes are in index.html,
above the preserved62entry. The versioned alpha status document describes this
candidate source, not proof that it is already deployed.

## Integration evidence and dependencies

Original source commits f965a194/49c08a76/9e16c19b/c11a9785/b05587d4 and native
proof commits were applied to the live base. Their earlier development-tree
acceptance is not acceptance of this release candidate.

The live base's update ordering differed: initial focused tests reproduced five
stun/replica expiry failures. Time Warp/Spell Focus timer processing now occurs
before the stun return, without importing unrelated status-system development.
Seven current client suites377tests passed6.529s. Full lint/shell syntax and diff
checks passed. Logs `/tmp/eidolon-release63-{initial-focused,focused,lint}-20260911.log`.

The first server test found a nondeterministic test fixture: injected fictional
ActiveSetBonuses could disappear when Time Warp recalculated its caster before
the distant recipient. The fixture now equips actual Temporal Weave pieces,
checking zero/five/six pieces and preserving their bonus across the real cast.
No server set behavior was changed to support fabricated state. Five repeated
focused race runs passed11.654s; server admission/receipt tests passed1.494s.
Logs `/tmp/eidolon-release63-{game-focused,game-final,server-focused}-20260911.log`.

This live base has the untimed full-QA chain. Its integration keeps every existing
command/order and inserts Time Warp after talent healing. The development-only
stage-timing fixture adjustment bce01bef is inapplicable here and was not imported;
no existing release test or stage was removed. A missing timing helper is not
referenced by this candidate. Own native/full checks remain required.

## Deliberately still open

This is not1.1 completion. The full dungeon repair/earned-progression/160-talents/
phone gates remain required. Later Fighter threat/training, shared receiving
defenses, additional Rogue/Cleric/recipient repairs, expanded investigations and
campaign rewards, Dark King phase caps and casino milestones are not shipped by
this candidate. The development-tree four-role clear still fails and must be
repaired; its result cannot prove this differently scoped release's gameplay.

## Required before acceptance

1. Freeze this candidate and pass complete client/lint/server race regression,
   browser partition discovery and its own native Time Warp/rejection proof.
2. Recheck remote master, preserving any new user commits and revalidating changes.
3. Publish through ordinary CI: hosted tests/browser shards, required System
   Chrome predeploy gameplay, QA-input checks, Pages/SSH deployment and final live
   verification. No waived or substituted native checks.
4. Verify matching live client/backend commits, saved gameplay and retained
   per-class/remote evidence. Do not label a branch push or manifest alone live.

The cancelled soak remains off. Full1.1–1.10 scope, including the two-floor
casino and future separately defined VIP currency, is unchanged.
