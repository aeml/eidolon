# Socket appearance consistency — visual successor candidate

Status: implemented, focused checks and full client regression passed;
rendered/native acceptance and versioned deployment remain pending. Built separately from the
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
The rendered test has not run yet: primary's post-combat dungeon-rest native
gate38977 owns the sole local browser/heavy slot. Wait for its terminal result
and preserve its artifacts before starting this comparison.

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
