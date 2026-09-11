# Alpha 1.0.62 — adventure together

Candidate only; not published. Based on the integrated successor31501ede with
the user's website and game-analytics commits throughdea1795b preserved. The
full1.1–1.10 roadmap remains required; this is an incremental repair release.

## Player-facing scope

- Whole-instance dungeon/raid party kill credit, including connected downed
  teammates;110-unit overworld reward range and kill-time recipient snapshots.
  Each player still performs their own quest turn-in.
- Enemy stun/root/slow lifecycle, attack-impact stun admission and replicated
  status fields for observers. Boss immunity is retained.
- Compact desktop party/healing roster and explicit support-target admission;
  phone party reward guidance and move-only input consistency.
- Forge/item detail refresh, socket color consistency across icons/equipped
  models, held-weapon clearance and shared Well Rested aura rendering resources.
- Trained Guardian Roar/Executioner Spin areas and Purifying Wave cleansing-area
  Mastery; ready Chronicle guidance and empty fresh-character stashes.
- Prepared character stats now match ordinary creation/growth. Existing saves,
  ordinary base stats, outside regeneration and town recovery are not rewritten.

All older patch-note entries, including the domain61 migration, are retained.
Login, packages/lockfile, release manifest, server/container/deploy/CI and
disposable-QA defaults advance together to Alpha1.0.62.

## Explicit exclusions

The expanded campaign/reward curve/Dark King phase-cap changes, later Fighter
duration/rune/offline parity work, unified ability/projectile/periodic receiving
defenses, explosive shield PvP/wall repair and wound PvP-budget/Magma repairs
remain in separate follow-up branches. Do not list those as shipped in62 or
mistake this incremental release for the complete1.1 dungeon/combat gate.
Four-player full dungeon clear, saved-build/class/talent acceptance and physical
phone checks remain open in the overall roadmap. Casino stages are unchanged.

## Verification and release gates

Earlier8cf72eb2 full client/server/lint acceptance is recorded in
[the integration history](2026-09-11-gameplay-after61-integration.md).
It does not establish full acceptance of this versioned candidate or the user's
subsequent analytics addition.51165 current focused PASS280tests/4suites1.695s
checks version/default/history consistency, analytics, disposable-QA defaults
and the complete declared browser partition; log
`/tmp/eidolon-release62-focused.log`. Discovery/plan coverage is not native play.

Before publication:

1. Freeze a clean versioned candidate and pass full client/lint/server checks.
2. Pass its declared browser partition and required native character, equipment,
   party/support, socket appearance and rest-render routes. Retain truthful
   source identity, ordinary input and sanitized evidence; do not replace a
   failed native route with a unit pass or prepared fixture claim.
3. Recheck remote master to preserve newer user changes; revalidate any resulting
   integration. Do not overwrite the user's website or analytics commits.
4. Publish through normal CI and verify matching client/backend identities,
   saved-character gameplay, four-class/remote animation and town-rest behavior
   on play.eidolonrealms.com/server.eidolonrealms.com.

The currently running4ed50046 CI and pendingdea1795b CI are separate sources.
Keep their GPU slot free; their eventual success cannot prove62 gameplay.
The user cancelled only the interrupted soak. Leave it stopped without treating
that cancellation as a waiver of ordinary release or future concurrency gates.
