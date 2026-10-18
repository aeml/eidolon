# Specialization guidance and periodic quest equipment rewards

Owner request: make the level-10 specialization unlock clear and guide players
to its menu; periodically award a choice from six random quest-level items,
guaranteed green or better, with improved blue/orange odds.

The implemented default is every second authored main-story chapter, choosing
**one** item from six distinct equipment bases. Existing daily contracts and
optional catch-up chapters keep their current payouts. Each item independently
rolls 55% Uncommon (green), 35% Rare (blue), or 10% Legendary (orange), compared
with the ordinary equipment drop's 1% orange chance. Items use the chapter's
authored content level, not the character's current level. These are initial
balance settings, not a claim that campaign equipment pacing is finalized.

At level 10 and on returning level-10+ unspecialized characters, an accessible
HUD reminder opens Skills directly on the specialization tab and focuses the
first branch. It stays available until the authoritative selected branch arrives.
It does not open a menu automatically. Existing free specialization switching
and pre-10 preview/selection behavior are unchanged. Desktop and phone placement
keeps the reminder clear of combat buttons. Session disposal removes its UI and
prevents old buttons from reopening a later session's menu.

A successful nearby quest turn-in creates six server-owned items and journals
those exact offers with the completed quest and ordinary gold/XP receipt before
acknowledgement. It never rolls again on reopen, reconciliation, reconnect or
replayed completion. Completed older quests receive no retroactive invented
items. The conversation and Journal both show saved offers, rarity, level, slot,
stats and a separate confirmation button. A full bag retains the offers; the
player can continue the story and claim later from the Journal anywhere.

`claim_quest_item` is a bounded character action. It accepts only an item ID from
that player's completed, unclaimed quest. The same saved post-image contains the
exact bag addition, selected-item receipt and removed alternatives. Feedback
publishes that saved bag before the quest receipt. Failed or lost saves use the
existing character journal recovery; no second item or currency award is issued.
Quest/item copies own nested stat maps. Existing scalar quest equality assertions
now use complete deep equality because quests contain item slices; their original
assertions and fixtures are otherwise retained.

Validation so far:

- 58 client checks in seven suites passed, including navigation, explicit claim,
  full-bag/save-error retry, keyboard focus, safe item text and session disposal.
- 396 Go race regression checks passed across game, database and handlers; four
  explicitly opt-in integration checks were skipped in that invocation.
- Two controlled real-browser UI cases passed at 1280×900 and 390×844, with no
  automatic retries. They use shipped UIManager, SkillTree, QuestUI and CSS with
  software rendering. Screenshots were reviewed, including combat-button
  separation and the six-option Journal layout. These are presentation fixtures,
  not campaign-earned completion, native GPU or physical-device acceptance.
- The actual ordinary-login/Mongo/reconnect/claim integration passed in 11.40s
  (Go race; 12.505s package time), across two real API processes and one owned
  account. The turn-in reached level 10, six exact offers survived a cold server
  restart/fresh login, and the chosen item was saved exactly once. A replay was
  rejected; unrelated equipment and EP survived. Owned Mongo/processes were
  cleaned, and the actual synthetic credentials were scanned/redacted in fresh
  retained logs. Mongo had a 1-CPU/512-MiB cap; Go used two processors and a
  384-MiB soft memory target. This was one functional session, not soak/stress.
- Retained setup negatives exposed the next-chapter-only catalog, binary health
  ownership guard and missing investigation mask in the prepared ready quest.
  All three failures remain available with cleanup evidence; they are not counted
  as successful sessions. The corrected session had no automatic retries.
- The new presentation cases join the existing exact hosted-browser partition
  (469 discovered cases, no omissions or duplicates; 51 CI-policy checks in four
  suites passed). The actual quest session joins the CI server integration stage.

Publication remains pending. The prior 1.79.79 CI run 39092994270 failed before
Fighter game startup on `ERR_NETWORK_CHANGED` module downloads; its other three
wardrobe cases passed, and deployment/live jobs were skipped. Preserve that
failed run and all earlier release evidence. This feature must be included in a
fresh coherent milestone with cumulative notes, selected source, complete CI and
verified deployment. It must not be described as live before those checks pass.
Soak/stress and human campaign/phone feedback remain deferred.
