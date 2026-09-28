# Alpha 1.29 — finale presentation audit

Local partial implementation. No 1.29 version bump, publication or acceptance.
Keep this review out of the pending 1.26 correction and local 1.27/1.28 releases.

## Existing contracts to preserve

- `server/internal/game/raid_phases.go` starts the opening at encounter range,
  advances each quarter in order and prevents burst damage skipping an Eidolon.
  Orun reduces incoming damage, Neris heals living connected raiders, Pyralis
  damages/exposes the King, and Aeral restores mana and increases player damage.
  Do not redesign these implemented mechanics or retune health from UI fixtures.
- `GameEngineNetworkMessages.js` already renders an eight-second phase callout,
  logs dialogue and effects to the game stream, and shows elemental floating text.
  Phase four is aid, not victory. Chronicle completion is a separate server event
  following manual turn-in; keep those distinctions.
- The prepared five-player encounter and checksum-pinned survivor continuation
  are recorded in [1.10's release evidence](2026-09-23-release1-10-playtest.md).
  `finale-saved-turn-in.spec.js` checks personal exact rewards, no duplicate claim,
  the epilogue and relogin. Do not replay the entire raid for presentation edits.
- The five-to-ten-minute human party target remains unmeasured. The historical
  automated 269.341-second result is not human pacing acceptance.

## Concrete presentation gaps to address

1. Phase information shares the ordinary combat-intent panel. Its nominal
   eight-second duration is not a readability guarantee: `updateCombatIntent`
   explicitly cancels that timer and replaces its text; the existing lifetime
   test requires target selection to do so. Subsequent hazard callouts likewise
   replace it. Preserve immediate attack warnings and target feedback, but give
   Eidolon information an independent, bounded presentation or recall surface.
   Do not queue old hazard warnings or block controls for narrative.
2. `RaidPhase` is server-private (`json:"-"` on Entity). A client-only remembered
   event must not be presented as authoritative current phase after reconnect.
   Any persistent phase display needs an actual snapshot/recovery contract, or
   must explicitly show historical received messages rather than current state.
3. The Guide's four-phase summary does not describe each role's opportunities
   beyond supporting the tank and saving cooldowns. Expand only from actual
   mechanics; do not promise resurrection, invulnerability or repeated heals.
4. A cleared weekly raid currently uses generic loot/Return to Lanternhold
   tracker guidance. For an accepted, unclaimed finale, explain personal Ilyra
   completion and epilogue access. Keep veteran repeat-clear/cache guidance and
   incomplete or failed runs distinct. Reuse the 1.28 personal-handoff approach.

## Focused verification plan

Exercise four ordered received phases alongside changing targets and higher-
priority warnings; inspect desktop, portrait and short-landscape layouts without
covering movement/combat controls. Check leaving, death, reconnect and teardown
against stale notices. Test eligible/unclaimed versus claimed/veteran finale
guidance, keeping actual reward eligibility entirely server-owned. Retain prior
earned/saved receipt scope; no new campaign, soak or full raid for this audit.

Final notes/version, mandatory CI, exact deployed identities/assets and human
party pacing remain separate gates. This document alone closes none of them.

## Local phase-notice implementation

`EidolonPhaseNotice` now owns a separate eight-second, pointer-transparent card
positioned beneath the actual combat panel. Resize observation follows warning
height changes; target changes and new danger warnings do not cancel the aid
notice. Full server phase title, effect and phase/element are readable. The next
received phase replaces the preceding notice; no stale warning queue, inferred
phase snapshot or reconnect replay. Full narrative remains in the Game log.

Death, connection loss/reconnect, instance transition and engine teardown clear
the notice, timer and observer. Delayed events naming another instance are
ignored. A dead observer still receives narrative without a new aid card.
The prepared-party evidence collector and screenshot locator now inspect the
new card; the existing exact four-phase/title/effect/living-player assertions
are retained, not removed to accommodate the presentation change.

102 focused notice/lifetime/feedback/party-evidence checks passed2.242s before
two additional stale-instance/dead-observer regression cases. Final affected run
passed104 checks in2.085s, including those cases. Scoped lint and whitespace passed.
Initial compact-text three-viewport browser checks passed17.9s. Full server-text
cases passed23.7s at1280x720,390x844,844x390; portrait/landscape captures inspected
at`/tmp/eidolon-129-phase-full/`. These are isolated production UI/CSS fixtures,
not a new live raid or a populated combat/phone-control overlap proof.

## Role guidance, handoff and populated-phone correction

The Guide now offers a collapsed four-Eidolon briefing with actual aid amounts,
tank/healer/DPS opportunities, MEMORY FRACTURE movement and explicit personal
completion/epilogue instructions. It appears only for an unlocked court and
sends no action. A cleared weekly raid directs a personally ready, accepted,
unclaimed finale to Ilyra; non-ready quests and veterans retain normal exit
guidance. No reward or quest state is changed by reading this information.

Initial populated-HUD integration failed the actor-overlap assertion on390x844
and568x320: the full notice below the warning covered the combat area. The three
Guide layouts and844x390 composition passed; retain this failure at
`/tmp/eidolon-129-finale-integration/`, not as an accepted layout.

The correction gives phones a concise two-line phase/aid summary in the existing
quest-tracker reservation for eight seconds. It hides only that tracker's
presentation temporarily, not its data or tracking choices. Clearing the notice
restores it; full effects/dialogue remain in the Game log. Desktop retains the
full server text below the target/warning card. This avoids adding another panel
over the phone's encounter or thumb-control regions.

Affected refined integration passed all six cases57.2s: three isolated feedback
layouts and three populated phone compositions at390x844,844x390,568x320. Actor
head/feet/enemy points stay outside the aid notice; existing controls, party and
chat checks remain. Portrait and smallest landscape screenshots inspected at
`/tmp/eidolon-129-phase-phone-refined/`. These are rendered fixtures, not actual
phone or raid playtesting. Existing danger-card placement is unchanged.

Final focused guidance/notice/lifetime/phase evidence/Nexus/menu checks passed
132 in4.889s. Scoped lint passed. Additional1.29-owned files/hunks:
FinaleGuidance.js, FinaleGuidance.test.js, QuestUI's import/finale exit spread,
UIManagerDungeon's import/briefing append, raid-menu's new finale-only test,
and phone-encounter-composition's notice/assertion/cleanup additions. Keep all
of these out of1.28 packaging even though the two milestones share some files.

Still required: final focused packaging/version/patch notes and normal release
gates after1.28. Human party timing remains deferred, not certified. No combat,
reward, saved phase or pacing change and no new full raid/campaign run.

## Journal completion receipt correction

Further review found that no current nonoptional quest was treated as proof of
Malachar's defeat. A partial list containing completed early chapters and only
optional catch-up work could therefore show the victory text. The Journal now
uses the same authoritative completed-finale receipt predicate as Ilyra's
epilogue. Without it, the Journal directs the player back to Ilyra to review the
next chapter; a ready-but-unclaimed finale is not victory. With the completed
receipt it adds directions to the rereadable epilogue, without changing rewards.

Two regressions inQuestUIChronicle plus existing journal/objective/aftermath/
finale tests passed85checks1.794s. This is additional1.29 work, not part of the
already committed1.28. The preserved recovery stash predates this correction;
do not overwrite these later edits by applying that stash again.

## In-world aid acknowledgement

`ProceduralEidolonAid` adds four distinct brief silhouettes at a living local
observer's actual height: stone motes, water droplets, fire shards and air arcs.
The server phase event triggers only presentation, never a local heal, damage
bonus or authoritative phase mutation. No floor discs, lights, textures,
collisions or raycast targets. Low uses4 meshes, High8, sharing one owned
geometry and two owned materials per cue; the existing transient lifecycle
disposes them once after2.4seconds or scene cleanup.

Initial92 affected phase/transient checks passed2.08s. First gallery run failed
because its unrelated default persistent spell changed the total effect count.
The fixture now uses the gallery's normal Idle/cleanup control before baseline
measurement; original owned-effect disposal assertions remain. Corrected High/
Low four-phase gallery passed7.8s. Screenshots showed Air's thin arcs needed more
contrast, so their geometry was thickened. Final gallery passed8.1s at
`/tmp/eidolon-129-aid-render-final/`; all four silhouettes inspected across High
and Low evidence, including final Low Air. Final combined art/notice/Journal/
phase/finale checks passed129 in3.551s; scoped lint and whitespace passed.

These are cue/readability fixtures, not full Eidolon character models, a fresh
raid clear, raid-load performance proof or final modern-actor approval. New
ProceduralEidolonAid.js/test, TransientEffects factory branch and network trigger
are additional1.29 work only; retained recovery stash predates them.

## Combined interface verification

The complete affected raid-menu and combat-action-preview files ran together:
29passed,1failed in3.0m at`/tmp/eidolon-129-interface-integration/`. The only
failure was a dynamic import before the844x390 phase fixture initialized.
Retained trace showsUIManager.js returned200 whileCasinoCelebration.js,
ProceduralSlotIcons.js andGuildEventsUI.js reported`net::ERR_NETWORK_CHANGED`.
This is network-interrupted evidence, not an accepted complete green run or a
demonstrated layout regression. No retries/timeouts/error filters were changed.

After the run was terminal, only that unchanged844x390 case was repeated. It
passed6.4s at`/tmp/eidolon-129-interface-network-repeat/`. The original29passes
include the full keyboard/action loop, populated raid authority/gates, three
Nexus/elemental/finale Guide layouts, existing target/quest-role cards and the
High/Low cue gallery. Full repository lint and whitespace also passed. No long
encounter replay was started.

Prepared future exact verifier:
`/tmp/eidolon-release-1-29-0-20260928-S6mhys/verify.mjs <published SHA>`.
Still requires ordered packaging/publication and terminal CI/live acceptance.
