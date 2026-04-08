# Eidolon Final Vision

## The end state
Eidolon should feel like a real online action RPG, not a promising prototype.

The final version is a polished browser MMO with strong class identity, readable and satisfying combat, authored-feeling dungeon runs, meaningful loot progression, a living economy, and a client/server architecture that stays understandable as the game grows.

## Product vision
Eidolon should deliver:
- fast, readable, satisfying real-time combat
- strong class fantasy across Fighter, Rogue, Wizard, and Cleric
- dungeons that feel intentionally paced instead of procedurally shuffled for their own sake
- progression that stays rewarding from first login through endgame replay
- enough social/economy hooks that the world feels inhabited rather than solo with chat

If the final game works, a player should be able to say:
- the movement feels good
- combat is readable and punchy
- dungeon runs have rhythm and identity
- loot and progression make me want another run
- menus and systems are deep without being miserable to use

## Experience bar for "done"
### Gameplay feel
- movement, attacks, abilities, hit response, and recovery all feel authored
- enemy telegraphs and player effects are clear in chaotic fights
- deaths feel fair and understandable
- combat feedback is strong enough that sound and visuals both carry meaning

### World and progression
- each realm and dungeon has a distinct gameplay identity
- base progression feels smooth and understandable
- endgame difficulties are differentiated by mechanics and pacing, not just stat inflation
- rewards support multiple long-term goals: power, build expression, economy, and prestige

### Social and economy
- party play is smooth and worth doing
- the trading house supports a real item economy instead of acting like dead UI
- social systems are strong enough to keep players around between runs

### UX and onboarding
- a new player can understand movement, skills, quests, and progression quickly
- advanced systems stay legible even as depth increases
- menus are fast, responsive, and consistent
- accessibility options exist for key readability and control pain points

## Technical vision
The codebase should support years of iteration without turning into sludge.

### Client/runtime goals
- high-frequency UI updates are diffed/throttled instead of churning the DOM
- dungeon and instance transitions use explicit scene groups instead of broad reset behavior
- content and mesh definitions are registry/catalog driven wherever it materially reduces risk
- rendering, VFX, and gameplay presentation stay modular enough to improve without collateral damage

### Server/runtime goals
- the authoritative simulation remains the source of truth for movement, combat, and dungeon state
- protocol and persistence flows stay documented and debuggable
- dungeon generation and encounter pacing become easier to tune intentionally
- live balancing and operational metrics become first-class instead of guesswork

### Quality bar
- regressions are easier to reproduce in sandbox/repro tooling
- critical combat, dungeon, and UI flows have meaningful automated coverage
- the runtime remains debuggable under real content growth

## What to optimize for
When in doubt, optimize for:
1. gameplay feel
2. readability
3. maintainability
4. performance
5. content velocity

Not the other way around.

A clever system that slows down content or makes behavior opaque is a bad trade.

## Milestones to final vision

### Milestone 1: Core feel and readability pass
Goal:
Make the minute-to-minute experience feel intentional.

Success looks like:
- movement, attacks, jump timing, hit response, and enemy telegraphs feel authored
- combat state is easier to read during crowded fights
- menu and HUD feedback feel fast and consistent

### Milestone 2: Technical runtime cleanup
Goal:
Remove the biggest architecture and performance footguns before content scale makes them worse.

Success looks like:
- scene-group based instance transitions replace broad scene reset behavior
- high-frequency HUD/UI paths are diffed or throttled
- more content definitions move into catalogs/registries instead of hard-coded switch logic
- repro/sandbox QA tooling becomes a normal part of iteration

### Milestone 3: Dungeon depth and replayability
Goal:
Turn dungeons from "working content" into authored repeatable content.

Success looks like:
- room roles and pacing are intentional
- elite/event/reward cadence is meaningfully better
- endgame difficulty identity is based on mechanics and pacing, not just number inflation
- dungeon-specific rewards and run satisfaction hooks are stronger

### Milestone 4: Social, economy, and long-tail retention
Goal:
Make the world feel inhabited and sticky.

Success looks like:
- party play is smoother and more rewarding
- the trading house supports a genuinely useful economy loop
- social systems become strong enough to keep players engaged between runs
- longer-term account goals start to matter

### Milestone 5: Full presentation and onboarding pass
Goal:
Make the game feel complete to a new player and rewarding to a returning one.

Success looks like:
- stronger combat/menu/audio feedback
- clearer onboarding and first-session understanding
- accessibility options for readability and controls
- a level of polish where the game feels surprisingly finished for a browser MMO

## The north star
The north star is simple:

Build a browser MMO that feels shockingly complete, polished, and alive for how directly and leanly it is built.

Not a tech demo.
Not a systems sandbox.
A real game people would actually want to keep playing.
