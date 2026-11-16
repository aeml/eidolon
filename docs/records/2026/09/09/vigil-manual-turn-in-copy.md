# Crystal Vigil completion feedback

Campaign follow-up, not part of the frozen urgent58 candidate. The actual repair
completion already leaves the quest ready for manual Ilyra turn-in, but its event
hint incorrectly said the next realm chapter had begun. That contradicts both
the user's requested manual completion and the server's actual progression.

The hint now directs the player back to Archmage Ilyra in Lanternhold to complete
the chapter, claim the reward and discuss the lore. No raid mechanics, rewards,
quest credit, acceptance or progression rules change.

The existing real completion/turn-in regression now also verifies this event hint
and that no gold/XP is granted before the manual action. It retains the original
checks that the repaired objective is ready but not completed, manual turn-in
succeeds, and the next Vigil is offered rather than automatically accepted.
The old hint failed this regression (`/tmp/eidolon-vigil-manual-copy-before.log`).
An initial test edit used the wrong experience field name and failed to compile;
that was corrected before the behavioral baseline. Focused rerun results are
separate evidence; this copy fix is not a claim of a full earned raid playthrough.
