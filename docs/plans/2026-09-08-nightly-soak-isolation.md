# Nightly soak isolation — unreleased

Scheduled run34183672037 failed before load: its server could not bind
127.0.0.1:8080, occupied by another project. The artifact contained only that
startup failure, not a completed100-client soak. No unrelated process was stopped.

The workflow now lets GitHub assign the Mongo host port and passes the service's
actual mapping. This uses the documented
[service-container port mapping](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax).
Each run builds its binaries and writes evidence in a unique temporary directory,
requests an available loopback server port, and verifies a unique run identity
plus database readiness before sending accounts or load. A port-allocation race
fails closed; another listener cannot satisfy that identity. Cleanup signals only
the spawned children. The original100-client, error-count, heap/goroutine and
growth requirements remain mandatory. Missing setup output cannot expand the
artifact path to an unrelated directory.

Two policy tests pass (exact identity, readiness, coverage and ceilings). Full
lint40393 passes. Real bounded smoke15821 **PASS**,70 seconds,100 connected/
100 joined,62,872 authoritative frames, zero read/write errors. Three health
samples: maximum295 goroutines,180,523,632 heap bytes,140,178,744 growth bytes.
The run used127.0.0.1:39231 and a uniquely identified build; the owned disposable
Mongo at18463 was removed with its ephemeral data after completion. No live game
data or unrelated service was changed. Evidence remains in
`/tmp/eidolon-soak-92WVYQ/` and `/tmp/eidolon-soak-isolation-smoke.log`.

This validates isolation and a short100-client run, **not24-hour stability**.
The change still needs a versioned release through the sequential queue before
the scheduled GitHub workflow is fixed on master.
