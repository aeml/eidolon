# Creature attack poses — local 1.43 candidate

Authored distinct attacks for the seven creatures deliberately excluded from
the regional armed-strike correction: Infernal Behemoth gores, Phoenix Sentinel,
Thunder Roc and Roc Matriarch peck, Cindermaw and Tiderend Leviathan open and
close their jaws, and Storm Harpy thrusts its wing-mounted javelin forward.
Anticipation, contact and recovery replace borrowed humanoid weapon sweeps.
Contact occurs at the existing 35% basic-hit timing; feet remain planted and
the actor root does not move. No damage, cadence, hitbox, geometry, material,
server or boss-mechanic changes. Unknown/imported actors remain untouched.

All 152 focused checks across six suites passed in 5.258 seconds. The new
checks sample every visible mesh vertex across 101 frames for finite, grounded
poses; verify actual contact anatomy reaches forward, returns to rest and
aligns through Actor at two attack intervals. An older test assumed an empty
weapon joint must animate; updated it to inspect the actual head contact track.
The first vertex test used excessive per-vertex assertions; accumulated the
same checks into one assertion, reducing test overhead without less coverage.
Scoped lint and whitespace checks passed.

The existing desktop and phone combat browser cases passed in 33 seconds,
including all seven creatures. Inspected desktop Cindermaw, Storm Harpy and
Infernal Behemoth contact captures, and phone Phoenix Sentinel, Thunder Roc,
Roc Matriarch and Tiderend Leviathan captures in
`/tmp/eidolon-creature-strikes-0929`. These are prepared actual-runtime poses,
not earned server hits, real-player readability acceptance or boss encounters.
No new browser jobs or campaign soak.

The movement is more anatomically appropriate, but the captures still show
the limitations of primitive creature silhouettes and the sparse scene. This
is not final Diablo/PoE-level art acceptance. Connected world density, actor
art, cohesive lighting and combat presentation remain larger quality work.
Local candidate only; no runtime bump, deployment or release-gate waiver.
