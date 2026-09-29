# Journal and tracker readability — 1.45 candidate

Local, unreleased interface work. Runtime identity and earlier release gates
remain unchanged. This does not establish final visual or gameplay acceptance.

## Changes

- Persistent All quests / Story / Contracts controls stay outside journal
  scrolling. Contracts show the accepted, unclaimed count. The section survives
  progress updates, resets for another character, and never changes tracking.
- Chronicle discovery links select Story before revealing the record. Daily
  reset information stays out of the Story-only view; empty sections give a
  relevant NPC direction.
- Accepted contracts put ready turn-ins first without reordering server state.
  Cards use coherent surfaces, explicit objectives/return guidance, aligned
  readable counts beside the progress bar, rewards and tracking controls.
- Progress bars expose accessible values, including safe missing-count handling.
  No auto-completion, new reward rules, quest mutations or network writes.
- Desktop tracker keeps its scroll position when quest progress changes; the
  existing bounded height and phone single-objective presentation remain.

## Verification

- Baseline desktop story-journal browser case passed (8.3s); screenshot reviewed.
- 87 focused journal, Chronicle, objective and phone unit checks passed (2.148s).
- Six desktop/phone journal browser cases passed (35.5s), including existing
  deliberate turn-in, disclosure and reading-focus behavior.
- Final five navigation unit checks passed (1.242s); scoped ESLint/diff clean.
- Final two long-list browser cases passed (15.2s): twelve accepted contracts,
  no horizontal overflow, 44px section actions, persistent focused navigation,
  deep-list tracking without scroll loss, Story switching, unchanged completion
  state, and thirteen tracked objectives retaining desktop scroll after progress.
- Final desktop/phone captures inspected under
  `/tmp/eidolon-journal-navigation-final-0929`; earlier comparison under
  `/tmp/eidolon-journal-baseline-0929`.

These are controlled production-DOM/CSS fixtures, not earned gameplay progress
or live deployment checks. Both added cases are in the existing hosted interface
test file; no new CI queue or long soak. Other 1.45 menu/service work and the
connected world/combat quality reference remain open.
