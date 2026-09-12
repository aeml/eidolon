# Alpha 1.0.65 — Wizard training and readable protection

Status: scoped candidate on its nonproduction branch, not deployed. Based on release64
`6d5e82cb`, now fully accepted by production CI34668112188 and matching public
frontend/backend health checks. Scoped native training checks on65 passed below;
normal production predeploy, deployment and final live acceptance remain required.
The full1.1–1.10 roadmap remains open.

## Scope

- Spell Focus Mastery stores the trained multiplier for the next damage spell,
  preserves it through utility casts, and replicates the actual charge bonus.
- Time Warp Mastery extends support duration; area, duration training and set
  behavior remain compatible. Updated native training route reinstalls its
  read-only observer after a genuinely fresh login.
- Teleport Warp consumes trained damage/area, canonical dungeon geometry and
  departure/arrival visuals. Offline Teleport gains canonical landing height,
  Phase impact immunity and Temporal Weave's paid recharge behavior.
- Temporary protection has authoritative duration, a readable Protected entry
  and an orbital effect without a solid shell; expiration/death/respawn clear it.
- Offline Wizard damage consumers agree with their corresponding Mastery and
  server base profiles, with one captured Focus budget per damage spell.

The imported runtime originates from a0315eb4, b1c9e8fc,9842ebe3,f15e445a,
ae938843,3b23c231,e5a3c2a6,edf6acaa,3a003536 andaa1ba963. Imported tests add
the two-client paid Focus route (b7b1af86/ef70be8b) and corrected Time Warp
observer (482f9c24). The existing full native gate gains Focus without dropping
any prior stage. Development-only stage-timing infrastructure and its dependent
test were not imported; original release64 command ordering is preserved with
Focus added immediately after Time Warp.

This candidate does not import the expanded Chronicle, reward curve, Dark King
phase cap, offline armor-melt repair, Shattering Charge/knockback changes, or
the prepared four-player dungeon driver. Those remain required development work.
Quest rewards/manual turn-ins/town recovery/Well Rested and .01 outside regen
remain unchanged. No full dungeon clear or balance acceptance is implied.

## Integration evidence

The release63 Actor loop already expires haste and Focus before its stun early
return. Resolving incoming context retained those timers once, not duplicated.
Initial imported Phase/recharge/protection tests exposed another dependency:
their new timers sat below that early return. RED:3suites,4failed/48passed,
1.306s (`/tmp/eidolon-release65-timer-integration-red-20260912.log`).

Commit97a7a3fd moves only these new clocks/protection cleanup to the existing
pre-stun expiry section, after periodic damage accounts for the original Phase
window. Ten focused client suites then PASS316tests/3.058s, including real
offline HP, periodic-boundary, rune/set, trained damage, serialization and
visual-expiry checks. Log `/tmp/eidolon-release65-client-focused-20260912.log`.

Focused Go race across packages PASS: server1.490s/game13.564s, covering
Teleport, Focus, Time Warp Mastery, Wizard damage contracts, protection and
paid hostile receiving defenses. Other packages compiled; those reporting no
tests are not broad acceptance. Log
`/tmp/eidolon-release65-server-focused-20260912.log`.

Release contract pass initially failed one old exact adjacency assertion because
Focus now sits between Time Warp and generic duration. Updated that assertion
to require the expanded sequence, retaining every command. Full client regression
then PASS296suites/4339tests,122.625s; full lint PASS. Logs
`/tmp/eidolon-release65-client-full-20260912.log` and
`/tmp/eidolon-release65-lint-20260912.log`. Shell syntax and diff whitespace
checks also pass. This is local integration evidence, not browser acceptance.

## Release identity and remaining gates

Login, package/lockfile, manifest, server/container/deploy and CI/QAs agree on
Alpha1.0.65. Added a full player-facing patch-note entry before64 and retained
the entire older history. Imported investigation records explicitly distinguish
their original branch evidence from this candidate.

Still required: full server regression and hosted browser checks;
native training plus dedicated Teleport/protection observations on this scope;
normal complete predeploy, input, deployment and final live gates. Keep local
native hardware free while64 needs it. Do not weaken gates or infer broader
earned progression/all-talents correctness from the narrow tests above.

## Hosted rehearsal queue correction

Committed8139ab6d and pushed only`work/release65-wizard-training`. Manual
CI34668784144 remained pending with no jobs because the workflow used the same
global`pages` concurrency group for hosted rehearsals and production. This is
distinct from runner labels: splitting native/soak runners alone cannot remove
that workflow-level wait. GitHub documents that a shared group admits one active
run and, by default, one pending run, so unrelated rehearsals could also replace
a pending production release.

Changed only the grouping: master/main **pushes** still use`pages`; other events
use a workflow/ref-specific`ci-checks`group. Kept`cancel-in-progress:false`, every
production-only job guard and post-deploy dependencies. No native, deploy or
soak stage is enabled for a manual branch rehearsal. Source:
[GitHub concurrency documentation](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency).

Regression RED1failed/3passed0.586s with the original group; GREEN4suites/
263tests1.385s plus changed-file lint. Logs
`/tmp/eidolon-release65-queue-{red,green,lint}-20260912.log`. Only the never-started
own candidate rehearsal34668784144 was canceled for replacement on the corrected
workflow; production34668112188 was left untouched. New hosted source/run and
its terminal evidence must still be recorded before acceptance.

### Hosted65 acceptance and subsequent integration

Corrected rehearsal **CI34668886679 TERMINAL SUCCESS**, source9ab5b644.
Client296suites/4340tests104.525s plus full lint/audit/benchmark; server coverage
game74.909s/85.5%, full race game224.979s and backup/restore/bench/build PASS.
Hosted browser shards1/2/3 PASS39/40/25cases=104. The production/native jobs were
intentionally skipped by unchanged event/branch guards, not passed.

Retained full logs`/tmp/eidolon-release65-hosted-{client,server,browser1,browser2,
browser3}-34668886679.log`; browser artifacts
`/tmp/eidolon-release65-hosted-shard1-OxJYej`,
`/tmp/eidolon-release65-hosted-shard2-S2vbUM`, and
`/tmp/eidolon-release65-hosted-shard3-nfCykY`. Inspection of the mocked Rogue
respawn capture shows no persistent white interaction cube. A390px status-panel
capture exposed background text faintly showing through its translucent surface.
These fixtures are not live gameplay, physical-phone or four-party acceptance.

After that run completed, fast-forwarded the candidate to1f5fe935: adds the
[two-client native Teleport/Phase route](2026-09-12-teleport-native-qa.md) and
[opaque phone reading surface](2026-09-12-phone-status-surface.md), with its
release-note entry and regressions. The new native route is wired into full QA
without removing prior commands but has NOT yet been executed natively.
Only CSS runtime changes after9ab5b644; server/gameplay runtime is identical.
Another hosted regression on the combined source remains required. Do not
attribute the successful9ab5b644 run to these later additions or claim65 live.

### Combined gate-order correction

Combined rehearsal34669744904 at0f9c19c9 failed two client contracts:
StandaloneWellRestedGate and ForgeSocketReleaseGate require the original
recovery/forge suffix. Appending Teleport after forge broke that contract.
Moved the new Teleport route after entrance visibility instead, preserving
every original command, its relative order, and the original suffix. Neither
existing recovery contract was weakened. Updated only the new Teleport
placement assertion and route documentation.

Focused verification PASS5suites/267tests1.697s; changed-file lint and shell
syntax PASS. Logs `/tmp/eidolon-release65-gate-order-{green,lint}-20260912.log`.
The failed client's total was297suites (295passed/2failed),4347tests
(4345passed/2failed),99.553s. Server was still running at the first observation;
its terminal state and another exact-source hosted regression remain to be
collected. Native Teleport/Phase acceptance remains outstanding.

The player confirmed milestone numbering1.1.0 through1.10.0. This candidate65
is the last planned ordinary foundation hotfix after64; bundle remaining
baseline work into1.1.0. Only urgent live blockers justify additional1.0.x
releases. This does not remove any dungeon/party, earned progression,
reconnect, balancing or later roadmap acceptance requirement.

## Combined hosted and scoped native acceptance

Corrected hosted CI34670196359 at1de18e03 is TERMINAL SUCCESS: client297suites/
4347tests104.847s plus lint/audit/benchmark; full server game race255.387s and
coverage85.6%, backup/restore/bench/build; browser39+40+25=104cases. Native and
production jobs were intentionally skipped for manual dispatch, not passed.
Logs `/tmp/eidolon-release65-corrected-{client,server,browser1,browser2,browser3}-34670196359.log`.

Native Teleport's first completed retry found an occupied-ground fixture error,
documented in the companion route record. Test-only95a78071 corrected that route;
no application/runtime change from hosted1de18e03. Focused3suites/24tests and
lint passed. On clean95a78071, sequential real system-Chrome checks then passed:

- Teleport/Phase: native17729,1test2.0m; base/trained Warp and base/saved-trained
  Phase, real receipts, owner/peer effects, natural expiration. Complete artifact
  `/tmp/eidolon-release65-teleport-accepted-B42924`.
- Spell Focus:1test2.1m; paid training and saved login, High/Low glyphs, actual
  stored multiplier, Scorch Beam789 versus263 and one-charge consumption on both
  clients. Complete artifact `/tmp/eidolon-release65-focus-accepted-n6qdKn`.
  Inspected the trained Low owner capture: visible Focus glyph and phone controls.
- Time Warp: native44831,1test2.9m; walked ally outside base range, trained area
  and Mastery duration, fresh login, High/Low geometry, actual recipient stat
  changes and ordinary expiry back to baseline on both clients. Complete artifact
  `/tmp/eidolon-release65-timewarp-accepted-7xvnTv`.

All three wrappers reported credential scan0 and passed; exact disposable services
and shared test ports were absent before starting the next native route. Native
renderer was verified as ANGLE AMD Vulkan/RADV RENOIR before this sequence. These
are prepared functional checks, not earned progression or performance acceptance.

Production65 has NOT been pushed. Its login label and full patch notes are ready;
normal complete predeploy, inputs, deployment and final live checks must still
pass on its eventual publishing commit. The native hardware is now running the
instrumented four-role dungeon diagnostic on development8f2c82a4; avoid competing
production/native work while that run is active. Do not infer1.1 completion.
