# Release54 basic damage parity retains current53/52/47

New release/54-with-final53 in `/tmp/eidolon-release54-final53-oZ3nK4` starts
from retained54/8f7f60a and merges current53/888e4b2 at
b57bdcf32cfcdb8bd74b061ae0e54cc55ebe164f. The sole runtime merge conflict was
competing Actor imports: retain BOTH primary-stat damage and basic-cadence
helpers. Construction/recalculation use both, and dead-only mana refill remains.

The runtime delta from53 remains the existing four-class primary-stat/4 plus
flat-damage client correction. Server combat damage is unchanged. The inactive
save bridge,0.01 regen, new attack cadence, PvP scene, nameplates, exact fragment
budget, equipment filter and every retained patch-note entry are preserved.
54 has its own matching login/package/server/build/deployment version defaults.

Frozen54858 prepare/lint/full client passed236suites/3365tests/148.429s, normal0.
This includes all four actual delayed offline hit callbacks and shared unequal-
stat/equipment fixtures, not only formula snapshots.20097 fullGo passed game
85.032s/database0.021s and all packages, normal0. No source changes during checks.
Logs `/tmp/eidolon-release54-final53-{client,server}.log`.

Local verification is not publication, full balance or phone/visual approval.
Current46/ed5f64a CI and each ordered47–54 CI/live gate still apply.53's new
rendered/town evidence remains due;54 inherits that requirement.55 has carried
this runtime ancestry and must carry later closure documents after its frozen
checks finish. Placeholder ability-intent damage estimates are a separate open
issue; this basic-damage fix does not make those multipliers authoritative.
