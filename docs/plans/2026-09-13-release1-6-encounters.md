# Alpha 1.6.0 — dungeons and raids worth repeating

Develop separately from the frozen1.5 release9c61d0d5. Runtime stays1.5 until
this milestone is packaged. The full1.1–1.10 goal remains active.

## Scope

- Improve existing dungeon/raid encounter identity, readable mechanics and pacing.
  Preserve attackable bosses, ability admission, generated walkable layout and
  exit/reconnect foundations already delivered; do not treat this milestone as
  permission to postpone broken basics.
- Differentiate all four crystal-defense events with realm-specific gameplay and
  understandable group jobs, not just different colours or names. Preserve full
  raid clear requirements, repair NPC/event state, waves and earned quest receipts.
- Improve party preparation, wipe recovery and lockout explanations so groups can
  understand what remains, retry safely and avoid losing earned progress.
- Preserve the full four-dungeon → four-raid/crystal repair → resonance portal →
  Dark King campaign and the four Eidolons' role in his phases.
- Use four appropriately prepared characters for relevant group checks: Fighter
  tank with Strong gear, Agile Rogue and Brilliant Wizard damage, Wise Cleric
  healing; at least Uncommon/Rare equipment. Do not add level-based stat scaling
  or compensate for a broken encounter with fabricated kills/clear receipts.
- Package, publish and verify1.6 with patch notes and synchronized login version.

## Verification timing

Follow the user's feature-first direction: targeted changed-encounter/group checks,
relevant build and release smoke. Full earned campaign/raid group progression and
cross-device/endurance matrices remain required for consolidated final stabilization
after all features are added; do not claim those complete from unit checks or a
prepared fixture. Reuse unchanged passing evidence and do not start another soak.

## First action

Read the active mechanics in `server/internal/game/crystal_repair.go`,
`elemental_raids.go`, `raid_phases.go` and `crystal_sanctum_snapshot.go` before
editing. Their current implementations, not stale planning claims, determine what
needs improving. Review corresponding client presentation and recovery state paths
as needed. No1.6 runtime implementation exists at this checkpoint.
