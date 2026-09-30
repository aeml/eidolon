# Alpha 1.54 duel and combat presentation work

September 30, 2026. Preparation only. This worktree starts from pushed 1.53
source and still reports Alpha 1.53.0. No 1.54 implementation or live acceptance
is claimed. Require exact predecessor acceptance before deploying this milestone.

The roadmap scope is opt-in duels/open-world PvP, safe-zone protection,
surrender/defeat and readable combat without unintended PvE loss or griefing.
The existing handlers already support challenges, explicit responses, PvP flags
and forfeits; retain the authoritative scene and durable arena-result paths.

Inspect challenge identity/expiry, blocking at response, replacement prompts,
same-area eligibility and safe-zone transitions through direct and periodic
damage. Confirm surrender/defeat clears combat state and restores the proper
world/resources without consuming PvE progress or granting repeated rewards.
Change demonstrated gaps rather than duplicating matchmaking or replaying
unchanged raid/dungeon campaigns.

The newly delivered [Fighter pilot](../art/2026-09-30-fighter-pilot.md) reopens the
authored-character integration work alongside combat readability. Its runtime,
generated-equipment fit and visual/performance acceptance are implementation
work, not a claim that the source upload replaced the live procedural hero.

Use focused game/handler negatives and a representative ordinary connected
duel/surrender flow, plus rendered current-prompt/readability checks. Package
1.54 metadata and cumulative notes after integration; fetch/merge remote changes
immediately before a normal push. Luna monitors deployment, root independently
accepts exact public identity and changed assets. Preserve accounts, open-alpha
access and the user's existing PvP/economy policies.
