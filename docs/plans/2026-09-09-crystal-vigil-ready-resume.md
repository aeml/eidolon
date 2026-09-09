# Preserve finished crystal defenses before manual turn-in

Status: later story/reconnect candidate; excluded from Alpha1.0.58 recovery.
Not published. Full server and rendered/group acceptance remain due.

## Reproduction and correction

`ensureRestoredCrystalRepair` used only `HasCompletedChronicleQuest` when deciding
whether a cleared, process-restored raid needed its Vigil restarted. A player who
had defended all waves but had not yet claimed the chapter from Ilyra therefore
started another defense. Claimed chapters already avoided that restart.

55030 reproduced the error in all four elemental raids after rebuilding a new
World with `GetDungeonResumeSnapshot`/`RestoreDungeon` and JSON-round-tripped
quest fields. Each ready/unclaimed case failed; claimed cases passed. This is
server snapshot/entry evidence, not a Mongo restart or full browser raid proof.
Log `/tmp/eidolon-crystal-ready-resume-before.log`.

The entry check now recognizes an already-claimed chapter OR its exact accepted
REPAIR objective with the correct crystal target and a positive, fulfilled count.
It inspects every raid member. Missing or unfinished members still require the
full three-wave defense. Partial wave progress still restarts; no shortcut is
introduced for boss death, an offered quest or an unrelated objective.

This read-only predicate does not mark quests complete, pay gold/XP, auto-accept
the next chapter, or unlock the Dark Realm. Ilyra's explicit turn-in remains the
authority for those steps. No schema, saved-field format or client behavior changes.

## Evidence and remaining work

- 73457 focused race passed3.814s: four-realm snapshot/repeated entry, readiness
  boundary cases, existing interrupted-Vigil restart and manual reward tests.
- 87252 expanded race passed4.948s, adding five-member all-defended,
  one-unfinished and one-missing cases. Same manual reward/progress protections.
- Logs `/tmp/eidolon-crystal-ready-resume-{after,party}.log`.

Full server regression is still required before this candidate can ship. Keep
heavy local regression work off the recovery browser's remaining acceptance run;
its recent short-frame sample failure is not causally attributed to host load.
Then verify actual saved group sessions, manual Ilyra turn-in and the entire raid
sequence. The separate visible-crystal/authoritative-rejoin presentation gate in
[the model review](2026-09-09-maelin-model-and-crystal-visuals.md) remains open;
this predicate alone does not render a restored crystal or complete that scope.
