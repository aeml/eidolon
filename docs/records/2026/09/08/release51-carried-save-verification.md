# Release51 save bridge on the current50/47 baseline

New release/51-with-final50 in `/tmp/eidolon-release51-final50-DizHn0` merges
retained51/2ed3375 with current50, including c2e8513's deployed-safe QA planner,
at45593779f361175229c8f4d69503d11e524f474d. No runtime merge conflict. Its diff
from50 retains the existing room-XP transition correction and inactive-curve
compatibility bridge, with distinct51 notes and all earlier history. It does
not activate curve2, expanded chapters or new quest/XP budgets.

88588 prepare/lint/full client passed233suites/3330tests/130.739s, normal0.
28965 full Go race passed game236.252s and all packages, normal0. Source was
frozen4559377 throughout. Logs `/tmp/eidolon-release51-final50-{client,server-race}.log`.

Built the bridge from4559377 and rebuilt the historical curve2 fixture from
detached762a46b214157c3b1d15fc808584f4d87962cb84. Artifacts/source retained in
`/tmp/eidolon-compat51-carried-gI9val/`. Initial16664 session attempt failed
before login because the harness requires the reported build ID to equal the
binary basename; names bridge/candidate did not match the embedded commits.
Server actually started, then was cleaned up. Retain this setup failure at
`/tmp/eidolon-release51-final50-sessions.log` and phase evidence
`/tmp/eidolon-compat-session-3606875861/`; it is not a save-migration failure.

Corrected binary basenames to45593779f361175229c8f4d69503d11e524f474d and762a46b
without changing source, identity checks or any assertions.29912 real session
PASS28.46s/process29.488s, normal0:100 ordinary login/join/disconnect/save cycles,
four classes/five saved-progress cases through1→2→1→2→2. Exact tested progression,
base stats, spent points, gold/Resonance, equipped/bag/stash/buyback gear and Forge
basis survive. Accepted zero-reward promises, counts, future discoveries and
optional flags remain. Log `/tmp/eidolon-release51-final50-sessions-matched.log`
lists retained phase server evidence. Standalone servers are ordinary builds;
the test harness and separate full server suite use race detection.

Both attempts used only a newly owned loopback Mongo on18641. Cleanup removed
the temporary containers and synthetic fixture data; independent Docker queries
confirmed absence. No production data was involved.47's completed planner
document was merged afterward without runtime changes.

This closes packaged local save compatibility, not earned campaign balance or
publication. Preserve current46/ed5f64a CI and the complete sequential47–51 live
gates before activating any curve2 balance release.52 must retain this ancestry.
