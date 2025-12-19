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
        LOAD_DISTANCE: 1,
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
    }
};