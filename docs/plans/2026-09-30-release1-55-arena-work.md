# Alpha 1.55 arena quality work

September 30, 2026. Arena interface changes are implemented and locally verified
on a separate, unpublished branch while the preceding 1.54 candidate completes
CI. This is not a deployed or accepted milestone. Version packaging, cumulative
patch notes, exact-source CI and independent public acceptance remain required
after 1.54 is accepted.

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
practice entry uses a readable two-column layout.

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

## Release requirements

Accept the exact 1.54 predecessor first. Merge any newer master changes without
discarding website or owner work, align every version identity, add accurate
1.55 patch notes and push normally after a fresh fetch/merge. Luna monitors the
run; root verifies exact public frontend/backend identity, database readiness
and changed assets before recording acceptance. Saves, open-alpha access,
economy, rating and disconnect policies remain unchanged. Source documentation
was reviewed; no rendered documentation preview was available.
