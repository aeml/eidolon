# Alpha 1.54 duel and combat presentation work

September 30, 2026. Duel fixes and Fighter runtime preparation are locally
implemented and tested. Alpha 1.54.0 is packaged as a release candidate, pending
exact-source CI and independent public acceptance. The
[exact 1.53 predecessor is publicly accepted](2026-09-30-release1-53-acceptance.md).
Scoped Fighter integration checks now pass; final modern-art approval remains
separate from this alpha pilot.

The roadmap scope is opt-in duels/open-world PvP, safe-zone protection,
surrender/defeat and readable combat without unintended PvE loss or griefing.
The existing handlers already support challenges, explicit responses, PvP flags
and forfeits; retain the authoritative scene and durable arena-result paths.

## Implemented duel changes

Challenges carry unique consent IDs and actor-instance bindings. Responses must
echo the exact current ID; stale Accept/Decline cannot consume a later prompt.
Expiry is exclusive, and expired challenges are not advertised. Repeated pending
requests reuse the original ID/deadline rather than resetting the recipient's
timer; another challenger cannot overwrite an unanswered prompt.

The ordinary response handler rechecks both directions of blocking and refreshes
the recipient after rejection. Matched-player hostility requires the admitted
instance, so an old match record cannot authorize damage in town or another
scene. Open-world flag mutation snapshots the actor under its lock while keeping
World ownership through admission; dead/zero-health players cannot opt in.
Existing mutual flags, safe-zone protection and shared-party restrictions remain.

The PvP panel opens for a new challenge, captures exact prompt identity, counts
down locally each second, disables expired buttons and offers 44px response
targets with a readable phone layout. Closed prompts do not reopen on identical
snapshots; disposal rejects late snapshots/detached consent. Disable World PvP
is unavailable outside safety, matching the existing authoritative rule.

## Verification and remaining work

Focused game consent/safe-zone/resource race selection passed in 1.116s; ordinary
handler/lifecycle/save-projection race selection passed in 4.244s. Seven JS suites
passed 58 checks in 4.315s, with changed-scope lint clean. Browser discovery proves
249 mandatory cases exactly once; the changed duel presentation and Fighter pilot
are assigned to the existing interface stage, not another runner queue.

Three native PvP cases passed in 15.2s. Visual review found the new clock crowded
the previous flex row on phones; the production CSS now uses full-width prompt
text and two 44px buttons. The changed desktop/390px consent cases then passed
in 16.4s with overflow/label-width/touch-target assertions. The corrected phone
screenshot was visually reviewed. These are prepared UI fixtures, not an owner
physical-phone party session.

The new actual-socket route passed in 7.80s (8.890s wrapper), using two ordinary
fresh characters against a private loopback Mongo and a real race-built server.
It covers completed/replacement prompt identities, stale acceptance rejection,
explicit decline, admission into the same authoritative duel instance and
surrender back to overworld, followed by saved Level1/XP0/Gold0/EP0 and unchanged
ranked records/penalties. Evidence: `/tmp/eidolon-compat-session-301495523`.
The route is required in CI before the broad Go suite leaves partial fixtures.

The newly delivered [Fighter pilot](../art/2026-09-30-fighter-pilot.md) reopens the
authored-character integration work alongside combat readability. Its derived
exports, skeleton adapter, five skill clips, quaternion moving-cast mask and
common-wrapper recoil are implemented. Revised body-only simplification keeps
fitted secondary meshes intact, data maps use lossless encoding, and the native
fixture matches the game's shadow-bias policy. Reviewed skin/scalp/shorts renders
are now clean. A shared equipment dispatcher and first 14-slot adaptation now
fit shaped clothing to the rig and calibrate rigid mounts, retaining item/gem/
cosmetic appearances. The final four-Actor High/Low equipped native route passed
in 20.4s, with restoration/disposal checks; six authored-model unit checks passed
in 1.973s and changed-scope lint passed. The pilot record preserves implementation
details, screenshots, interleaved-skin and missing-waist corrections and limits.
The subsequent normal factory/ensureMesh path selects the derived quality and
uses separate resettable pools plus procedural fallback. Preview requests are
identity-fenced, apply the latest equipment and dispose owned skeletons. Shield
face orientation now follows the torso through unarmed wrist poses. Nine scoped
JS suites passed 196 tests in 11.992s; the integrated native pilot and three
character-sheet sizes passed four cases in 43.7s, with reviewed independent
High/Low previews and a short isometric CPU-render sample. The pilot record
qualifies those metrics; they are not final GPU/FPS/capacity evidence.
Casino seating now converts through the exported pelvis/parent axes and applies
its pose after ordinary animation, preserving authoritative position and exact
exit restoration. Fourteen fixed item-slot mounts expose proper attachment
ownership to existing gallery consumers. Five changed-scope JS suites passed
57 checks in 5.451s. The ordinary local/remote gallery now accepts authored
equipment without relying on a procedural-only guard; all class/state/quality
and all equipment-family routes passed with the pilot, three cases in 1.0m.
The subsequent full death-end and physical-chair/phone-panel routes passed two
cases in 28.3s. Seated, death-end and normal gameplay-scale renders were reviewed;
evidence is in `/tmp/eidolon-1-54-fighter-seated-final-0930` and
`/tmp/eidolon-1-54-fighter-motion-final-0930`. The separate fixed front/side/back
and ordinary-outfit Fighter gallery routes also passed. Cloth and equipment
remain baseline code-owned forms, not final modern-art approval.
The source upload and adapter have not replaced the live procedural hero.

Package 1.54 metadata and cumulative notes after integration; fetch/merge remote changes
immediately before a normal push. Luna monitors deployment, root independently
accepts exact public identity and changed assets. Preserve accounts, open-alpha
access and the user's existing PvP/economy policies.
