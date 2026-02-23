export const CONSTANTS = {
    SCENE: {
        BACKGROUND_COLOR: 0x202020,
        GROUND_SIZE: 2000,
        WORLD_BOUNDS: 2000, // Deprecated, use BOUNDS
        BOUNDS: {
            MIN_X: -50000,
            MAX_X: 50000,
            MIN_Z: -50000,
            MAX_Z: 50000
        },
        CHUNK_SIZE: 50,
        LOAD_DISTANCE: 2,
        GROUND_COLOR: 0x333333,
    },
    CAMERA: {
        FOV: 45,
        NEAR: 0.1,
        FAR: 1000,
        ISO_ANGLE_X: Math.atan(-1 / Math.sqrt(2)),
        ISO_ANGLE_Y: Math.PI / 4,
        ZOOM: 15,
        MIN_ZOOM: 5,
        MAX_ZOOM: 30
    },
    ENTITIES: {
        FIGHTER: {
            COLOR: 0xff0000,
            MANA_STAT: 'WISDOM',
            STATS: {
                STRENGTH: 10,
                INTELLIGENCE: 2,
                DEXTERITY: 4,
                WISDOM: 3,
                STAMINA: 8
            }
        },
        ROGUE: {
            COLOR: 0x00ff00,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 4,
                INTELLIGENCE: 5,
                DEXTERITY: 10,
                WISDOM: 3,
                STAMINA: 5
            }
        },
        WIZARD: {
            COLOR: 0x0000ff,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 2,
                INTELLIGENCE: 10,
                DEXTERITY: 4,
                WISDOM: 6,
                STAMINA: 3
            }
        },
        CLERIC: {
            COLOR: 0xffd700,
            MANA_STAT: 'WISDOM',
            STATS: {
                STRENGTH: 5,
                INTELLIGENCE: 4,
                DEXTERITY: 3,
                WISDOM: 10,
                STAMINA: 6
            }
        },
        SKELETON: {
            COLOR: 0xcccccc,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 5,
                INTELLIGENCE: 2,
                DEXTERITY: 3,
                WISDOM: 2,
                STAMINA: 5
            }
        },
        IMP: {
            COLOR: 0xff4500,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 12,
                INTELLIGENCE: 4,
                DEXTERITY: 6,
                WISDOM: 4,
                STAMINA: 12
            }
        },
        DEMON_ORC: {
            COLOR: 0x8b0000,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 25,
                INTELLIGENCE: 8,
                DEXTERITY: 10,
                WISDOM: 8,
                STAMINA: 25
            }
        },
        CONSTRUCT: {
            COLOR: 0x555555,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 40,
                INTELLIGENCE: 15,
                DEXTERITY: 5,
                WISDOM: 15,
                STAMINA: 40
            }
        },
        INFERNO_TITAN: {
            COLOR: 0xff4500,
            MANA_STAT: 'INTELLIGENCE',
            STATS: {
                STRENGTH: 60,
                INTELLIGENCE: 20,
                DEXTERITY: 10,
                WISDOM: 20,
                STAMINA: 60
            }
        }
    },
    SKILL_TREES: {
        Fighter: {
            Tier1: { name: "Charge", desc: "Rush forward, damaging and briefly staggering enemies in a small radius." },
            BranchA: {
                name: "Shield & Mitigation",
                Tier2: { name: "Whirlwind", desc: "Spin around dealing damage to all nearby enemies." },
                Tier3: { name: "Shield Slam", desc: "AoE cone threat + minor stun." },
                Tier4: { name: "Iron Fortress", desc: "Flat damage reduction for X seconds after Charge." },
                Tier5: { name: "Guardian Roar", desc: "Large-radius taunt + group damage reduction buff." }
            },
            BranchB: {
                name: "Control & Crowd Management",
                Tier2: { name: "Sweeping Strike", desc: "Small AoE cleave that increases threat." },
                Tier3: { name: "Earthshaker", desc: "Ground smash that knocks down nearby enemies." },
                Tier4: { name: "Unbreakable Grip", desc: "Short-range pull (single target) to help cluster mobs." },
                Tier5: { name: "Juggernaut Charge", desc: "After Charge, creates a shockwave that slows enemies heavily." }
            },
            BranchC: {
                name: "Damage Tank / Offense-Tank Hybrid",
                Tier2: { name: "Berserker Edge", desc: "Gain a % damage buff when at >60% HP." },
                Tier3: { name: "Shattering Charge", desc: "Charge applies armor reduction to all hit." },
                Tier4: { name: "Executioner Spin", desc: "AoE spin that deals higher damage to marked or taunted enemies." },
                Tier5: { name: "Last Stand Rampage", desc: "When dropping below 30% HP, gain a massive damage boost for X seconds." }
            }
        },
        Rogue: {
            Tier1: { name: "Piercing Throw", desc: "Throw a dagger that pierces through enemies in a line." },
            BranchA: {
                name: "Assassin Burst Path",
                Tier2: { name: "Backstab", desc: "Bonus damage from behind." },
                Tier3: { name: "Weak Point Mark", desc: "Marked enemies take more damage from Piercing Throw." },
                Tier4: { name: "Shadow Lunge", desc: "Teleport behind target → apply bleed." },
                Tier5: { name: "Death Spiral", desc: "Finisher that deals heavy damage per bleed stack." }
            },
            BranchB: {
                name: "Throwing Specialist Path",
                Tier2: { name: "Fan of Knives", desc: "Throw daggers in all directions around you." },
                Tier3: { name: "Serrated Edges", desc: "Piercing hits apply bleed to all targets hit." },
                Tier4: { name: "Blade Storm", desc: "Throw a fan of 5 daggers in a cone." },
                Tier5: { name: "Phantom Volley", desc: "Rapid-fire three Piercing Throws in a row." }
            },
            BranchC: {
                name: "Utility / Debuff Path",
                Tier2: { name: "Smoke Bomb", desc: "AoE slow + reduces enemy accuracy." },
                Tier3: { name: "Poison Coating", desc: "Small DoT + healing reduction." },
                Tier4: { name: "Tripwire", desc: "Drop a trap that roots the first enemy touched." },
                Tier5: { name: "Cloak & Vanish", desc: "Instant invisibility + massive movement speed burst." }
            }
        },
        Wizard: {
            Tier1: { name: "Fireball", desc: "Classic AoE projectile dealing fire damage." },
            BranchA: {
                name: "Pyromancer",
                Tier2: { name: "Flame Whip", desc: "Cone attack that stuns enemies for 3 seconds." },
                Tier3: { name: "Flame Tornado", desc: "Spawns a moving tornado that damages enemies." },
                Tier4: { name: "Meteor Drop", desc: "Large AoE with a delay." },
                Tier5: { name: "Inferno Cataclysm", desc: "Massive ultimate AoE covering a large region." }
            },
            BranchB: {
                name: "Single-Target Caster",
                Tier2: { name: "Scorch Beam", desc: "Line nuke, melts armor." },
                Tier3: { name: "Arcane Missiles", desc: "Homing projectiles." },
                Tier4: { name: "Spell Focus", desc: "Channel to drastically increase damage for next spell." },
                Tier5: { name: "Dragonfire Lance", desc: "Huge single-target spike damage." }
            },
            BranchC: {
                name: "Control & Utility Mage",
                Tier2: { name: "Teleport", desc: "Instantly teleport to a target location." },
                Tier3: { name: "Arcane Shield", desc: "Absorbs damage." },
                Tier4: { name: "Gravity Well", desc: "Pulls enemies together for combos with Fireball." },
                Tier5: { name: "Time Warp", desc: "Party haste + cooldown reduction." }
            }
        },
        Cleric: {
            Tier1: { name: "Spirit Guardians", desc: "Persistent radius damage." },
            BranchA: {
                name: "Pure Healer Path",
                Tier2: { name: "Healing Light", desc: "Restores health to yourself or a target." },
                Tier3: { name: "Guardian Embrace", desc: "AoE heal over time around the cleric." },
                Tier4: { name: "Purifying Wave", desc: "Cleanse negative effects." },
                Tier5: { name: "Divine Intervention", desc: "Save an ally from death once every X minutes." }
            },
            BranchB: {
                name: "Battle Cleric",
                Tier2: { name: "Radiant Strike", desc: "Melee hit deals extra radiant damage." },
                Tier3: { name: "Consecrated Ground", desc: "Standing in it heals allies and harms enemies." },
                Tier4: { name: "Spirit Guardians Boost", desc: "Spirit Guardians radius + damage + slow." },
                Tier5: { name: "Avenging Seraph", desc: "Summons a temporary celestial ally." }
            },
            BranchC: {
                name: "Buff/Debuff Support",
                Tier2: { name: "Blessing of Resolve", desc: "Party defense buff." },
                Tier3: { name: "Blessing of Zeal", desc: "Party attack speed buff." },
                Tier4: { name: "Mark of Weakness", desc: "Enemies take more damage from all sources." },
                Tier5: { name: "Heaven's Trumpet", desc: "Massive AoE stun + damage taken buff on enemies." }
            }
        }
    },
    ABILITY_CONFIG: {
        Fighter: {
            default: { mana: 20, cooldown: 5.0, range: 10.0 },
            skills: {
                Charge: { mana: 20, cooldown: 5.0, range: 14.0 },
                Whirlwind: { mana: 30, cooldown: 8.0, range: 5.0 },
                "Shield Slam": { mana: 25, cooldown: 6.0, range: 4.0 },
                "Iron Fortress": { mana: 40, cooldown: 60.0, range: 0.0 },
                "Guardian Roar": { mana: 35, cooldown: 30.0, range: 8.0 },
                "Sweeping Strike": { mana: 30, cooldown: 4.0, range: 4.0 },
                Earthshaker: { mana: 40, cooldown: 12.0, range: 6.0 },
                "Unbreakable Grip": { mana: 35, cooldown: 15.0, range: 10.0 },
                "Juggernaut Charge": { mana: 30, cooldown: 20.0, range: 14.0 },
                "Berserker Edge": { mana: 0, cooldown: 45.0, range: 0.0 },
                "Shattering Charge": { mana: 30, cooldown: 12.0, range: 14.0 },
                "Executioner Spin": { mana: 40, cooldown: 15.0, range: 5.0 },
                "Last Stand Rampage": { mana: 0, cooldown: 120.0, range: 0.0 },
            },
        },
        Rogue: {
            default: { mana: 15, cooldown: 1.0, range: 12.0 },
            skills: {
                "Piercing Throw": { mana: 15, cooldown: 1.0, range: 12.0 },
                Backstab: { mana: 20, cooldown: 6.0, range: 3.0 },
                "Weak Point Mark": { mana: 25, cooldown: 12.0, range: 10.0 },
                "Shadow Lunge": { mana: 25, cooldown: 10.0, range: 12.0 },
                "Death Spiral": { mana: 35, cooldown: 20.0, range: 4.0 },
                "Fan of Knives": { mana: 25, cooldown: 6.0, range: 5.0 },
                "Serrated Edges": { mana: 30, cooldown: 20.0, range: 0.0 },
                "Blade Storm": { mana: 30, cooldown: 15.0, range: 10.0 },
                "Phantom Volley": { mana: 40, cooldown: 18.0, range: 12.0 },
                "Smoke Bomb": { mana: 35, cooldown: 15.0, range: 8.0 },
                "Poison Coating": { mana: 30, cooldown: 20.0, range: 0.0 },
                Tripwire: { mana: 25, cooldown: 15.0, range: 6.0 },
                "Cloak & Vanish": { mana: 30, cooldown: 30.0, range: 0.0 },
            },
        },
        Wizard: {
            default: { mana: 30, cooldown: 2.0, range: 15.0 },
            skills: {
                Fireball: { mana: 30, cooldown: 2.0, range: 18.0 },
                "Flame Whip": { mana: 35, cooldown: 10.0, range: 12.0 },
                "Flame Tornado": { mana: 50, cooldown: 8.0, range: 15.0 },
                Meteor: { mana: 60, cooldown: 15.0, range: 20.0 },
                "Meteor Drop": { mana: 60, cooldown: 15.0, range: 20.0 },
                "Inferno Cataclysm": { mana: 60, cooldown: 60.0, range: 20.0 },
                "Scorch Beam": { mana: 40, cooldown: 8.0, range: 18.0 },
                "Arcane Missiles": { mana: 30, cooldown: 4.0, range: 18.0 },
                "Spell Focus": { mana: 30, cooldown: 45.0, range: 0.0 },
                "Dragonfire Lance": { mana: 50, cooldown: 20.0, range: 18.0 },
                Teleport: { mana: 40, cooldown: 12.0, range: 15.0 },
                "Arcane Shield": { mana: 40, cooldown: 30.0, range: 0.0 },
                "Gravity Well": { mana: 60, cooldown: 20.0, range: 18.0 },
                "Time Warp": { mana: 50, cooldown: 60.0, range: 15.0 },
            },
        },
        Cleric: {
            default: { mana: 40, cooldown: 10.0, range: 12.0 },
            skills: {
                "Spirit Guardians": { mana: 40, cooldown: 10.0, range: 6.0 },
                "Guardian Spirits": { mana: 40, cooldown: 10.0, range: 6.0 },
                "Healing Light": { mana: 25, cooldown: 8.0, range: 15.0 },
                "Guardian Embrace": { mana: 40, cooldown: 30.0, range: 6.0 },
                "Purifying Wave": { mana: 30, cooldown: 12.0, range: 8.0 },
                "Divine Intervention": { mana: 60, cooldown: 120.0, range: 15.0 },
                "Radiant Strike": { mana: 20, cooldown: 4.0, range: 3.0 },
                "Consecrated Ground": { mana: 40, cooldown: 12.0, range: 5.0 },
                "Spirit Guardians Boost": { mana: 40, cooldown: 20.0, range: 6.0 },
                "Avenging Seraph": { mana: 60, cooldown: 45.0, range: 12.0 },
                "Blessing of Resolve": { mana: 35, cooldown: 45.0, range: 10.0 },
                "Blessing of Zeal": { mana: 35, cooldown: 25.0, range: 10.0 },
                "Mark of Weakness": { mana: 30, cooldown: 20.0, range: 15.0 },
                "Heaven's Trumpet": { mana: 50, cooldown: 60.0, range: 12.0 },
            },
        },
    },
    PASSIVE_TALENTS: {
        Fighter: (() => {
            const skills = [
                "Charge",
                "Whirlwind",
                "Shield Slam",
                "Iron Fortress",
                "Guardian Roar",
                "Sweeping Strike",
                "Earthshaker",
                "Unbreakable Grip",
                "Juggernaut Charge",
                "Berserker Edge",
                "Shattering Charge",
                "Executioner Spin",
                "Last Stand Rampage",
            ];

            const entries = [];
            for (const s of skills) {
                entries.push({ name: `${s} - Mastery`, desc: `+4% ${s} damage per rank (20% max).`, maxRank: 5 });
                entries.push({ name: `${s} - Technique`, desc: `+3% ${s} CDR, +2% range/AoE per rank.`, maxRank: 5 });
            }

            entries.push(
                { name: "Combat Discipline", desc: "+2% global CDR per rank (10% max).", maxRank: 5 },
                { name: "Battle Breathing", desc: "-3% mana cost per rank (15% max).", maxRank: 5 },
                { name: "Threat Mastery", desc: "+5% threat generation per rank (25% max).", maxRank: 5 },
                { name: "Crowd Control Drills", desc: "+0.2s stun/slow duration per rank (+1s max).", maxRank: 5 },
                { name: "Frontliner Routine", desc: "+2% damage reduction per rank (10% max).", maxRank: 5 },
                { name: "Heavy Weapon Technique", desc: "+3 flat damage per rank (+15 max).", maxRank: 5 },
                { name: "Lineholder Instinct", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Rally Presence", desc: "+2% party buff effectiveness per rank (10% max).", maxRank: 5 },
                { name: "Aggressor Footwork", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Shieldwall Training", desc: "+3% armor per rank (15% max).", maxRank: 5 },
                { name: "Breakthrough", desc: "+2% armor penetration per rank (10% max).", maxRank: 5 },
                { name: "Enduring Rhythm", desc: "+2% sustained damage per rank (10% max).", maxRank: 5 },
                { name: "Battlefield Awareness", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Vanguard Momentum", desc: "+1% all damage per rank (5% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `FTR_${String(i + 1).padStart(2, '0')}`, ...t }));
        })(),
        Rogue: (() => {
            const skills = [
                "Piercing Throw",
                "Backstab",
                "Weak Point Mark",
                "Shadow Lunge",
                "Death Spiral",
                "Fan of Knives",
                "Serrated Edges",
                "Blade Storm",
                "Phantom Volley",
                "Smoke Bomb",
                "Poison Coating",
                "Tripwire",
                "Cloak & Vanish",
            ];

            const entries = [];
            for (const s of skills) {
                entries.push({ name: `${s} - Mastery`, desc: `+4% ${s} damage per rank (20% max).`, maxRank: 5 });
                entries.push({ name: `${s} - Technique`, desc: `+3% ${s} CDR, +2% range/AoE per rank.`, maxRank: 5 });
            }

            entries.push(
                { name: "Opportunist's Flow", desc: "+2% global CDR per rank (10% max).", maxRank: 5 },
                { name: "Dirty Tricks", desc: "+4% bleed/poison damage per rank (20% max).", maxRank: 5 },
                { name: "Quickhands", desc: "+3% attack speed per rank (15% max).", maxRank: 5 },
                { name: "Shadow Poise", desc: "+2% evasion per rank (10% max).", maxRank: 5 },
                { name: "Silent Balance", desc: "+3% movement speed per rank (15% max).", maxRank: 5 },
                { name: "Needle Precision", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Lightstep", desc: "-5% escape cooldowns per rank (25% max).", maxRank: 5 },
                { name: "Fine Motor", desc: "+2% multi-hit damage per rank (10% max).", maxRank: 5 },
                { name: "Catlike Reflexes", desc: "+1% dodge per rank (5% max).", maxRank: 5 },
                { name: "Quick Draw", desc: "+3% projectile damage per rank (15% max).", maxRank: 5 },
                { name: "Evasive Flow", desc: "+2% damage reduction per rank (10% max).", maxRank: 5 },
                { name: "Close-Quarters Grace", desc: "+3% melee damage per rank (15% max).", maxRank: 5 },
                { name: "Edge Awareness", desc: "+4% crit damage per rank (20% max).", maxRank: 5 },
                { name: "Wrist Control", desc: "+1% all damage per rank (5% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `ROG_${String(i + 1).padStart(2, '0')}`, ...t }));
        })(),
        Wizard: (() => {
            const skills = [
                "Fireball",
                "Flame Whip",
                "Flame Tornado",
                "Meteor Drop",
                "Inferno Cataclysm",
                "Scorch Beam",
                "Arcane Missiles",
                "Spell Focus",
                "Dragonfire Lance",
                "Teleport",
                "Arcane Shield",
                "Gravity Well",
                "Time Warp",
            ];

            const entries = [];
            for (const s of skills) {
                entries.push({ name: `${s} - Mastery`, desc: `+4% ${s} damage per rank (20% max).`, maxRank: 5 });
                entries.push({ name: `${s} - Technique`, desc: `+3% ${s} CDR, +2% range/AoE per rank.`, maxRank: 5 });
            }

            entries.push(
                { name: "Efficient Casting", desc: "-4% mana cost per rank (20% max).", maxRank: 5 },
                { name: "Quickened Formulae", desc: "+2% global CDR per rank (10% max).", maxRank: 5 },
                { name: "Runic Precision", desc: "+3% projectile speed per rank (15% max).", maxRank: 5 },
                { name: "Leyline Recall", desc: "-5% Teleport cooldown per rank (25% max).", maxRank: 5 },
                { name: "Overchannel", desc: "+3% burst damage per rank (15% max).", maxRank: 5 },
                { name: "Arcane Stability", desc: "+4% shield effectiveness per rank (20% max).", maxRank: 5 },
                { name: "Elemental Rhythm", desc: "+2% DoT damage per rank (10% max).", maxRank: 5 },
                { name: "Prismatic Control", desc: "+0.2s CC duration per rank (+1s max).", maxRank: 5 },
                { name: "Aether Reach", desc: "+3% spell range per rank (15% max).", maxRank: 5 },
                { name: "Volatile Insight", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Channel Discipline", desc: "+2% channeled spell damage per rank (10% max).", maxRank: 5 },
                { name: "Mana Geometry", desc: "+2% Intelligence per rank (10% max).", maxRank: 5 },
                { name: "Sigil Mastery", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Contingency Wards", desc: "+2% damage reduction per rank (10% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `WIZ_${String(i + 1).padStart(2, '0')}`, ...t }));
        })(),
        Cleric: (() => {
            const skills = [
                "Spirit Guardians",
                "Healing Light",
                "Guardian Embrace",
                "Purifying Wave",
                "Divine Intervention",
                "Radiant Strike",
                "Consecrated Ground",
                "Spirit Guardians Boost",
                "Avenging Seraph",
                "Blessing of Resolve",
                "Blessing of Zeal",
                "Mark of Weakness",
                "Heaven's Trumpet",
            ];

            const entries = [];
            for (const s of skills) {
                entries.push({ name: `${s} - Mastery`, desc: `+4% ${s} power per rank (20% max).`, maxRank: 5 });
                entries.push({ name: `${s} - Technique`, desc: `+3% ${s} CDR, +2% duration/range per rank.`, maxRank: 5 });
            }

            entries.push(
                { name: "Efficient Rites", desc: "-4% mana cost per rank (20% max).", maxRank: 5 },
                { name: "Rites of Haste", desc: "+2% global CDR per rank (10% max).", maxRank: 5 },
                { name: "Mercy Routine", desc: "+3% healing done per rank (15% max).", maxRank: 5 },
                { name: "Sanctuary Practice", desc: "+3% shield/absorb effectiveness per rank (15% max).", maxRank: 5 },
                { name: "Radiant Doctrine", desc: "+3% holy damage per rank (15% max).", maxRank: 5 },
                { name: "Cleanse Discipline", desc: "-5% cleanse cooldown per rank (25% max).", maxRank: 5 },
                { name: "Chorus of Faith", desc: "+2% party buff duration per rank (10% max).", maxRank: 5 },
                { name: "Battlefield Ministry", desc: "+3% AoE heal radius per rank (15% max).", maxRank: 5 },
                { name: "Warden's Instinct", desc: "+2% damage reduction per rank (10% max).", maxRank: 5 },
                { name: "Blessed Footwork", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Hymncraft", desc: "+2% HoT effectiveness per rank (10% max).", maxRank: 5 },
                { name: "Pilgrim Patience", desc: "+3% mana regen per rank (15% max).", maxRank: 5 },
                { name: "Mercy Doctrine", desc: "+2% Wisdom per rank (10% max).", maxRank: 5 },
                { name: "Ritekeeper", desc: "+1% all healing/damage per rank (5% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `CLR_${String(i + 1).padStart(2, '0')}`, ...t }));
        })(),
    },

    // ================================================================
    // SKILL RUNES
    // Each skill can have one rune equipped from 3 options
    // Runes unlock at levels 50, 70, and 90
    // ================================================================
    SKILL_RUNES: {
        Fighter: [
            // Charge Runes
            { id: "charge_momentum", name: "Momentum", skill: "Charge", unlockLevel: 50, description: "+50% range, damage scales with distance traveled" },
            { id: "charge_shockwave", name: "Shockwave", skill: "Charge", unlockLevel: 70, description: "Ends with knockback AoE (5 unit radius)" },
            { id: "charge_unstoppable", name: "Unstoppable", skill: "Charge", unlockLevel: 90, description: "CC immune during charge, +20% armor for 5s after" },
            // Whirlwind Runes
            { id: "whirlwind_extended", name: "Extended", skill: "Whirlwind", unlockLevel: 50, description: "+100% duration, -50% damage" },
            { id: "whirlwind_bladestorm", name: "Bladestorm", skill: "Whirlwind", unlockLevel: 70, description: "Pulls enemies toward you" },
            { id: "whirlwind_bloodwhirl", name: "Bloodwhirl", skill: "Whirlwind", unlockLevel: 90, description: "Heals 2% HP per enemy hit" },
            // Shield Slam Runes
            { id: "shieldslam_concussion", name: "Concussion", skill: "Shield Slam", unlockLevel: 50, description: "Stun duration +1s" },
            { id: "shieldslam_reverberation", name: "Reverberation", skill: "Shield Slam", unlockLevel: 70, description: "Hits twice" },
            { id: "shieldslam_fortify", name: "Fortify", skill: "Shield Slam", unlockLevel: 90, description: "Grants shield equal to damage dealt" },
            // Iron Fortress Runes
            { id: "ironfortress_extended", name: "Extended", skill: "Iron Fortress", unlockLevel: 50, description: "+50% duration" },
            { id: "ironfortress_thorns", name: "Thorns", skill: "Iron Fortress", unlockLevel: 70, description: "Reflect 20% damage while active" },
            { id: "ironfortress_immovable", name: "Immovable", skill: "Iron Fortress", unlockLevel: 90, description: "Cannot be knocked back or pulled" },
            // Earthshaker Runes
            { id: "earthshaker_fissure", name: "Fissure", skill: "Earthshaker", unlockLevel: 50, description: "Creates line AoE instead of circle" },
            { id: "earthshaker_aftershock", name: "Aftershock", skill: "Earthshaker", unlockLevel: 70, description: "Second smaller quake after 1s" },
            { id: "earthshaker_seismic", name: "Seismic", skill: "Earthshaker", unlockLevel: 90, description: "+100% knockdown duration" },
        ],
        Rogue: [
            // Piercing Throw Runes
            { id: "piercingthrow_ricochet", name: "Ricochet", skill: "Piercing Throw", unlockLevel: 50, description: "Bounces to 2 additional targets" },
            { id: "piercingthrow_serrated", name: "Serrated", skill: "Piercing Throw", unlockLevel: 70, description: "Applies bleed (5s DoT)" },
            { id: "piercingthrow_executioner", name: "Executioner", skill: "Piercing Throw", unlockLevel: 90, description: "+100% damage to targets below 30% HP" },
            // Backstab Runes
            { id: "backstab_ambush", name: "Ambush", skill: "Backstab", unlockLevel: 50, description: "+50% crit chance" },
            { id: "backstab_eviscerate", name: "Eviscerate", skill: "Backstab", unlockLevel: 70, description: "Ignores 50% armor" },
            { id: "backstab_shadowstep", name: "Shadowstep", skill: "Backstab", unlockLevel: 90, description: "Teleport behind target before striking" },
            // Fan of Knives Runes
            { id: "fanofknives_weighted", name: "Weighted", skill: "Fan of Knives", unlockLevel: 50, description: "Slows enemies hit by 30% for 3s" },
            { id: "fanofknives_poisoned", name: "Poisoned", skill: "Fan of Knives", unlockLevel: 70, description: "Applies poison DoT" },
            { id: "fanofknives_fury", name: "Bladed Fury", skill: "Fan of Knives", unlockLevel: 90, description: "Double the number of knives" },
            // Shadow Lunge Runes
            { id: "shadowlunge_extended", name: "Extended", skill: "Shadow Lunge", unlockLevel: 50, description: "+50% range" },
            { id: "shadowlunge_cripple", name: "Cripple", skill: "Shadow Lunge", unlockLevel: 70, description: "Slows target by 50% for 3s" },
            { id: "shadowlunge_shadow", name: "Shadow Clone", skill: "Shadow Lunge", unlockLevel: 90, description: "Creates illusion that attacks once" },
            // Cloak and Vanish Runes
            { id: "cloak_swift", name: "Swift", skill: "Cloak & Vanish", unlockLevel: 50, description: "+30% movement speed while invisible" },
            { id: "cloak_longer", name: "Lasting Shadow", skill: "Cloak & Vanish", unlockLevel: 70, description: "+100% invisibility duration" },
            { id: "cloak_ambush", name: "Prepared Ambush", skill: "Cloak & Vanish", unlockLevel: 90, description: "Next attack deals +100% damage" },
        ],
        Wizard: [
            // Fireball Runes
            { id: "fireball_magma", name: "Magma Orb", skill: "Fireball", unlockLevel: 50, description: "Slower projectile, leaves burning ground for 3s" },
            { id: "fireball_chain", name: "Chain Reaction", skill: "Fireball", unlockLevel: 70, description: "Bounces to 3 additional targets at 50% damage" },
            { id: "fireball_empowered", name: "Empowered", skill: "Fireball", unlockLevel: 90, description: "+100% damage, +3s cooldown" },
            // Meteor Drop Runes
            { id: "meteor_cluster", name: "Cluster", skill: "Meteor Drop", unlockLevel: 50, description: "3 smaller meteors instead of 1" },
            { id: "meteor_extinction", name: "Extinction", skill: "Meteor Drop", unlockLevel: 70, description: "+50% explosion radius" },
            { id: "meteor_apocalypse", name: "Apocalypse", skill: "Meteor Drop", unlockLevel: 90, description: "Meteors continue for 5s after cast" },
            // Teleport Runes
            { id: "teleport_blink", name: "Blink", skill: "Teleport", unlockLevel: 50, description: "+50% range" },
            { id: "teleport_phase", name: "Phase", skill: "Teleport", unlockLevel: 70, description: "Invulnerable for 1s after teleport" },
            { id: "teleport_warp", name: "Warp", skill: "Teleport", unlockLevel: 90, description: "Damages enemies at start and end location" },
            // Arcane Shield Runes
            { id: "arcaneshield_extended", name: "Extended", skill: "Arcane Shield", unlockLevel: 50, description: "+50% duration" },
            { id: "arcaneshield_reflective", name: "Reflective", skill: "Arcane Shield", unlockLevel: 70, description: "Reflects 30% of absorbed damage" },
            { id: "arcaneshield_explosive", name: "Explosive", skill: "Arcane Shield", unlockLevel: 90, description: "Explodes when broken dealing absorbed amount" },
            // Gravity Well Runes
            { id: "gravitywell_expanded", name: "Expanded", skill: "Gravity Well", unlockLevel: 50, description: "+50% radius" },
            { id: "gravitywell_crushing", name: "Crushing", skill: "Gravity Well", unlockLevel: 70, description: "+100% damage" },
            { id: "gravitywell_blackhole", name: "Black Hole", skill: "Gravity Well", unlockLevel: 90, description: "Enemies cannot escape while active" },
        ],
        Cleric: [
            // Spirit Guardians Runes
            { id: "spirits_expanded", name: "Expanded", skill: "Spirit Guardians", unlockLevel: 50, description: "+50% radius" },
            { id: "spirits_vengeful", name: "Vengeful", skill: "Spirit Guardians", unlockLevel: 70, description: "+50% damage, -25% healing" },
            { id: "spirits_sanctuary", name: "Sanctuary", skill: "Spirit Guardians", unlockLevel: 90, description: "Also reduces damage taken by 20%" },
            // Healing Light Runes
            { id: "healinglight_beacon", name: "Beacon", skill: "Healing Light", unlockLevel: 50, description: "Heals in AoE around target (5 unit radius)" },
            { id: "healinglight_renewal", name: "Renewal", skill: "Healing Light", unlockLevel: 70, description: "Adds HoT for 5s (20% of initial heal)" },
            { id: "healinglight_divine", name: "Divine", skill: "Healing Light", unlockLevel: 90, description: "Also cleanses 1 debuff" },
            // Divine Intervention Runes
            { id: "divineintervention_quick", name: "Quick Save", skill: "Divine Intervention", unlockLevel: 50, description: "Cooldown reduced by 50%" },
            { id: "divineintervention_guardian", name: "Guardian Angel", skill: "Divine Intervention", unlockLevel: 70, description: "Target gains 50% damage reduction for 5s" },
            { id: "divineintervention_miracle", name: "Miracle", skill: "Divine Intervention", unlockLevel: 90, description: "Can affect 2 targets" },
            // Radiant Strike Runes
            { id: "radiantstrike_smite", name: "Smite", skill: "Radiant Strike", unlockLevel: 50, description: "+50% damage" },
            { id: "radiantstrike_chains", name: "Chains of Light", skill: "Radiant Strike", unlockLevel: 70, description: "Roots target for 2s" },
            { id: "radiantstrike_purge", name: "Purge", skill: "Radiant Strike", unlockLevel: 90, description: "Removes 1 buff from target" },
            // Consecrated Ground Runes
            { id: "consecratedground_expanded", name: "Expanded", skill: "Consecrated Ground", unlockLevel: 50, description: "+50% radius" },
            { id: "consecratedground_lingering", name: "Lingering", skill: "Consecrated Ground", unlockLevel: 70, description: "+100% duration" },
            { id: "consecratedground_sanctuary", name: "Holy Ground", skill: "Consecrated Ground", unlockLevel: 90, description: "Allies in area take 30% less damage" },
        ],
    },

    // ================================================================
    // SKILL COMBOS
    // Using specific skill sequences within 3 seconds triggers bonus effects
    // Each class has 4 unique combos
    // ================================================================
    SKILL_COMBOS: {
        Fighter: [
            { id: "momentum_strike", name: "Momentum Strike", firstSkill: "Charge", secondSkill: "Whirlwind", description: "+50% Whirlwind damage" },
            { id: "tremor_rush", name: "Tremor Rush", firstSkill: "Earthshaker", secondSkill: "Charge", description: "+2s knockdown on Charge" },
            { id: "guardian_combo", name: "Guardian Combo", firstSkill: "Shield Slam", secondSkill: "Guardian Roar", description: "+50% taunt duration" },
            { id: "iron_will", name: "Iron Will", firstSkill: "Iron Fortress", secondSkill: "Last Stand Rampage", description: "Damage reduction persists during rampage" },
        ],
        Rogue: [
            { id: "ambush", name: "Ambush", firstSkill: "Cloak & Vanish", secondSkill: "Backstab", description: "Guaranteed critical hit" },
            { id: "venom_burst", name: "Venom Burst", firstSkill: "Poison Coating", secondSkill: "Death Spiral", description: "+100% poison damage" },
            { id: "blade_tornado", name: "Blade Tornado", firstSkill: "Fan of Knives", secondSkill: "Phantom Volley", description: "Volley pierces all targets" },
            { id: "shadow_dance", name: "Shadow Dance", firstSkill: "Shadow Lunge", secondSkill: "Smoke Bomb", description: "Smoke bomb instant cast" },
        ],
        Wizard: [
            { id: "implosion", name: "Implosion", firstSkill: "Gravity Well", secondSkill: "Fireball", description: "+100% Fireball damage in gravity well" },
            { id: "arcane_barrage", name: "Arcane Barrage", firstSkill: "Arcane Shield", secondSkill: "Meteor Drop", description: "Shield explodes on meteor impact" },
            { id: "time_burn", name: "Time Burn", firstSkill: "Time Warp", secondSkill: "Inferno Cataclysm", description: "Cataclysm ticks twice as fast" },
            { id: "nova_cascade", name: "Nova Cascade", firstSkill: "Teleport", secondSkill: "Flame Whip", description: "360° Flame Whip" },
        ],
        Cleric: [
            { id: "divine_storm", name: "Divine Storm", firstSkill: "Heaven's Trumpet", secondSkill: "Spirit Guardians", description: "Guardians deal holy damage" },
            { id: "sanctuary_combo", name: "Sanctuary", firstSkill: "Consecrated Ground", secondSkill: "Guardian Embrace", description: "Ground also provides damage immunity" },
            { id: "holy_fury", name: "Holy Fury", firstSkill: "Mark of Weakness", secondSkill: "Radiant Strike", description: "+100% Radiant Strike damage" },
            { id: "mass_revival", name: "Mass Revival", firstSkill: "Divine Intervention", secondSkill: "Healing Light", description: "Healing Light heals entire party" },
        ],
    }
};
