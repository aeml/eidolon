# Alpha 1.41 character/equipment finish — unreleased candidate

This is a code-owned integration candidate, not a published version. It builds
on the prepared 1.38 branch; 1.39/1.40 pacing/readiness gates and ordered live
publication remain open. Runtime version metadata is intentionally not bumped
on this preview branch. Do not deploy it as a replacement for those releases.

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

## Verification and limits

The detailed work/evidence record is
[the equipment preflight](2026-09-29-1-41-equipment-polish-preflight.md).
It includes focused geometry/lifecycle tests, all four classes' ordinary and
enhanced local/remote movement galleries, mixed gear, and the final all-family
hardware-Chrome check. Existing human campaign/phone gates are not replaced
by these tests. No long soak was added for this visual work.

This improves procedural fallback actors and equipment. The user's first
Fighter GLB, source/license information and final authored-art approval remain
outstanding. It does not claim Diablo/PoE production-art parity or whole-game
beta readiness. Publish final version/patch-note entries only when the ordered
release prerequisites and remaining art acceptance are resolved.
