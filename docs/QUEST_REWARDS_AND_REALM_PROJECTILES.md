# Quest rewards and realm projectiles

September 5, 2026. Included in the Alpha 1.0.2 candidate's in-game patch notes.
Deployment evidence is recorded separately in the
[roadmap execution ledger](plans/2026-09-05-roadmap-execution.md).

## Rewards

Story and daily quests pay gold and their existing XP reward only after a valid,
explicit turn-in. Existing progression converts XP into Resonance XP at level
100, including overflow when a turn-in reaches the cap. No new currency is added.

Initial gold tuning is `clamp(floor(rewardXP / 500), 100, 50000)`: a starter
floor of 100 gold, with the ceiling matching the existing weekly raid payout.
This is initial tuning, not an economy-balance benchmark. Gold sources are
recorded as `quest_rewards` in economy telemetry.

Canonical reward definitions refresh existing saved quests without changing
accepted/completed progress or paying retroactive gold. Exact granted gold,
leveling XP, and Resonance XP are persisted and sent through JSON/protobuf so
completion dialogue can report the actual split, even across level/rank changes.
Quest offers, the Journal, ready tracker entries, and dungeon daily listings
show level-appropriate rewards.

## Projectile fix

Overworld projectile cleanup still used X bounds of -1000 through 1000, excluding
Fire and Air. It now allows the full -3000 through 3000 span. Z bounds, lifetime,
damage rules, and the exemption for instanced dungeons/raids are unchanged.

Server regression tests cast Fireball and Piercing Throw against enemies in all
four realms, including both entrances and far reaches of Fire/Air. They check
first-tick survival and actual damage, plus outer-bound cleanup and instance
exemption. These are server simulations, not a live Air Realm playthrough.

Reward tests cover daily/story manual payout, duplicate protection, level 100,
level-99 overflow, Resonance rank crossings, saved-progress reconciliation,
persistence snapshots, and protobuf serialization/normalization. Client tests
cover exact receipts and level-dependent labels. The quest presentation browser
fixture checks max-level gold/Resonance text, simulated acknowledgement, and
27 objectives at desktop and phone sizes; it does not claim a live payout.

## Repeatable validation

```sh
npm test -- --runInBand
npm run lint
# From server/:
go test -race ./...
# From repository root:
EIDOLON_E2E_WEB_PORT=4473 npx playwright test tests/e2e/quest-town-polish.spec.js --grep 'Ilyra dialogue'
```
