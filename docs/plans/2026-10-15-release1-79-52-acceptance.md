# Alpha 1.79.52 — combat feedback and reduced motion

Accepted October 15, 2026. Runtime source:
`8c8ef016eb0fcda59164f3fc2503476dd4514039`.
[CI38656850418](https://github.com/aeml/eidolon/actions/runs/38656850418)
completed successfully with all ten jobs passing, including server and website
deployment, live character checks and fresh-account recovery.

The public frontend and backend both report **Alpha 1.79.52**. Independent
normal-TLS verification at 00:35:22 UTC matched both identities, ready database,
all 204 pinned asset byte lengths/SHA-256 and valid analytics JavaScript.

## Delivered scope

Skill and party feedback now packs within the viewport with bounded visible
labels. Live system and manual reduced-motion preferences apply to floating
text, all 52 cast presentations, area/status effects and Spirit Guardians.
Essential warnings, gameplay ranges, lifetimes and following behavior remain.
[Scoped qualification](2026-10-15-combat-accessibility-qualification.json).
Twelve version surfaces are synchronized; 487 cumulative notes preserve all
486 previous entries byte-exact across 48 history pages.

## Validation and retained retry

| Gate | Result |
| --- | --- |
| Client | 770 suites / 11,772 tests; lint, 14 content groups, dependency audit and benchmark pass |
| Server | Full tests, race detector, persistence/recovery/backup checks, benchmark and build pass |
| Hosted browsers | 388 passes / 13 skips / **one flaky case** across three successful shards |
| Native predeployment | 62 passes / one skip; no reported flakes |
| Live QA | Eight main passes / one skip; two recovery cases and one two-player Well Rested case pass |
| Independent public read | Exact source/version, ready database and all 204 asset pins match over normal TLS |

The Low Magma comparison initially reported 49 differing image channels for
both the replicated field and the restored original scene. Its field poses and
shared surfaces were identical, while the earlier hide/restore control had zero
difference. The workflow's existing single retry passed. This is retained as a
flake, not an additional pass or a clean first attempt. No workflow rerun occurred.

Inspection found asynchronous module imports between the reference and replica
captures: cancelling the fixture RAF does not stop unrelated timers or geometry
delivery during an await. The next candidate moves those imports before freezing
the comparison and preserves exact zero-difference assertions. This removes a
specific comparison race; the historical event that changed those 49 channels
has not been uniquely identified. Runtime motion behavior is not changed by
that fixture correction. Original artifact and observation remain below.

Four optional workflow stages remain skipped (exhaustive animation gallery,
broader Well Rested GPU lifecycle, full disposable character route and live
four-class/remote-animation route). They are not claimed as passed. The three
High class-effects cases retain required native execution.

Final world/actor/audio quality, human class feel, representative performance,
physical devices, operations and original freeze/beta/release gates remain open.
Raised terrain stays disabled. Soak/stress remains owner-deferred, with prior
failures retained. [Remaining work](2026-10-09-release-readiness-remaining.md).

## Evidence custody

Retained in `/home/aeml/.local/share/eidolon-combat-readability-20261014/.qa-readability`.
The job summary records hashes for all ten job logs; direct job-log downloads
supply the three browser logs that the combined CLI export returned empty.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `final-ci.json` | 22166 | `06f1a2117c21df27246227384fd6a13a9547c782878115e875ee906f95bf02eb` |
| `final-public.json` | 72260 | `f096cc15fa669dd551b64baeefe8bf3e237f1aed747b749a71ee93dcbc537eea` |
| `expected-public52-assets.json` | 39670 | `936e3624051c344b366ca59c9aa73f4203624b78acd128bc18e3d42ab1682883` |
| `build-summary.json` | 5371 | `89c019db2861922e97544c43ff06141f5a59e055c6dcd2e7c41b0e9c1d81242e` |
| `final-job-summaries.json` | 5975 | `13b4490a1db69a6e19bc665f62cd091ef142a65105b24d169fee029e306ca5f8` |
| `final-browser-counts.json` | 51 | `44fac119f8e97ca83b790adb6e6b9503b52c55e97259fd37411b99936c2d4576` |
| `magma-flake-observation.json` | 627 | `57b5461498f66dd9c6ca11db4933384b81ee8251b77bd39c9ede1f097ad403fb` |
| `browser3-artifact.zip` | 150182462 | `2831c0395c8d1743e5ef7fce603d2a556ffc8f3c013f4ded0d7b15322c43d784` |
