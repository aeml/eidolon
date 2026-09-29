# Alpha 1.41 character/equipment finish — unreleased candidate

This is a code-owned integration candidate, not a published version. It builds
on the prepared1.40 branch with only the three scoped equipment/batching commits;
ordered1.40 live publication remains pending.
Human pacing/readiness observations remain assigned to player playtesting;
they are not a new code-publication permission requirement. Runtime metadata,
login and cumulative notes identify1.41.0 on this release branch. Do not deploy
it as a replacement for the preceding release before that release is accepted.

## Draft player-facing patch notes

- More fitted gloves, boots, shoulder armor and cloth mantles, with matching
  default class outfits, better curves and visible grips.
- Leg equipment now replaces both thighs and shins and bends at the knee;
  changing pants no longer leaves the previous class's shin armor behind.
- Folded Wizard robes and Cleric vestments with matching trim.
- Rounded Fighter helmet and an open Rogue hood. Rogue facial features and
  hanging hair remain visible when other headwear is equipped.
- Connected necklace chains and pendants positioned clear of raised chest armor.
- Gems and item-effect settings sized and fitted to headwear, chest and limb
  armor, weapons, off-hands and small accessories. Earned gem colors/effects
  are unchanged; blade sockets remain visible on both faces.
- Fixed inward-facing shoulder armor surfaces and stale spell effects in the
  equipment preview. No character stats, saved items or collision sizes changed.
- Production class models now combine compatible rigid parts into fewer draws,
  preserving fitted surfaces, animation pivots, equipment masking and pooling.
  See the [bounded integration comparison](2026-09-29-1-41-rigid-batch-integration.md).

## Verification and limits

The detailed work/evidence record is
[the equipment preflight](2026-09-29-1-41-equipment-polish-preflight.md).
It includes focused geometry/lifecycle tests, all four classes' ordinary and
enhanced local/remote movement galleries, mixed gear, and the final all-family
hardware-Chrome check. Existing human campaign/phone gates are not replaced
by these tests. No long soak was added for this visual work.

### Ordered release integration

Integrated the three scoped art commits onto the clean1.40 candidate without
conflicts. No later world/terrain, attack-contact, audio or HUD commits were
pulled in. The runtime/package/login/CI/default build identities and newest
cumulative patch entry now agree on1.41.0; all historical entries remain.

The existing batching, equipment replication/refresh, loader, version and
Pages-cache suites pass459 checks across six suites in15.273s. Full lint,
shell syntax and whitespace checks pass. A bounded hardware-Chrome integration
review passes the existing Fighter and Cleric local/remote equipped Idle/Run/
Attack cases in23.5s, exercising armored and robed construction after batching.
Inspected Fighter Attack side and Cleric Run front captures at
/tmp/eidolon-1-41-integrated-fit-0930. Reused the recorded four-class High/Low
and equipment-family reviews rather than repeating unchanged galleries.

These captures still show visibly procedural actors. Successful attachment,
rendering and lifecycle checks do not certify final modern-ARPG appearance.
Publication waits for preceding1.40 acceptance. Before any push, fetch current
master and merge any concurrent website work into this clean release branch;
resolve overlaps and verify affected integration seams. Never force-push or
replace the owner's dirty development worktree.

This improves procedural fallback actors and equipment. The user's first
Fighter GLB, source/license information and final authored-art approval remain
outstanding. It does not claim Diablo/PoE production-art parity or whole-game
beta readiness. Publish final version/patch-note entries after the preceding
releases pass their live checks, disclosing the deferred final-art observations.
