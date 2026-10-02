# Alpha 1.60 social and endgame integration plan

This milestone connects the existing guild calendar, recruitment, party
preparation and reward guidance. Changes may be prepared while 1.59 runs through
CI; publication follows its accepted deployment. The integration preserves player
consent and existing server entry, settlement and moderation checks; it does not
add another queue. The prepared code is not a published milestone.

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
