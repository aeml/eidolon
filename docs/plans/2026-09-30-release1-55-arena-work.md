# Alpha 1.55 arena quality work

Arena interface changes are implemented and locally verified. After
[full 1.54 acceptance](2026-09-30-release1-54-acceptance.md), Alpha 1.55.0 with
cumulative patch notes was pushed normally on October 1 at exact
`480a47b28137783c0f9db623a87ee8e6cd581d5a` after a fresh fetch/merge. Its CI run
is `36794385683`; final CI and independent public acceptance remain required.
Publication alone is not a live acceptance claim.

## Scope and retained behavior

The roadmap requires 1v1/2v2, team elimination, practice/ranked separation,
matchmaking windows, disconnect treatment and results. Existing authoritative
implementations remain unchanged: both teams' widening rating windows must
permit admission; practice never joins ranked; invalid or changed parties leave
the queue; whole-team elimination decides rounds; ranked results are durable
before profiles and return; only the actual leaver receives a deserter penalty.

Retain the [connected team, disconnect and restart evidence](2026-09-14-connected-arena-acceptance.md)
and [rendered team-round and personal-result evidence](2026-09-19-rendered-team-arena-preparation.md).
Those prepared-build checks do not establish earned progression, physical-phone
acceptance, broad class balance or real-population wait times. No additional
queue split, bot opponent, combat normalization or settlement policy is added.

## Interface improvements

Queue waiting time advances locally once per second from the latest server
snapshot. The rating window still displays the server's actual value; the client
does not claim a local prediction as admission authority. Refreshes remain every
five seconds and continue if a response is delayed. Clock updates change text
without replacing the queue controls or moving focus. Closing or disposing the
panel stops both polling and clocks, and late snapshots cannot revive disposal.

The panel shows the deserter restriction as a countdown, blocks ranked and
practice requests until its displayed deadline, and explains that teammates do
not receive that restriction. The server still rechecks eligibility. Detached
queue controls cannot submit after admission, match entry or disposal. Active
matches show their remaining time limit without declaring a winner or returning
the player when the client clock expires. Pending durable settlement stays
explicit. Queue, leave and forfeit controls have 44px minimum targets; ranked and
practice entry uses a readable two-column layout. Compact team rosters display
the authoritative Standing, Eliminated or Finished status for each participant,
with safe text names, full hover labels and bounded long names on narrow screens.

Authoritative and leaderboard snapshots preserve expanded or closed rules,
scroll position and focus on the same available action or disclosure summary.
Focus is not stolen from outside the body, restored to removed/disabled controls
or inherited by a replacement challenge's consent. This completes refresh
stability beyond the earlier local-clock-only focus checks.

## Focused verification

Seventeen arena UI tests passed in 1.083s, covering exact-second clocks, bounded
network polling, focus retention, refreshed rating windows, restriction expiry,
authoritative match completion and stale/disposed controls. Changed-scope lint
and diff checks passed.

The existing three duel/elimination browser cases passed during the initial
five-case run. Its two new countdown cases initially failed because layout
inspection consumed live observation time. The fixture now freezes observation
before creating deadlines; exact-second assertions were retained. Those two
cases then passed in 11.5s. Visual review found the leave button crowded the
waiting label, so it now occupies a separate line with a 44px target. The final
1280px and 390px cases passed in 13.5s with that target assertion. Reviewed phone
controls/waiting and desktop waiting screenshots show no crowded controls.

Final browser artifacts: `/tmp/eidolon-1-55-arena-ui-final-0930`. These are native
browser fixtures, not actual phone certification or a new ranked combat run.
Mandatory browser discovery assigns all 251 cases exactly once to existing
stages, including the two additions to the existing interface file.

After the refresh and roster additions, all 20 UI checks passed (0.859s).
The two desktop/390px routes and existing elimination-feedback route passed
three native cases in 17.8s, with exact-second active-match timing, retained
disclosures/focus, eliminated-player state and bounded roster width. Desktop
and narrow roster screenshots were visually reviewed. Latest artifacts:
`/tmp/eidolon-1-55-arena-roster-0930`. Scoped lint and diff checks passed;
combat/settlement behavior and the browser-case partition are unchanged.

Packaging passed 329 version/publisher checks in 2.534s, scoped lint, shell
syntax and diff checks. The first login-surface run exposed missing generated
vendor files in this isolated worktree; `npm run prepare:client` restored the
normal install output without changing tracked generated content. The two
unchanged anonymous desktop/mobile login and release-surface cases then passed
in 7.9s. Login identity agrees with the local manifest, the latest notes are
1.55, prior history remains below, and the patch-notes screenshot was reviewed.
Artifacts: `/tmp/eidolon-1-55-login-notes-ready-0930`. This is local packaging
evidence, not public acceptance or a production server check.

## Release requirements

The exact 1.54 predecessor passed all ten CI jobs and independent public checks.
The source was pushed after a fresh fetch/merge without discarding website or
owner work, with aligned version identities and 1.55 patch notes. Luna monitors the
run; root verifies exact public frontend/backend identity, database readiness
and changed assets before recording acceptance. Saves, open-alpha access,
economy, rating and disconnect policies remain unchanged. Source documentation
was reviewed; no rendered documentation preview was available.
