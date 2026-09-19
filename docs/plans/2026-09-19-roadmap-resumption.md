# September 19 — roadmap resumption

Current local feature stage: the administration batch includes role-checked
reads/session history, canonical grant validation, durable grant/receipt/audit
execution and automatic startup/runtime recovery. Confirmed Gold/item/teleport
handlers and controls are now implemented, with real two-account socket and
restart acceptance (native99139), race-tested duplicate/cross-account handling,
three browser layout cases, and schema14 archive restore/older-writer fencing.
Authenticated two-account browser controls now pass as well (native89594),
including all grants and teleport modes, saved state and audits. Alpha1.9.17 is
delivered with cumulative patch notes and matching versions. CI35464162303
passed all ten jobs at `b5feba27cdf6de984446032aedfefeb286df5a0f`; both public
domains independently match Alpha1.9.17 and the database is ready. The schema
12 → 14 upgrade has a verified protected pre-upgrade recovery point. See the
[release record](2026-09-19-release1-9-17-administration.md). The safe live
operator panel read check remains requested; the broader 1.10 gate stays open.
See [implementation, proof and remaining full-panel scope](2026-09-19-administration-console.md).
Earlier Alpha1.9.17 replacement `441b3ffa` / CI35463942707 failed a stale
dungeon-entry helper mock. Its correction passed 133 focused checks before
the successful release above. The dedicated read-only Luna watcher reported
the final CI success; it is no longer an active release wait.
The original CI35462943697 failed an anonymous mobile-menu fixture that tried
to expose the intentionally hidden admin launcher; every deployment job was
skipped. The correction explicitly checks that hidden state and preserves all
ordinary menu checks. Its six-case mobile/admin layout run passed. Publication
was not accepted for those failed candidates. Session-event capture
passes real two-account/socket/restart acceptance (native83168 exit0); grant
recovery passes the real built-server startup/runtime/restart test (native40190
exit0), using trusted test intents. The newer99139 test exercises the actual
administrator endpoints; see the administration evidence record for exact scope.
Rootheart retry18833 is terminal failure in assault combat, not an active wait;
formation now passes, but DemonOrc hover acquisition stalled. Preserve its
diagnostics and do not repeat the raid without a concrete correction.

Fresh Rootheart retry **69714 is terminal success: 29.5minutes, zero retries**.
All five survived the full assault/guardian and three repair waves, individually
claimed Ilyra's reward and retained completion after re-login. Owned cleanup and
private checkpoint are verified. See [accepted Rootheart result and limits](2026-09-19-rootheart-party-acceptance.md).
Do not poll/restart69714 or rerun Rootheart by default. The earlier failures above
are historical diagnostics; the corrected input route now has actual clear proof.

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

Next concrete unfinished acceptance is the actual five-player Tidestar raid:
ordinary formation/readiness, assault/guardian, three repair waves, individual
manual turn-ins and saved re-login. Use the existing legal5Rare/9Uncommon role
fixtures; do not increase stats/rarity or grant completion to make the test pass.
The corrected Maelin hostility, boss identity and occluded-target input driver
are already inherited. Rootheart is accepted, not the next missing clear.

Tidestar started in native session **1809**, runID `waterraid0919a`, after
Rootheart cleanup and an idle live-browser runner were verified. Clean source
`6ace7407909d1cb234936496d774282e723df01a`; later edits are documentation and
CI-filter checks only, not runtime, fixture or browser-route changes.
Log: `/tmp/eidolon-water-raid-20260919-ZLnP7l/run.log`. The same isolated
API18285/Mongo18286/Web4187 and five legal level70 role builds are used, Low
graphics, zero retries. Water's own memory-carrying ritual remains mandatory.
Session1809 is now terminal exit143: the process ended during repair combat,
without a test assertion failure or completion result. The final log records
28.8minutes, guardian defeated and further repair enemies killed; no full-wave,
turn-in or re-login acceptance may be inferred. Browser workers are gone; only
orphaned isolated services remained. Their private save and sanitized screenshots
were preserved before owned cleanup. See the
[interrupted Tidestar record](2026-09-19-tidestar-interruption.md).
Do not poll1809 or the completed Rootheart69714. The next attempt must survive
chat-turn interruption and retain the same legal gear and ritual requirements.

Replacement `waterraid0919b` is terminal exit1; detached PID3804247 and read-only
watch27144 are finished. Do not poll or restart those handles.
Clean startup source `b8e02767aed79aadf7e9a4c899313749066b5322`. Log and launcher:
`/tmp/eidolon-water-raid-20260919-r2-z4qo0c/`. Same ports, five role builds, Low
graphics, normal mechanics and zero retries. Check that exact process and the
log's terminal `RAID_PROCESS_EXIT` marker before taking any restart action.
No other CI browser job was active at launch; the independent nightly soak was
left alone. The guardian and first repair wave completed on all five clients,
but a Wizard spacing input hit a crossing healer during wave2. All five remained
alive. Full repair/manual claims/re-login are not accepted. Artifacts preserved,
owned services cleaned up; see [failure and correction](2026-09-19-tidestar-spacing.md).
The recorded-layout regression reproduces the exact old step. The driver now
holds an already useful firing/healing position while a nearby friendly moves,
without weakening movement assertions or suppressing retreat from melee danger.
101 focused spacing/formation/input checks and lint pass. Connected confirmation
remains pending; finish the isolated floor review before another raid attempt.

Integrated visual candidate: `/tmp/eidolon-floor-polish-GTaEiw`, branch
`work/dungeon-floor-polish-20260919`. Actual Tidestar screenshot review found
the repeated luminous floor pearls/lines visually noisy; source identifies an
authored texture pattern, not proven duplicate geometry. Candidate broadens
floor masonry, smooths sampling and subdues Water floor accents while retaining
wall identity. A subsequent sRGB correction restores readable stone joints.
40 focused interior/crystal tests pass; the targeted High/Low gallery passed and
both screenshots were inspected after raid cleanup. The candidate is now merged
for Alpha1.9.18, with cumulative notes and synchronized version labels.277
version/runtime/queue checks pass. See [release record](2026-09-19-release1-9-18-dungeon-surfaces.md).
First74bd4b70/CI35471125941 is terminal cancelled before any deployment, after
Luna confirmed Go was still running. A canonical world-UV integration omission
is now fixed and verified by67 focused checks and one5second High/Low join test.
Publish the corrected Alpha1.9.18 candidate and reassign Luna
`/root/watch_release_1_9_18` to its exact SHA/run. Public delivery is pending.
Do not duplicate watcher polling or start another raid over release browser QA;
the next required raid also supplies the integrated actor/telegraph floor review.

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

## Rootheart input correction awaiting connected acceptance

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

## Deployment monitoring policy (user request, September19)

Prepared CI efficiency change: pushes containing only `README.md` and/or
`docs/**/*.md` no longer start the full publishing pipeline. These files are
not Pages game inputs. Pull requests remain unfiltered to avoid leaving required
checks pending; manual dispatch and every mixed code/asset/release/HTML-note
push retain all existing gates. No test job, concurrency rule or deployment
dependency was removed. The new regression failed before the filter and then
all14 queue/checkout/browser-sharding checks passed (80870), with YAML parsing,
changed-file lint and diff checks. This is not yet published; batch it with the
next suitable change rather than interrupt the active multi-browser raid.
For the next and subsequent deployments, delegate watching the exact GitHub
CI/CD run to one `gpt-5.6-luna` agent with a minimal standalone brief, not a fork
of the full roadmap conversation. Use a quiet process/watch or bounded polling;
report terminal completion or a failed job with a concise relevant log excerpt,
not every unchanged tick. The watcher is read-only: no reruns, cancellation,
commits or deployment changes. The main agent continues useful feature work
and handles fixes and final live-release verification. This authorizes Luna
deployment monitoring, not unrestricted delegation of implementation work.
