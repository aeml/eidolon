# September 19 — roadmap resumption

Current local feature stage: the administration batch includes role-checked
reads/session history, canonical grant validation, durable grant/receipt/audit
execution and automatic startup/runtime recovery. Confirmed Gold/item/teleport
handlers and controls are now implemented, with real two-account socket and
restart acceptance (native99139), race-tested duplicate/cross-account handling,
three browser layout cases, and schema14 archive restore/older-writer fencing.
Authenticated two-account browser controls now pass as well (native89594),
including all grants and teleport modes, saved state and audits. Alpha1.9.17 is
packaged with cumulative patch notes and matching versions; CI/deployment and
read-only live verification remain, not unimplemented buttons or repeated soaks.
See [implementation, proof and remaining full-panel scope](2026-09-19-administration-console.md).
Alpha1.9.17 candidate `f76b0a601dfd99d9839657b5925a7c1777da86f4` is pushed;
CI35462943697 is watched by the dedicated read-only Luna agent. Publication is
not yet accepted; last verified production remains Alpha1.9.16. Session-event capture
passes real two-account/socket/restart acceptance (native83168 exit0); grant
recovery passes the real built-server startup/runtime/restart test (native40190
exit0), using trusted test intents. The newer99139 test exercises the actual
administrator endpoints; see the administration evidence record for exact scope.
Rootheart retry18833 is terminal failure in assault combat, not an active wait;
formation now passes, but DemonOrc hover acquisition stalled. Preserve its
diagnostics and do not repeat the raid without a concrete correction.

The interrupted permission-check turn made no progress; access is now restored.
Reconciled current files and external results before resuming old tests:

- Root is clean `work/fighter-charge-20260915`, based on production
  `5c714e19460bf53b59c81afabf7aa61567608dd1`, not the archived ledger-only master.
- Alpha1.9.15 added administration;1.9.16 doubled Fighter Charge impact.
  CI35036376369 for1.9.16 succeeded in all ten jobs, including live character QA.
  Both public domains report that exact SHA/Alpha1.9.16; database ready.
- The September14 public-event run27229 is gone and its log records terminal
  failure after22.92s (one prepared Wizard died). Do not restart that old test.
  The September15 recovery report and corrected test record a later full Air
  event acceptance with four geared characters, all waves/champion and saved
  progression. Retain that narrower scope, not an all-realm balance claim.
- Nightly35418625861 is an independently scheduled100-client soak, not a stuck
  release pipeline. Leave it alone. No local browser/QA containers were active.
- The user explicitly chose to keep the15-minute dungeon logout rule. Source
  `server/client_dispatch.go` still implements it. No runtime change needed.

Next concrete unfinished acceptance is the actual five-player Rootheart raid:
ordinary formation/readiness, assault/guardian, three repair waves, individual
manual turn-ins and saved re-login. Use the existing legal5Rare/9Uncommon role
fixtures; do not increase stats/rarity or grant completion to make the test pass.
The corrected Maelin hostility and boss-identity driver are already inherited.

Rootheart attempt39986 is terminal failure before combat (five leader steps,
zero rooms cleared). All five entered correctly. The captured formation at
`/tmp/eidolon-earth-raid-20260919-xyX7KD/run.log` reproduces a boxed-in second
Cleric while the other three followers have clear paths. Planning all members
with `Promise.all` aborted on that one unavailable route before anyone moved.
The browser planner now treats only that specific no-route result as waiting:
clear followers move, then all positions are read and replanned. Arrival,
collision checks, the original deadline and unexpected-error failures remain.
The recorded five-member regression and all60 focused helper tests pass.
This is QA-only, not a production or balance change and not a full raid pass.
Owned API/Mongo containers are absent after cleanup; retained save is not used
to bypass the approved15-minute expiry. Next attempt starts a fresh legal party.

Full1.10 is not complete: remaining regional dungeon/raid and earned-campaign
integration, finale and the outstanding cross-feature/mobile checks remain as
tracked in the final integration audit. Phone Brave/Chrome general UI feedback
does not prove phone dungeon/party play. Reuse accepted evidence; do not repeat
whole matrices, accepted releases, or public-event preparation unnecessarily.

## Deployment monitoring policy (user request, September19)

Rootheart input recovery now has a concrete local correction after that release
candidate. The recorded tank/Orc/Construct positions reproduce an impossible
direct approach: the old fallback asks to walk into the target's occupied centre
while already within attack range. The party driver now tries a short lateral
or retreat segment checked against live actor capsules, canonical collisions,
encounter boundaries and current warnings; distant approaches stop at range.
Pointer acquisition waits for the real pending raycast to finish rather than
assuming50/60ms includes its next frame with five rendered clients. No target,
movement state, stat or combat packet is injected. The original target's death,
60second damage-stall watchdog, boss/repair requirements and legal gear remain.
Recorded-layout and associated controls109tests pass (native58555 exit0), with
changed-file lint. This is not yet an actual raid-clear proof. Do not launch a
five-browser retry alongside the release's live-browser workload on this host.


For the next and subsequent deployments, delegate watching the exact GitHub
CI/CD run to one `gpt-5.6-luna` agent with a minimal standalone brief, not a fork
of the full roadmap conversation. Use a quiet process/watch or bounded polling;
report terminal completion or a failed job with a concise relevant log excerpt,
not every unchanged tick. The watcher is read-only: no reruns, cancellation,
commits or deployment changes. The main agent continues useful feature work
and handles fixes and final live-release verification. This authorizes Luna
deployment monitoring, not unrestricted delegation of implementation work.
