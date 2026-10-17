# Casino interior material and atmosphere qualification

Candidate runtime source: `82da0bbc43933a7c7655e62c6e610d1c3d6c62d0` on accepted
master documentation `209442852`. Qualified for scoped integration review;
not yet versioned, pushed or deployed. Current public runtime remains1.79.68.

Both gaming floors now use restrained veined marble, narrower physical slab
joints and registered cloth/timber detail on existing carpet, seating and
furniture. The first broad contour-like veins are retained in the evidence;
final veins use a stretched mineral field, narrow physical widths and filtered
coverage. Two owned marble materials per floor add four submitted calls in the
recorded full-hall comparison; model triangle counts agree in that view.

The casino now selects a private indoor lighting preset independent of its
world allocation. Existing key/fill lights provide warm light with less ambient
wash; no extra lights are allocated. Outdoor particles stop immediately on
entry and remain stopped through Low/Medium/High changes. Returning to the
actual overworld realm restores its lighting, outdoor geometry and applicable
particle visibility. World-region and dungeon catalogs remain unchanged.

Table/seat counts, physical anchors, collision, ownership, currencies, prices,
VIP admission and wagering rules are unchanged. Imported class models, fitted
gear and animation banks are retained. This is an interior material/atmosphere
pass, not final venue/world art or whole-game performance acceptance.

Evidence:

- 100 focused checks across seven suites, including indoor entry/exit at remote
  Fire coordinates, quality changes, original light identities, Low exit and
  existing environment/resource/theme/casino paths. Full lint passes.
- The canonical Go catalog and fixed native-container fixture agree exactly:
  92 stations /232 chairs. Fixture SHA-256 is
  `01c0bbf577563d963270205d0e262ef418494c406980f1bd5c15aa2bcc61960a`.
- Final native component case passes four High/Low public/VIP overviews and
  eight closer views, with standard100/100/100 camera offset, zoom18, matching
  shadow focus and hardware-renderer checks. Forty prepared, fourteen-slot
  four-class models provide twenty visible/seated actors per floor. These are
  controlled fitted-pose views, not forty network clients or an actual HUD.
- The final actual connected casino case passes in2.0minutes: two newly
  registered prepared level1 Fighters/1000Gold bankrolls, ordinary entry,
  shared instance, physical seats, real server blackjack hand/countdown/cards,
  settlement and next wager without spending, camera restoration, reconnect,
  VIP denial, native dialog focus, menu recall, environment restoration and
  other-account isolation. No browser errors or automatic test retries. These
  actual HUD/player views do not claim fourteen-slot or earned campaign proof.

Retained limits and failures:

- The candidate High public full-hall sample records29.7ms median/37.9ms p95,
 25.5ms synchronous render CPU,816calls and1,153,411triangles. The independent
  prior-art sample uses immutable `209442852:src/art/ProceduralCasino.js` with
  current indoor light, actors and first wide-camera setup:30.5/39.3ms,
 26.0ms CPU,812calls and the same1,153,411triangles. Both fail the unchanged
  **25ms median** fixture limit. These independent180-frame windows establish
  neither a paired speedup nor whole-game performance clearance. No unchanged
  candidate timing retry was made. The overview zoom58 is beyond gameplay's
  maximum30, but the failed fixture finding remains retained. Other original
  world/device/casino timing findings remain open; no budget was raised.
- First native setup lacked Go in the isolated visual container. The initial
  host parity command omitted its explicit fixture flag. Corrected host Go
  parity and the fixed-catalog native path are separately recorded.
- The older connected test matched an active blackjack wager and a hidden
  house input. It now requires one visible accessible spinbutton while retaining
  every stake/settlement assertion. Native dialog dismissal restores guard
  button focus, where gameplay recall shortcuts are intentionally blocked;
  the corrected test asserts that focus and uses the visible recall menu.
- The first new camera-distance assertion failed because OrbitControls clamped
  the173.205metre camera offset at120metres. The controlled close-view limit
  now accommodates the existing gameplay offset. The first wide cost sample
  remains unchanged and its failure remains retained. No production camera
  setting was changed to obtain art views.

Private evidence: `/home/aeml/.local/share/eidolon-venue-art-review-20261017/.qa-venue-art`. Frozen182-file inventory
SHA-256: `a6bb6760857407d870761ade1bcb20829baa8438be5063942fc27ef6b3c07c93`. `freeze-venue.py` executed once; never rerun or mutate the
frozen payloads. Closed metadata/HTML/logs scrub disposable account names;
image pixels are not claimed redacted. Execution stdout and mutable continuation
are excluded. Existing broader art, gameplay, performance, readiness, owner,
feature-freeze/beta/1.99 gates remain open. Human campaign/phone feedback and
soak/stress remain deferred, not passed.
