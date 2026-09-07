# Alpha 1.0.32: retained browser-network failure

Source `d578bdfff7cd998c56bc422bc403d4cbe666b902`, CI `34089969590`, attempt 1:
client checks, server checks and browser smoke pass. Predeploy Character QA fails
on `mobile-settings-gameplay.spec.js:51` before either deployment runs. The normal
phone-settings assertions complete on both its initial attempt and built-in retry,
but the unchanged final browser-error guard catches local module/stylesheet
requests failing with Chrome `net::ERR_NETWORK_CHANGED`.

The retry reaches its settings/persistence milestone at 06:42:20 UTC; the job exits
with code 1 at 06:42:22. Production deploy/live-check jobs are skipped. This is not
evidence that 1.0.32 deployed successfully or that the browser errors are harmless.
The precise host-network event causing them is not established.

One failed-job rerun is requested without changing source or relaxing error checks.
GitHub API confirms **run_attempt 2**, exact same source, **in_progress**. Retain
the first failure even if the rerun passes. Do not push 1.0.33 until the complete
rerun CI/live gate passes and fresh uncached manifest/login/script/backend checks
agree. If it recurs, investigate infrastructure/network isolation rather than
blindly repeating jobs or filtering out browser failures.

Latest established live baseline remains healthy Alpha 1.0.31 (`a82baa2`), with
the fresh 06:33:12.223 UTC identity check in the execution ledger.

Attempt 2 subsequently passes predeploy character QA and both deployments. At
**07:35:08.399 UTC**, fresh uncached manifest/login/versioned main script/backend
all match `d578bdfff7cd998c56bc422bc403d4cbe666b902` / Alpha 1.0.32, with health `ok`
and database `ready`. Final live four-class/remote-animation QA is still running;
this pre-terminal identity check does not replace the required check after the
complete job succeeds. Keep 1.0.33 queued until that gate.
