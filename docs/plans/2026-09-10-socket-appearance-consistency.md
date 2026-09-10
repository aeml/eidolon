# Socket appearance consistency — visual successor candidate

Status: implemented and focused checks passed; full regression, rendered/native
acceptance and versioned deployment remain pending. Built separately from the
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

## Remaining acceptance and release

1. Preserve main44188 and frozen primary4b3991ff. Do not run a competing browser
   or heavy full suite while the earned campaign owns that gate.
2. After its terminal result/artifacts are retained, run full client regression
   and lint on this exact candidate. Inspect rendered socket colors for all
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
