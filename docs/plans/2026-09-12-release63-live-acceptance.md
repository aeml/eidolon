# Alpha 1.0.63 — release accepted September 12

Source: **f866df68b74b52531ed32a2fa53a93b179d983ac**.
Normal CI **34660899212** completed successfully: hosted client/server tests,
all three browser groups, System Chrome predeployment, production-input
validation, Pages deployment, SSH deployment and final live QA all passed.
The cancelled soak was not restarted.

Independent uncached public checks after the final gate matched:

- `https://play.eidolonrealms.com/release.json`: Alpha 1.0.63 and the exact source.
- `https://server.eidolonrealms.com/healthz`: same version/source, status `ok`,
  database `ready`.
- Public HTML: Alpha 1.0.63 login label, matching release query on `src/main.js`,
  new 1.0.63 patch notes and retained earlier notes.

This release delivers Time Warp's trained area and consistent offline haste,
offline Spell Focus charge behavior, rejected build-menu request recovery and
separate live animation evidence. It does not include the later stored Focus
Mastery, Time Warp Mastery, protection/Teleport, Wizard damage, armor-reduction
or Shattering Charge development work.

## Final live evidence

Job **103473089014**:

- Anonymous/persistent-character/dungeon/movement stage: 8 tests passed, 5.0m.
- Each of four classes: one animation case passed (58.7s, 52.1s, 45.4s, 1.1m).
- Remote multiplayer animation: one case passed, 1.9m.
- Ordinary fresh-character town recovery, earned rest/expiry/reconnect:
  two cases passed, 1.0m.
- Two-player rested auras/phone status at High and Low: one case passed, 29.2s.
- Both credential scans passed, zero files requiring sanitization.

Logs: `/tmp/eidolon-release63-live-job-20260912.log`.
Retained artifact: `/tmp/eidolon-release63-live-proof-Sj6wyE`.

## Predeployment evidence

Job **103466209719** passed the complete required sequence, including the
previously repaired normal-purchase Roar/Spin gates. Sanitizer passed with zero
files requiring sanitization. Log:
`/tmp/eidolon-release63-predeploy-job-20260912.log`.
Retained artifact: `/tmp/eidolon-release63-predeploy-accepted-QZtbxd`.

The retained Well Rested render JSON reports four expected, zero skipped,
unexpected or flaky cases in 59.234s. The High/Low 568px party screenshots were
visually reviewed: both preserve the visible rested aura and playable world/HUD
composition. These screenshots are prepared browser evidence, not physical
device acceptance or a new proof of every menu/encounter.

The user's separate positive live-phone combat/menu feedback is recorded in
`mobile-playability-evidence.md`, without inventing a device/browser/build.

The full 1.1–1.10 roadmap remains open. In particular, this release does not
establish the pending four-role dungeon clear, expanded earned campaign/balance,
all talent consumers, future casino or later milestone acceptance.
