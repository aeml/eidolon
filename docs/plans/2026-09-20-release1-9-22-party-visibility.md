# Alpha1.9.22 — keep your party in sight

Status: packaged and queued for publication, not yet deployed. Fire run
fireraid0920f is terminal exit1 and its services are gone; deployment can use
the native runner. Luna will monitor the exact publishing workflow. Do not
start Water or another native raid run until deployment browser work finishes.

The earned Verdant screenshot exposed a four-member roster whose header/tank
row scrolled offscreen after Ready Check. The real-HTML regression failed before
the fix (header y=-38, panel y=140). Full four-player desktop parties now use a
two-column roster with fixed header/health bars and independently scrollable,
keyboard-focusable options. Three-or-fewer parties, five-to-ten-member raids,
phone controls, combat rules and collision remain unchanged.

Both1280x720 and1440x900 layout cases pass in19.6seconds, including existing
raid-roster/ground-projection checks. The1280 screenshot was inspected.
Artifacts: `/tmp/eidolon-four-party-roster-20260920-XKGFE3/`.
Sixty focused social/healing tests pass, with changed-file lint/diff checks.
No replay of the accepted full dungeon is needed for this UI-only correction.

The batch also retains test-driver fixes and a prepared post-Verdant Water
continuation; those are not new gameplay features or full-region acceptance.
The earned Wizard's full Verdant result is documented separately, with actual
saved progress. Unfinished Water/Fire/Air raids, remaining campaign/dungeons,
cross-feature checks and final1.10 delivery remain open. Phone session feedback
is deferred by the user, not a failed gate or a new request.

Login, package/lock, release manifest, server/deployment defaults and additive
in-game patch notes are synchronized. All271 focused version/history checks
pass in3.353seconds, with lint and diff checks. The first check caught the two
CI version literals, now corrected. Publication still requires the full existing
CI gate and exact live identities; neither is claimed by these local checks.
