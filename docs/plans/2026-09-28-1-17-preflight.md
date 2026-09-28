# Alpha 1.17 source preflight — party preparation, Air and Dark Realm

Planning/source inspection only while1.16 deployment is pending. Do not publish
1.17 until1.16 passes all gates and the entire1.17 milestone is ready.

## Existing party access, not a new matchmaking system

- `UIManagerDungeon.js` already uses authoritative entry levels, saved active-run
  details, difficulty choices, per-player locks and latest-checkpoint guidance.
  `DungeonPreparation.js` already explains recommended tank/healer/damage roles,
  class-appropriate Uncommon/Rare gear, recovery and crystal rituals. Preserve
  these features; do not announce them as newly implemented.
- Concrete presentation gaps: preparation is duplicated, the selected dungeon's
  generic help is always titled “Prepare for the Bastion”, and the Guide offers
  instructions to use recruitment/readiness without a direct contextual route.
  Inspect existing social-panel API before wiring contextual buttons. Show real
  personal requirements and readiness, not inferred eligibility for unseen members.
- `GroupFinderUI.js` already supports real-player listings, request/accept flows,
  roles and20-minute listings/5-minute requests. Its empty result says to post
  or refresh. Improve the low-population next steps without suggesting NPCs,
  automatically starting groups, or granting entry to an ineligible member.
- `dungeon_entry.go` preserves saved raid requirements: a formed5–10-player raid,
  per-member level/story checks and no fresh ready check just to return to an
  already launched run. Fresh launches still need their real readiness checks.
  `dungeon_handlers.go` sends each entering character's authoritative position.
  Reuse those tests and add coverage for any changed presentation/action wiring.
- There are two distinct clocks: a completely empty live instance has a5-minute
  idle collapse timer; saved dungeon logout restoration has the approved15-minute
  window. Explain the distinction and retain both policies. Continuing returns
  only the caller to the latest cleared boss checkpoint; reset is leader-only
  and not a shortcut to repeat rewards.

## Air population anchors and visual identity

- Two existing story compositions from generated Chronicle data:
  `selen_journal`(1150,245), an open abandoned observatory;
  `silent_vane`(1180,145), `trapped_updraft`(1192,145),
  `free_horizon`(1186,135), the stationary-storm evidence sequence.
- Existing Tempest Spire entrance is(2400,200), visual bounds approximately
  44.40×76.55×48.14. Derive approach and collision margins from its source, not
  the larger Fire entrance. Do not move or duplicate the canonical entrance.
- Complete the eight-place contract: these two dressed stories, dungeon approach
  plus another major landmark, two camps/workspaces, two usable optional readings.
  Build a distinct courier/weatherkeeping identity: wind instruments, open frame
  architecture, anchored canvas, rescued charts and choice versus imposed order.
  Avoid merely mirroring Fire positions or recoloring its furnaces.
- Select new coordinates after checking Air's19 canonical wind hazards, border
  passages, story approach boxes and Spire footprint. Its nominal z200 foliage
  clearing is not a safe road: hazards sit on that line. Author physical detours
  and reuse their exact centerlines in cartography.
- Extend common location/reading/path/spawn/landing data together. Air foliage
  stays visual-only. New actual solids need ordinary regional-spawner integration,
  not just additions to the Earth spawn registry;1.16 found that distinction.

## Dark Realm: integrate what is already there

- `dark_realm.go` owns the shared expedition and five canonical districts:
  Resonant Foothold(40000,40800), Unwritten Shore(40000,40400),
  Tithe of Names(39300,40400), Stillwater Foundry(39300,39700),
  City Without Tomorrow(40000,39700). Four500m districts form a connected circuit;
  Foothold is180m with a140m safe area. Only Nexus and King's raid are private runs.
- Existing witnesses: Maelin(39988,40800), Ren(40000,40814),
  Elin(39900,40548), Oss(39200,40548), Vara(39180,39568), Oren(40130,39838).
  Reconcile generated chapters, witness unlocks and actual investigation meshes
  before adding surroundings. Preserve IDs, masks, manual claims and lore order.
- `ProceduralDarkRealm.js` already builds union floors, low void edges, camp
  shelters/lanterns and district silhouettes. Most district buildings are beyond
  the floor bounds; they are views, not traversable destinations. Inspect normal
  camera views, then dress existing records/witness approaches inside real walk
  geometry. Never draw an atlas route over void or advertise a facade as enterable.
- Keep protected arrival, Ilyra interaction, Nexus/court approach and circuit
  corridors clear. New map references must respect shared/private instance space
  and personal progression visibility. Do not reset the completed Dark Realm story
  or relabel existing content as newly delivered.

## Bounded acceptance

Focused eligibility/party-entry/readiness tests (normal prepared group, no grants
to production players); Guide→recruitment/readiness UI and empty-list behavior at
desktop/touch widths; physical path/hazard/solid/atlas parity; existing discovery
and witness interactions; high/low normal-camera scene review and resource counts.
Reuse unaffected1.16 session and1.10 encounter evidence. No full campaign replay,
fake-player matchmaking, level/stat scaling or long soak added for this milestone.
Publish notes/version only for the complete scope, then Luna deployment monitoring
and root exact live acceptance before1.18.
