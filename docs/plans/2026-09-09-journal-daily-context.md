# Daily contracts should support the story journal

Unpublished UI follow-up based on the actual fresh Wizard diary screenshots
captured during story-only readiness2268 on primarya4ea4cc. Progress images:
`/tmp/eidolon-story-ready-progress-GEWgC6/{approach,earned}-mara_diary.png`.
These are a point-in-time visual observation, not full-story acceptance.

At level2 the recovered diary was followed by a large Repeatable Ladder panel
advertising Phoenix Sentinels/Cyclone Avatars/Infernal Behemoths as the “fastest XP”
route. QuestUI sorted total rewardXP only; it had no completion-time or character-
level suitability evidence for that claim. Daily offers are valid server catalog
entries; this observation does NOT prove an eligibility bug or authorize changes
to their XP, gold, requirements, acceptance or reset rules.

## Change

- Replace the unconditional panel with a native keyboard-operable Daily contracts
  disclosure. While a story chapter is current and no dailies are accepted, it
  defaults closed; active work or a journal without a current story defaults open.
  The player can expand/collapse either way; subsequent updates preserve that
  choice and summary focus. Offers are not removed or falsely marked locked.
- Show ready-to-turn-in work first, other accepted work second, then unaccepted
  offers. Reward totals only break ties within those groups. Keep exact reward
  labels, maximum-level Resonance conversion display and progress counts.
- Remove unsupported fastest/highest-value route advice. Keep authoritative reset
  countdown and advise choosing targets suited to the character. No XP-per-minute
  recommendation or invented level gate replaces the old claim.
- Keep disclosure target at least44px. Existing mobile CSS supplies16px reading
  text and stacked full reward rows. Preserve completed-lore archive open/focus
  independently from daily offers, using an explicit archive selector. Discovery
  records retain their existing identity-preserving behavior.

## Evidence and remaining gates

Initial new regressions failed3/43 (priority and desktop/mobile compact disclosure).
`/tmp/eidolon-journal-daily-context-before.log`. After implementation52tests passed
and lint passed; additional independent lore/daily focus regression brings the
final focused total to53tests/2suites/.924s with lint. Logs
`/tmp/eidolon-journal-daily-context-final-{focused,lint}.log`.

New `tests/e2e/journal-daily-presentation.spec.js` has two discovered viewport cases
(1280x720/390x844), using actual QuestUI/DOM/CSS with controlled quest state. It
checks collapsed offers,44px target/viewport bounds, Enter toggle and focus after
refresh, independent recovered-lore reading, honest copy and ready/active ordering.
Actual browser execution/screenshots are NOT YET RUN. It must wait for the current
owned story browser to finish; do not interrupt it or claim this fixture as earned
gameplay. Full client regression and CI wiring follow after rendered acceptance.

This branch is separate from frozen primary readiness source and published58.
Do not cherry-pick into either while their runs are active. Integrate only into a
later accepted UI/story candidate with proper release identity and patch notes.

Planned player note: “The quest journal keeps optional daily offers compact while
you follow the story, puts ready and accepted contracts first, and remembers which
sections you are reading. Reward sizes are no longer presented as a promise of
the fastest leveling route.”
