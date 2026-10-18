# Stable quest-reward controls

This isolated candidate is based on fbdf981d4. It is implemented with focused
CPU evidence, but remains unselected pending actual browser pointer/touch checks
and integration/publication. It does not close the complete quest/UI review.

The original reward section included selection, pending/error state and entire
quest records in its replacement signature. Selecting an item followed by a
Journal snapshot replaced its radio and confirmation nodes. Unrelated quest
progress could do the same in conversations. A claim or rejection replaced the
controls again; the two surfaces could display different selections. A detached
old confirmation could also send a stale claim after its reward was claimed
elsewhere. Server single-claim custody remains independent and unchanged.

Only actual offer/title changes now replace those controls. Selection, pending
state, errors and unrelated progress update their existing nodes. The Journal
and conversation reflect the same selection immediately. Pending claims disable
the controls and expose busy state; rejection restores the selected option and
explicit confirmation without another request or reroll. Detached/retired
controls cannot mutate selection or send claims. Error text stays literal.

The initial nine-case run retained three actual regressions and one fixture
error: JSDOM has no structuredClone global. Five original cases passed. Using
fresh JSON-decoded quest data, as on the real wire, reproduces the first node-
identity failure in a focused negative. A fifth new case independently proves
the stale callback. Original negative/setup logs are preserved. The first
positive has nine passes and the same fixture error; the corrected complete
file passes all ten cases in1.391s. Changed-file lint and whitespace checks pass.

The original two desktop/phone specialization/reward browser cases remain
byte-for-byte intact. Two added cases prepare a real mouse or CDP touch press,
call the actual UIManager/QuestUI update while the button is held, then release
and require exactly one selected claim. A rejected-claim response retains the
same controls and option; keyboard Space or a virtual touch explicitly retries.
These use controlled UI data and the shipped styles, not earned campaign
progress or a physical phone. All four cases are enumerated, not executed yet.
The remaining parent-list detach/reinsert path must pass those actual input
checks; CPU node identity alone does not prove a held click survives.

No reward-generation, server, item, progression, economy, equipment, asset,
style, saved-offer or single-claim rule changes. Do not publish this component
before the current82milestone is fully accepted and this candidate qualifies.
Movement-audio and outfit-preview native qualification remain separate gates.

Evidence is under
`/home/aeml/.local/share/eidolon-quest-reward-controls-20261018/.qa-quest-reward-controls/`.
Its13entry CPU/source inventory is frozen at
SHA256`a8ebfd2af7c931b256bfac8bdfc646bc8dd460e52b13b4e5105eca1ea0eb972f`.
The full original game/world/art/gameplay/audio/device/security/operations/
owner/F1–F5/beta/1.99goal remains active; soak/stress remains deferred.

## Actual input counterexample and parent preservation

The unchangedfbdfsource fails the new desktop native case at control identity;
the phone case is unrun after the explicit first-failure stop. The initial
bb5df9795candidate passes the two original cases and the new phone-touch case,
but the desktop held mouse press produces no claim after the Journal refresh.
Its same-node assertion passes: removing/reinserting the whole reward section
still cancels mouse activation. All raw results remain retained, with no retry
or relaxed input/assertion/deadline.

Two MutationObserver regressions reproduce the Journal/conversation parent
detach. Refresh now keeps that reward section continuously attached, rebuilds
its siblings and preserves the original prelude reading order. Conversation
retention applies only to the story surface; claiming/removing the last reward
still retires its controls. Generic clearing of other windows retains its
original behavior, including absent containers. Three focused quest/reward/
navigation suites pass44checks; changed-file lint passes. The corrected native
four-case run is required before selecting this component.
