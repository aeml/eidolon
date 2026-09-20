# Earned campaign continuation with a real party

The September14 Earth readiness result remains accepted. Its private full save
at level30/7170XP/8539Gold, Orc46/50 is retained with verified SHA256
`be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c`:
`/tmp/eidolon-earned-earth-r2-20260914-1c1qRm/earned-earth-r2-level30.archive.gz`.
Do not substitute the older build-only JSON fixture or replay the opening.

September20 attempts revealed a disposable-account identity mistake. The first
finished the four kills and claimed level31 in memory, but preserving the old
character name prevented normal saves to the new account. Its Mongo archive is
still level30; a second attempt correctly refused to call it level31. Both runs
are terminal, their reports retained. These are not new saved-readiness passes.

The fix remaps only the character name to the new account's required save key.
Inventory, equipment, currency, XP, quest progress, resources and logout times
remain the original snapshot. Normal Leave Party controls remove the old
account's solo-party association. Real isolated Mongo restore/copy passed;
focused isolation, save-transfer and cleanup checks passed. Readiness must now
match actual saved Mongo level/XP/Gold and quest state, not only a warm reconnect.

The next route is `earned-party-dungeon`: restore the Wizard, finish the four
unsaved kills/manual handoff, verify its saved readiness, then form a normal
four-player party with prepared level30 Fighter, Cleric and Rogue. Those three
retain the approved class-appropriate Rare/Uncommon equipment; the Wizard keeps
only its actual earned build. Complete the full Normal30 Verdant dungeon,
individual manual claims, next Water offer and the Wizard's actual database
receipt. No forced deaths, additional rewards, stat scaling or instance-expiry
changes. This is earned Wizard progression with prepared support, **not** four
independently earned characters or acceptance of the party leveling curve.

Implementation is committed in the isolated worktree
`/tmp/eidolon-earned-continuation-20260920-0VmRVz/`; merge after the active Fire
raid ends. The 53 focused fixture/isolation checks pass in3.405s, lint/Bash/diff
checks pass. The connected mixed-provenance party route has not run yet. Use
the original private archive above, Low graphics, zero retries, and preserve
the final full save. Never overlap it with Fire or deployment browser QA.
