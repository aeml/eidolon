# Death resource recovery

Existing `PerformRespawn` and offline `Actor.respawn` restore health only.
The earned Watch run e74a658 recorded death mana18,23,28 across successive
attempts: a normal town respawn did not refill mana. That is distinct from
passive regeneration and from the unanswered optional potion/rest preference.

Death recovery now restores both bars. An authoritative DEAD state or zero
health qualifies; living unstuck requests retain their existing health behavior
and do not refill mana. Recall does not refill either bar. Existing PvP recovery
gates and rejected movement-context requests remain unchanged. Cooldowns,
training, gold and the requested0.01 passive coefficient are not reset or buffed.
Fractional recovery is cleared when the corresponding bar is restored to full.
Offline/predicted respawn uses the same dead-only rule.

Focused client11998 PASS /two suites/eight tests/1.507s; lint PASS. Server62828
race PASS5.108s; expanded37607 PASS2.395s exercises four classes, zero-health
and explicit-dead states, living repeats, recall, rejected contexts, cooldown
preservation and rejected PvP recovery. All these handles are terminal.
Full regression and actual browser death-recovery checks remain required before
release approval. No new version is packaged or deployed by this document.
