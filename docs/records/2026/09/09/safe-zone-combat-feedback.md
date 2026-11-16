# Safe-zone combat feedback and earned-route departure

Primary0691772 browser47584 failed during collection after passing the full
opening, diary and40-kill hunt/manualclaim/reconnect. Hunt573s,0deaths15reststops,
1593XP100gold→level8; collection then observed3target deaths,0/8Seeds. Final bag
had11free slots: this failure is not the earlier full-bag problem.

Failure log records position83.51,296.40, server safeZone="lanternhold", full
302HP/225MP and repeated accepted Fireballs without new damage receipts. Viewed
failed-collection.png shows the character behind the town fence and the target
card claiming IN RANGE. Server CombatRelationship deliberately returns neutral
for player/enemy pairs while the player is in safety; geometry can also block
shots through the fence. Do not weaken either rule to make the test pass.
Archive `/tmp/eidolon-story-safe-zone-combat-failure-2jkvBl`, scanner0 and exact
owned containers/ports removed. Previous failed run remains failed.

Client card now uses replicated safeZoneId to say "Leave the safe zone" for an
enemy target, regardless of geometric range. Clearing that server field restores
normal range feedback through the existing cache signature. Valid player duel
targets retain their own rules. No automatic movement, mana grant, offensive
spell/damage formula, healing, safe-zone boundary or Well Rested change.

The ordinary earned opening/collection/hunt drivers now leave safety through
their existing real travel callback when chase/loot movement crosses into town.
Wait for replicated membership to clear before attacking again. Dead characters
stay on the existing death path; target-death handling remains first. No combat
deadline reset, quest credit injection, waived kill or guaranteed drop.

Focused31432 passed16tests/3suites1.366s and lint; existing browser combat-card
fixtures now use the real engine intent builder and cover enter/leave warning
transitions at desktop and phone size. Added server relationship tests for exact
failure coordinates, fence, departure and same coordinates in another instance.
Actual focused browser, full integrated regression and fresh earned replay are
still required; the pending59 release is untouched by this unpublished change.

Focused server-race46016 passed1.800s, covering exact observed town position,
scene boundaries, ordinary departure, enemy acquisition and consented duels.
`/tmp/eidolon-safe-zone-combat-server.log`. No server production code changed.

Integrated51eeaa8 full37716 PASS283suites3983tests97.767s+lint;
`/tmp/eidolon-safe-functional-integrated-{client,lint}.log`. Focused hardware
browser14323 PASS2/6.9s. Both inspected desktop/phone screenshots show the amber
LEAVE THE SAFE ZONE warning; leaving restores In Range. Archive
`/tmp/eidolon-safe-zone-warning-proof-kqqx2s`, scanner0/port41961absent; log
`/tmp/eidolon-safe-zone-combat-browser.log`. This is real engine/UI presentation
evidence, not yet a native gameplay departure or fresh-story completion pass.
