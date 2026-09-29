# Alpha 1.45 — interface consistency candidate

Unreleased partial work, not a complete1.45 milestone. Earlier release gates
remain in force and runtime/version metadata is unchanged.

## Draft patch notes

- Ground loot has zoom-readable, rarity-accented labels that separate crowded
  drops and leave room around the player. Clicking a label selects that drop
  without shuffling nearby labels; living enemies retain targeting priority.
  Pickup range, capacity and server confirmation are unchanged.
  See [loot presentation checks](2026-09-29-loot-label-presentation.md).

- Desktop storage shows Bag and Stash together, with named items, search,
  category filters, capacity counts and independently scrolling lists.
  Click to inspect or right-click to transfer; refreshed items preserve focus
  and reading position. Phone storage stays unchanged.
  See [stash presentation checks](2026-09-29-desktop-stash-presentation.md).

- Forge lists show item names beside upgrade previews on wide desktops.
  Capped items retain useful stats and clear maximum-reached feedback;
  phone item rows fit wrapped names, and actions use the game styling.
  See [Forge presentation checks](2026-09-29-forge-presentation.md).

- Character sheets show equipment beside build stats on wide desktops, with
  clearer vitals and signed attribute differences. Live stat updates preserve
  upgrade-button focus; phone progression controls are larger. EP/wardrobe
  panels follow the main build. See [character-sheet checks](2026-09-29-character-sheet-presentation.md).

- Journal section buttons separate Story and Contracts without losing your
  tracking choices. Clearer contract cards put ready turn-ins first and use
  readable progress counts. Progress updates preserve the desktop tracker's
  scroll position. See [journal checks](2026-09-29-journal-navigation.md).

- Item set counts and comparisons exclude inactive legacy gear, while keeping
  those items recoverable. Special effects use their display names. Integrated
  UI checks now join the existing hosted CI stage; heavier visual references
  stay opt-in. See [integration evidence](2026-09-29-presentation-ci-integration.md).

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
