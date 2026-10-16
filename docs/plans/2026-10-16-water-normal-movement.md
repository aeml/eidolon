# Normal Water travel and Well integration

Source: `864b27b95d54d97e5b51bcaf5a3337797716412e`; exact rendered geometry: `bd52ed810d866e9235203d6628aa3beadc3dc03b`.
Qualified ordinary-input integration for the Water art milestone, not yet deployed.
[Construction qualification](2026-10-16-abyssal-quay-qualification.md).

A prepared level 30 Fighter with fourteen actual gear slots travels from town,
around the casino, through the north gate and along every authored Water road
waypoint to the public Abyssal approach. All movement uses ordinary ground clicks
and exact arrival checks. No jump, teleport or actor-position assignment occurs
on the route. The full HUD remains visible. This is not earned progression,
dungeon entry/clear, human pacing or physical-phone evidence.

The successful route lasts **112.292s**, with **913 captured frames** and
**155 observations**, all alive, correctly equipped and grounded on actual
production-flat terrain. Route frame sampling is off. The original 140s route and
230s browser limits are retained. The Go-race fixture passes in 149.00s / 150.062s
whole execution; the browser records one pass/one four-renderer alternative skip,
zero retries. Subsequent ordinary invitations/three socket peers and all four
saved gear, inventory, EP and party-membership assertions pass.

Retained initial findings:

- The first plan aimed through the existing casino facade. The corrected plan
  follows the open eastern lane, preserving all realm-road waypoints.
- The next plan reached that lane, but its 20m westward target was underneath the
  quest-tracker button. The helper correctly refused to click it. Water now uses
  closer 12m ground clicks in the unobstructed centre; Earth retains 20m clicks and
  its exact previously qualified waypoints, labels and capture settings. No HUD
  hiding, collision bypass, alternate-path fallback or timeout relaxation.
- Five route/preflight checks plus seven Tooling checks pass. Invalid realm or
  inconsistent route/scenario flags fail before database/browser setup. The
  longer Water screencast has its own 1800-frame cap, retaining the full arrival.

The following separate post-route Earth-party sample **fails retained High frame
limits** despite the successful movement/save checks:

| Observation | Actual | Original High limit |
| --- | ---: | ---: |
| Frame median | 33.3ms | 20ms |
| Frame p95 | 49.9ms | 33.4ms |
| Peak draws | 271 | 350 |
| Peak triangles | 203,761 | 250,000 |

All 180 frames are visible, with 122 stable entities and no preview frames. Geometry
preparation records 23→0 pending jobs and 53→70 installed. CPU-loop median/p95 is
26.5/39ms. These counters describe this fresh unpaired sample; they do not identify
a regression or its cause, clear cold/whole-world/device limits, or turn the
functional pass into FPS acceptance. Do not replay it for favorable timing.
Original performance findings and the full game/readiness goal remain open.

Actual arrival and moving frames 0200/0600/0900 were inspected. The portal,
equipped character, road and constructed stonework remain readable. Wider terrain,
vegetation, actor art and final modern presentation still need work/review.

The three owned servers, databases and listeners 18253/4190 are retired. Twelve
synthetic accounts were prepared across the three attempts; all six account names
that reached plaintext artifacts are scanned/redacted, including copied server
logs and the copied/original latest HTML report and embedded records. No plaintext
names remain. Synthetic labels in image pixels are not claimed redacted. Automatic
trace/video are off. No production accounts, access, value or data changed.
No new soak/stress, campaign or physical-device certification was run.

Private evidence root: `/home/aeml/.local/share/eidolon-water-approach-review-20261016/.qa-water-movement`.
Frozen 1032-entry inventory: `evidence-inventory.json`, SHA-256 `b0b0e0f479848398c3a0f500713424c819a15a9c6a4c340384ce0f477a9775df`.
