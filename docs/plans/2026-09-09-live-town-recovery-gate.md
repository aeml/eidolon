# Live town recovery acceptance

Prepared in the primary worktree September9; not deployed and not yet imported
into frozen standalone58. The active complete58 replay must finish before any
candidate edit. This is a publication-gate addition, not a gameplay change.

The existing final-live workflow verified release identities, dungeon play,
movement, four-class animations and remote actors, but did not run the specific
native town-recovery tests. Add a mandatory step after matching deployed client,
runtime and server commits, and before final artifact sanitation/upload.

`scripts/run-live-recovery-qa.sh` reuses the native no-grant tests:

- Real travel and hostile damage, an accepted mana-consuming spell, Recall,
  both depleted pools returning to full, bank accumulation, aura and reconnect.
- Natural earned-bank expiry outside town, removal of stat/icon/aura bonuses,
  and their return through ordinary Recall.
- Two real party members, actual phone joystick movement, High/Low auras and
  readable status in portrait/landscape layouts. This is not physical-phone QA.

Four ordinary accounts are registered under a dedicated QA prefix with a random
48-bit suffix per invocation. Accounts are not granted levels, resources or buffs,
and none is deleted. Fresh identities avoid inheriting levels or long rest banks
from a prior run. Automatic test retries are disabled for this freshness-sensitive
gate; failure remains failure, with no blanket error filtering.

Separate screenshot roots retain both invocations without overwriting preceding
live reports. An EXIT handler scans the generated username root and password on
success or failure and preserves test failure status. The existing workflow's
sanitation/upload gate remains mandatory as well. No secrets are placed in CLI
arguments or printed by this wrapper.

The shell harness executes the real wrapper with stubbed browser/scanner commands:
14 checks cover all routes and arguments, fresh/max-length identities, mandatory
workflow ordering, missing/invalid input, stop-on-failure and sanitation failure.
The initial harness had a JavaScript template syntax error (zero tests executed),
then was corrected; this was not a browser/runtime failure. Focused tests and lint
pass. The opt-in isolated route `live-recovery-rehearsal` runs this exact wrapper
against the disposable loopback services, without expanding their QA allowlist
or changing the default full gate. Actual browser rehearsal and live checks remain
required; shell mocks and prior native-test passes do not establish live delivery.

The first complete primary regression on9fa4638 passed268suites/3818tests/
170.675s plus lint. Subsequent source review found the party observer launch
omitted the existing scoped backend-origin routing that the primary browser and
other live multiplayer tests already use. Add that same validated mapping to
the observer; no configured origin still means no override. A source guard fails
on the old launch and passes with the corrected policy. This is preventive live
QA wiring, not a claimed diagnosis of an observed production failure.
