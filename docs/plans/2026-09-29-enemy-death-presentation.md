# Enemy death presentation

Continuation after df4d1962 woodland work. Local candidate only; no version bump,
deployment or readiness-gate waiver. Full ordered roadmap remains active.

## Changes

The client previously hid every remote corpse at exactly two seconds, including
enemies whose death clips lasted that long. Server-identified enemies now finish
their clip, hold for 0.3 seconds, and fade over 0.5 seconds. Missing clips use a
bounded fallback; clip duration is bounded to 0.6–4 seconds. Server removal still
takes precedence. Death admission, loot, XP, respawn and combat bounds do not
change. Remote players/NPCs retain their old two-second hide behavior.

The fade uses Three's alpha-hash opacity rather than transparent self-overlap.
Materials are cloned only during the fade, deduplicated within each actor, and
retain their shader hooks. Shared source materials, geometry and textures are
not changed or disposed. Completion, respawn, mesh replacement and actor disposal
restore originals and release temporary materials. Invisible interaction
materials are excluded. No particle burst, camera motion, per-frame random
flicker or additional geometry/textures; reduced-motion users retain the fade.

Browser inspection then exposed a separate Skeleton animation defect: its final
body translation was -0.56m, putting visible vertices about 1.63m below the floor.
Corrected that clip's body-height keys so its existing rotation falls onto the
ground instead of burying the torso. This is an authored Skeleton correction,
not a claim that every boss/enemy death pose has been grounded or reviewed.

## Evidence

- Final 92 corpse, hit-reaction, death/respawn and combat-callout checks pass
  (4.745s). Includes full fall sampling over 61 frames, real authoritative
  respawn synchronization during/after fade, material-array identity and cleanup.
- Final two existing combat-health browser cases pass (17.7s). They now exercise
  the production corpse updater with the actual Skeleton clip at desktop and
  phone widths. Prepared death, not an earned live-server kill. Inspected final
  images at `/tmp/eidolon-corpse-grounded-0929`.
- First tests caught zero-opacity interaction proxies in the clone set and a
  fixture expecting an uninitialized property rather than the lifecycle's null.
  Excluded invisible materials and corrected that assertion. The first passing
  render then revealed the buried Skeleton; final tests/images include its fix.
- Scoped ESLint/whitespace pass. Existing hosted interface cases expanded;
  no new test case, runner job, soak or full campaign run.

Still open: broader class/encounter feel, other enemy death poses, dense-party
visual/performance acceptance and final art. No sustained frame-rate claim.
