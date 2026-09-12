# Iron Fortress protection — 1.1 candidate

The current-item armor audit in2026-09-12-party-armor-budget.md reproduced the
native role problem: plate Fighter183 versus Rogue184 damage per30 Warden hit;
40mana Fortress only reduced that to181. Offline instead applied1% damage
reduction per Strength (up to75%), without the server's armor/speed changes.

Standardize Fortress at20% incoming damage reduction, retaining50% armor and
20% movement penalty,40mana/60s base cooldown/30s base duration, existing runes
and saved ranks. The additional reduction covers all incoming damage through
the receiving pipeline, not only physical attacks. Apply it after outgoing
damage/armor and before other receiving reductions and shields. Require an
active flag and a valid future authoritative deadline. Mastery extends only
duration. No equipment migration, boss HP change or passive regeneration change.

Offline now uses the same20% strength-independent reduction, rebuilding armor
and capped movement speed once through the existing stat-recalculation helper.
Rebuild on cast, expiration and cancellation, including equipment changes during
the buff. Replicated actors never get local stat/damage modification. Expiry
moves after periodic damage in Actor.update; per-tick offsets distinguish hits
before/after expiry in a slow frame. Fighter now forwards that offset to Actor's
Phase protection too. Cost fixtures use lawful mana budgets when a cast rebuilds
stats instead of relying on synthetic mana above the actual maximum.

RED client3failed/4passed; server rejected the new mitigation expectations,
including a real paid Warden impact187 instead of149. After implementation,
7client suites338tests pass6.857s, full lint/diff pass. Server focused race
passes3.635s for receiving reductions, deadline boundaries, shields and their
ordering, actual paid current-item impact and all six armor comparisons.
Logs `/tmp/eidolon-fortress-mitigation-{client-red,server-red,client,server,expanded-client,expanded-lint}-20260912.log`.

Updated actual armor audit:30 plate baseline183, paid Fortress144;70 baseline478,
paid Fortress378. These are individual impact measurements, not whole-encounter
survival or balance approval. Full CI, native paid incoming-hit/deadline proof,
four-role dungeon replay, other encounter types and merged regression remain
required before release. Item quantization and tank threat/positioning remain
separate open issues; this change must not conceal failed dungeon evidence.

## Proposed 1.1 patch note

Iron Fortress now consistently reduces incoming damage by20%, alongside its
armor bonus and movement tradeoff. Its protection no longer becomes negligible
against stronger enemies, and offline behavior matches the intended buff.
Existing Mastery ranks, rune choices, costs and durations are retained.
