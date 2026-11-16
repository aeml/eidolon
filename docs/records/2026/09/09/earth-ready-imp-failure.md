# Actual Earth story-only readiness: first Imp-hunt failure

Unpublished primary a4ea4ccea2adbf1e1a4d756e1b453566b47bc96a. Node24 hardware
Chrome, isolated ordinary Wizard, no grants/dailies/optional preparation flags.
2268 TERMINAL1 after17.7minutes. Full seven-chapter readiness NOT achieved.

Log `/tmp/eidolon-story-ready-wizard-0909-1319.log`; complete sanitized failure
archive `/tmp/eidolon-story-ready-imp-failure-mptII0` (scan0). Original exact API,
Mongo, image and ports18560/18561/41960 absent after wrapper cleanup. No timer
cancellation/restart. Previous partial passes are not a full route pass.

## Earned observations

- Opening3kills118s, no deaths,24retreats;100XP/100gold manually claimed→level2.
- Diary inspected/read and manually claimed200XP/25gold→level3 at171s.
- Those Who Kept the Watch40credited kills, no deaths,16ordinary town recovery
  stops;566s including manual1593XP/100gold claim and persistence check→level8.
  Beforeclaim1541gold/18occupiedslots/1120unsoldvendorvalue. Unsold values are not
  received income and selected-target death observations are not an independent
  counter of every eligible/AoE death.
- All8MemorySeeds collected after21selected-target death observations, no deaths.
  Exact8quest items consumed on manualclaim; next quest begins atlevel9.
- Eleven already-earned equipment pieces were equipped before Ink That Walks.
  The ordinary authored objective is60Imps oflevel20+. Only1credit was earned.
  The next unchanged120second credit watchdog failed. No daily or bonus reward
  was injected to bypass the content gap.

## Failure evidence and limits

Final observation: level10,HP288/365,MP8/265,restBank0,outside safety,
position−208.20/258.86. RequestedImp-52 islevel20,51HP,11.27units away;
hovered actor is an eliteImp. Defense observer reports69retreats/20accepted
Fireballs/0rejectedFireballs, no shields. No per-hit target history was captured
for this expedition, so do not assume every accepted cast hit the requested Imp.
Failure screenshot `test-results/.../failed-collection.png` was inspected.

Town recovery WORKED in prior encounters (actual spent mana tofull, rest earned,
ordinary travel back). The hunt driver only schedules recovery before starting
the next credited encounter; it does not return to town during its120s watchdog.
This explains why the stalled encounter did not trigger another town visit, but
does NOT establish a defect in production healing or prove that a human cannot
win the fight.

The driver trains stats/talents only when the level AT HUNT START is≥10. At9 it
only fills empty equipment slots. It does not respond to reaching10 during the
hunt. The exact remaining stat/talent points were not logged. Evaluate an ordinary
earned, explicitly recorded preparation baseline before attributing the entire
failure to rewards or enemy damage. Preserve no-grant/no-daily requirements and
do not loosen deadlines/death bounds simply to erase this failure.

The authored3→20enemy-level step also remains a genuine pacing risk: the route
reached only9 before the second hunt. Fullclass/party readiness and the existing
budget audit still require a coordinated progression decision. A single automated
failure does not determine the correct new XP curve or collection rate.

## Separate confirmed hover-panel presentation defect

The screenshot shows Fireball approximately8 and basicattack approximately5.
`AbilityController.buildSoftDamagePreview` computes Fireball as1.5×basic damage
using an arbitrary class multiplier table. The actual server Fireball uses
`20 + 2*Intelligence`, skill training and subsequent combat effects. Therefore
the displayed8 is NOT evidence that the server dealt8 per Fireball. This panel
needs source-backed estimates or honest nonnumeric cast information; do not use
its current fabricated ratios as balance evidence. No change to live58 or spell
damage has been made from this observation.

Next: improve recorded earned preparation/hit evidence, then rerun the complete
story-only route through its original dungeon-readiness gate. Keep the larger
story/raid/party/polish scope open; the independent recovery58 deployment remains
the immediate delivery priority.
