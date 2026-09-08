# Release45 prepared Wizard diagnostic

Base45b4b831a85c96992cd396344610cd1fb9175fd6 failed CI34192659636 in the
predeploy character gate; deployments were skipped. Fresh public client manifest
still identifies Alpha1.0.44 /847d454a94a7424ab303f6339c875ab170bff36e.
Do not retry unchanged CI or publish46 before resolving45's gate.

The ordinary Verdant fixture selects Fighter skills/runes but never prepares
Wizard talents or runes. Its level100 Wizard reached Rootbound Warden15000HP with
391mana, then stalled at9074HP by the existing120s limit. Retry started with
809mana and ended at5462HP. Both observed real damage. The1205mana logged at
the earlier Skeleton was current mana, not maximum; the log had no maximum-mana
field. This is not evidence that all builds cannot clear the dungeon.

Candidate preparation spends only existing talent points on Fireball Mastery
(up to five ranks), and selects the existing Empowered rune if level-unlocked,
using ordinary UI clicks with server acknowledgements. It neither selects unused
specializations nor injects resources, equipment, damage, ranks or another level.
There is no added reconnect or mana refill. Fighter preparation and encounter
deadlines, stall watchdogs, survival assertions and spawn progression remain intact.
This is an experiment to repair prepared functional coverage, not a fresh-character
balance pass. The separate uninterrupted candidate still dies at the diary site.

New actual-dispatch server test4500 passes with passive-regeneration race tests
(3.063s). Canonical level100 Wizard has1685max mana: untrained Fireball emits
258raw damage for30mana/1s effective cooldown; rank5 plus Empowered emits618
for the same30mana but2.5s cooldown. Basic damage29, both0.01 regeneration
coefficients and point budget remain unchanged. Theoretical full-bar raw output
14448 versus34608 is not actual kill/encounter evidence (misses, travel, prior
spending and enemy interaction still matter). Empty-to-one-cast passive wait is
27.52s at109Wisdom. Existing preparation-policy15 tests and helper lint20741 pass.
An actual browser run on this frozen candidate is required before integration.
