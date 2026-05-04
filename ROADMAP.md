# Eidolon Roadmap

> Project by [Robert Mendola](https://mendola.tech)
>
> Last refreshed: May 3, 2026

This file is intentionally short. The active planning lives in two documents:

- [`docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md`](docs/plans/2026-04-18-alpha-1-0-roadmap-and-status.md) — high-level roadmap-and-status from `Alpha 0.35.0` through `Alpha 1.0`, with the active release line called out
- [`docs/plans/2026-05-03-v1-0-implementation-plan.md`](docs/plans/2026-05-03-v1-0-implementation-plan.md) — the audit-grounded v1.0 implementation plan that backs every release line, including slice contents, files, and definition-of-done gates

Per-patch detail lives in `index.html` Patch Notes.

## Where the project is right now

- Current displayed version: `Alpha 0.35.0`
- Active implementation line: `0.36` — reconnect and session resume
- Two parallel tracks run from here through `Alpha 1.0`:
  - **Track A (Stability):** reconnect, persistence hardening, decomposition, multi-client harness, perf
  - **Track B (Features):** social depth, guilds, PvP, endgame content
- Track A leads, Track B follows, both converge at `0.90` for pre-beta hardening

## Shipped foundation (summary)

- 4 playable classes, 4 overworld realms, 4 instanced dungeons
- Authoritative Go server with binary protobuf state streaming and MongoDB persistence
- Skill trees, passive talents, runes, combos, set bonuses, gems, forge, stash, gambling, trading house
- Quests, party play, social statuses, asset cache management, audio foundation, accessibility baseline
- Dungeon room-state, named room identity, boss-approach pacing, repro sandbox QA tooling
- Remote-actor smoothing, support-effect replication, render-time UI diffing

For the full shipped-line summary see the roadmap-and-status doc above.

## License

This project is open source.
