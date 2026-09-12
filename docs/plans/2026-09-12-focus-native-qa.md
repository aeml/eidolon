# Focus native verification — staged, not yet executed

The new `focus-mastery` isolated route prepares only its allowlisted Wizard
and observing Fighter. It joins the full timed QA chain immediately after
Time Warp, retaining every previous command and the short-circuit behavior.
There is no blanket test retry against a partially saved character.

The authored System Chrome test covers:

- Normal phone branch selection and five paid WIZ_15 purchases. Rejections
  must preserve rank/points and release controls before a deliberate new tap.
- Untrained2.5 High and trained3.0 Low charge state, actual attached effect
  geometry on both clients, the owner's displayed bonus and natural expiry.
- A new desktop context loading the saved five ranks; trained Focus followed
  by a real hovered Scorch Beam against an existing overworld enemy.
- Exact integer damage (or its ordinary critical double), identical on both
  clients; charge removal and a subsequent unboosted spell against a real enemy.
- Failure screenshots/receipts, browser failures and normal disposable cleanup.

`/level100`, `/qa-animation-ready` and the existing encounter waypoint are
bounded functional preparation, not proof of earned progression or balance.
The test never grants talent ranks, creates targets, injects attacks, forces
hits or changes the server's damage/resource rules. Its native result is still
unknown: do not count discovery or the shell-contract tests as gameplay proof.

Initial code b7b1af86; candidate7dc65ab9 also includes the unchanged timed-effect
factory extraction fromedf6acaa. Final41026 passed full lint and5focused suites/
85tests in1.517s. Earlier87872 passed2route suites/60tests and discovered the
single native case. No local native run has started on this candidate.

Separately, the combined Focus/protection full client run7823 on e5a3c2a6 found
one architecture-budget failure: GameEngine2515lines exceeded2500. The other
5201tests passed. Extracting `createTimedRemoteEffectConfig` into
`src/core/TimedRemoteEffectConfig.js` preserved its implementation and the
budget; focused14545 passed3suites/25tests. Full rerun31631 is on frozenedf6acaa
in `/tmp/eidolon-focus-mastery-20260911`, not this native-route successor.

Do not run competing native/full jobs during the self-hosted release gate.
Alpha1.0.63 publication is separately running CI34660899212 onf866df68. This
later development work is not included in63. Full integration, native/earned/
balance acceptance and an explicitly versioned release remain due. Soak stays
cancelled and the overall1.1–1.10 roadmap remains open.
