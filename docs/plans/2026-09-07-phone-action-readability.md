# Phone actor-action readability after Alpha 1.0.39

Unversioned checkpoint `c9c93b9b521d27c1b96bbc113c150893bb6399b1`, after the preserved 1.0.39 source
`c6145c35dc935ae197ca643ce1a3dfe75416fcd1`. Not included in that candidate or
published. The full 1.1–1.10 roadmap remains open.

## Evidence and design

The final real-party screenshots for 1.0.39 still show long replicated actor
labels extending across the portrait view. `buildRemoteActionReadabilityText`
keeps the full name, while `FloatingTextManager` previously rendered a single
unbounded nowrap line with a 1.5× pop and a fixed 2.5-world-unit anchor. It can
therefore cover a taller model as well as run offscreen.

The before fixture uses the exact preserved 1.0.39 floating-text module, with the
same text/color/position and production Cleric model as the new fixture. All
three sizes fail the width requirement: **855.38px at 390×844**, **877.04px at
844×390 and 568×320**. Retained captures/traces:
`/tmp/eidolon-phone-action-before-dodA7Z/results`; log
`/tmp/eidolon-phone-action-before-browser.log`. This is an emulated presentation
reproduction, not earned progression or physical-phone evidence.

Phone action, attack/jump and replicated support labels now receive a structured
actor/action presentation. The actor's full name remains in the DOM and accessible
label while its visible line ellipsizes; the action has a separate readable 16px
line. Local effects omit the redundant name as before. A maximum 192px layout and
restrained 1.12× pop stay contained within the viewport. The label anchors above
declared model height; wholly offscreen actors do not acquire false edge labels.
Labels remain touch-through. This preserves actor attribution: a cast names the
caster, while a replicated buff-state label names the affected actor, as before.

Desktop action text and normal numeric damage/healing feedback keep their prior
presentation. Pooled elements reset their compact styling/visibility/attributes
before reuse as numbers. Disposal removes active and pooled elements and rejects
late callbacks. Layout measurement happens at spawn or a responsive width change,
not on every animation tick.

## Verification

- Initial new unit checks reproduce **4 failures / 1 pass in 0.75s**. Initial
  implementation and existing callout tests pass **58 tests in 1.184s**;
  structured engine integration checks increase this to **61 in 1.666s**.
- New rendered checks pass **3 layouts in 7.9s**: preserved full attribution,
  readable action text, viewport edges and expiry. Before/after portrait captures
  are inspected. Log `/tmp/eidolon-phone-action-after-browser.log`.
- Initial full client regression passes **198 suites / 2,923 tests in 73.421s**;
  lint passes. This precedes the final late-callback guard below.
- Extending disposal coverage exposes a real late-callback regression (**1 failed /
  6 passed in 0.78s**); the disposed manager could recreate a node. It now rejects
  new spawns after disposal. Offscreen-to-number pool reuse and literal-text
  markup safety are also checked.
- Final full client passes **198 suites / 2,925 tests in 128.766s**;
  `/tmp/eidolon-phone-action-full-client-final.log`. Final real two-account support
  passes **43.8s**, `/tmp/eidolon-phone-action-live-party.log`. The support route
  checks the actual recipient-state label's bounds, size and retained identity
  after an authoritative Divine Intervention heal. Browser guards, credential
  scans and exact temporary cleanup pass. The actual portrait screenshot is
  inspected: full-width overflow is replaced by a compact name/action pair above
  the model, with numeric healing feedback unchanged.
- The three new rendered checks now join the regular anonymous suite. The
  expanded full repeat passes **all 53 tests in 5.7 minutes**;
  `/tmp/eidolon-phone-action-full-anonymous.log`. Final lint and whitespace also
  pass. All verification processes for this pass are terminal. This remains an
  unversioned checkpoint after the preserved 1.0.39 candidate, not a published
  release or a substitute for broader group-play evidence.

## Still open

Dense group-effect overlap, world-space nameplate sizing, physical-device contrast
and touch play, and broader class/talent parity remain open. This pass fixes long
action-label overflow; it does not claim complete raid/phone readability.
