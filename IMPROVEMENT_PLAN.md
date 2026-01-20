# Eidolon Improvement Plan

A comprehensive roadmap for expanding and enhancing Eidolon, a Conquer Online-style ARPG MMORPG.

---

## Table of Contents

1. [Current State Overview](#current-state-overview)
2. [Current Implementation Status](#current-implementation-status)
3. [Phase 1: New Zones](#phase-1-new-zones)
4. [Phase 2: New Dungeons](#phase-2-new-dungeons)
5. [Phase 3: Skills & Talents Overhaul](#phase-3-skills--talents-overhaul)
6. [Phase 4: Item System Enhancements](#phase-4-item-system-enhancements)
7. [Phase 5: Quality of Life & Game Feel](#phase-5-quality-of-life--game-feel)
8. [Phase 6: Quest System Expansion](#phase-6-quest-system-expansion)
9. [Implementation Schedule](#implementation-schedule)

---

## Current State Overview

### World Structure

| Zone | Location | Level Range | Element |
|------|----------|-------------|---------|
| Earth Realm | X: -1000 to 1000, Z: -600 to 1000 | 1-50 | Earth |
| Snow/Water Realm | X: -1000 to 1000, Z: -2200 to -600 | 50-70 | Water |
| Town | Center at (0, 200), Size: 200x200 | Safe | N/A |

### Existing Systems

| System | Status | Notes |
|--------|--------|-------|
| Classes | 4 classes | Fighter, Rogue, Wizard, Cleric |
| Skill Trees | 3 branches per class | 13 skills per class |
| Passive Talents | 40 per class | Generic stat bonuses |
| Dungeons | 1 dungeon | The Verdant Bastion (Lv 40-50) |
| Items | 5 rarities | Common, Uncommon, Rare, Legendary, Eidolic |
| Forge | 3 upgrade types | Level, Potency, Sockets |
| Quests | Daily kill quests | 7 quest types |
| Party System | Functional | Max 5 members |
| Trading House | Functional | Auction-style |

### Current Enemy Types

**Earth Realm (Lv 1-50):**
- Skeleton (Lv 1-10)
- Imp (Lv 10-20)
- Demon Orc (Lv 20-30)
- Construct (Lv 30-40)
- Inferno Titan (Lv 40-50)

**Water Realm (Lv 50-70):**
- Mountain Troll (Lv 50-55)
- Aqua Golem (Lv 55-60)
- Siren (Lv 60-65)
- Frost Guardian (Lv 65-70)

### The Verdant Bastion (Current Dungeon)

**Location:** X: 800, Z: 200  
**Level:** 40-50  
**Bosses:** 4

| Boss # | Name | HP | Strength | Dexterity |
|--------|------|-----|----------|-----------|
| 1 | RootboundWarden | 1,250,000 | 2,000 | 150 |
| 2 | BriarMatron | 1,350,000 | 2,500 | 200 |
| 3 | RustboundColossus | 1,500,000 | 3,000 | 250 |
| 4 | HollowSentinel | 1,750,000 | 3,500 | 300 |

---

## Current Implementation Status

This section documents what currently exists vs. what needs to be built.

### Fully Implemented ✅

| System | Status | Location |
|--------|--------|----------|
| 4 Classes | Complete | `src/entities/Fighter.js`, `Rogue.js`, `Wizard.js`, `Cleric.js` |
| 52 Skills | Complete | 13 skills per class, all functional |
| Skill Trees | Complete | 3 branches per class (SKILL_TREES in Constants.js) |
| Passive Talents | Structure Complete | 40 talents per class (PASSIVE_TALENTS in Constants.js) |
| 2 Zones | Complete | Earth Realm (Lv 1-50), Water/Snow Realm (Lv 50-70) |
| 1 Dungeon | Complete | The Verdant Bastion with 4 bosses |
| Item System | Complete | 5 rarities, stats, levels, potency |
| Forge System | Complete | Level upgrade, Potency upgrade, Socket upgrade |
| Trading House | Complete | Auction-style marketplace |
| Party System | Complete | Max 5 members |
| Daily Quests | Complete | 7 quest types |

### Partially Implemented ⚠️

| System | Current State | Gap |
|--------|--------------|-----|
| **Socket System** | Complete ✅ | Server: SocketedGem struct, `Gems []SocketedGem` field, `PerformForgeInsertGem()`, gem drops from enemies. Client: Forge Gems tab with insertion UI, tooltip display |
| **Talent Bonuses** | Complete ✅ | Server applies skill-specific bonuses via `talentDefForID()` with `GetSkillDamageMultiplier()` integration |

#### Socket System Details

**What exists (COMPLETE):**
- `server/internal/game/items.go`: Item struct has `Sockets int` and `Gems []SocketedGem` fields
- `server/internal/game/items.go`: `SocketedGem` struct with Type, Quality, Stats
- `server/internal/game/items.go`: `GemType`, `GemQuality`, `GemStats()`, `GenerateGem()`, `GenerateRandomGemByLevel()`, `GetNextGemQuality()` functions
- `server/internal/game/world.go`: `PerformForgeSocket()` adds sockets (max 4)
- `server/internal/game/world.go`: `PerformForgeInsertGem()` handles gem insertion
- `server/internal/game/world.go`: `PerformForgeCombineGems()` combines 3 gems into 1 higher quality
- `server/internal/game/world.go`: `PerformForgeRemoveGem()` removes gem from equipment (destroys it)
- `server/main.go`: `forge_insert_gem`, `forge_combine_gem`, `forge_remove_gem` message handlers
- Gem drops from level 20+ enemies (10% base chance, 30% for elites)
- Quality scales with enemy level (higher level = better gems)
- Socket costs scale: 250 × 2^(current sockets) shards
- `src/core/ItemSystem.js`: Client-side gem definitions (GEM_TYPES, GEM_QUALITIES, getGemStats)
- `src/ui/UIManager.js`: Forge Gems tab with sub-tabs for Insert/Combine/Remove, tooltip display
- `src/core/GameEngine.js`: Callbacks for `onForgeInsertGem`, `onForgeCombineGem`, `onForgeRemoveGem`

**Gem System is FULLY COMPLETE ✅**

#### Talent Bonus Details

**What exists (server/internal/game/world.go) - COMPLETE ✅:**

Talents are now skill-specific with proper server integration:

**Talents 1-26 (Skill-Specific):**
- Odd talents (1,3,5...): **Mastery** - +4% skill damage per rank (20% max)
- Even talents (2,4,6...): **Technique** - +3% CDR, +2% range/AoE per rank

**Talents 27-40 (Generic Class Bonuses):**
- Global CDR, mana efficiency, crit chance, damage reduction, etc.
- Each class has unique generic bonuses matching their playstyle

**Server Integration:**
- `TalentBonus` struct extended with `SkillName`, `SkillDamage`, `SkillCdr`, `SkillRange`, etc.
- `GetSkillBonus(skillName)` returns accumulated bonuses for a specific skill
- `GetSkillDamageMultiplier(skillName)` returns 1.0 + skill damage bonus
- `GetSkillCdrBonus(skillName)` returns CDR bonus for a skill
- All 25+ damage-dealing skills call `GetSkillDamageMultiplier()` in their execution code

**Client Integration:**
- `PASSIVE_TALENTS` in Constants.js shows exact percentages (e.g., "+4% Charge damage per rank (20% max)")

**Skill-Specific Talent System is FULLY COMPLETE ✅**

### Not Implemented ❌

| System | Status | Notes |
|--------|--------|-------|
| **Gem System** | Complete ✅ | Server: Full gem system with insert/combine/remove. Client: Forge Gems tab with 3 sub-tabs. Gems drop from level 20+ enemies. |
| **Set Items** | Client Done | Server: 8 class sets (2 per class) with 2/4/6 piece bonuses in items.go. Client: Set bonus calculation and tooltip display complete |
| **Unique Item Effects** | Client Done | Server: 10 proc effects in items.go. Client: All triggers implemented (lucky, executioner, berserker in attack; vampiric, explosive onKill; swift onSkill; thorns, guardian, regenerative, efficient passive) |
| **Skill Runes** | Complete ✅ | Server: SkillRuneDef structs, select_rune handler, rune effects on all 4 classes. Client: Runes tab in skill tree UI, rune selection/toggle, SKILL_RUNES constants |
| **Combo System** | Complete ✅ | Server: ComboDef structs, combo detection in skill execution, combo event broadcast. Client: Combos tab in skill tree UI, combo notification display, SKILL_COMBOS constants |
| **Fire Realm (West Zone)** | Complete | Server: Zone spawning in world.go. Client: 5 enemy entities + meshes |
| **Air Realm (East Zone)** | Complete | Server: Zone spawning in world.go. Client: 5 enemy entities + meshes |
| **Molten Core Dungeon** | Complete | Server: generateMoltenCoreLayout() in world.go. Client: 5 boss entities + meshes |
| **Tempest Spire Dungeon** | Complete | Server: generateTempestSpireLayout() in world.go. Client: 5 boss entities + meshes |
| **Difficulty Modes** | Complete | Server: DungeonDifficulty type with HP/damage/loot/XP multipliers. Client: Dungeon menu with difficulty selection |
| **Respec NPC** | Complete | Server: spawnRespecNPC(), PerformRespec(). Client: RespecNPC entity + respec menu UI |
| **Environmental Hazards** | Complete | Server: Hazard struct, % health damage, 4 realm hazard types. Client: EnvironmentalHazard.js with full visuals |
| **Reputation System** | Not Started | Faction standings, rewards |

### Implementation Priority

Based on dependencies and player impact:

1. ~~**Gem System**~~ - ✅ COMPLETE
2. ~~**Skill-Specific Talent Bonuses**~~ - ✅ COMPLETE - `talentDefForID()` with `GetSkillDamageMultiplier()` integration
3. ~~**New Zones (Fire/Air)**~~ - ✅ COMPLETE
4. ~~**New Dungeons**~~ - ✅ COMPLETE
5. ~~**Skill Runes**~~ - ✅ COMPLETE (Level 50/70/90 unlocks, 5 skills per class)
6. **Set Items** - Equipment depth
7. **Unique Effects** - Item variety
8. ~~**Combo System**~~ - ✅ COMPLETE (4 combos per class with client UI)

---

## Phase 1: New Zones

### World Map Overview

```
                            NORTH
                    ┌─────────────────────┐
                    │    WATER REALM      │
                    │    (Snow/Ice)       │
                    │    Lv 50-70         │
                    │    Element: Water   │
                    └──────────┬──────────┘
                               │
         WEST                  │                   EAST
    ┌──────────────┐    ┌──────┴──────┐    ┌──────────────┐
    │  FIRE REALM  │    │    EARTH    │    │  AIR REALM   │
    │  (Scorched   │◄───┤    REALM    ├───►│  (Skyward    │
    │   Wastes)    │    │   (Start)   │    │   Peaks)     │
    │  Lv 70-95    │    │   Lv 1-50   │    │  Lv 70-95    │
    │              │    │   [TOWN]    │    │              │
    │  ★ Molten    │    │             │    │  ★ Tempest   │
    │    Core      │    │ ★ Verdant   │    │    Spire     │
    └──────────────┘    │   Bastion   │    └──────────────┘
                        └─────────────┘
                            SOUTH
```

### 1.1 West Zone: The Scorched Wastes (Fire Element)

**Location:** X: -3000 to -1000, Z: -600 to 1000  
**Entrance:** Gap in Earth Realm's west wall at X: -1000, Z: 200  
**Theme:** Desert, lava, volcanic wasteland

#### Enemy Zones

| Area | X Range | Z Range | Level | Enemy Type | HP | Damage |
|------|---------|---------|-------|------------|-----|--------|
| 1 | -1400 to -1000 | -600 to 1000 | 70-75 | Sandstorm Djinn | 45,000 | 8,000 |
| 2 | -1800 to -1400 | -600 to 1000 | 75-80 | Magma Golem | 60,000 | 10,000 |
| 3 | -2200 to -1800 | -600 to 1000 | 80-85 | Scorched Wraith | 75,000 | 12,000 |
| 4 | -2600 to -2200 | -600 to 1000 | 85-90 | Infernal Behemoth | 95,000 | 14,000 |
| 5 | -3000 to -2600 | -600 to 1000 | 90-95 | Phoenix Sentinel | 120,000 | 16,000 |

#### New Enemy Types

| Enemy | Stats (STR/INT/DEX/WIS/VIT) | Special Ability |
|-------|----------------------------|-----------------|
| Sandstorm Djinn | 4000/1200/1000/1200/4500 | **Sandstorm** - AoE slow (30% for 5s) |
| Magma Golem | 5000/500/400/500/6000 | **Lava Pool** - Ground DoT zone (3s duration) |
| Scorched Wraith | 4500/2000/1500/2000/4500 | **Phase Shift** - Invulnerable for 2s |
| Infernal Behemoth | 6000/1000/600/1000/7000 | **Ground Slam** - AoE stun (2s) |
| Phoenix Sentinel | 5500/2500/1200/2500/5500 | **Rebirth** - Heals 50% HP once per fight |

#### Environmental Hazards

| Hazard | Effect | Location |
|--------|--------|----------|
| Lava Pools | 5% max HP/sec damage | Random spawn, Areas 2-5 |
| Sandstorm Zones | -30% movement speed, reduced visibility | Areas 1-2 |
| Heat Exhaustion | -10% max HP after 5 minutes | Zone-wide (cured at Oasis) |

#### Oasis Outpost (Safe Zone)

**Location:** X: -2000, Z: 200

**NPCs:**
| NPC | Function |
|-----|----------|
| Desert Merchant | Sells fire resist potions, water flasks |
| Fire Warden Quartermaster | Reputation vendor (fire damage gear) |
| Bounty Board | Zone-specific daily quests |
| Portal Master | Teleport to Town (requires Lv 70) |

---

### 1.2 East Zone: The Skyward Peaks (Air Element)

**Location:** X: 1000 to 3000, Z: -600 to 1000  
**Entrance:** Gap in Earth Realm's east wall at X: 1000, Z: 200  
**Theme:** Mountain peaks, floating islands, storm clouds

#### Enemy Zones

| Area | X Range | Z Range | Level | Enemy Type | HP | Damage |
|------|---------|---------|-------|------------|-----|--------|
| 1 | 1000 to 1400 | -600 to 1000 | 70-75 | Storm Harpy | 42,000 | 7,500 |
| 2 | 1400 to 1800 | -600 to 1000 | 75-80 | Cloud Elemental | 55,000 | 9,500 |
| 3 | 1800 to 2200 | -600 to 1000 | 80-85 | Thunder Roc | 70,000 | 11,500 |
| 4 | 2200 to 2600 | -600 to 1000 | 85-90 | Tempest Giant | 90,000 | 13,500 |
| 5 | 2600 to 3000 | -600 to 1000 | 90-95 | Cyclone Avatar | 115,000 | 15,500 |

#### New Enemy Types

| Enemy | Stats (STR/INT/DEX/WIS/VIT) | Special Ability |
|-------|----------------------------|-----------------|
| Storm Harpy | 3800/1000/1500/1000/4200 | **Gust** - Knockback (10 units) |
| Cloud Elemental | 4200/1500/800/1500/5500 | **Mist Form** - 50% miss chance for 3s |
| Thunder Roc | 5000/1800/1200/1800/5000 | **Chain Lightning** - Bounces to 3 targets |
| Tempest Giant | 5800/1200/700/1200/6500 | **Tornado** - Pulls players in (8 unit radius) |
| Cyclone Avatar | 5200/2200/1400/2200/5800 | **Eye of Storm** - Safe zone mechanic |

#### Environmental Hazards

| Hazard | Effect | Location |
|--------|--------|----------|
| Wind Gusts | Random knockback (5-10 units) | Areas 2-4 |
| Thin Air | -10% movement speed | Zone-wide (negated by rep) |
| Lightning Strikes | Random AoE damage (10% HP) | Areas 3-5 |
| Floating Platforms | Fall damage if missed | Areas 4-5 |

#### Aerie Outpost (Safe Zone)

**Location:** X: 2000, Z: 200

**NPCs:**
| NPC | Function |
|-----|----------|
| Mountain Trader | Sells wind resist potions, featherfall charms |
| Air Warden Quartermaster | Reputation vendor (lightning damage gear) |
| Bounty Board | Zone-specific daily quests |
| Portal Master | Teleport to Town (requires Lv 70) |

---

## Phase 2: New Dungeons

### Dungeon Overview

| Dungeon | Location | Level | Bosses | Element |
|---------|----------|-------|--------|---------|
| The Verdant Bastion | Earth (800, 200) | 40-50 | 4 | Earth/Nature |
| Frostbound Citadel | Water (-500, -1800) | 60-70 | 4 | Water/Ice |
| The Molten Core | Fire (-2400, 200) | 80-90 | 5 | Fire/Lava |
| The Tempest Spire | Air (2400, 200) | 80-90 | 5 | Air/Lightning |
| The Abyss | Hidden | 95-100 | 6 | All Elements |

### Difficulty Modes

| Mode | HP Multiplier | Damage | Mechanics | Rewards |
|------|---------------|--------|-----------|---------|
| Normal | 1x | 1x | Basic | Standard loot |
| Heroic | 2x | 1.5x | +1 mechanic per boss | +50% loot, rare gems |
| Mythic | 4x | 2x | All mechanics active | Unique items, titles |

### 2.1 The Molten Core (Fire Dungeon)

**Location:** X: -2400, Z: 200  
**Level:** 80-90  
**Estimated Clear Time:** 45-60 minutes  
**Weekly Lockout:** Yes (per difficulty)

#### Boss Encounters

##### Boss 1: Cindermaw (Fire Elemental)

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 3,000,000 | 8 min |
| Heroic | 6,000,000 | 10 min |
| Mythic | 12,000,000 | 10 min |

**Phase 1 (100% - 50% HP):**
| Ability | Description | Counter |
|---------|-------------|---------|
| Flame Breath | Frontal cone, 50% HP damage | Tank faces away from group |
| Scatter Flame | Random players marked, drop fire puddles | Spread out, drop at edges |
| Fire Sprite Spawn | 3 adds every 30s | AoE down quickly |

**Phase 2 (50% - 0% HP):**
| Ability | Description | Counter |
|---------|-------------|---------|
| Enrage | +50% damage | Burn faster |
| Molten Rain | Red circles on ground | Dodge continuously |
| 360 Breath | Full room cone every 60s | Group moves behind boss |

##### Boss 2: The Scorched Twins (Duo Fight)

| Difficulty | HP (Each) | Enrage Timer |
|------------|-----------|--------------|
| Normal | 2,000,000 | 8 min |
| Heroic | 4,000,000 | 10 min |
| Mythic | 8,000,000 | 10 min |

**Core Mechanic:** Both must die within 10 seconds or the dead one revives at 50% HP.

| Boss | Role | Abilities |
|------|------|-----------|
| Ember | Caster | Fireball Barrage (interruptible), Flame Shield |
| Cinder | Melee | Cleave (frontal), Searing Brand (tank swap at 3 stacks) |
| Combined | Both | When within 10 units, +100% damage to both |

##### Boss 3: Forgemaster Pyrax

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 4,000,000 | 10 min |
| Heroic | 8,000,000 | 12 min |
| Mythic | 16,000,000 | 12 min |

**Phase 1 (100% - 70%):** Tank and spank with add spawns  
**Phase 2 (70% - 40%):** Activates forge - destroy 4 anvils in 30s or boss becomes immune  
**Phase 3 (40% - 0%):** Creates molten weapons targeting random players

##### Boss 4: Obsidian Guardian

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 5,000,000 | 10 min |
| Heroic | 10,000,000 | 12 min |
| Mythic | 20,000,000 | 12 min |

**DPS Check:** Stone Shield at 50% HP must be broken in 20 seconds or party wipe.

| Ability | Description | Counter |
|---------|-------------|---------|
| Petrify | 8s stun (interruptible) | Must interrupt |
| Quake | Ground pound, damage if grounded | Jump ability or timing |
| Obsidian Spikes | Marked ground areas | Move out quickly |

##### Boss 5: Lord Infernax (Final Boss)

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 8,000,000 | 10 min |
| Heroic | 16,000,000 | 12 min |
| Mythic | 32,000,000 | 12 min |

**Phase 1 (100% - 70%):** Introduction phase, learn mechanics  
**Phase 2 (70% - 40%):**
- Fire wall maze (navigate or die)
- Meteor targets 2 players (stack to split damage)

**Phase 3 (40% - 0%):**
- Floor is lava (safe spots rotate every 10s)
- Must interrupt "Cataclysm" or party wipe
- Soft enrage: +10% damage every 30s

#### Loot Table

| Boss | Drops |
|------|-------|
| Cindermaw | Boots, Gloves, Ring |
| Scorched Twins | Shoulders, Belt, Trinket |
| Forgemaster Pyrax | Main Hand Weapon |
| Obsidian Guardian | Chest, Legs, Neck |
| Lord Infernax | Helm, Off-hand, Set Token |

**Mythic-Only Drops:**
- "Infernal" prefix items (+15% fire damage)
- Lord Infernax's Sigil (trinket)
- Title: "Flame Conqueror"

---

### 2.2 The Tempest Spire (Air Dungeon)

**Location:** X: 2400, Z: 200  
**Level:** 80-90  
**Estimated Clear Time:** 45-60 minutes  
**Weekly Lockout:** Yes (per difficulty)

#### Boss Encounters

##### Boss 1: Windshear

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 2,800,000 | 8 min |
| Heroic | 5,600,000 | 10 min |
| Mythic | 11,200,000 | 10 min |

| Ability | Description | Counter |
|---------|-------------|---------|
| Gale Force | Massive knockback | Position against walls |
| Wind Tunnel | Line attack | Sidestep |
| Vacuum | Pulls all players to center | Run outward |

##### Boss 2: The Stormcallers (Duo Fight)

| Difficulty | HP (Each) | Enrage Timer |
|------------|-----------|--------------|
| Normal | 1,800,000 | 8 min |
| Heroic | 3,600,000 | 10 min |
| Mythic | 7,200,000 | 10 min |

| Boss | Element | Abilities |
|------|---------|-----------|
| Voltara | Lightning | Chain Lightning, Static Field |
| Zephyros | Wind | Tornado Summon, Wind Blade |

**Mechanic:** If both are too close, they create a Storm Surge (massive AoE damage).

##### Boss 3: Roc Matriarch

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 3,800,000 | 10 min |
| Heroic | 7,600,000 | 12 min |
| Mythic | 15,200,000 | 12 min |

**Flying Boss Mechanic:** Boss alternates between ground and air phases.

| Phase | Abilities |
|-------|-----------|
| Ground | Talon Swipe, Egg Protection (destroy eggs or adds spawn) |
| Air | Dive Bomb (dodge markers), Feather Barrage (spread damage) |

##### Boss 4: Thunderlord Kaelix

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 4,800,000 | 10 min |
| Heroic | 9,600,000 | 12 min |
| Mythic | 19,200,000 | 12 min |

| Ability | Description | Counter |
|---------|-------------|---------|
| Lightning Rod | Player becomes conduit | Targeted player moves away |
| Thunder Clap | AoE stun | Interrupt or spread |
| Storm Giant Form | At 30%, grows larger, increased damage | Final burn phase |

##### Boss 5: Zephyrion, the Eternal Gale (Final Boss)

| Difficulty | HP | Enrage Timer |
|------------|-----|--------------|
| Normal | 7,500,000 | 10 min |
| Heroic | 15,000,000 | 12 min |
| Mythic | 30,000,000 | 12 min |

**Phase 1 (100% - 60%):**
- Wind walls rotate around arena
- Eye of Storm safe zones

**Phase 2 (60% - 30%):**
- Platform phase (jumping puzzle while fighting)
- Lightning strikes on previous platform

**Phase 3 (30% - 0%):**
- Full tornado phase
- Must DPS in narrow safe windows
- Enrage: Tornado expands until arena is consumed

#### Loot Table

| Boss | Drops |
|------|-------|
| Windshear | Boots, Gloves, Ring |
| Stormcallers | Shoulders, Belt, Trinket |
| Roc Matriarch | Main Hand Weapon |
| Thunderlord Kaelix | Chest, Legs, Neck |
| Zephyrion | Helm, Off-hand, Set Token |

**Mythic-Only Drops:**
- "Tempest" prefix items (+15% lightning damage)
- Eye of Zephyrion (trinket)
- Title: "Stormbreaker"

---

## Phase 3: Skills & Talents Overhaul

### 3.1 Skill Runes System

Each skill can be modified with runes unlocked at levels 50, 70, and 90.

#### Fighter Runes

| Skill | Rune | Unlock | Effect |
|-------|------|--------|--------|
| Charge | Momentum | 50 | +50% range, damage scales with distance |
| Charge | Shockwave | 70 | Ends with knockback AoE |
| Charge | Unstoppable | 90 | CC immune during, +20% armor for 5s after |
| Whirlwind | Extended | 50 | +100% duration, -50% damage |
| Whirlwind | Bladestorm | 70 | Pulls enemies toward you |
| Whirlwind | Bloodwhirl | 90 | Heals 2% HP per enemy hit |
| Shield Slam | Concussion | 50 | Stun duration +1s |
| Shield Slam | Reverberation | 70 | Hits twice |
| Shield Slam | Fortify | 90 | Grants shield equal to damage dealt |

#### Rogue Runes

| Skill | Rune | Unlock | Effect |
|-------|------|--------|--------|
| Piercing Throw | Ricochet | 50 | Bounces to 2 additional targets |
| Piercing Throw | Serrated | 70 | Applies bleed (5s DoT) |
| Piercing Throw | Executioner | 90 | +100% damage to targets below 30% HP |
| Backstab | Ambush | 50 | +50% crit chance |
| Backstab | Eviscerate | 70 | Ignores 50% armor |
| Backstab | Shadowstep | 90 | Teleport behind target before striking |
| Fan of Knives | Weighted | 50 | Slows enemies hit by 30% |
| Fan of Knives | Poisoned | 70 | Applies poison DoT |
| Fan of Knives | Bladed Fury | 90 | Double the number of knives |

#### Wizard Runes

| Skill | Rune | Unlock | Effect |
|-------|------|--------|--------|
| Fireball | Magma Orb | 50 | Slower, leaves burning ground |
| Fireball | Chain Reaction | 70 | Bounces to 3 additional targets at 50% damage |
| Fireball | Empowered | 90 | +100% damage, +3s cooldown |
| Meteor Drop | Cluster | 50 | 3 smaller meteors instead of 1 |
| Meteor Drop | Extinction | 70 | +50% radius |
| Meteor Drop | Apocalypse | 90 | Meteors continue for 5s after cast |
| Teleport | Blink | 50 | +50% range |
| Teleport | Phase | 70 | Invulnerable for 1s after teleport |
| Teleport | Warp | 90 | Damages enemies at start and end location |

#### Cleric Runes

| Skill | Rune | Unlock | Effect |
|-------|------|--------|--------|
| Spirit Guardians | Expanded | 50 | +50% radius |
| Spirit Guardians | Vengeful | 70 | +50% damage, -25% healing |
| Spirit Guardians | Sanctuary | 90 | Also reduces damage taken by 20% |
| Healing Light | Beacon | 50 | Heals in AoE around target |
| Healing Light | Renewal | 70 | Adds HoT for 5s |
| Healing Light | Divine | 90 | Also cleanses 1 debuff |
| Divine Intervention | Quick Save | 50 | Cooldown reduced by 50% |
| Divine Intervention | Guardian Angel | 70 | Target gains 50% damage reduction for 5s |
| Divine Intervention | Miracle | 90 | Can affect 2 targets |

---

### 3.2 Talent System Enhancement

#### Current Structure (Keep & Enhance)

The existing talent system uses a **skill-based structure** with 40 talents per class:
- **26 Skill Talents** (13 skills × 2 types: Mastery & Technique)
- **14 Utility Talents** (generic class improvements)
- Each talent has **5 ranks**
- **1 talent point per 5 levels** = 20 points at level 100

**Current Issue:** Descriptions are vague ("Minor improvements to...") and server bonuses are generic stat blocks assigned by ID ranges, not matching the actual talent names.

#### Proposed Enhancement

Keep the existing Mastery/Technique structure but make bonuses **specific and meaningful**:

---

#### Fighter Talents (40 Total)

##### Skill Talents (FTR_01 - FTR_26)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| FTR_01 | Charge - Mastery | +10% Charge damage |
| FTR_02 | Charge - Technique | -0.5s Charge cooldown |
| FTR_03 | Whirlwind - Mastery | +8% Whirlwind damage |
| FTR_04 | Whirlwind - Technique | +0.2s Whirlwind duration |
| FTR_05 | Shield Slam - Mastery | +12% Shield Slam damage |
| FTR_06 | Shield Slam - Technique | +0.3s Shield Slam stun duration |
| FTR_07 | Iron Fortress - Mastery | +2% Iron Fortress damage reduction |
| FTR_08 | Iron Fortress - Technique | +3s Iron Fortress duration |
| FTR_09 | Guardian Roar - Mastery | +10% Guardian Roar buff strength |
| FTR_10 | Guardian Roar - Technique | +1s Guardian Roar taunt duration |
| FTR_11 | Sweeping Strike - Mastery | +10% Sweeping Strike damage |
| FTR_12 | Sweeping Strike - Technique | +5% Sweeping Strike threat generation |
| FTR_13 | Earthshaker - Mastery | +15% Earthshaker damage |
| FTR_14 | Earthshaker - Technique | +0.4s Earthshaker knockdown duration |
| FTR_15 | Unbreakable Grip - Mastery | +1 unit Unbreakable Grip range |
| FTR_16 | Unbreakable Grip - Technique | -1s Unbreakable Grip cooldown |
| FTR_17 | Juggernaut Charge - Mastery | +5% Juggernaut Charge slow strength |
| FTR_18 | Juggernaut Charge - Technique | +1s Juggernaut Charge slow duration |
| FTR_19 | Berserker Edge - Mastery | +2% Berserker Edge damage bonus |
| FTR_20 | Berserker Edge - Technique | Berserker Edge activates at -2% lower HP threshold |
| FTR_21 | Shattering Charge - Mastery | +3% Shattering Charge armor reduction |
| FTR_22 | Shattering Charge - Technique | +1s armor reduction duration |
| FTR_23 | Executioner Spin - Mastery | +10% Executioner Spin damage |
| FTR_24 | Executioner Spin - Technique | +5% damage vs taunted targets |
| FTR_25 | Last Stand Rampage - Mastery | +8% Last Stand damage boost |
| FTR_26 | Last Stand Rampage - Technique | +2s Last Stand duration |

##### Utility Talents (FTR_27 - FTR_40)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| FTR_27 | Combat Discipline | -2% all Fighter ability cooldowns |
| FTR_28 | Battle Breathing | -3% mana cost for all abilities |
| FTR_29 | Threat Mastery | +5% threat generation from all abilities |
| FTR_30 | Crowd Control Drills | +0.2s stun/slow duration on all abilities |
| FTR_31 | Frontliner Routine | +2% armor while in combat |
| FTR_32 | Heavy Weapon Technique | +3% damage with all abilities |
| FTR_33 | Lineholder Instinct | +5% AoE radius on all abilities |
| FTR_34 | Rally Presence | +1% party damage while alive |
| FTR_35 | Aggressor Footwork | +3% movement speed after using ability |
| FTR_36 | Shieldwall Training | +50 flat defense |
| FTR_37 | Breakthrough | +2% armor penetration |
| FTR_38 | Enduring Rhythm | +2% damage for each enemy within 10 units |
| FTR_39 | Battlefield Awareness | +5% crit chance vs enemies you've taunted |
| FTR_40 | Vanguard Momentum | Next ability after Charge deals +10% damage |

---

#### Rogue Talents (40 Total)

##### Skill Talents (ROG_01 - ROG_26)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| ROG_01 | Piercing Throw - Mastery | +10% Piercing Throw damage |
| ROG_02 | Piercing Throw - Technique | Piercing Throw pierces +1 additional target |
| ROG_03 | Backstab - Mastery | +15% Backstab damage |
| ROG_04 | Backstab - Technique | +5% Backstab crit chance |
| ROG_05 | Weak Point Mark - Mastery | +3% damage bonus from Mark |
| ROG_06 | Weak Point Mark - Technique | +2s Mark duration |
| ROG_07 | Shadow Lunge - Mastery | +12% Shadow Lunge damage |
| ROG_08 | Shadow Lunge - Technique | +1s bleed duration |
| ROG_09 | Death Spiral - Mastery | +8% Death Spiral damage per bleed stack |
| ROG_10 | Death Spiral - Technique | -2s Death Spiral cooldown |
| ROG_11 | Fan of Knives - Mastery | +10% Fan of Knives damage |
| ROG_12 | Fan of Knives - Technique | +1 additional knife thrown |
| ROG_13 | Serrated Edges - Mastery | +15% bleed damage |
| ROG_14 | Serrated Edges - Technique | +1s bleed duration |
| ROG_15 | Blade Storm - Mastery | +10% Blade Storm damage |
| ROG_16 | Blade Storm - Technique | +10° cone width |
| ROG_17 | Phantom Volley - Mastery | +8% damage per volley |
| ROG_18 | Phantom Volley - Technique | +1 additional volley |
| ROG_19 | Smoke Bomb - Mastery | +5% slow strength |
| ROG_20 | Smoke Bomb - Technique | +1s smoke duration |
| ROG_21 | Poison Coating - Mastery | +20% poison DoT damage |
| ROG_22 | Poison Coating - Technique | +2s poison duration |
| ROG_23 | Tripwire - Mastery | +0.5s root duration |
| ROG_24 | Tripwire - Technique | -3s Tripwire cooldown |
| ROG_25 | Cloak & Vanish - Mastery | +1s invisibility duration |
| ROG_26 | Cloak & Vanish - Technique | +10% movement speed while invisible |

##### Utility Talents (ROG_27 - ROG_40)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| ROG_27 | Opportunist's Flow | -2% all Rogue ability cooldowns |
| ROG_28 | Dirty Tricks | +5% damage to debuffed enemies |
| ROG_29 | Quickhands | +3% attack speed |
| ROG_30 | Shadow Poise | +2% dodge chance |
| ROG_31 | Silent Balance | +3% movement speed |
| ROG_32 | Needle Precision | +2% crit chance |
| ROG_33 | Lightstep | -0.5s on escape ability cooldowns |
| ROG_34 | Fine Motor | +5% multi-hit ability damage |
| ROG_35 | Catlike Reflexes | +1% chance to reset ability cooldown on crit |
| ROG_36 | Quick Draw | +10% throw ability damage |
| ROG_37 | Evasive Flow | +1% dodge per enemy targeting you (max 5%) |
| ROG_38 | Close-Quarters Grace | +5% melee ability damage |
| ROG_39 | Edge Awareness | +3% crit damage |
| ROG_40 | Wrist Control | +5% damage when attacking from behind |

---

#### Wizard Talents (40 Total)

##### Skill Talents (WIZ_01 - WIZ_26)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| WIZ_01 | Fireball - Mastery | +10% Fireball damage |
| WIZ_02 | Fireball - Technique | +0.5 unit Fireball explosion radius |
| WIZ_03 | Flame Whip - Mastery | +12% Flame Whip damage |
| WIZ_04 | Flame Whip - Technique | +0.3s Flame Whip stun duration |
| WIZ_05 | Flame Tornado - Mastery | +10% Flame Tornado damage |
| WIZ_06 | Flame Tornado - Technique | +1s Flame Tornado duration |
| WIZ_07 | Meteor Drop - Mastery | +15% Meteor Drop damage |
| WIZ_08 | Meteor Drop - Technique | +1 unit Meteor explosion radius |
| WIZ_09 | Inferno Cataclysm - Mastery | +8% Inferno Cataclysm damage |
| WIZ_10 | Inferno Cataclysm - Technique | +1s Inferno Cataclysm duration |
| WIZ_11 | Scorch Beam - Mastery | +12% Scorch Beam damage |
| WIZ_12 | Scorch Beam - Technique | +3% armor reduction |
| WIZ_13 | Arcane Missiles - Mastery | +10% Arcane Missiles damage |
| WIZ_14 | Arcane Missiles - Technique | +1 additional missile |
| WIZ_15 | Spell Focus - Mastery | +5% Spell Focus damage multiplier |
| WIZ_16 | Spell Focus - Technique | -1s Spell Focus channel time |
| WIZ_17 | Dragonfire Lance - Mastery | +12% Dragonfire Lance damage |
| WIZ_18 | Dragonfire Lance - Technique | +2 unit Dragonfire Lance range |
| WIZ_19 | Teleport - Mastery | +2 unit Teleport range |
| WIZ_20 | Teleport - Technique | -1s Teleport cooldown |
| WIZ_21 | Arcane Shield - Mastery | +10% Arcane Shield absorption |
| WIZ_22 | Arcane Shield - Technique | +2s Arcane Shield duration |
| WIZ_23 | Gravity Well - Mastery | +8% Gravity Well damage |
| WIZ_24 | Gravity Well - Technique | +1 unit Gravity Well radius |
| WIZ_25 | Time Warp - Mastery | +3% Time Warp haste bonus |
| WIZ_26 | Time Warp - Technique | +2s Time Warp duration |

##### Utility Talents (WIZ_27 - WIZ_40)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| WIZ_27 | Efficient Casting | -3% mana cost for all spells |
| WIZ_28 | Quickened Formulae | -2% all spell cooldowns |
| WIZ_29 | Runic Precision | +3% spell damage |
| WIZ_30 | Leyline Recall | +5% Teleport range |
| WIZ_31 | Overchannel | +5% damage on next spell after channel |
| WIZ_32 | Arcane Stability | +10% shield/absorption effectiveness |
| WIZ_33 | Elemental Rhythm | +3% damage when casting same spell twice |
| WIZ_34 | Prismatic Control | +0.2s CC duration on all spells |
| WIZ_35 | Aether Reach | +3% spell range |
| WIZ_36 | Volatile Insight | +5% AoE spell damage |
| WIZ_37 | Channel Discipline | -5% interrupt chance while casting |
| WIZ_38 | Mana Geometry | +2% mana regeneration |
| WIZ_39 | Sigil Mastery | +2% crit chance with spells |
| WIZ_40 | Contingency Wards | +50 flat defense while casting |

---

#### Cleric Talents (40 Total)

##### Skill Talents (CLR_01 - CLR_26)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| CLR_01 | Spirit Guardians - Mastery | +10% Spirit Guardians damage |
| CLR_02 | Spirit Guardians - Technique | +1 unit Spirit Guardians radius |
| CLR_03 | Healing Light - Mastery | +10% Healing Light healing |
| CLR_04 | Healing Light - Technique | -1s Healing Light cooldown |
| CLR_05 | Guardian Embrace - Mastery | +8% Guardian Embrace HoT |
| CLR_06 | Guardian Embrace - Technique | +1s Guardian Embrace duration |
| CLR_07 | Purifying Wave - Mastery | +10% Purifying Wave healing |
| CLR_08 | Purifying Wave - Technique | +1 additional debuff cleansed |
| CLR_09 | Divine Intervention - Mastery | Target revives with +5% more HP |
| CLR_10 | Divine Intervention - Technique | -30s Divine Intervention cooldown |
| CLR_11 | Radiant Strike - Mastery | +12% Radiant Strike damage |
| CLR_12 | Radiant Strike - Technique | +3% lifesteal from Radiant Strike |
| CLR_13 | Consecrated Ground - Mastery | +8% Consecrated Ground healing/damage |
| CLR_14 | Consecrated Ground - Technique | +1 unit Consecrated Ground radius |
| CLR_15 | Spirit Guardians Boost - Mastery | +5% Spirit Guardians damage boost |
| CLR_16 | Spirit Guardians Boost - Technique | +1s slow duration |
| CLR_17 | Avenging Seraph - Mastery | +10% Seraph damage |
| CLR_18 | Avenging Seraph - Technique | +3s Seraph duration |
| CLR_19 | Blessing of Resolve - Mastery | +2% defense buff strength |
| CLR_20 | Blessing of Resolve - Technique | +3s buff duration |
| CLR_21 | Blessing of Zeal - Mastery | +3% attack speed buff strength |
| CLR_22 | Blessing of Zeal - Technique | +3s buff duration |
| CLR_23 | Mark of Weakness - Mastery | +2% damage taken debuff |
| CLR_24 | Mark of Weakness - Technique | +2s debuff duration |
| CLR_25 | Heaven's Trumpet - Mastery | +10% Heaven's Trumpet damage |
| CLR_26 | Heaven's Trumpet - Technique | +0.5s stun duration |

##### Utility Talents (CLR_27 - CLR_40)

| ID | Talent Name | Effect Per Rank |
|----|-------------|-----------------|
| CLR_27 | Efficient Rites | -3% mana cost for all abilities |
| CLR_28 | Rites of Haste | -2% all ability cooldowns |
| CLR_29 | Mercy Routine | +3% healing done |
| CLR_30 | Sanctuary Practice | +5% buff duration |
| CLR_31 | Radiant Doctrine | +3% holy damage |
| CLR_32 | Cleanse Discipline | +1 debuff cleansed per cast |
| CLR_33 | Chorus of Faith | +1% party stats while alive |
| CLR_34 | Battlefield Ministry | +5% AoE healing radius |
| CLR_35 | Warden's Instinct | +50 flat defense |
| CLR_36 | Blessed Footwork | +3% movement speed |
| CLR_37 | Hymncraft | +5% healing on targets with your buffs |
| CLR_38 | Pilgrim Patience | +2% HP regeneration in combat |
| CLR_39 | Mercy Doctrine | Overhealing creates +2% max HP shield |
| CLR_40 | Ritekeeper | +3% effect on consecutive same-ability casts |

---

#### Alternative: Three-Tree Structure (Future Option)

If you later want to add specialization trees, the existing 40 talents can be reorganized:

**Fighter:**
- **Vanguard (Tank):** FTR_01-13 + new capstone
- **Warlord (Damage):** FTR_14-26 + new capstone  
- **Commander (Support):** FTR_27-40 + new capstone

This allows gradual migration without breaking existing saves.

---

### 3.3 Combo System ✅ COMPLETE

Certain skill combinations trigger bonus effects within a 3-second window.

**Implementation Status:** ✅ Complete
- Server: ComboDef structs in `world.go`, combo detection in skill execution, `OnEvent("combo", ...)` broadcast
- Server: 16 combos (4 per class), all effects consumed in skill code
- Client: MsgCombo handler in `GameEngine.js`, combo floating text notification
- Client: `showComboNotification()` in `UIManager.js` with animated screen notification
- Client: Combos tab in skill tree UI showing all class combos
- Client: `SKILL_COMBOS` constant in `Constants.js`

#### Fighter Combos

| Combo Name | Skill Sequence | Effect |
|------------|----------------|--------|
| Momentum Strike | Charge → Whirlwind | +50% Whirlwind damage |
| Tremor Rush | Earthshaker → Charge | Extended knockdown (+2s) |
| Guardian Combo | Shield Slam → Guardian Roar | +50% taunt duration |
| Iron Will | Iron Fortress → Last Stand Rampage | Damage reduction persists during rampage |

#### Rogue Combos

| Combo Name | Skill Sequence | Effect |
|------------|----------------|--------|
| Ambush | Cloak & Vanish → Backstab | Guaranteed critical hit |
| Venom Burst | Poison Coating → Death Spiral | +100% poison damage |
| Blade Tornado | Fan of Knives → Phantom Volley | Volley pierces all targets |
| Shadow Dance | Shadow Lunge → Smoke Bomb | Smoke bomb instant cast |

#### Wizard Combos

| Combo Name | Skill Sequence | Effect |
|------------|----------------|--------|
| Implosion | Gravity Well → Fireball | +100% Fireball damage in well |
| Arcane Barrage | Arcane Shield → Meteor Drop | Shield explodes on meteor impact |
| Time Burn | Time Warp → Inferno Cataclysm | Cataclysm ticks twice as fast |
| Nova Cascade | Teleport → Flame Whip | 360° Flame Whip |

#### Cleric Combos

| Combo Name | Skill Sequence | Effect |
|------------|----------------|--------|
| Divine Storm | Heaven's Trumpet → Spirit Guardians | Guardians deal holy damage |
| Sanctuary | Consecrated Ground → Guardian Embrace | Ground also provides damage immunity |
| Holy Fury | Mark of Weakness → Radiant Strike | Strike deals +100% damage |
| Mass Revival | Divine Intervention → Healing Light | Light heals entire party |

---

### 3.4 Respec System

**NPC:** Elara the Mindweaver (Town, near Stash)

| Respec Type | Cost |
|-------------|------|
| Skills Only | 1,000 gold × character level |
| Talents Only | 2,000 gold × character level |
| Runes Only | 500 gold × character level |
| Full Respec | 5,000 gold × character level |

**Example at Level 100:**
- Skills: 100,000 gold
- Talents: 200,000 gold
- Runes: 50,000 gold
- Full: 500,000 gold

---

## Phase 4: Item System Enhancements

### 4.1 Gem System

#### Gem Types

| Gem | Primary Stat | Secondary Effect |
|-----|--------------|------------------|
| Ruby | +Strength | +% Fire Damage |
| Sapphire | +Intelligence | +% Mana Regen |
| Emerald | +Dexterity | +% Crit Chance |
| Topaz | +Wisdom | +% Healing Done |
| Diamond | +Vitality | +% All Resist |
| Onyx | +Flat Damage | +% Lifesteal |
| Opal | +Move Speed | +% CDR |

#### Gem Qualities

| Quality | Stat Value | Source |
|---------|------------|--------|
| Chipped | 10 | Normal dungeons |
| Flawed | 25 | Normal dungeons |
| Normal | 50 | Heroic dungeons |
| Flawless | 100 | Heroic dungeons |
| Perfect | 200 | Mythic dungeons |
| Radiant | 400 | Mythic final bosses |

**Combining:** 3 gems of same type and quality = 1 gem of next quality

#### Socket Costs (Updated)

| Socket # | Hearts | Shards |
|----------|--------|--------|
| 1 | 5 | 50 |
| 2 | 10 | 100 |
| 3 | 25 | 250 |
| 4 | 50 | 500 |

---

### 4.2 Set Items

#### Fighter Sets

**Warlord's Fury (Damage)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% Armor |
| 4 | Charge cooldown reset on killing blow |
| 6 | Double damage during Iron Fortress |

**Bulwark of Ages (Tank)**
| Pieces | Bonus |
|--------|-------|
| 2 | +20% Max HP |
| 4 | Block grants 5% damage reflect |
| 6 | Guardian Roar also taunts bosses |

#### Rogue Sets

**Shadow's Embrace (Burst)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% Crit Chance |
| 4 | Backstab usable from any angle |
| 6 | Phantom Volley fires 6 times instead of 3 |

**Venom Lord (DoT)**
| Pieces | Bonus |
|--------|-------|
| 2 | +20% Poison Damage |
| 4 | Poison spreads to nearby enemies |
| 6 | Death Spiral consumes all DoTs for burst |

#### Wizard Sets

**Inferno's Heart (Fire)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% Fire Damage |
| 4 | Fireball pierces enemies |
| 6 | Killing an enemy with fire resets Meteor cooldown |

**Temporal Weave (Utility)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% CDR |
| 4 | Teleport has 2 charges |
| 6 | Time Warp affects entire zone |

#### Cleric Sets

**Divine Light (Healing)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% Healing Done |
| 4 | Spirit Guardians also heals allies |
| 6 | Divine Intervention on 60s cooldown |

**Crusader's Zeal (Battle)**
| Pieces | Bonus |
|--------|-------|
| 2 | +15% Holy Damage |
| 4 | Radiant Strike heals you for damage dealt |
| 6 | Avenging Seraph is permanent while in combat |

---

### 4.3 Unique Item Effects

Items can roll one of these unique effects:

| Effect | Description |
|--------|-------------|
| Vampiric | On kill, restore 5% HP |
| Efficient | Skills cost 10% less mana |
| Lucky | 10% chance to deal double damage |
| Explosive | Enemies killed explode for 50% damage to nearby |
| Swift | +20% move speed for 3s after using a skill |
| Thorns | Reflect 10% of damage taken |
| Berserker | Below 30% HP, +30% damage |
| Guardian | Above 80% HP, +20% armor |
| Executioner | +25% damage to enemies below 25% HP |
| Regenerative | +1% HP regen per second |

---

## Phase 5: Quality of Life & Game Feel

### 5.1 Combat Feel Improvements

| Feature | Implementation | Trigger |
|---------|----------------|---------|
| Screen Shake | Camera offset oscillation | Critical hits, boss abilities |
| Hit Stop | Brief pause (50ms) | Heavy attacks, executions |
| Impact Particles | Burst of particles | All damage dealt |
| Damage Numbers | Floating text | All damage/healing |
| Sound Effects | Distinct per skill | All abilities |

#### Damage Number Colors

| Type | Color |
|------|-------|
| Physical | White |
| Fire | Orange |
| Ice | Cyan |
| Lightning | Yellow |
| Holy | Gold |
| Poison | Green |
| Critical | Red (larger) |
| Healing | Green |

### 5.2 UI Additions

| Priority | Feature | Description |
|----------|---------|-------------|
| 1 | Buff/Debuff Bar | Icons with countdown timers |
| 2 | Boss Health Frame | Large HP bar with phase markers |
| 3 | Loot Comparison | Hover tooltip shows vs equipped |
| 4 | Minimap | Shows party, objectives, dungeon layout |
| 5 | Cast Bar | Progress bar for channeled abilities |
| 6 | Damage Meter | Optional DPS/HPS tracking |

### 5.3 Minimap Features

| Icon | Meaning |
|------|---------|
| Blue Dot | Party member |
| Yellow Star | Quest objective |
| Red Skull | Boss location |
| Green Cross | Safe zone/NPC |
| Purple Portal | Dungeon entrance |
| White Arrow | Player (self) |

---

## Phase 6: Quest System Expansion

### 6.1 Quest Types

| Type | Description | Example |
|------|-------------|---------|
| Kill | Kill X enemies | Kill 100 Skeletons |
| Collection | Gather X items | Collect 20 Djinn Essence |
| Escort | Protect NPC | Guide Merchant to Oasis |
| Boss | Defeat specific boss | Slay Lord Infernax |
| Dungeon | Complete dungeon | Clear Molten Core (Normal) |
| Discovery | Find location | Discover the Hidden Peak |
| Delivery | Bring item to NPC | Deliver Letter to Fire Warden |

### 6.2 Story Quest Chains

#### Main Story Arc

| Chapter | Name | Level | Zone |
|---------|------|-------|------|
| 1 | The Awakening | 1-10 | Earth Realm |
| 2 | Shadows in the Earth | 10-30 | Earth Realm |
| 3 | The First Trial | 30-50 | Earth/Verdant Bastion |
| 4 | Frozen Secrets | 50-70 | Water Realm |
| 5 | Flames of the West | 70-85 | Fire Realm |
| 6 | Winds of Change | 70-85 | Air Realm |
| 7 | Convergence | 85-95 | All Realms |
| 8 | The Final Eidolon | 95-100 | The Abyss |

### 6.3 Reputation System

| Faction | Zone | Rewards |
|---------|------|---------|
| Townspeople | Earth Realm | Shop discounts, cosmetics |
| Ice Shamans | Water Realm | Frost resist gear, ice mounts |
| Fire Wardens | Fire Realm | Fire damage gear, fire cosmetics |
| Air Wardens | Air Realm | Lightning gear, wind cosmetics |
| Eidolon Keepers | End-game | Legendary patterns, titles |

**Reputation Levels:**
1. Neutral (0)
2. Friendly (3,000)
3. Honored (12,000)
4. Revered (30,000)
5. Exalted (60,000)

---

## Implementation Schedule

### Sprint 1 (Weeks 1-2): West Zone Foundation
- [ ] Zone boundaries and fencing (server: world.go)
- [ ] 5 new enemy types with basic AI
- [ ] Environmental hazards (lava pools, sandstorm)
- [ ] Oasis Outpost NPCs
- [ ] Connection to Earth Realm (wall gap)

### Sprint 2 (Weeks 3-4): West Zone Polish & East Zone Start
- [ ] Enemy special abilities
- [ ] XP scaling for levels 70-100
- [ ] East zone boundaries
- [ ] 5 new air enemy types
- [ ] Aerie Outpost

### Sprint 3 (Weeks 5-6): Molten Core Dungeon
- [ ] Dungeon layout generation
- [ ] Boss 1-2 with full mechanics
- [ ] Boss 3-5 with full mechanics
- [ ] Loot tables
- [ ] Difficulty modes

### Sprint 4 (Weeks 7-8): Tempest Spire Dungeon
- [ ] Dungeon layout generation
- [ ] All 5 bosses with mechanics
- [ ] Flying boss mechanics (Roc Matriarch)
- [ ] Loot tables
- [ ] Difficulty modes

### Sprint 5 (Weeks 9-10): Skill System Overhaul
- [ ] Skill runes data structure
- [ ] Rune selection UI
- [ ] All class runes implemented
- [ ] Combo system
- [ ] Respec NPC

### Sprint 6 (Weeks 11-12): Talent System Overhaul
- [ ] New talent tree structure
- [ ] All class talent trees
- [ ] Capstone talents
- [ ] Talent UI redesign
- [ ] Balance pass

### Sprint 7 (Weeks 13-14): Item System
- [ ] Gem system implementation
- [ ] Gem combining
- [ ] Set items (2 per class)
- [ ] Unique item effects
- [ ] Updated socket costs

### Sprint 8 (Weeks 15-16): Polish & QoL
- [ ] Combat feel (screen shake, particles)
- [ ] UI additions (buff bar, boss frame)
- [ ] Minimap
- [ ] Damage meter
- [ ] Quest system expansion

---

## Technical Notes

### Server Files to Modify

| File | Changes |
|------|---------|
| `server/internal/game/world.go` | New zones, enemies, dungeons |
| `server/internal/game/items.go` | Gems, sets, unique effects |
| `server/main.go` | New message handlers |

### Client Files to Modify

| File | Changes |
|------|---------|
| `src/core/Constants.js` | Skill runes, talents, sets |
| `src/core/GameEngine.js` | Combo system, new zones |
| `src/entities/*.js` | Skill rune implementations |
| `src/ui/UIManager.js` | New UI panels |
| `src/world/WorldGenerator.js` | New zone terrain |

### New Assets Needed

| Category | Assets |
|----------|--------|
| Enemy Models | 10 new enemies (5 fire, 5 air) |
| Boss Models | 10 new bosses |
| Environment | Desert/lava terrain, mountain/cloud terrain |
| UI | Gem icons, set icons, buff icons |
| Audio | New enemy sounds, boss music, skill sounds |

---

## Appendix: Level Scaling

### XP Requirements (70-100)

| Level | XP Required | Cumulative |
|-------|-------------|------------|
| 70-75 | 10,000,000 each | 50,000,000 |
| 75-80 | 20,000,000 each | 150,000,000 |
| 80-85 | 40,000,000 each | 350,000,000 |
| 85-90 | 80,000,000 each | 750,000,000 |
| 90-95 | 150,000,000 each | 1,500,000,000 |
| 95-100 | 300,000,000 each | 3,000,000,000 |

### Stat Budget Formula

```
statBudget = level × 50 × rarityMultiplier × (1 + potency × 0.1)
```

| Rarity | Multiplier |
|--------|------------|
| Common | 1.0 |
| Uncommon | 2.0 |
| Rare | 5.0 |
| Legendary | 20.0 |
| Eidolic | N/A (materials) |

---

*Last Updated: January 19, 2026*

---

## Implementation Status Summary

### Completed This Session

**Client-Side (JavaScript):**
- **Fire Realm Enemy Entities:** SandstormDjinn.js, MagmaGolem.js, ScorchedWraith.js, InfernalBehemoth.js, PhoenixSentinel.js
- **Air Realm Enemy Entities:** StormHarpy.js, CloudElemental.js, ThunderRoc.js, TempestGiant.js, CycloneAvatar.js
- **Molten Core Boss Entities:** Cindermaw.js, ScorchedTwins.js, ForgemasterPyrax.js, ObsidianGuardian.js, LordInfernax.js
- **Tempest Spire Boss Entities:** Windshear.js, Stormcallers.js, RocMatriarch.js, ThunderlordKaelix.js, Zephyrion.js
- **MeshFactory.js:** Added primitive mesh fallbacks for all 20 new entities (10 zone enemies + 10 dungeon bosses)
- **GameEngine.js:** Added imports and switch cases for all 20 new entities

**Server-Side (Go - items.go):**
- Gem System: GemType, GemQuality, GenerateGem(), GenerateRandomGemByLevel(), GemStats(), GetNextGemQuality(), SocketedGem struct
- Set Items: 8 class sets with 2/4/6 piece bonuses
- Unique Item Effects: 10 proc effects

**Server-Side (Go - world.go):**
- Fire Realm zone spawning (X: -3000 to -1000)
- Air Realm zone spawning (X: 1000 to 3000)
- `generateMoltenCoreLayout()` - 5 boss dungeon at offset (30000, 20000)
- `generateTempestSpireLayout()` - 5 boss dungeon at offset (40000, 20000)
- `spawnFireDungeonEnemy()` and `spawnAirDungeonEnemy()` functions
- `PerformForgeInsertGem()` - gem socketing handler
- `PerformForgeCombineGems()` - combines 3 gems into 1 higher quality
- `PerformForgeRemoveGem()` - removes gem from equipment (destroys it)
- Gem drops from level 20+ enemies (10% chance, 30% for elites)

**Server-Side (Go - main.go):**
- Message handlers: `forge_insert_gem`, `forge_combine_gem`, `forge_remove_gem`

**Client-Side (JavaScript - UIManager.js):**
- Forge Gems tab with 3 sub-tabs: Insert, Combine, Remove
- `updateGemCombineUI()` - gem combining interface
- `updateGemRemoveUI()` - gem removal interface
- `switchGemSubTab()` - tab switching logic

**Client-Side (JavaScript - GameEngine.js):**
- Callbacks: `onForgeInsertGem`, `onForgeCombineGem`, `onForgeRemoveGem`
