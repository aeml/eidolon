# Alpha 1.79.59 acceptance

Runtime source: `2c4cbb4c9b8257439061c23959a896d58dc1c09b`.
[CI38836797920](https://github.com/aeml/eidolon/actions/runs/38836797920) completed successfully: all ten ordered jobs pass,
including both deployments and live gameplay/recovery.

Weapon Garment, Armor Garment and Offhand Garment now appear in one centered row
immediately below the character picture. Controls show the confirmed appearance
or Original gear and open the matching owned Wardrobe selector. Applying or
resetting remains explicit/server-authorized; actual equipment, combat stats,
full-outfit precedence and independent hands retain their existing behavior.

The coherent interface milestone also improves returning Lore Book task context:
accepted objectives/progress, tracked-task priority, correct-journal links,
personally claimed finale and past-tense recap, with reading focus/scroll retained
through new memories. Manual quest acceptance and claims remain unchanged.
[Preparation](2026-10-16-release1-79-59-preparation.json).
[Qualification](2026-10-16-character-garment-row-qualification.md).

Validation: 782 client suites / 12005 tests; 442 hosted browser passes /
13 skips / no reported flakes; 88 native predeploy passes / one skip; eight live
main passes / one skip, two town-recovery passes and one Well Rested party pass.
Four optional workflow steps remain skipped. Local qualification adds seven
distinct native desktop/tablet/phone cases at 1280/900/390px, with workers1 /
retries0, reviewed captures and 601 distinct focused checks across fifteen
suites. Full lint and sixteen generated-content groups pass. Initial native
memory-index scroll resets, earlier isolated focus/fixture failures and the
nonexistent PatchNotes.test.js invocation remain retained with corrections.
Repeated cases are not counted as additional coverage.

Normal-TLS public verification at **2026-10-16T02:50:07.964934+00:00**, after all ten jobs
completed, matches both Alpha1.79.59 identities, exact runtime source, ready
database, analytics module and **all 351 pinned public asset sizes/SHA-256**.
Copied publication: 4454 files / 505 bundled modules. Immutable worker remains
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.
All 493 prior patch entries remain byte-exact within 494 cumulative notes.

The latest requested garment-row implementation is delivered and verified.
This milestone does not complete the full game goal: final owner collection art,
broader quest/menu/world/audio/device/performance, operations and original
owner/F1–F5/beta/cohort/release/handoff gates remain open. Physical-device and
human campaign pacing feedback remains deferred; no soak/stress was run.
[Current work register](2026-10-09-release-readiness-remaining.md).

Raw release evidence is retained at
`/home/aeml/.local/share/eidolon-master-20261011/.qa-release59`.
Direct terminal job API logs include every slash-named browser job.

| Evidence | Bytes | SHA-256 |
| --- | ---: | --- |
| `.qa-release59/final-ci.json` | 22166 | `842f2a5005f55012916a851333fcee8eb3aa4a316339bb4748f4acb0bcbd0d26` |
| `.qa-release59/final-public-after-terminal.json` | 123424 | `61a5dd016435e0bb64a8f31afeb4dbc1b72598262a9afcf357506633d2282ab1` |
| `.qa-release59/expected-public59-assets.json` | 66282 | `504f2b48a015e0305c8693b7428654c314b650628485cd005903f25597958be6` |
| `.qa-release59/build-summary.json` | 5357 | `c73b2d46f0fe69c8cc69762406f33238ad4df0b515c6736820220bb0f0d145aa` |
| `.qa-release59/final-job-summaries.json` | 3488 | `a1ce3965a611d024e372e17a3ce7c3946928018b50f0a7ef48a64ec975381a07` |
| `.qa-release59/client-final.log` | 1175825 | `881c1b9f9bd36620b6c0db8d5758f99b83dd74fb74bcf672a4502de0b291e414` |
| `.qa-release59/browser-1.log` | 79793 | `856bfedd21b470e840da7bb141fdddc37428203de0874a86acedea950f4d03cd` |
| `.qa-release59/browser-2.log` | 94406 | `7b7a61c5b2d7ee4064704a18568492da9bd77f3287977627ab901c028e1c98d4` |
| `.qa-release59/browser-3.log` | 91080 | `7e2af9fc97f84d1629f99ce8ee10e7f729f28f818c760990b20b2370b68dbabd` |
| `.qa-release59/native-final.log` | 58801 | `f05f2a5c2bfb6e912443f4f9f84789eaca1ccb0214462f249f3017e9ed02c180` |
| `.qa-release59/live-final.log` | 219648 | `51be935753e669de0f5e3666a13410f28669898ebf89f8f1fd50a0332e4b27c7` |
| `.qa-release59/patch-history.json` | 60 | `76ac1fe6345420a3a9e37c9b41aee75551f34f2d23320ddfc624bedc0e375a95` |
