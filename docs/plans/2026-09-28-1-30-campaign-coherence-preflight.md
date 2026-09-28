# Alpha 1.30 — campaign coherence review

Local partial implementation. No1.30 version or release. Keep this out of
the committed1.28 and the local1.29 candidate.

## Retained foundation, not work to recreate

- `chronicleQuestCatalog` and the server's discussion/prerequisite checks own
  chapter order. Existing tests cover catalog ordering and command-level
  advancement across55chapters. They are fixtures, not a fresh played campaign.
- `ensureChronicleLocked` preserves saved accepted/completed contracts. Authored
  additions behind an existing milestone become optional catch-up records, not
  retroactive completions. The Journal must not let those replace the current
  required chapter or count them as evidence that the finale was claimed.
- `ChronicleRestoration.js` has four personal, manually completed repair
  receipts and consequences: Mara's shared shelter, Dain/Tovin's returning
  names, Hessa's communal kiln, and Selen's unbound currents. Existing Journal
  tests preserve open records across refresh. Do not flatten these into generic
  healed-crystal text or invent shared-world completion.
- The physical town portal and canonical directions are established in1.12;
  expedition navigation in1.27 and private Guide admission in1.28 remain distinct.
- `chronicleAftermath.js` supplies the post-Malachar hook, A Letter Without a
  Throne, behind a completed finale receipt.1.29 fixes the Journal's false
  victory inference and adds reread directions. Do not duplicate that fix here.

## Remaining editorial/integration work

Review all current target/NPC/location references against authored content and
actual admission points, including existing legacy in-flight contracts. Keep
recorded discovery masks authoritative; a total count is not which diary was
read. Use the existing generated-content checkers rather than creating another
catalog or migrating saves for editorial copy.

The Journal now offers a collapsed “Your journey so far” recap alongside the
active chapter and full recovered-lore archive. It distinguishes an opened
dungeon road from a repaired crystal, then the shared expedition, private court
unlock and personally claimed ending. Every statement requires its own personal
completed receipt. Level, party access, ready counts, optional catch-up chapters
and the absence of a current chapter cannot imply progress or unseen lore.
Ordinary refresh retains the recap control, paragraph nodes, focus and open state;
empty/reset snapshots remove it. No save fields or rewards change.

Verify fresh, optional catch-up, accepted legacy-contract and completed-finale
snapshots, archive focus/reading retention and a compact phone layout. Do not
start a new full campaign, retune rewards or claim human pacing from generated
progression fixtures. User campaign feedback and final art approval remain open.

## First demonstrated wording correction

Ilyra's post-Nexus greeting previously said the portal was open and Malachar
waited beyond it. That conflated the already-open shared expedition portal with
the private court admission. The greeting now names the claimed Fifth Note and
directs the raid to Lanternhold's Dungeon Guide, explicitly distinguishing the
Fourfold Portal. Earlier four-repair dialogue still names the real southeast
town plaza and level100 gate. A ready-but-unclaimed Fifth Note does not announce
court admission. No quest, reward, access or save changes.

Focused campaign-coherence, aftermath and Water handoff checks passed17/17
in0.943s; scoped ESLint and whitespace passed. These are dialogue/snapshot
contracts, not a played campaign or human pacing evidence.

This1.30 change owns QuestConversation.js, ChronicleRecap.js, new QuestUI/hud.css
hunks, ChronicleCampaignCoherence.test.js and the new reading-layout case;
exclude them from the1.29 release already committed at42e2cc17.

## Scoped campaign evidence

-48 recap/Journal/aftermath/Water checks passed1.583s;98 content, witnesses,
  hunts, preparation and expedition checks passed2.799s.
-Generated content verification agrees with eight regional investigations,
  sixteen discoveries, eight hunts,24 expedition chapters and38 discoveries.
-Four authoritative Go catalog/55-chapter command progression/legacy saved-
  contract cases passed0.357s. These fixtures exercise ordering and personal
  commands, not a played campaign or elapsed-time evidence.
-Phone recap layout passed6.5s at390×844 and844×390; both screenshots inspected
  in`/tmp/eidolon-130-recap-layout/`. Open state, control identity, scroll and
  horizontal fit remain intact. Actual physical-device feedback is deferred.

Existing field-record touch reading regression passed26.0s at
`/tmp/eidolon-130-reading-retention/`; scoped ESLint and whitespace passed.

## Editorial review findings

Original milestone IDs still select Ilyra's replies independently of displayed
chapter numbering. Regional investigations and hunts retain their authored
catch-up responses rather than directing veterans back through already-open
roads. Expedition chapters preserve district-specific voices, recorded discovery
masks and the final Recall-to-Guide handoff. Existing aftermath has optional
survivor/letter/witness conversations, not an invented fifth element or a daily
quest obligation. Repair receipts reveal the four distinct personal consequences.

The remaining server Nexus/finale descriptions still left admission implicit;
the finale explicitly said “Beyond the portal waits Malachar.” Both descriptions
now name the Guide in Lanternhold and personal completion. The ordinary catalog
refresh delivers editorial metadata to accepted saves while preserving their
contracts; no special migration was added. A focused regression exercises ready
and completed saved contracts with old copy, different counts and quoted zero
Gold. The recap now also includes the latest personally completed expedition
account, selected by authored order, without inventing intervening discoveries.
Its updated11-case coherence suite passed0.697s; five authoritative Go graph,
legacy-contract and updated-copy cases passed0.295s. These are not campaign runs.

Final version/notes/packaging and delivery gates remain before publication.
