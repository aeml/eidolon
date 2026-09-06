# Phone layout design — working specification

Status: proposed September 6, 2026; **not implemented or physically reviewed**.
This is the shared design pass requested by the mobile roadmap, not a replacement
for its release gates. Existing phone menu improvements must be reviewed against
the same composition rather than treated as a finished interface.

## Evidence and design problem

The player reports that useful visibility requires maximum zoom-out, making
characters tiny, while desktop-sized UI is difficult to operate. The local
568×320 populated-HUD capture `/tmp/eidolon-phone-party-controls-568.png` also
shows six persistent menu buttons across the top, a narrow party panel with a
tiny Leave action and only part of one member row visible. It verifies the
previous joystick-overlap correction, not a good overall composition. Its world
is a layout fixture, so it cannot establish actor or telegraph readability.

Treat camera framing and HUD occupancy as one design problem. Reducing render
resolution, browser zoom or text size is not the solution. Camera zoom, readable
menu scale and graphics quality remain independent preferences.

## Exploration and combat compositions

The following are annotated wireframes, not pixel-accurate rendered mockups.
All dimensions refer to CSS pixels after browser chrome and device safe areas.
Sizes below are starting budgets to validate in real encounters, not measured
proof of ergonomics.

### Portrait — begin at 360×800

```text
┌──────────────────────────────────────┐
│ HP / resource               [ Menu ] │  compact status, ≥44px menu
│ Selected objective          [ More ] │  at most two readable lines
│                                      │
│          approaching threat          │
│                                      │
│             YOUR HERO                │  camera's usable encounter region
│                                      │
│                                      │
│                                      │
│ [movement]       [aim / attack / use] │  left/right thumb regions
│                   [1] [2] [3] [4]    │  all equipped skills accessible
│ Chat · unread / tap to write         │  always present, ≥44px entry
└──────────────────────────────────────┘
```

- Replace Bag/Hero/Social/Map/Quests shortcuts with a labeled Menu launcher.
  Secondary actions remain one panel away; do not sacrifice status readability
  to preserve every desktop shortcut. Keep shortcuts optional only if space
  and touch testing support them.
- Budget no more than about 104px for status plus selected objective and about
  208px for controls plus collapsed chat on this baseline. Reserve the intervening
  region for encounter visibility and use it when positioning the camera target.
  Do not fill unused combat space with party rows, notices or expanded journals.
- Keep player-selected quest tracking; More opens the full tracked list without
  changing which quests are tracked. Long names wrap or move into details.
- Show party count/readiness through a reachable launcher or Menu entry, with
  full member actions in a readable panel. Do not retain a tiny Leave button
  beside truncated names. Party-targeted healing still needs deliberate target
  access during combat; prototype it with a Cleric before hiding all member access.

### Short landscape — stress case 568×320

```text
┌──────────────────────────────────────────────┐
│ HP / resource     objective summary [ Menu ] │
│                                              │
│ [left thumb]     HERO + THREATS [right thumb] │
│ [ movement ]     clear center  [attack / use]│
│                                [1][2][3][4] │
│ Chat · unread / tap to write                  │
└──────────────────────────────────────────────┘
```

- Begin with a single roughly 48px top strip and a ≥44px collapsed chat strip.
  Limit objective text to the space left after health/resource and Menu. Its
  full text must remain reachable; clipping mandatory information is not allowed.
- Place thumb controls along the sides of the remaining world region, not across
  its center. Reflow the four skill targets into a 2×2 group if a four-column row
  intrudes on the movement zone. Preserve simultaneous movement/aim input and
  visible cooldowns. No action may require rotating back to portrait.
- Keep party detail, the full quest tracker and secondary navigation collapsed
  by default. Validate party-target selection, boss telegraphs and nearby loot
  before deciding the exact center-width and actor-size budgets.

## One shared menu journey

```text
World → Menu → Bag list → Item details → Equip → authoritative result → Back
World → Ilyra → readable conversation → Accept/Complete → reply → Back to world
World → Party → member / readiness details → explicit action → Back to world
```

Use one foreground panel above the persistent chat entry. Header/Back and primary
actions stay reachable; only the body scrolls. Preserve the previous selection
and scroll position when returning from details. Opening chat dismisses the
foreground panel cleanly, without hidden layers capturing later movement.

Inventory/stash should be two labeled routes in the same surface on phones,
not two overlapping windows. Tap an item to inspect it and choose Store or
Withdraw explicitly. Preserve item-ID checks, quest-item protection, capacity
rejection and authoritative inventory updates. Buying/selling and Forge actions
use the same readable detail/action pattern; irreversible spending needs clear
cost and outcome feedback.

## Prototype and sign-off tasks

- [ ] Render these compositions with real HUD data and actual world actors at
  default zoom, paired with same-encounter before captures. Cover 360×800,
  390×844, 844×390 and the 568×320 stress case without assuming browser zoom-out.
- [ ] Prototype move + cast, Ilyra accept/turn-in, bag inspect/equip, party-targeted
  healing and chat; inspect text, ≥44px separated targets and encounter visibility.
- [ ] Test software keyboard, interrupted gestures, rotation and restoration of
  panel selections/scroll on actual iOS and Android devices. Record named devices
  and builds; desktop touch emulation is layout evidence only.
- [ ] Review the player's ten-minute default-view session in both orientations.
  If normal play still needs maximum zoom-out, adjust composition/framing and
  repeat. A wider camera view with smaller unreadable actors fails the review.

Milestones: camera/HUD/core action operability belongs to **1.1**; the consistent
remaining-menu treatment, left-handed preferences and visual polish to **1.2**;
touch aiming and sustained physical-device combat/performance tuning to **1.3**.
