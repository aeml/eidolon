# Unpublished aura integration with the corrected release baseline

Status: full/render/equipment and the uninterrupted combined recovery suffix
pass locally. Remote release/promotion and live verification remain open.
This is not a deployment,
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

1. The independent campaign attempt96530 on626385d terminated at the first boss
   survival assertion; preserve that failure. Its subsequent equipment diagnosis
   and corrections passed local checks on primary. Keep future native campaign
   work separate from these release gates and avoid competing heavy/browser runs.
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

## Verified equipment fixes brought into the visual-release integration

Before running this branch's full gates, transferred only the two runtime fixes
and their focused tests from primarybf8d36d6: unfamiliar-item icon fallbacks and
stable equipment-slot DOM/artwork during character-sheet updates. The relevant
runtime/icon tests and new slot-refresh tests match primary exactly. No expanded
campaign, reward, encounter, stat or server changes were brought across.

Also included the standalone prepared equipment-upgrade policy/helper/spec,
policy tests and real-shell output/fail-fast checks needed to exercise these
fixes on this release baseline. The optional `equipment-refresh` isolated route
runs three independent full-bag drag/refresh/login cases, then the existing
Forge/guide scenario, retaining each command's artifacts in separate directories.
This does NOT enable automatic equipment upgrades for players or alter the
release baseline's earned campaign driver. Primary-only source-wiring tests were
not imported into a branch that does not have that campaign integration.

Primary acceptance was full293suites/4125tests+lint and retained native3+1 cases
onf2600a44, archived at `/tmp/eidolon-equipment-refresh-proof-T4FHu5`. That proof
does not replace this branch's own integrated full/render/native gates.

Focused release-integration59078 exited0:93tests/6suites13.92s, lint and Bash syntax,
Node24.18.0. Logs `/tmp/eidolon-aura-equipment-unit.log` and
`/tmp/eidolon-aura-equipment-lint.log`. Full integration regression and actual
rendered/native acceptance are still pending; no version/push/deployment changed.

Include in the eventual correctly versioned successor notes: unfamiliar items
now show recognizable slot art or a neutral fallback instead of missing images;
equipment drag targets and keyboard focus survive stat updates while Forge/item
changes still refresh their display. Retain the aura-batching and quest-role
notes above. Do not publish under the unchanged base version or bypass60's gate.

## Integrated acceptance and decorative hit-target correction

Frozen30b2dd42 full10444 passed266suites/3719tests135.261s plus lint onNode24.18.0.
Render1612 exited0: role/combat cards5cases22.7s and aura4cases1.2m. Inspected
all6story/daily role crops across desktop/portrait/landscape and populated20
High/Low screenshots. The18single/5/20actor pixel comparisons had zero RGB
difference; GPU lifecycle released all owned buffers. Controlled20actor High
draws1541 versus2101reference, Low1501 versus1741. These are not physical-phone
or native-combat FPS acceptance. Earlier pending-render statements are historical.
Archive `/tmp/eidolon-visual-integration-render-proof-Cgv0kl` retains the scoped
role artifacts, independent renderer tree/JSON and full/lint/render logs.

Native86642 on30b2dd42 failed:2equipment cases passed, one ring drop did not
arrive despite target dragover events; Forge correctly did not execute. Items
remained intact. Actual scan0, containers/ports cleaned. Failure screenshot
inspected; archive `/tmp/eidolon-visual-equipment-failure-gDAxRp`, log
`/tmp/eidolon-visual-equipment-native.log`. Do not treat primary's earlier native
passes as acceptance for this integrated candidate.

Added a real-browser center hit-test assertion for occupied equipment slots.
Baseline53132 on5a2c41d0 failed all3cases at that assertion: decorative children
receive hits rather than the stable slot. This proves a split hit target, not
by itself every cause of intermittent drag failure. Baseline artifacts/log:
`/tmp/eidolon-equipment-hit-baseline-proof-faBui9`; scan0 and owned ports cleaned.

The CSS correction makes equipment artwork/potency labels pointer-transparent,
leaving native hit/drop/click handling on the stable slot. No item/currency/
server changes, artificial drop events or swap retries. Added a stylesheet-backed
unit test for icon/potency hit handling; retain the center assertion and all
existing full-bag/paired-slot/persistence checks in the native rerun. Successful
integrated equipment+Forge, Well Rested native suffix, final full regression and
remote/live promotion remain required. Eventual patch notes must also mention
stable equipment dragging across artwork, once verified.

## Corrected equipment acceptance and recovery execution evidence

Focused26258 passed67tests/5suites17.382s plus lint. On frozen runtimec3305ae7,
native77847 passed all3equipment cases56.1s and Forge1case22.3s. The new native
hit assertion, all6ordinary swaps during UI refresh and fresh-login ownership
checks passed without retries. Actual scan0 and owned18580/18581/41980ports/
containers cleaned. All4images inspected: readable item art, updated equipment,
Forge potency+2→+3 and damage46→50. Archive
`/tmp/eidolon-visual-equipment-hit-proof-sqU6uz`; log
`/tmp/eidolon-visual-equipment-hit-fixed.log`. The3source/test files were also
ported to primary25495d95, whose final full regression remains pending.

On SAMEc3305ae7, final63011 passed266suites/3720tests129.789s plus lint under
Node24.18.0. Logs `/tmp/eidolon-visual-hit-final-{client,lint}.log`. No server
source differs from canonical62dc2d1. The artwork hit-target fix is now locally
verified and belongs in the eventual successor notes; no automatic equip feature.

Combined recovery49294 terminated143 during party startup, after journey/expiry
2cases1.2m passed. A fresh unchanged attempt93245 also terminated143, after
journey/expiry2cases1.3m, party1case43.4s and death/respawn1case1.4m passed, during
dungeon rest setup. Cause remains unknown; no relevant kernel OOM evidence was
found. Neither is a completed suffix or successful final credential scan. Worker
absence and exact orphan static-server ownership were checked, then only each
run's server process group and disposable API/Mongo/image were removed; ports
were verified closed. No nightly/production service was interrupted.

Archives `/tmp/eidolon-visual-rest-interrupted-proof-0sZFVx` and
`/tmp/eidolon-visual-rest-second-interrupted-9u3pih` retain these partial runs.
Known-username scans sanitized1file in each archive, but the killed wrappers'
password environments were unavailable. Do not describe these as full
credentialed artifact scans. Logs `/tmp/eidolon-visual-rest-native.log` and
`/tmp/eidolon-visual-rest-second-native.log` remain interruption evidence.
Inspected second-run portrait/landscape status/world and respawn images. Party
used2real clients, actual joystick movement and High5/Low4/High5 aura meshes per
actor; RADV samples median16.7ms, not physical-phone performance acceptance.

Standalone37202 on samec3305ae7 completed both native transitions2.8m with a
streaming PTY. Actual credentialscan0, ownedcontainers/ports cleaned; archive
`/tmp/eidolon-visual-transitions-proof-S1htBZ`, log
`/tmp/eidolon-visual-transitions-native.log`. Hostile death/relogin removed aura
and kept hitbox opacity0; real Respawn restored full resources and exactly one
aura. Two guide-entry/dungeon-login/Recall cycles preserved correct aura ownership
and bank behavior. Inspected second dungeon and town-return images. Prepared
level30 entry is not an earned dungeon clear or complete dungeon-art acceptance.
Streaming execution succeeded here; it does not establish the signal's cause.

Next: run the complete unchanged journey/expiry → party → transitions suffix
to terminal success with its actual credential scan/cleanup. Keep the corrected
runtime frozen while running. Then reconcile release60's remote/live acceptance
before assigning/pushing the successor with accurate patch notes. All broader
campaign, class/group/raid, balance, phone and casino requirements remain open.

## Uninterrupted combined recovery accepted locally

Session26206 on cleanc78f29e6 TERMINAL0. This source differs from full-tested
c3305ae7 only in this plan; all runtime/tests are identical. The complete
unchanged suffix passed: ordinary journey/expiry2cases1.3m, real-party1case48.8s,
hostiledeath/repeateddungeontransitions2cases2.9m. Its actual final credential
scan passed with0sanitized files and ownedAPI/Mongo/webports18580/18581/41980
were all absent after cleanup. No renewal of rest, phase limits or test retries.

Retained all3scoped image trees, final HTML and complete log at
`/tmp/eidolon-visual-recovery-complete-proof-JgdGF2`; source log
`/tmp/eidolon-visual-rest-stream-native.log`. Inspected this run's portraitHigh/
landscapeLow status panels, respawn and second dungeon-return images: readable
buff text, visible owned aura, no lingering interaction cube. Party profiles
retain their actual RADV hardware identity and median16.7ms with p95around33ms;
neither these samples nor earlier faster samples prove physical-phone performance.
No full earned dungeon-clear claim follows from prepared level30 transitions.

The two terminated attempts and their limited scans remain historical failures
to complete execution, not retroactively successful runs. Streaming execution
now completed both standalone and combined routes; the earlier signal's cause
is still unknown. This closes the combined local gate, not release60remote/live
acceptance or the successor's versioned pipeline and production acceptance.
Assign version/patch notes and promote only after those prerequisite gates allow it.
