# Alpha 1.60 social and endgame integration plan

This milestone connects the existing guild calendar, recruitment, party
preparation and reward guidance. Changes may be prepared while 1.59 runs through
CI; publication follows its accepted deployment. Alpha 1.59 is now accepted at
a58ec61512cc8be22e1b197208eb5ec992dd7bd0 after all ten CI jobs and independent
public identity, database and changed-runtime checks passed. Its
[public receipt](2026-10-02-release1-59-public.json) records the exact source.
The integration preserves player
consent and existing server entry, settlement and moderation checks; it does not
add another queue. Alpha 1.60 is accepted live at
15df739e6f15e631d0ccff576947ae2d99237296: all ten jobs of CI36981917813
passed. Independent public HTTPS checks verified both identities, the ready
database, all five changed client runtime files and Ilyra's retained model and
loader. The [public receipt](2026-10-02-release1-60-public.json) records exact
publisher-output hashes. This does not close the human observations below.

## Confirmed gaps

The calendar previously lacked activity-specific recruitment. The prepared
`GuildEventsUI`, `GuildUI` and `SocialUI.openGroupFinder` integration opens the
existing board for a current, supported event. It does not post a listing,
invite anyone, join a party or start an activity automatically. Its explanation
distinguishes calendar plans from 20-minute listings, and callbacks reject a
changed, cancelled, finished or unsupported event, guild departure and disposal.

The old feedback called any nonempty room-counter summary “Dungeon complete,”
including intermediate bosses. The prepared server now matches the activity and
its final guardian and sends an explicit completion flag. Other summaries show
run progress; an elemental guardian kill directs players to the three-wave
Vigil, not a restored-crystal claim. Follow-up text keeps personal quest turn-ins,
weekly cache settlement and choosing another optional activity separate.

The previous transport also omitted the actual XP/Resonance receipt from boss
and room rewards. The prepared wire types use the server event structure directly
so the existing formatter receives the earned split, including rewards crossing
level 100. No award amounts or ownership rules change.

## Completed local checks

- Five focused client suites passed 99 checks in 2.28 seconds, including stale
  calendar navigation, normal Social UI routing and pre-cap, max-level and split
  XP/Resonance presentation. Full lint and whitespace checks passed.
- Reward guidance passed under the Go race detector in 1.056 seconds, including
  six actual finales, intermediate bosses, a mismatched boss and all four
  elemental guardians. Wire receipt preservation passed in 1.046 seconds.
- Two actual-component System Chrome cases passed in 10.4 seconds at desktop and
  phone-sized viewports. Calendar controls were explicitly scrolled into view;
  both final renders were inspected. The normal listing, application and party
  invitation tests remained in the same cases. Synthetic data, not physical-phone
  or production membership evidence.
- The existing ordinary-server recruitment socket exercise passed in 7.64
  seconds, with race-package total 8.685 seconds: three fresh characters,
  private applications, explicit invitation acceptance, readiness, normal token
  resume, leave/removal and unchanged progression/Gold/EP. CI reuses its existing
  server binary and disposable Mongo service to retain this check. The local
  task-labeled `eidolon-160-social-qa-20261002` container and anonymous volume
  were removed after the check; production was untouched.

The first XP split assertion incorrectly expected the boss currency formatter to
use the room callout's separator. The fixture now checks each existing format;
the failed attempt is not counted as acceptance.

The assembled 1.60 defaults, login label and cumulative patch notes passed 417
version/history, boot and menu checks in 4.239 seconds; full lint passed again.
These suites overlap the earlier checks, so their counts are not added as unique
coverage. The first assembly check caught the previous CI step-name assertion
and README source-version pointer before both were updated. All existing
history and the single reused server-build requirement remain checked.

## Existing integration evidence and open S checks

The [1.51 community acceptance](2026-09-30-release1-51-acceptance.md),
[1.52 guild acceptance](2026-09-30-release1-52-acceptance.md) and
[1.53 recruitment work](2026-09-30-release1-53-group-work.md) retain the earlier
social ownership, private applications and consent checks. This candidate reruns
the ordinary recruitment/ready/resume flow against the current server rather
than claiming those histories alone prove the changed handoff.

[1.54 duel acceptance](2026-09-30-release1-54-acceptance.md) and
[1.55 arena acceptance](2026-10-01-release1-55-acceptance.md) retain their consent
and settlement scopes. [1.56 season rules](2026-10-01-release1-56-seasons.md),
[1.57 event discovery](2026-10-01-release1-57-events.md) and
[1.58 optional endgame goals](2026-10-01-release1-58-endgame.md) remain the existing
loops, not newly activated systems. Entry and reward eligibility still belong
to the server. The [1.40 review](2026-09-29-1-40-readiness.md) records the limits
of prepared-party activity evidence and the user-deferred campaign observations.

The [1.59 moderation record](2026-10-01-release1-59-moderation.md) includes
independent chat/world restrictions, login support and reversal exercises. Its
successful deployment is still a prerequisite for publishing this closeout.
No production sanction or private report was used as test data here.

The technical S integration is prepared, not a claim that the complete S gate has
passed. There is no validated real-player population/wait-time study in these
checks. Sparse-group behavior therefore retains existing short-lived listings,
optional exploration and preparation while waiting, solo normal-dungeon access
and explicit raid minimums. Do not add new queues to solve an unobserved shortage.
Season operator agreement, actual content cadence and human multiplayer feedback
remain open before the stabilization and beta-readiness decisions. The overall
roadmap is not complete and no closed-beta transition is authorized.

## Integration checks

- Exercise calendar navigation through the actual Social UI, including cancelled,
  finished, changed, unsupported and detached event controls. Navigation must not
  send recruitment writes or party invitations.
- Verify intermediate, final, elemental and weekly raid reward guidance. Show
  existing rewards without granting an additional purse or inferring a personal
  quest claim from a kill. Use the existing Guide and optional endgame goals for
  follow-up, with a fresh server reply when eligibility is needed.
- Reuse the existing disposable socket fixture for recruitment ownership,
  applicant privacy, explicit invitations, ready checks and disconnect cleanup.
  Retain the independent moderation and PvP settlement evidence rather than
  repeating a long campaign or fabricating a large population.
- Run focused affected client/server checks, update login version and cumulative
  notes, fetch and merge concurrent remote work, then publish through the normal
  CI gates. Require exact-source frontend/backend and database-ready acceptance.

## Evidence limits

Real-player recruitment volume, sparse-population wait times, endgame pacing and
physical-phone party/dungeon comfort remain player observations, not established
capacity or balance claims. Existing optional events, season rules and six
endgame goals stay optional; this closeout does not activate a new season/reset,
force daily chores or change closed-beta access. Any remaining observations must
be carried forward explicitly to the stabilization and beta-readiness stages.
