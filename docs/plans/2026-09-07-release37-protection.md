# Alpha 1.0.37 candidate — a wider circle of protection

Local candidate, not published. The original candidate is preserved at
`47a565b0ec4d38ef9149b1a7055cf056ccfe3802`. The corrected candidate now includes
1.0.36 hotbar correction `69b34a78cd880f7a863d5ad2a0aa33af0680f961`; every earlier queued release must clear
its own complete CI/live gate first. Package/lockfile, release manifest, login,
server, container, deployment, CI and isolated-QA defaults all advance to 1.0.37.
Its separate patch-note entry precedes 1.0.36 without replacing earlier history.

## Included

- [Guardian Embrace](2026-09-07-guardian-area.md), checkpoint `a0a17e7`: real
  trained periodic healing area, persistent perimeter, accepted cast geometry,
  active-radius replication for late observers and offline healing corrections.
- [Consecrated Ground](2026-09-07-consecrated-area.md), checkpoint `3458918`:
  trained healing/damage area including Expanded, accepted/persistent geometry,
  offline persistent zone lifetime, self/friendly healing and dungeon-wall damage.
- [Both Blessings and Heaven's Trumpet](2026-09-07-cleric-immediate-areas.md):
  actual trained areas and accepted local/remote footprints, preserved allegiance
  and cover, shared offline cooldown/presentation and missing offline Trumpet base
  damage. Limitations of older offline buff modifiers are explicitly retained.

## Final versioned verification

- Full client checks pass **193 suites / 2,864 tests in 148.676s**,
  `/tmp/eidolon-release37-full-client.log`. This includes separate 1.0.37 notes,
  exact login/package/version defaults and all prior release history.
- Lint, shell syntax and whitespace checks pass. Full server race checks pass
  root **19.953s**, game **354.538s**, `/tmp/eidolon-release37-full-server.log`.
- The new isolated `cleric-area` route passes **48.9s** (46.5s body),
  `/tmp/eidolon-release37-cleric-gameplay.log`. Actual phone hotbar casts, normal
  branch selection and Ministry purchases produce all three accepted and rendered
  baseline High, rank-five Low and rank-five High boundaries. Costs, attached
  self buffs and saved ranks after fresh login pass. Browser errors, credential
  scan and isolated cleanup pass. It does not prove actual enemy damage in that
  browser town session; actual server/offline regressions cover effects separately.
- Inspected trained High/Low captures retain visible exact perimeter and cosmetic
  center. The level-up notification still obscures the encounter view; phone HUD,
  actor-size and physical-device playability sign-off remain open.
- The first final-version Guardian route completes real-heal/late-observer/expiry
  and fresh-login assertions but fails its unchanged browser-error guard on local
  module `ERR_NETWORK_CHANGED` errors (`/tmp/eidolon-release37-guardian-gameplay.log`).
  An unchanged rerun passes **55.6s** (53.7s body), including actual 258 HP healing,
  trained High/Low radius, late-observer replication/expiry and fresh-login ranks:
  `/tmp/eidolon-release37-guardian-network-repeat.log`. A passive 120-second host
  link/address monitor initially reports no events, then records virtual-interface
  removals at 06:54:03 UTC (`/tmp/eidolon-release37-network-monitor.log`). It did not
  capture the earlier failed run, so it does not establish that failure's cause.
  The monitor exits normally through its time limit (timeout exit 124). No errors are
  filtered, no other project's containers are changed and no Chrome safety checks
  are disabled. Final credential scanning and isolated cleanup pass.
- The final versioned holy-ground rune/cast/persistence route passes **39.0s**
  (37.1s body), `/tmp/eidolon-release37-holy-gameplay.log`: actual 5m / 5.75m / 8.625m
  persistent zones, normal training and Expanded selection, 74 HP server healing
  and fresh-login persistence. Error checks, credential scan and cleanup pass.

## Release boundary

The corrected integration is `da16b485302fd23dfebf5d85b9f2a2207908a77a`, branch
`release/37-with-target-identity`, checkout `/tmp/eidolon-release37-targeting-lT3Mdt`.
Only the five files from the hotbar correction differ from the original candidate:
actor identity/buffering, its regression tests, stronger real-gameplay assertions,
the correction plan and the extra 1.0.36 patch-note bullet. The server tree is
identical to the original race-tested 1.0.37 candidate. Target/ability checks pass
14 tests in 0.946s; version/default/history checks pass 219 tests in 1.4s. Logs:
`/tmp/eidolon-release37-targeting-{focused,version}.log`. These targeted checks
supplement the original full candidate checks, not a new full browser run.

Alpha 1.0.35 is the last fully verified live release. Corrected 1.0.36 CI
`34114458548` is still in predeploy gameplay QA. Do not push this candidate until
all of that run's jobs pass, including live QA, and a fresh public identity check
matches the corrected 1.0.36 commit. Carry this corrected ancestry into 1.0.38–40;
do not push their preserved original branches unchanged.

This is not closure of the talent audit, all offline rune/stat parity, physical
phone playability, all-class dungeon/raid progression, visual polish or the full
1.1–1.10 roadmap. Spirit Guardians/Boost area, remaining class areas, Cleric
duration consumers, skill crit and ineffective mastery/copy remain open.
