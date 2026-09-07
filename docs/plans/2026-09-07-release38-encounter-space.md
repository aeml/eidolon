# Alpha 1.0.38 — room for the adventure

Candidate after the preserved 1.0.37 source `47a565b0ec4d38ef9149b1a7055cf056ccfe3802`.
Not published; retain sequential release gates and do not push over a predecessor's
live verification.

Includes [Spirit Guardians/Boost](2026-09-07-spirit-area.md), checkpoint
`b8a761ee46ce6e91ed171aac351508ea6f072180`, and the subsequent
[phone encounter-space repairs](2026-09-07-phone-encounter-space.md).
Package/lockfile, login label, release manifest, Go/Docker/Compose/deploy defaults,
isolated QA build version and version-presentation checks all advance to 1.0.38.
A distinct entry precedes the preserved 1.0.37 notes.

## Verification

- Final functional phone-layout checks pass **7 tests in 1.5 minutes**,
  `/tmp/eidolon-phone-composition-layout-verified.log`, including 360/390 portrait,
  844×390 and 568×320 landscape, quest reading/manual actions/tracking, party-control
  access, chat and the existing production-model camera fixture. Inspecting the
  final short-landscape tracker confirms separation from health and readable
  two-line text. These are layout fixtures, not physical-phone play evidence.
- Final focused callout/quest/cleanup checks pass **80 tests / 5 suites in 3.216s**.
- Candidate full server race checks pass root **22.582s**, game cached from the
  unchanged Spirit implementation's **367.003s** full race pass. Log:
  `/tmp/eidolon-release38-full-server.log`.
- Candidate lint, shell syntax and whitespace checks pass.
- Isolated Spirit/phone gameplay passes **1.3 minutes**,
  `/tmp/eidolon-release38-gameplay.log`: normal talent/rune choices, base/Boost
  casts, the compact journal entry, level-notice expiry, late observer/expiry and
  fresh-login persistence. Browser-error and credential guards pass; temporary
  containers/data are cleaned up. Normal and Boost screenshots are inspected.
- The first candidate full client run passes **2,891 tests** but fails one
  version-alignment check in **152.881s**: the two CI workflow defaults were
  still 1.0.37. Both are corrected to 1.0.38.
  Retained log `/tmp/eidolon-release38-full-client.log`. This is a packaging
  correction, with no further game/browser runtime changes.
- The corrected full client suite passes **195 suites / 2,892 tests in 142.066s**,
  `/tmp/eidolon-release38-full-client-final.log`. All local verification processes
  are terminal and successful after the retained correction. Whitespace and
  predecessor ancestry checks pass; publication remains queued behind 1.0.32–37.

## Limits and next work

No claim of complete talent/offline/PvP parity, earned campaign progression,
physical-phone ergonomics or the full 1.1 gate. Next phone work should establish
the shared usable encounter region and camera composition, with populated real
encounters, rather than merely shrinking more HUD elements. Remote nameplate and
party-target readability remain part of that review. The retained diagnostic
overlay still exposes three unrepaired Cleric area consumers.
