# Desktop action-label width proof

This closes the pending local rendered comparison for primary9b168be, not the
whole combat-readability, party, raid or phone gate. Excluded from recovery58.

The controlled baseline dispatches the exact GameEngine source from2505b369,
using the actual current text renderer and Cleric. At1280x720 and1920x1080 the
long player-name + Divine Intervention label measured614.074px wide. Both
baseline cases failed the216px bound as expected; screenshots were viewed.
Run46843 failed2/2, log `/tmp/eidolon-desktop-action-baseline.log`, full archive
`/tmp/eidolon-desktop-action-baseline-proof-7eDYEr` (scanner0).

Current primary479f302 passed both cases in7.1s, run95533. The compact source
line truncates visually, the full action wraps, and the complete name/action
remains in the accessible label. Assertions preserve16px minimum type, viewport
containment, pointer transparency and cleanup. Viewed both fixed screenshots;
the label no longer spans most of the central encounter. These are anonymous
rendered fixtures on the real renderer, not a live multiplayer encounter.

Log `/tmp/eidolon-desktop-action-fixed.log`; full archive
`/tmp/eidolon-desktop-action-fixed-proof-dvLaWX` (scanner0). Port41960 is closed
after browser termination. Added the fixed cases to the unpublished successor's
existing combat-card CI command. Full integrated regression42881 oncb80d65
passed276suites3942tests129.103s and lint; logs
`/tmp/eidolon-primary-visual-story-full-{client,lint}.log`. No production claim.
