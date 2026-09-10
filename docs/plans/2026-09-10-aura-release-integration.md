# Unpublished aura integration with the corrected release baseline

Status: local integration and focused checks only. This is not a deployment,
accepted release60, or a published successor version. Keep release60's canonical
worktree and active CI unchanged.

Integrated aura branch0d535d6 with corrected release candidate
62dc2d1eb1baf8030fc69244b1522deb5f6d2340 in this separate worktree. Git merged the
workflow, package scripts and isolated QA wrapper without conflicts. The runtime
`ProceduralStatusEffects.js`, native aura-transition scenario and renderer wrapper
are byte-for-byte unchanged from the verified aura branch. No server files differ
from62dc2d1. The latest respawn fixture and settled ground-spell corrections remain.

The change preserves the Well Rested look while batching sparks, with the
existing required renderer/lifecycle gate, independent retained artifacts and
native transition suffix. Its previous rendered and native evidence is in
[the aura plan](2026-09-09-rest-aura-batching.md); that evidence does not substitute
for the integrated branch's remaining regression and release acceptance.

## Integrated checks completed

Session3362 TERMINAL PASS131tests/11suites4.647s, then lint, shell syntax checks
for both wrappers and successful parsing of the merged workflow underNode24.18.0.
Coverage includes batching, pixel comparison, GPU-buffer observation, aura state
and release wiring, standalone recovery gates, settled ground approach, trained
ground shapes and respawn presentation. Logs:
`/tmp/eidolon-aura-integration-unit.log` and
`/tmp/eidolon-aura-integration-lint.log`. No full-suite, browser or live acceptance
is claimed for this integration.

Session25774 also completed `npm run prepare:client` and actual Playwright
`--list` discovery underNode24.18.0, without launching a browser/server. All nine
expected cases across seven files are present: four rendered batching/lifecycle/
population cases, journey, expiry, party, hostile death and repeated dungeon
transitions. Logs `/tmp/eidolon-aura-integration-prepare.log` and
`/tmp/eidolon-aura-integration-discovery.log`. Source remained clean; browser
assets are ignored generated dependencies. Discovery is not execution or a
substitute for the integrated native gates below.

## Promotion gates still open

1. Preserve the current independent campaign attempt96530 on frozen626385d;
   do not launch competing full-suite/browser work while it remains active.
2. Run the integrated full client suite, renderer/lifecycle/populated checks and
   native recovery/party/transition checks with retained, sanitized artifacts.
   Verify merged release60 regressions, not only the previously tested aura code.
3. Wait for canonical release60's successful remote pipeline and actual live
   acceptance. Do not push this successor or preempt its scheduled-soak blocker
   without the required operational direction.
4. Reconcile any newer accepted baseline, assign the next available version and
   write accurate player-facing patch notes with matching client/server/login
   identities. This preparatory branch deliberately retains its base version;
   never publish the new feature as an undocumented replacement of that release.
5. Run the complete successor pipeline and verify the deployed identity and real
   gameplay. Fixed-pose draw-call reductions are not a physical-phone or native
   combat FPS claim. All wider roadmap gates remain required.

## Small quest-giver card polish — pending rendered verification

Viewed the active primary campaign's `earned-collection-ready.png`: the target
card repeated “Archmage Ilyra” in both title and subtitle. This branch already
supports the same quest NPC role flag. Its subtitle now says “Story quests” for
Ilyra or “Daily contracts” for the daily giver, alongside the unchanged in-range/
move-closer state. Names, distances, prompts, marker colors and actions remain.
This adds a textual role cue instead of relying solely on marker color.

The first focused run40047 failed a proposed lore-discovery case: unlike primary,
this release baseline does not yet support ChronicleSite interactions. Removed
that unsupported addition from this branch rather than mocking away the missing
capability. Keep the lore-role improvement for the expanded campaign integration;
the new two-NPC runtime change does not introduce partially supported story sites.
Original log `/tmp/eidolon-role-hint-unit.log` retained.

Final59343 PASS92tests/3suites2.045s plus lint, Node24.18.0; logs
`/tmp/eidolon-role-hint-{unit,lint}-final.log`. Both NPC roles preserve their title,
prompt and real range decision in near/far cases; existing portal/combat checks
pass. No post-change browser image is claimed. Before promotion, inspect both
quest NPC cards on desktop and phone alongside the integrated gates above, and
include the role-label change in the successor's eventual patch notes.

The existing required interface spec now includes three role-card presentation
cases at1280x720,390x844 and844x390. Each constructs the actual QuestNPC, builds
its hint through GameEngine and renders through UIManager/CSS; checks both roles
near/far, on-screen bounds, horizontal overflow and clearing; and captures each
nearby role card. Phone cases explicitly enable the phone layout, not physical
touch emulation. No pointer-selection or server-interaction proof is claimed.
These run through the existing `test:e2e:interface` command in browser job2, with
the two original combat-card cases retained.

Discovery/lint89395 exited0 underNode24.18.0: all5cases in the interface spec
loaded, no browser started. Focused18414 then passed254tests/2suites3.785s for
version/workflow presentation and entrance hints. Logs:
`/tmp/eidolon-role-hint-discovery.log`,
`/tmp/eidolon-role-hint-browser-lint.log` and
`/tmp/eidolon-role-hint-wiring-unit.log`. Actual rendered execution and image
review remain pending behind the active campaign browser; discovery is not a pass.
