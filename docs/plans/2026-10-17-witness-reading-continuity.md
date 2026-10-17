# Witness conversation reading continuity

When new personal evidence unlocks another witness topic, the conversation
rebuilds its topic list. Previously that removed a focused question and left
keyboard focus outside the reading flow. A removed topic also lost focus.

The renderer now restores the same question by topic identity, keeping its
open state and list scroll. If that topic is no longer available, focus moves to
the witness introduction. Later refreshes preserve that introduction focus;
another question is not activated. Focus outside the topic list stays where the
reader placed it. Existing speaker/character/death guards and spoiler gating,
manual quest actions, rewards and dialogue text are unchanged.

Lore question summaries retain native disclosure/keyboard behavior and gain a
minimum44px height. The desktop/phone manual quest-action cases now also exercise
witness refresh, keyboard/touch toggling, removed-topic recovery, outside focus,
scroll and the measured touch target. Accept/claim counts remain unchanged.

Four targeted cases pass in1.585seconds, including three new cases in the
existing ChronicleWitness suite. The other26cases are unmatched and are not
counted as local passes. The first execution retained two failures and two
passes. Source gating and pooled interaction code are unchanged. Scoped lint
passes for all three changed JavaScript/test inputs.

Both extended desktop/phone browser cases pass in11.8seconds in System Chrome
with GPU disabled. These are UI behavior/layout checks; physical-device and GPU
qualification remain distinct. Captures show readable questions and answers,
reachable close controls and preserved reading position. No new browser case,
server data, dialogue receipt, network command or campaign/load test is added.

This component joins the selected Lore Book/leaf milestone after exact73
acceptance. Its three added existing-suite cases change the next client count
to801suites/12412tests. The full original game/art/performance/operations/beta/
1.99goal remains active.
