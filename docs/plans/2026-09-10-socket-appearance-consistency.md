# Socket appearance consistency — visual successor candidate

Status: normalization and held-weapon/socket placement implemented; strengthened
per-class rendered checks, equipment gallery, full client regression and lint
passed on85989abc. Native Forge and versioned deployment remain pending. See
[held-weapon clearance evidence](2026-09-10-held-weapon-clearance.md) for the
subsequent fix; the earlier failures below remain historical evidence, not the
current result. Built separately from the
accepted local aura/equipment candidate71f18922; no active campaign source or
canonical release was edited. This is an equipment-polish correction within the
existing1.1–1.10 goal, not completion of the broader visual milestone.

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
