# Alpha 1.58 optional endgame goals

The Dungeon Guide now has an Endgame tab at level 100, bringing post-story
direction and the existing repeat-run systems into one readable overview.
This is packaged as Alpha 1.58.0 and pushed at
`4824a2fdb3cd6a6a50731321b7a29cd8126387fc`,
[CI36807934445](https://github.com/aeml/eidolon/actions/runs/36807934445).
It is not accepted live: browser shard 2 failed before deployment.
The preceding [1.57 is accepted](2026-10-01-release1-57-acceptance.md) at
`3632e2d57a33df8f7c4f6c18ea0d3563edc83d21`, CI36802997921. All ten jobs and
independent public identities, database readiness and six changed runtime files
passed. This candidate still requires its own CI and independent acceptance.

## Player choices and authority

The six goals cover finishing or revisiting the Fourfold Chronicle, choosing
a Normal/Heroic/Mythic run, Malachar's weekly personal cache, Resonance traits,
long-term Forge/loadout goals, and wardrobe/lore/world-event discoveries. They
are choices rather than mandatory daily objectives and add no tracker entries.
Buttons route to the existing dungeon/raid tabs, Character or the world atlas;
they do not create a run, place a wager, claim a prize or spend resources.

The normal server guide reply determines the story stage and weekly cache
status. Only a personally claimed Dark King quest means the Chronicle is
complete. Earlier stages explain crystal Vigils, the Dark Realm expedition,
the Nexus and personal turn-ins. Available, claimed and unknown cache states
remain distinct; unknown is not presented as an available reward. The guide
labels its eligibility snapshot and tells players to reopen for fresh status.
The existing server still checks actual entry, clearing and settlement.

Normal boss rewards remain unchanged. Heroic guarantees one bonus gem; Mythic
one bonus gem and one unique-effect item. Existing weekly status includes the
Monday UTC reset and makes clear that instance resets cannot reset the cache
limit. Players may still help another raid after claiming. At level 100, earned
XP becomes Resonance; EP cannot buy trait points or combat gear. Forge +20 is
a long-term endgame goal, not a requirement to finish the campaign. Owned-item
wardrobe learning consumes no gear; all EP and medal appearances are cosmetic.

The existing [Forge release](2026-09-28-release1-35.md) and
[Resonance and durable weekly-cache release](2026-09-29-release1-37.md) retain
their accepted mechanical evidence and human pacing limits. This milestone
does not replace them with synthetic campaign clears or change reward values,
material costs, lockouts, character saves, story gates or open-alpha access.

## Focused verification

Fifty-four logic/menu checks passed in 3.772 seconds: all story stages, all
cache states, explicit reward sources, no EP power path, optional dailies,
the two-tab under-cap and three-tab endgame keyboard cycles, normal screen
handoffs, and stale detached character buttons that cannot reopen the guide.
Scoped lint and whitespace checks passed. Mandatory browser discovery assigns
all 261 cases once, with no duplicates or omissions; the three new cases belong
to the existing raid-menu file rather than a new parallel test matrix.

Three native Chrome cases passed in 29.1 seconds at 1280×720, 390×844 and
844×390. They check readable scrolling cards, 44px buttons, hidden unrelated
preparation/footer controls on the Endgame tab, raid-tab navigation and the
normal Character handoff with no gameplay commands sent. All three screenshots
were reviewed. Artifacts: `/tmp/eidolon-1-58-endgame-layout-1001`. These prepared
server-shaped fixtures are not earned clears, physical-phone certification,
campaign pacing measurements or final endgame balance approval. No long soak
or production account mutation was used.

## Remaining release work

The initial CI failure exposed an existing keyboard fixture that still assumed
two adventure tabs: its End-key assertion expected Raids rather than the new
last tab, Endgame. The corrected route verifies Endgame focus/selection, hidden
party preparation and ArrowLeft back to Raids, then retains the existing run
actions and under-level behavior. It passed in native Chrome in 26.7 seconds.
Gameplay behavior and the Alpha 1.58.0 version are unchanged. The corrected
candidate still requires normal publication, terminal CI and independent live
acceptance; a local pass is not deployment success.

Local packaging passed 336 version/publisher checks in 2.467 seconds and both
unchanged anonymous login/release routes in 7.5 seconds. Scoped lint, shell syntax
and whitespace checks passed. The login version matches the local manifest;
new 1.58 notes precede the complete prior history. The notes screenshot was
reviewed in `/tmp/eidolon-1-58-login-notes-1001`. These checks establish local
packaging, not public backend readiness or deployment acceptance.

After 1.57 acceptance, 349 focused endgame, version and publisher checks passed
in 4.395 seconds. The outgoing runtime diff was reviewed; no later moderation
or calendar feature is included in this release.

Keep publication ordered after 1.56 and 1.57 acceptance. Login,
client/server/build versions and cumulative notes are aligned at 1.58.0. Fresh-fetch
and merge master immediately before a normal push to preserve website work.
Luna monitors CI; independent public identity, database readiness and exact
changed-runtime checks remain required. Source documentation was reviewed;
rendered documentation preview was unavailable.
