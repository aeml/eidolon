# Alpha1.9.22 — keep your party in sight

Status: **public delivery accepted** at4f39328bb383051e00591d7295a3b12f2396ad77.
CI35492191742 passed every job, including predeployment and live character QA,
from05:38:33 to06:00:17UTC (21m44s). Independent public verification confirms
matching Alpha1.9.22 client/server commit, database ready, login label, versioned
runtime entry, cumulative1.9.22/1.9.21 notes, exact party CSS and the four-member
layout code. Receipt: `PUBLIC_RELEASE_VERIFIED` in
`/tmp/eidolon-earned-water-20260920-MuBmtK/run.log`.
The guarded Water continuation has passed its deployment/source checks and
started isolated setup; no Water completion is claimed by release acceptance.

The first publication was blocked in CI, not deployed. CI35491700557 on44729c2d
ended failure after9m57s: one old damage-role assertion still expected six
targeting probes instead of the ten now including exposed upper corners.
7,031 client tests passed; that assertion alone failed. Hosted browser and Go
jobs passed; deployment/native QA were skipped. Production remained1.9.21 then.
The assertion now requires all ten attempts, explicitly checks the four corners,
and still requires zero clicks through a covered target. This is a test-only
correction within the same1.9.22 candidate, not a gameplay targeting change.
That failed publication is historical; the corrected workflow is accepted above.

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
CI gate and exact live identities; those are now independently accepted above,
not inferred from these local checks.
