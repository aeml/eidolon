# Moving enemy health feedback — combat presentation candidate

Local continuation after0616316c. No release identity, deployment, balance
change or final combat/art acceptance.

## Demonstrated gap and implementation

The runtime previously refreshed overhead bars only when hover/Alt/HP changed.
It never reprojected them as the camera or actors moved, and every model used
a fixed2.5-unit logical-position anchor. PvP players were excluded from the
refresh signature, despite the old UI method admitting hostile players.

Health membership/value reconciliation stays separate from render projection.
The production render loop now projects the bounded bar set every frame using
the actual interpolated mesh transform and declared model height. Elite scale,
camera motion and visual corrections no longer detach the bar from the body.
Off-screen records can reappear without needing another health change.

Wounded or selected hostile actors keep a bar without hover/Alt. Full-health
unselected actors stay quiet unless revealed with Alt. The existing hostility
predicate excludes services/friendlies and admits actual PvP opponents; phone
combat selection participates in the update signature. Selected/hovered actors
take priority within24 desktop /12 phone visible bars. Off-screen/invalid/dead
actors do not retain visible bars. These are display limits, not target limits.

Bars use the dark HUD palette, a clear selected border and an immediate red HP
fill. A short amber loss segment holds140ms and eases away over320ms; healing
snaps to the new value. Reduced motion disables that trailing animation.
Values remain authoritative/local combat state; this never predicts damage.
Pooled elements reset target/value/selection presentation on reuse, and scene
signature resets and engine destruction clear the owned DOM/state.

## Verification

-34 focused tests passed3.437s: actual runtime HUD cadence/hostility, model and
  camera movement, quality-independent health state, off-screen return, dead
  and invalid values, bounded pooling/priority, reduced motion, existing
  nameplate layout and death/respawn behavior. Initial21 checks passed1.926s.
- Two real renderer/UI desktop High and phone Low cases passed15.3s. They use
  the production GameEngine render method with prepared actors/state, not a
  connected fight or earned damage. Both move the enemy and camera without a
  health reconciliation, checking projected alignment within0.1px, then check
  unhovered damage, reduced motion, friendly exclusion, death and full cleanup.
- Initial browser cases failed only on an incorrect expectation that a hidden
  pooled DOM node was deleted. Corrected to require hidden state plus removal
  from the active map; final cleanup still requires all bar nodes removed.
- Desktop/phone captures inspected at `/tmp/eidolon-enemy-health-final-0929`;
  sparse scenery and fallback actor quality remain unresolved by this change.
- Scoped lint and whitespace checks passed. The two cases join the existing
  hosted interface job. Required browser partition discovery verifies208 cases
  with no omissions/duplicates; this does not claim208 executions.

No new polling, timer, asynchronous effect loop, runner queue, campaign soak,
attack cooldown, movement speed, hit delay, damage coefficient or reward change.
Further connected encounter/art review and earlier publication gates stay open.
