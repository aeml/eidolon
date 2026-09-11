# Offline Divine Intervention

Unpublished follow-up based on full verified primary3c1085b8. Work is isolated
from the frozen four-role dungeon run; no server/protocol/saved-schema changes.

## Reproduction and repair

Fifteen actual paid offline casts reproduced failures in2.208s: missing initial
half-max-health heal and Mastery benefit, enemy/out-of-range/remote/dead/wall
selection, missing Miracle/Guardian effects, and overwritten trained/rune/set
cooldowns. Evidence `/tmp/eidolon-offline-divine-red.log`.

The spell now resolves an eligible friendly direct target before presentation,
falling back to self, using the same helper as Healing Light. Locked offline
Divine casts are rejected. Recipient eligibility also excludes actors whose
engine owns authoritative multiplayer health.

Initial healing uses recipient half-max HP, caster healing equipment/training,
poison and missing-health limits. Miracle adds the nearest distinct eligible
friendly recipient, including the caster as on the server. Guardian applies
50% damage reduction for its independently trained5s window; normal rescue
retains its trained10s window. Both timers continue under stun. Rescue remains
single-use with integer30% HP and minimum1. Canonical cooldown training composes
with Quick Save's half cooldown and the existing set's60s base.

Multiplayer/remote casts do not apply these local benefits. Actor.takeDamage
also rejects engine-authoritative recipients, preserving health snapshots even
when a former offline protection timer remains. No new local authority is added.

## Focused verification

- Initial15paid cases PASS1.135s.
- Expanded8suites/243tests PASS7.169s; final same243tests PASS6.107s.
  Includes all three runes, Mastery/healing equipment, poison/clamp, trained/
  equipment/rune cooldown combinations, invalid targeting, unpaid/rejected
  casts, authoritative guards, Guardian expiry during stun, lethal rescue then
  lethal second hit, Miracle self-cast/nearest distinct ally, previous Cleric
  duration/areas/support expiry, shield and respawn regressions.
- Logs `/tmp/eidolon-offline-divine-{green,broad,final}.log` and
  `/tmp/eidolon-offline-divine-lint-final.log`. Full client regression is still
  required after the ongoing native party route releases the heavy-test slot.
  Prepared set metadata is a consumer fixture, not proof of acquiring/equipping
  the set or preserving its saved state through a native login.

Keep this branch separate until full acceptance. Do not alter primary during
the four-player dungeon test or launch a competing full/browser suite. Native
class/build/save/160talent parity, earned pacing, physical phones and later
roadmap/casino scope remain open. The soak stays off.

## Unreleased patch-note draft

Offline Divine Intervention now heals its target, respects friendly range and
walls, and supports Quick Save, Guardian Angel and Miracle. Healing and cooldown
training apply correctly; Guardian protection expires independently of the
one-use death rescue. Multiplayer health remains server-controlled.
