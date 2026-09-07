# Avenging Seraph — summoned ally lifecycle

Status: implementation on `work/seraph-lifecycle-20260907`, based on
preserved 1.0.42 and packaged as local Alpha 1.0.43. Not published. Full 1.1–1.10,
remaining talent consumers and phone acceptance gates remain open.

## Reproduction and server repair

Paid casts followed by real summoned-entity updates reproduce **seven failing
cases in 0.247s**, `/tmp/eidolon-seraph-before.log`: rank-one/five Mastery attacks
remain 70 instead of 72/84; five Technique ranks still expire before 16s; a dead
or disconnected owner leaves an attacking ally; changing instances leaves an
orphan; and a solid dungeon wall does not stop its 70-damage smite.

Summons now snapshot normalized damage training and duration at creation, without
rewriting saved ranks. The existing set extension remains capped at 300 seconds
and survives later equipment changes. Owner death, disconnect, removal or an
instance change removes the summon. Acquisition and impact use canonical floor
geometry; following clips the full movement segment and does not overshoot the
owner's three-unit following distance. The attacking summon retains its event
source while owner equipment/critical modifiers, threat and death credit remain
owner-owned. Summon lifetime is private server state, not a new wire field.

Expanded actual cast/attack/lifetime/following tests and the shared nine-case
server/client training contract pass under the race detector in **3.680s**,
`/tmp/eidolon-seraph-contract.log`. Earlier repaired checks pass 2.169s; those
precede normalization, set/critical/source and follow-segment controls.

## Offline implementation

The previous offline branch spent mana, overwrote the trained cooldown and
announced a summon without creating one. It now creates an actual
`AvengingSeraph` through the normal entity/mesh lifecycle, retaining the existing
procedural model. Its own actor update selects hostile targets, smites at the
normal cadence with owner attribution, follows the owner and expires. It does
not create or simulate a multiplayer replica. Locked/unaffordable casts cannot
create an ally, and owner disposal clears owned summons.

Source inspection establishes the missing offline entity; no separate pre-fix
offline Jest run is claimed. New paid-cast, cadence, expiry, owner/instance/death,
wall/door and authority tests pass, together with shared training and existing
Cleric/effect guards: **59 tests in 0.933s**,
`/tmp/eidolon-seraph-offline-contract.log`. Lint and whitespace pass. Seraph's
Technique copy now specifies duration rather than implying increased range.
Generic Cleric duration talent descriptions and other ability consumers remain
part of the broader audit, not silently declared fixed by this implementation.

## Remaining evidence

Full regression on **2329891** passes: **212 client suites / 3,137 tests in
115.252s** (`/tmp/eidolon-seraph-full-client.log`) and full Go race, root
**10.143s** / game **264.589s** (`/tmp/eidolon-seraph-full-server.log`). All test
handles are terminal success. The later corrected 1.0.38–42 ancestry merge
changes QA/evidence only; game/server/index source remains identical.

### Browser self-cast correction and completed route

Four hotbar regressions fail before the client repair (0.845s): both self-casts
require a cursor intersection, and Seraph can chase a distant hovered enemy or
lose its buffered summon when that enemy disappears. `1b6235d` treats Seraph as
caster-centered and dispatches both self-casts before cursor targeting. The
focused targeting/summon/party set passes **42 tests / 1.929s**; the complete
client suite passes **212 suites / 3,141 tests / 151.394s**. Server source remains
identical to the earlier fully race-tested implementation.

The final real browser route on **`1b6235ddf2f1dbcd4e98ab475689477f65919a48`**
passes **1.3 minutes**, `/tmp/eidolon-seraph-browser-final.log`: normal Battle
Cleric selection and server-confirmed rank purchases produce **288 / 345 / 345**
baseline/trained/fresh-login smites. Real expiry is **14.94 / 16.46 seconds**
against **15 / 16.5 seconds** expected. Ground-click movement verifies following;
ordinary dungeon entry/recall removes the summoned replica. Credential scan
passes with zero sanitizations; disposable cleanup finishes and local ports are
free. This is prepared level-100 functional evidence, not earned progression.

Earlier route failures are retained in `/tmp/eidolon-seraph-browser-{first,second,third}.log`:
the observer originally confused asynchronous model creation with removal, rank
clicks raced authoritative rerenders, and the trained summon never dispatched.
The four unit regressions establish the self-cast defect independently; no
missing browser request trace is invented. The fourth run confirms baseline and
trained combat/expiry but exits 143 before completion. Its resources were scoped
and cleaned after confirming the driver was gone; no successful scan is claimed
for that interrupted run. The final complete route supersedes that partial pass.

Inspected town captures show the gold-winged summon and binding ring separately
following the Cleric after the birth flash. Combat captures retain a visual
follow-up: desktop action text crowds the silhouette and nearby entrance facade
geometry obscures combat. This does not establish full desktop/phone readability.

### Rendered fallback and desktop action label

The anonymous offline component scene passes **3 tests / 31.2s** on `b031f57`:
real paid casts create the mesh, deal owner-attributed 84-damage smites, expire
through the normal chunk update loop and remove their mesh/ownership entries.
Disconnected floor blocks damage; ordinary actor movement/collision drives
following; changing the fixture instance removes the ally. This uses production
actors, mesh loading, collision, effects and chunk updates, not mocked AI or
rendering. It remains a prepared component scene: normal login is multiplayer,
and this is not evidence of an offline campaign or earned progression.

One desktop action-label test fails before `b9a28d4` (57 controls pass, 1.976s).
Seraph now uses the existing compact above-model identity/action treatment on
desktop too; other desktop player labels stay unchanged. Combined label/text
tests pass **65 / 0.964s**. The integrated rendered scene and label set passes
**4 checks / 34.3s** on `d4f83ab`; inspected captures show the two-line attributed
label above the model, separate from damage numbers and the actor silhouette.
Logs: `/tmp/eidolon-seraph-offline-render-first.log`,
`/tmp/eidolon-seraph-label-before.log`, `/tmp/eidolon-seraph-label-after.log`,
`/tmp/eidolon-seraph-render-final.log`. All these handles are terminal success.

Packaging adds the rendered checks to anonymous CI and the real Seraph route to
full isolated character QA. See the [1.0.43 release evidence](2026-09-07-release43-seraph.md)
for final package regression and publication status. Full offline damage-modifier parity is not
claimed by the shared summon base-damage/lifetime contract. Physical-phone and
earned character progression are separate from prepared summon QA.
