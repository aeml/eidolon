# Release 43 — repeated smites under software rendering

Corrected 43 **ed5b4e4 / CI 34175827810** still fails its anonymous browser
gate: **61 pass / two fail / 10.2m**, including retries. Native and 8fps cases
each see one hit during a separate 15-wall-second second-hit poll; neither
reaches the previously corrected expiry assertion. Client/server pass and all
deployment/live jobs skip. See `/tmp/eidolon-release43-corrected-ci-failed.log`.

Exact bundled-Chromium configuration on this machine **11275 PASS / four /
3.3m** admits 16.5 simulation seconds in approximately 70 wall seconds. This
reproduces slow rendering, **not the exact CI assertion failure**. Software
rendering speed must not be confused with the actor's 1.5-second attack clock.
Log `/tmp/eidolon-release43-software-before.log`.

QA-only **d1f182b** retains production rendering, chunk updates, damage and
the 50ms update cap. An 800×450 component viewport reduces fill cost without
disabling effects or replacing the renderer. Capture the first real smite while
its mesh is alive; verify repeated attacks after the unaltered 16.5-admitted-
second lifetime. Assertions now require at least ten 84-damage owner-attributed
hits, a first hit within one update, and 1.5–1.55 admitted seconds between hits.
All prior exact expiry/disposal, disconnected-floor, follow and instance cleanup
assertions remain. No runtime/server/version/player-facing patch-note change.

- **80356 bundled/software PASS / four / 1.9m**: native expiry 32.942 wall
  seconds; delayed-frame expiry 44.6385 wall seconds. Both admit 16.5 seconds,
  deliver eleven genuine hits and pass cadence/cleanup. Log
  `/tmp/eidolon-release43-software-after.log`.
- **63682 system/hardware PASS / four / 1.3m**: native expiry 16.516 admitted /
  16.5019 wall; delayed-frame expiry 16.5 admitted / 43.8906 wall. Both deliver
  eleven hits. Log `/tmp/eidolon-release43-hardware-after.log`. Slow-case smite
  image inspected: actual 84 damage and rendered actors; attribution text is
  crowded, a remaining visual follow-up rather than a claimed polish success.
- Lint/diff pass. All owned browser handles are closed. Runtime is unchanged
  from corrected 43's passing CI client/server jobs.

Keep older release refs; propagate through new `with-smite-cadence` descendants.
Republish only corrected 43 first. Publish 44 only after every corrected-43 CI,
deployment and live job succeeds and fresh public identity matches exactly.
This check does not complete reward balancing or the full roadmap.
