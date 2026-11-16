# Eidolon 0.33.2 Repro Sandbox Smoke Workflow

Last refreshed: April 30, 2026 (`0.33.2`)

Purpose: use `repro.html` as a deterministic sandbox for fast client QA before booting a full live run.

## Scope

This workflow covers quick checks for:

- rendering sanity
- movement pick/marker feedback
- VFX readability
- menu chrome and close behavior
- dungeon room pacing previews, including `boss_approach`

The sandbox does not boot normal login, networking, character state, quests, or live gameplay systems.

## Open The Sandbox

Open `repro.html` directly from the repo or dev server.

Useful URL parameters:

- `?perf=1` shows the perf overlay on load
- `?instances=500` changes deterministic prop count
- `?instancing=0` compares non-instanced rendering behavior

## Two-Minute Smoke Pass

1. Load `repro.html` and confirm the scene renders without console errors.
2. Drag to orbit and scroll to zoom.
3. Click the ground and confirm the marker/readout updates.
4. Click `Preview telegraph` and confirm the danger ring is visible and pulses.
5. Click `Preview loot burst` and confirm reward objects animate cleanly.
6. Click `Preview jump landing` and confirm the landing footprint reads as an impact.
7. Open `Toggle menu chrome`, then close with the close button and `Esc`.
8. Toggle each dungeon room preview and confirm start, reward, `boss_approach`, and boss beats are visually distinct.
9. Toggle `P`, `G`, and `L` to confirm perf, grid, and light switches still work.
10. Click `Reset preview state` and confirm temporary previews clear.

## Dungeon Room Preview Checks

Use the Verdant, Abyss, Molten, and Tempest room buttons to check that each realm theme remains readable while sharing the same deterministic route shape.

Pass criteria:

- route direction reads left-to-right at a glance
- reward and boss rooms are visually distinct
- `boss_approach` uses a separate pressure marker rather than pretending to be a reward hook
- corridor width, floor contrast, and boss-room clutter are still readable from normal orbit angles

## When To Use This

Run this before full live QA when changing:

- rendering and environment setup
- transient effects and combat readability
- menu/window chrome
- dungeon route, minimap, world-map, or objective readability
- performance-sensitive object counts or instancing paths

## Evidence To Capture For Failures

- browser and viewport size
- exact URL parameters
- which preview button was active
- screenshot or short video
- console error, if present
- whether the same issue reproduces after `Reset preview state`
