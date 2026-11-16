# Deliberate desktop item inspection

Local candidate following53f6f748. Not deployed or complete1.45 acceptance.

## Player-visible changes

- Right-click bag items or equipped gear to open a readable, scrollable item
  panel. Focused bag slots also support Shift+F10/the context-menu key.
- Reuses the phone's identity-checked action route rather than introducing a
  second equipment mutation path. Left-click equip, merchant right-click sell,
  stash right-click deposit and stash withdrawal remain unchanged.
- Desktop gets a centered rarity-accented panel, larger icon, aligned stat
  labels/values and side-by-side comparison. Phones retain their touch layout
  with the same clearer stat rows. Long details scroll while actions remain
  available; Escape closes only inspection and restores the originating focus.
- Open details now refresh same-ID item upgrades, changed equipped comparison
  and level/context changes. Unrelated updates don't rebuild the panel. Reading
  position/focus remain; changed data invalidates an old drop confirmation.
  Removed/replaced identities still disable actions and ask for reselection.

Item/server values, comparison arithmetic, protections and ownership unchanged.
No claim of a speculative DPS score, new item art or complete inventory redesign.
The internal phone-item identifiers remain shared intentionally.

## Verification

- Initial42 inventory/sort/stash/equipment/inspection checks passed36.486s.
  Final27 deliberate-action/stash/inspection checks passed32.736s after adding
  open-panel refresh. Includes preserved shortcuts, no action on inspection,
  explicit equip routing, stale identity rejection and same-ID value refresh.
- Initial five browser cases passed46.2s: desktop1440×900/1024×600 and
  phone360×800/390×844/844×390. Final strengthened desktop pair passed19.0s,
  including live same-ID value/comparison refresh and retained keyboard focus.
- Actual UI/InputManager, icons, modal focus, scrolling, viewport bounds and
  Escape/chat retention are covered with seeded display data. This is not
  an earned loot/equip transaction or authenticated server test.
- Desktop comparison and phone390 captures inspected. Scoped lint/diff pass.

Artifacts: /tmp/eidolon-item-inspection-0929 and
/tmp/eidolon-item-inspection-final-0929. Phone captures:
 /tmp/eidolon-phone-item-360.png, -390.png and -844.png.
No long soak, production data change, version bump or release-gate bypass.
