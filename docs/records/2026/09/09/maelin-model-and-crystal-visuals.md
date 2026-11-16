# Maelin identity and visible crystal restoration

Status: later story candidate only; excluded from standalone Alpha 1.0.58.
The inherited version label is not publication permission. Recovery retains
priority and its frozen browser build is unchanged.

Update12:47UTC: the dedicated artificer model and actual channel/idle loop are now
implemented and rendered in hardware and CI-mode browsers. See
`2026-09-09-maelin-channel-and-model.md`. This original document records the
earlier Wizard-rig bridge, not the current model. Full group/live acceptance
remains open; the newer model's full regression is being repeated.

## Reproduced model mismatch

The actual remote-entity factory mapped `NPC/CrystalKeeper` to `AvengingSeraph`.
The server uses this subtype for Maelin, Resonance Artificer during the three-wave
Vigil. Consequently the summon redesign also made the human story NPC a baby
angel and attached the summon actor's lifecycle implementation to her.

Regression91969 failed on that real factory result; the separate true-summon
assertion passed. Retained log: `/tmp/eidolon-maelin-model-before.log`.

The correction introduces a dedicated `CrystalKeeper` actor using the existing
clothed Wizard mesh. It retains the prior client radius1.5, remote ownership and
server-owned state. It inherits neither player skill logic, summon lifecycle nor
Ilyra's quest markers/turn-in interaction. Real AvengingSeraph routing is unchanged.
This is an identity correction, not a claim of a finished bespoke Maelin model.

Focused29362 passed54tests/4suites/2.727s plus lint under Node24.18.0, including
actual mesh-factory construction and unrelated NPC/King/site regressions.
Logs: `/tmp/eidolon-maelin-model-{after,lint}.log`.
Full client63743 PASSED270suites/3857tests/155.615s plus lint on f3bbe43,
Node24.18.0. Logs `/tmp/eidolon-primary-maelin-full-{client,lint}.log`.
A real rendered comparison remains due. The later moving-cast diagnostic import
changes browser evidence only, not the NPC implementation tested here.
No server/gameplay changes, production deployment or full-raid acceptance claimed.

## Open crystal/world presentation work

Update12:04UTC: the authoritative server snapshot contract is implemented and
focused race-tested; see `2026-09-09-crystal-sanctum-snapshot.md`. Actual crystal
rendering, bespoke sanctums/Maelin and full transport/group acceptance remain open.

Source inspection found elemental raids reuse their region's dungeon scenery.
`crystal_repair` currently drives callouts/chat; the server changes Maelin from
CHANNELING to IDLE and credits the repair objective after the waves. No authored
raid crystal representation was found in the active world/model path reviewed.
The story's visible restoration gate therefore remains open.

Before implementing that visual, define the authoritative initial/rejoin state:
intact scene identity, fractured crystal before repair, live Vigil progress,
restored crystal after all waves, and restored status after manual turn-in and
reconnect/restart. Do not infer a durable repair solely from a transient completion
callout, a display-name substring, boss death, or an offered next quest.

Then build four distinct crystal sanctums and a distinct clothed artificer with
readable ritual motion, retaining collision/targeting and explicit manual Ilyra
turn-ins. Verify the entire dungeon-to-raid-to-repair progression and persistent
visual consequences in actual group gameplay. Render desktop and phone High/Low
views without obscuring threats or introducing an enclosing glow volume. These
are required later story/raid gates, not silently replaced by the mage-rig fix.
