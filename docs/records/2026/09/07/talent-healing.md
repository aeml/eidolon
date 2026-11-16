# Alpha 1.0.31 candidate — mercy in every pulse

Developed in a separate worktree while the unchanged 1.0.30 earned-dungeon
measurement runs. Not merged, published or verified live. Publication must
follow each preceding release's complete CI and live-identity gate.

## Reproduced behavior and scoped correction

Paired actual casts reproduce missing bonuses in Healing Light and Divine
Intervention. Real entity updates reproduce the missing Guardian Embrace,
Consecrated Ground and Spirit Guardians set-heal bonuses. Rank-zero baselines
and unrelated talents preserve their old amounts. The first failing log is
`/tmp/eidolon-1-0-31-healing-before.log`.

| Working healing talent | Per-rank bonus | Scope |
|---|---|---|
| Healing Light Mastery (`CLR_03`) | 4% | Initial heal, Beacon, Mass Revival and cast-time Renewal snapshot |
| Guardian Embrace Mastery (`CLR_05`) | 4% | Self and friendly-ally ticks |
| Divine Intervention Mastery (`CLR_09`) | 4% | Actual initial healing |
| Mercy Routine (`CLR_29`) | 3% | Existing direct/periodic spell heals |
| Mercy Doctrine (`CLR_39`) | 2% | Existing direct/periodic spell heals; not Wisdom |

The server adds applicable talent healing percentages, then applies them to the
existing equipment-adjusted integer amount. Receiving-target modifiers and
overheal clamps remain afterwards. Healing Light at 10 Wisdom and 20% equipment
healing changes from 72 to 86 HP with five Mastery ranks; combined generic ranks
produce 104 HP. Poison reduces the ranked heal to 43, and a target missing only
20 HP produces a 20-HP event, not the uncapped spell amount.

Renewal snapshots the already-modified initial amount. Five 19-HP ticks remain
19 HP each after a simulated equipment/talent change, without reapplying bonuses.
Other existing periodic heals take a fresh, locked caster snapshot for each tick.
The zone regression exercises concurrent rank updates under the race detector.
This does not add bonuses to passive regeneration or damage-based lifesteal.

The actual Spirit Guardians set-heal test also reproduced healing a flagged PvP
opponent. The heal now excludes hostile relationships and rechecks the target's
living state and instance. Neutral/friendly healing and the required set bonus
remain; no healing is added to the base skill without that set effect.

## Copy and remaining work

A shared Go/JavaScript contract covers the five healing entries above. Their
descriptions identify the working healing bonus. Mercy Doctrine's old Wisdom
claim was incorrect. Its additional server-defined duration field is still an
open consumer and is not advertised as a working benefit in this candidate.
Purifying Wave Mastery's healing field still has no actual heal to modify;
it requires a separate design/implementation decision. Duration, range, area,
crit, other mastery effects and the broader 160-talent audit remain open.

Focused post-fix actual-cast/tick checks pass, including Beacon, an actual
Divine Intervention → Healing Light combo, Renewal, receiving modifiers and
PvP eligibility. Expanded focused race checks pass. Full Go race checks pass
(game package 200.325 seconds; final versioned rerun cached, root 14.702 seconds).
Final Node 24 client checks pass **177 suites / 2,479 tests in 105.395 seconds**;
lint, shell syntax and diff whitespace checks pass. Logs use
`/tmp/eidolon-1-0-31-{server-final,client-final,lint-final}.log`.

The real-server phone route **passed in 12.2 seconds** (10.8-second test body),
session `59535` closed, log `/tmp/eidolon-1-0-31-healing-browser.log`. Ordinary
touch branch selection, five rank purchases and hotbar casts observed exact
server healing **387 → 464 HP**, a 25-mana charge and visible matching floating
text. The ranked heal survived fresh login and landscape rotation. Portrait and
landscape screenshots were visually inspected: the heal number and touch controls
are visible. The portrait level-grant notification is fixture UI, not a claim of
unobstructed human onboarding. Browser errors were empty, credential scanning and
exact disposable cleanup passed. This uses an explicit level-100/low-health QA
fixture, **not earned progression or a physical-phone playability sign-off**.

The separate open-consumer audit still fails its three remaining actual-cast
probes: shield duration stays 20 instead of 25 seconds, a ranked 17-meter cast is
rejected and a ranked 10.2-meter cleanse misses the ally. Log
`/tmp/eidolon-1-0-31-open-consumer-audit.log`; no green all-talents claim is made.
Release publication and live verification remain pending behind 1.0.26–1.0.30.
No production character has been changed by this work.
