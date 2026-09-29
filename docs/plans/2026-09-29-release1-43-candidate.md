# Alpha 1.43 — combat presentation preview

Unreleased partial candidate. Ordered publication and earlier milestone gates
remain open; runtime version metadata is intentionally unchanged.

## Draft patch notes

- Added soft actor contact shadows for phones and Low graphics, grounding
  characters without enabling expensive directional shadows. Contacts follow
  movement and fade during jumps; hidden/stealthed actors remain unrevealed.
  See the [connected route and rendered-floor checks](2026-09-29-low-quality-actor-grounding.md).

- Corrected below-floor death poses for22 more regional enemy and boss models,
  including Constructs, Moonfrost enemies and several dungeon bosses. Attack
  animations, collision bounds and encounter timing remain unchanged. See
  [regional death grounding](2026-09-29-regional-death-grounding.md).

- Enemy corpses hold after their death animation and fade instead of abruptly
  disappearing. Skeletons now fall above the floor rather than sinking below
  it. Loot, combat and server respawn timing are unchanged. See the
  [death-presentation checks](2026-09-29-enemy-death-presentation.md).

- Enemy health bars follow camera/movement smoothly and account for model
  height. Wounded and selected foes remain readable without hover, including
  phone targets and PvP opponents. A brief loss segment clarifies hits and
  honors reduced motion; friendly services do not get enemy bars. See the
  [health feedback checks](2026-09-29-enemy-health-feedback.md).

- Periodic damage and healing use smaller body-level cues instead of additional
  decorative ground rings and large particle bursts. Reduced motion retains
  feedback without particle travel. Actual danger/healing ranges and combat
  values are unchanged. See [verification](2026-09-29-periodic-combat-feedback.md).

- Boss danger circles, their shaded areas and regional motifs now sit above
  dungeon floors instead of being hidden underneath them.
- Fireball, Meteor and Explosive Trap impact areas remain visible on dungeon
  floors, without changing their damage radius.
- Guardian Embrace's healing-range circle and ground-level buff rings are no
  longer buried under dungeon floors. Character and body-aura positions stay put.
- Boss warnings respect the device's reduced-motion preference: decorative
  pulsing/rotation stops while the warning edge, label and countdown remain.

No combat balance, encounter timing, rewards, character saves or network
protocol changes. Camera shake already respects reduced motion and its own
strength setting; this preview does not claim universal motion suppression.

See [combat presentation preflight](2026-09-29-1-43-combat-presentation-preflight.md)
for before/after rendering evidence, focused lifecycle/cast checks and crowded
High/Low warning review. Earlier release gates and public deployment remain
outstanding; no live release or complete 1.43 milestone is claimed.
