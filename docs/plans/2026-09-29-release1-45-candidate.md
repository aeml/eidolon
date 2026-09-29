# Alpha 1.45 — interface consistency candidate

Unreleased partial work, not a complete1.45 milestone. Earlier release gates
remain in force and runtime/version metadata is unchanged.

## Draft patch notes

- Town minimap names avoid one another and service icons, prioritizing ready
  quests and nearby services. All service icons stay in place; phone radar
  retains icons without tiny labels. A stronger backdrop improves contrast.
  See [map readability checks](2026-09-29-minimap-service-labels.md).

- Desktop right-click inspection adds a scrollable item panel, aligned stats
  and side-by-side comparison; keyboard users can use Shift+F10 on a bag slot.
  Existing equip/sell/stash shortcuts remain. Open item details refresh
  upgrades without losing reading position or focus. Phone stat rows share
  the clearer layout. See [inspection checks](2026-09-29-desktop-item-inspection.md).

- Wide-screen desktop combat HUD groups health, mana, the primary ability and
  four numbered skill slots in a compact central dock. Existing bindings,
  cooldowns and gameplay remain unchanged.
- The primary icon identifies its right-mouse binding; HP/MP labels and numerical
  values remain visible together.
- Desktop chat stays available and resizable without covering the dock; menu
  buttons wrap beside it. Phone and narrow desktop layouts remain unchanged.

See [connected desktop review and checks](2026-09-29-desktop-combat-dock.md).

Remaining1.45 scope: comprehensive journal/tracking, inventory/stash, forge,
trading, character/build sheets, menus/tooltips/notifications and loading,
empty, failure/success, focus, Escape and interaction-priority review.
These checks do not certify those areas or final visual quality.
