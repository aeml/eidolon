# Socket appearance consistency — visual successor candidate

Status: normalization and held-weapon/socket placement implemented; strengthened
per-class rendered checks, equipment gallery, full client regression and lint
passed on85989abc. Native Forge/observer/bag/fresh-login passed onb640e2cf after
fixing a stale Forge gem-panel refresh. Full integrated regression and lint
passed on03bb02a7. The later b97a7ea1 move-only input integration now also passes
full client/lint, native browser-input cases and the actual Forge lifecycle on
47b465c1. The complete isolated gameplay sequence now passes on d3c0fff5;
versioned pipeline/promotion/live acceptance remain pending. See
[held-weapon clearance evidence](2026-09-10-held-weapon-clearance.md) for the
subsequent fix; the earlier failures below remain historical evidence, not the
current result. Built separately from the
accepted local aura/equipment candidate71f18922; no active campaign source or
canonical release was edited. This is an equipment-polish correction within the
existing1.1–1.10 goal, not completion of the broader visual milestone.

## Complete isolated gameplay gate — September 10, 15:43 UTC

5956 TERMINAL0 on clean d3c0fff5b2d364deda327baa95ceebbc2a9de6de:
60 passed cases, zero skipped cases, about49minutes including disposable build
and setup. Node24.18.0 inside `sg render`, system Chrome, CI unset. The actual
`all` sequence ran through ordinary login, dungeon/input/wall checks, phone
inventory/stash/quest/build/adventure flows, Forge upgrades, fresh collection
and manual reward, talent/ability validation, dungeon/death recovery, all four
practice-duel and animation matrices, multiplayer and town nameplates, Well
Rested journey/expiry/party/death/dungeon transitions, and final Forge sockets.

Notable final results: multiplayer2.9min; Well Rested expiry39.1s and journey
40.3s; phone party aura47.4s; actual death/Respawn aura1.4min and repeated dungeon
entry/relogin/Recall1.5min. Final Forge socket case28.7s/30.4s total verifies
normal gem removal/insertion, consumed loose gem, owner/actual observer model
refresh, bag icon and saved equipment through fresh login. It remains an
explicit prepared Forge fixture, not earned item/material acquisition.

Archive `/tmp/eidolon-successor-full-proof-sUeFSL` retains available result trees,
final report, full native log and earlier3775-test client/lint evidence. Wrapper
credential scan sanitized0files. The redirected log lay outside its default
artifact roots; additionally sanitized its34 disposable username occurrences
using the existing scanner on the archive (one file changed, zero remaining
prefix matches). Prefer this archive to the original private redirected log.
Exact owned API/Mongo containers and image for `successor-full-0910` are absent;
API18580/Mongo18581/web41980 have no listeners after normal wrapper cleanup.

Manually inspected the retained High390 portrait and Low844 landscape party
world captures: both player aura rings/effects are visible at ordinary framing.
Long disposable names crowd nearby labels, and the QA performance overlay is
present. These are emulated-phone rendering checks, not physical-device or
complete mobile-polish acceptance. Earlier detailed weapon/socket galleries
retain their separate source-specific scope; no Forge screenshot was retained
by this final fixture beyond its DOM/model/pixel assertions and report.

No release number changed, no push and no deployment occurred. This completes
the combined isolated `all` gate, not the entire versioned CI/predeploy suite,
fresh full campaign, all dungeon/raid/class/party matrices or full visual goal.
Canonical release60 acceptance must precede successor version assignment,
accurate player-facing patch notes, synchronized login/manifest/server metadata,
required CI and live checks. The separate primary starting-stat correction is
not part of this source and has its own pending full/native acceptance.

## Native Forge verification — September 10, 13:50 UTC

### Final integrated verification — September 10, 14:35 UTC

47b465c1 adds three native browser input cases to the existing required anonymous
ground-aim suite: near enemy, distant enemy and Shift first pressed while chat
has focus. Native keyboard/mouse events feed production InputManager and
GameEngine.update across five animation frames while the mouse remains held.
Checks require the real floor destination, no attack/interaction, held key state,
release cleanup and ordinary interaction afterward. The hovered actor is fixed
and the player records destinations; this isolates input ownership, not actual
collision, physical movement, rendering quality or server combat.

6014 lint/discovery passed all4cases (the exact-ground aiming case is retained).
31538 TERMINAL0 under system Chrome:4cases/12.3s/zero retries. Archive
`/tmp/eidolon-browser-move-only-proof-qgkTCC`;41980listener absent afterward.
83064 TERMINAL0 onclean47b465c1:270suites/3775tests137.978s plus lintNode24.18.0.
Logs `/tmp/eidolon-move-only-release-full-{client,lint}.log`.

46506 TERMINAL0 on the same clean47b465c1: dedicated socket-owner/socket-observer
helper now exercised against actual disposable services, one case29.0s/30.8s
total/zero retries. Normal Forge changes, both clients' models, filled UI/bag
icons, re-equip and fresh-login equipment all passed. Archive
`/tmp/eidolon-forge-release-input-proof-Ks2YYI`; credential scan sanitized0 and
exact owned18580/18581/41980services/listeners absent. Full predeploy and its
expanded recovery suffix have not been run as a complete sequence on this tip.
No new version or deployment; inherited release acceptance remains required.

The explicit isolated `forge-socket-appearance` route uses two real clients and
new disposable accounts. Only initial level30 equipment and one loose gem are
seeded; all removal, insertion, unequip/re-equip and login actions use the normal
UI/server flow. The owner starts with a Ruby-socketed Rare Iron Sword and a loose
Flawed Sapphire; Gold stays0. This is appearance/persistence verification, not
earned acquisition, currency costs, phone input or broader campaign acceptance.

-74721 on1a12d02f failed the bag-icon assertion: the test inspected the outer
 inventory slot instead of its inner artwork. Before that, both actual clients'
 attached models refreshed after Ruby removal and Sapphire insertion. The Forge
 icon also remained at its optimistic empty-socket state, exposing a real bug.
 Archive `/tmp/eidolon-forge-socket-failure-zIfaOQ`; credential scan sanitized0.
-47351 RED3failed/6passed reproduced missing gem-panel refresh, stale selections
 and unchanged-state node behavior. f4f0362e adds authoritative gem-panel refresh
 while retaining the tab/valid equipped selection and avoiding node replacement
 when equipment/inventory are unchanged.20231 PASS34tests/3suites1.313s+lint.
-76163 onf4f0362e failed at4minutes because the test toggled an already-visible
 bag closed before re-equipping. Filled-Sapphire Forge icon and both real-client
 models passed first. Archive `/tmp/eidolon-forge-refresh-failure-Gly8la`;
 credential scan sanitized0, owned services/listeners absent. No timeout increase.
-b640e2cf corrects only the bag visibility precondition and requires visible
 inventory/slot before inspecting its art or clicking.95175 TERMINAL0: one case
 19.3s,20.8s total, zero retries. Actual server-owned removal/insertion, consumed
 loose gem, same item ID/new model UUIDs on owner and observer, filled-Sapphire
 Forge and bag icons, normal re-equip and fresh-login equipment all passed.
 Archive `/tmp/eidolon-forge-socket-proof-S6Uq7N`; credential scan sanitized0,
 exact disposable containers and18580/18581/41980listeners absent after cleanup.

The native scenario is now required at the end of full predeploy and its focused
recovery suffix, using distinct socket-owner/socket-observer accounts and a
dedicated output directory. 14535 PASS24release-contract tests/3suites.826s+lint.
First full69308 failed the existing suffix-alignment assertion (268suites passed,
one failed;3759tests passed,one failed;121.91s). 03bb02a7 adds the new requirement
to the focused suffix as well; final focused26tests/4suites.917s+lint/shell pass.
87508 TERMINAL0 onclean03bb02a7: full269suites/3760tests121.835s plus lint.
Logs `/tmp/eidolon-forge-integrated-verified-full-{client,lint}.log`; the earlier
failure remains at `/tmp/eidolon-forge-integrated-full-client.log`.
Native95175 used the same runtime/test body, before the helper acquired its
dedicated account names; no full updated predeploy/suffix native pass is claimed.

Existing
rendered evidence remains scoped to its inspected poses/quality levels; this
native test has recordings disabled and does not supply new visual screenshots.
No version, patch-note release or production deployment is claimed here.

### Draft player-facing notes for the eventual successor

- Socketed gems now use consistent colors in equipment models and item icons,
  including after replacing a gem on the same piece of equipment.
- Held blades and their socket inlays sit more clearly outside class garments.
- The open Forge's gem panels now refresh after server-confirmed changes,
  without requiring the window to be closed and reopened.
- Hold Shift while clicking to move without attacking or using an object under
  the pointer. The move-only intent stays consistent while the mouse is held.

These are unpublished draft notes, not shipped patch notes. Combine them with
the inherited aura/equipment/quest-role changes, assign the next available version
only after canonical60 acceptance, then verify the complete release and live game.

### Move-only input integration — September 10, 14:10 UTC

b97a7ea1 brings only the initial/held Shift gesture, its input tracking and
focused tests from primary into this release candidate. No unfinished campaign,
reward or dungeon-balance changes were imported. Control/Meta jump priority,
ordinary interactions, mobile taps, menu guards and server/collision authority
remain unchanged. The opaque-interactable unit case uses existing Forge, not
the ChronicleSite feature absent from this baseline.

40402 RED9failed/12passed reproduces the missing initial/held behavior on the
release baseline. First63433 PASS48tests/4suites1.779s+lint still used invented
held-key state, and did not detect InputManager's missing Shift field. Primary's
actual native replay95608 failed again on issued movement, not death or timeout.
The initial mouse event contained Shift, but InputManager only tracks declared
key fields; Shift was absent. Actual key-event/engine-update tests then reproduced
4failures on primary. The integration includes that subsequent fix as well.

The held-engine regression now reads production InputManager key state. Window
keydown/keyup/blur tests cover both Shift keys; a focused-chat-to-canvas test
covers a Shift keydown deliberately ignored while typing. Left mousedown adopts
its real modifier snapshot. 82243 TERMINAL0:51tests/4suites2.126s+lint/diff.
Logs `/tmp/eidolon-release-real-shift-{focused,lint}.log`; preserve the earlier
red `/tmp/eidolon-release-move-only-red.log`. Full client and native verification
of this expanded candidate remain pending;03bb02a7's full result is historical.

## Reproduced behavior

The item system accepts canonical gem names and uppercase enum keys. Socket
models and equipment icons instead indexed title-case color maps directly, so
uppercase gem records produced neutral stones. Both renderers also already
supported the alternate `gemType` field, but the equipped appearance signature
only read `type`. Replacing Ruby with Sapphire under the same item ID using
`gemType` could therefore retain the previous equipped model.

Normal current server `SocketedGem` records use canonical `type`; this evidence
does not show every production socket was affected. It demonstrates inconsistent
handling of forms supported by the client and stale visuals on the alternate
field. No item/stat/reward/save-schema or server changes are needed.

## Correction and evidence

One shared appearance-name resolver now drives icon socket colors, model socket
colors/material keys and equipment change detection. Canonical art is unchanged;
equivalent names reuse material/model resources, real gem replacements refresh,
and unknown/malformed data stays neutral instead of assuming Ruby. Input data is
not mutated. Forge or gameplay stat calculation rules are unchanged.

- Initial red19933:9/9 tests failed on the old implementation; log
  `/tmp/eidolon-socket-visual-red.log`.
- First follow-up47923:2passed/7failed because the test used Playwright's optional
  message argument with Jest's `expect`. Corrected the assertion API without
  removing the material-identity assertion. That run is not a green result;
  `/tmp/eidolon-socket-visual-green.log` retains its failure despite the filename.
- Corrected51581:241tests/4suites3.390s plus lint. Broader final91082 TERMINAL0:
  **253tests/4suites3.482s**, lint underNode24.18.0 and `git diff --check` passed.
  Final logs `/tmp/eidolon-socket-visual-final-{unit,lint}.log`.
- Coverage includes all seven gem types, both fields/name forms, icon equality,
  actual attached-model replacement for all four class rigs, unchanged item ID,
  no rebuild for equivalent records, neutral malformed inputs and data retention.
  Existing procedural equipment/icon and remote replication suites also pass.
- Full21864 on frozenbdf3a2df TERMINAL0:267suites/3741tests121.725s followed by
  lintNode24.18.0. Logs `/tmp/eidolon-socket-visual-full-{client,lint}.log`.
  This began only after earned44188 was terminal and prepared class native32340
  had also finished. No competing local browser/heavy gate or source edits.

## Remaining acceptance and release

### Rendered comparison prepared — September 10, 12:18 UTC

`tests/e2e/socket-gem-render.spec.js` prepares the production renderer and all
four actual class meshes with the same socketed sword. It compares seven gem
palettes at High and Low quality, canonical `type` against uppercase `type` and
both `gemType` forms, using fixed poses/camera and a neutral-socket RGB baseline.
Assertions require visible rendered color signal, identical equivalent frames,
no unnecessary equipment rebuild, matching icon sources and actual attached
socket/item metadata. Four-class screenshots and JSON comparisons are retained.

This is a component visual check, not native Forge, multiplayer, phone, item
acquisition or balance evidence. Group-frame pixel signal alone does not prove
each individual tiny socket is readable; inspect the images as well. Production
source is unchanged from9ef7e1b7/bdf3a2df. Lint13668 and one-case Playwright
discovery19716 passed underNode24; lint log `/tmp/eidolon-socket-render-lint.log`.
The subsequent rendered attempts and narrower evidence limits are recorded below.

### Rendered results and visibility gap — September 10, 12:26 UTC

Primary38977 passed and was archived before these browser runs. Initial79252
failed before rendering because this separate worktree had no generated vendor
dependencies. Archive `/tmp/eidolon-socket-render-setup-failure-0mD1v7` retains
that setup failure. Normal `npm run prepare:client` generated the missing files;
the unchanged test was then run again, not silently retried inside Playwright.

42354 on9caa198d passed1case6.0s (7.5s total): seven types×two quality levels×
three equivalent representations,42zero-RGB-difference comparisons, matching
icons/no rebuild, visible group signal. Archive
`/tmp/eidolon-socket-render-proof-qXJs7F`. Inspected RubyHigh/Low, SapphireHigh
and EmeraldHigh images: too wide to judge individual tiny sockets reliably.

Added actual attached-weapon close-up cameras without moving/enlarging the
weapon/gem or removing the surrounding actor. 35854 onff0be297 passed1case9.1s
(10.6s total), same comparisons plus all sockets projected inside their views.
Archive `/tmp/eidolon-socket-closeup-proof-wiw1sA` retains14group images,
14four-class close-up mosaics and reports/logs. Inspected all7High close-ups:
Fighter's socket changes color visibly, but the other classes' sockets are
obscured in this prepared pose. Group-level pixel signal is insufficient.

Strengthened the test to change ONE actor's socket at a time, keeping neighbors,
pose and camera fixed. **22608 TERMINAL1 on7efc60f5**,3.2s: HighRuby signal4706
forFighter and0forRogue/Wizard/Cleric. All four socket centers project inside the
camera frustum, so in-frame metadata does not establish actual visible color.
The test fails on Rogue's own visible-color assertion; keep that assertion.
Archive `/tmp/eidolon-socket-visibility-failure-eaIvhd` retains failure screenshot,
detail mosaic, trace/video, report and native/lintlogs. No remaining41980listener.
This is an anonymous prepared scene; no account, resource or save was altered.

Production code remains unchanged frombdf3a2df. Lint35728 passed for the stronger
test; this is not a gameplay or normalization-code regression established by the
new evidence. The prepared frame does not advance a gameplay animation, so do
not claim sockets are hidden in every live pose. Investigate actual idle/attack
poses and equipment placement/occlusion before changing geometry. In particular,
blade geometry grows along local+Y from the hand and the current socket origin
is[.1,.3,.08]; inspect its relation to the forearm rather than merely making the
material brighter or weakening the visibility test.

The earlier group-comparison passes retain their narrow meaning but DO NOT close
all-class rendered equipment acceptance. Next resolve the per-class visibility
gap, rerun strengthened comparisons and inspect High/Low details, then ordinary
Forge/local+observer/save acceptance. Canonical release60 remains ahead of any
successor push/version assignment.

1. Earned44188 is now TERMINAL1 (second Warden survival failure), archived at
   `/tmp/eidolon-earned-upgrade-failure-sQmC8N`. Preserve that result; this visual
   correction is not a fix for its combat failure or evidence of a dungeon clear.
2. Full client regression/lint on this candidate is complete. Inspect rendered socket colors for all
   seven types and all-class equipped fit; compare canonical versus enum forms
   at the same camera/quality. Confirm no geometry or palette regression.
3. Verify an ordinary Forge socket change updates bag icon and equipped local/
   observer presentation and survives login. The alternate-field repro may be
   explicitly prepared visual evidence; do not label it production wire evidence.
4. Integrate with the visual successor only after its appropriate checks. The
   previous aura/equipment proof belongs to its original source, not automatic
   acceptance of this additional source. Keep canonical60 release acceptance
   first, choose the next version when ready, update login/manifest/notes, and
   require that version's CI and live checks. No release number is assigned here.

Proposed player-facing patch note (unreleased):
“Socketed gems now keep consistent colors in equipment icons and character
models, and supported gem replacements refresh equipped visuals immediately.”
