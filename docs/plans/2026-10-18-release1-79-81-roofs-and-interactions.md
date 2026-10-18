# Alpha 1.79.81 — roofs and deliberate interactions

Prepared, not deployed. The latest accepted live runtime is Alpha1.79.80/f5401eb7.
This milestone completes the owner's six gameplay corrections as a coherent batch;
it does not close the full beta/release-readiness roadmap.

- B/menu town recall casts for three seconds; movement cancels it. Only the
  authoritative matching completion teleports the character.
- Quest objects and Chronicle collection items use stationary three-second casts.
  NPC acceptance and manual turn-ins remain immediate, as explicitly requested.
- World clicks/touches and manual phone movement close window owners first;
  dragged positions remain saved. Desktop camera pan retains its normal behavior.
- Fighter/Cleric basics require body contact plus a half-unit gap, at admission
  and impact, with roof height separation. Existing ranged basics remain ranged.
- Nineteen town roofs support landing, pitched walking, eave falls, jumping down,
  saved-position recovery and durable dropped items on the correct floor.
- Earth uses the existing timber/iron/lantern fence factory. Normal initial entry
  and instance return build it and retire loaded or pending orange legacy meshes.
- A capability handshake gives cached clients a readable reload instruction
  before world entry, preserving saved characters and reconnect token custody.

Schema27 adds a writer fence without backfilling existing character/item data.
Roof drops use ledger version3; existing version1/2 fingerprints remain unchanged.
The public binary wire version remains2. Maximum flight is1.1seconds, reserving
400ms of the original1500ms native input-to-confirmed-landing requirement for
network/rendering. Known prior float32 caps retain pending pose/animation.

## Qualification

See [the implementation and retained findings](2026-10-18-gameplay-interaction-quality.md).
The prior cap passes eight actual socket/recovery cases; current-version API and
complete native successors are required. Native negatives remain retained:
phone omitted-zero fixture, real missing initial Earth construction, and the
1505.6ms Cleric confirmation miss. Their requirements are not waived.

Corrected startup/armor/scenery checks pass65cases/five suites. Jump checks pass
122cases/four suites and28Go-race outcomes, including legacy float32 behavior.
CI-policy checks pass57cases/three suites; hosted browser discovery covers exactly
473cases with no omissions/duplicates. Existing checks overlap; counts are scoped.
The original-tree full client run completed:12584checks/811suites pass, with
seven old armor fixtures failing in one suite. Their positions are corrected
in the isolated release tree; their damage assertions remain unchanged.
Full lint, shell syntax and all17generated content groups pass.516patch entries
are retained, with ten initial entries and51lazy pages. Final exact-version
API/native and whole-CI qualification remain required.

Before publication: complete exact-version API/native checks and final release
consistency/content/lint validation, fetch and ordinarily merge remote changes,
merge the validated milestone into master, push without force, then require the
full pipeline and verify public frontend/backend identities and served assets.
No later release may precede that deployment verification. Keep public access
unchanged. Final art, whole-game performance, human/device feedback, production
backup policy/owner handoff, beta approval and the remaining roadmap remain open.
Soak/stress remain deferred.
