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
                Tier3: { name: "Shield Slam", desc: "Cone strike generating 2× normal threat from damage dealt; briefly stuns non-immune enemies." },
                Tier4: { name: "Iron Fortress", desc: "Refresh Shield Slam and brace for 30 seconds: take 20% less damage and gain 50% armor, at the cost of 20% movement speed. Follow with Shield Slam for a stronger counter. Mastery extends duration." },
                Tier5: { name: "Guardian Roar", desc: "Large-radius taunt + 30% group damage reduction (10s base duration)." }
            },
            BranchB: {
                name: "Control & Crowd Management",
                Tier2: { name: "Sweeping Strike", desc: "Small AoE cleave that increases threat." },
                Tier3: { name: "Earthshaker", desc: "Ground smash that knocks down nearby enemies." },
                Tier4: { name: "Unbreakable Grip", desc: "Strike and pull one enemy into melee range, briefly rooting it. Generates double damage threat; control-immune enemies take the hit without being moved or rooted." },
                Tier5: { name: "Juggernaut Charge", desc: "Charge up to 10 units, then unleash a damaging shockwave that slows susceptible enemies by 60% for 5 seconds." }
            },
            BranchC: {
                name: "Damage Tank / Offense-Tank Hybrid",
                Tier2: { name: "Berserker Edge", desc: "For 15 seconds, you and nearby party members gain +50% Damage stat at the cost of 20% defense. Mastery strengthens the damage multiplier." },
                Tier3: { name: "Shattering Charge", desc: "Charge applies armor reduction to all hit." },
                Tier4: { name: "Executioner Spin", desc: "AoE spin that deals higher damage to marked or taunted enemies." },
                Tier5: { name: "Last Stand Rampage", desc: "Gain +100% Damage stat for 10 seconds, or +200% when activated below 30% health. Mastery strengthens the damage multiplier." }
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
                Tier3: { name: "Serrated Edges", desc: "Piercing hits apply bleed. While active, Fan of Knives also slows susceptible enemies by 20% for 2 seconds without replacing existing slows." },
                Tier4: { name: "Blade Storm", desc: "Throw a fan of 5 daggers in a cone." },
                Tier5: { name: "Phantom Volley", desc: "Fire three rapid shots. Follow Fan of Knives within 3s to make the volley pierce enemies." }
            },
            BranchC: {
                name: "Utility / Debuff Path",
                Tier2: { name: "Smoke Bomb", desc: "AoE slow + reduces enemy accuracy." },
                Tier3: { name: "Poison Coating", desc: "Small DoT + healing reduction." },
                Tier4: { name: "Tripwire", desc: "Place a trap within 6 units on reachable ground. It damages and roots the first enemy touched; immune enemies still take damage." },
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
                Tier2: { name: "Scorch Beam", desc: "Line strike that melts armor and slows susceptible enemies by 30% for 3s base. Existing slows are preserved. Follow with Arcane Missiles within 3s for a five-missile volley." },
                Tier3: { name: "Arcane Missiles", desc: "Three homing missiles; follow Scorch Beam within 3s for five. Runes alter volley count or trade homing for aimed shots." },
                Tier4: { name: "Spell Focus", desc: "Empower your next damaging spell and gain a brief ward (40 + twice Intelligence; 6s base). Does not stack with an active shield." },
                Tier5: { name: "Dragonfire Lance", desc: "Heavy single-target projectile that stops at the first enemy. Broadside trades damage for a wider piercing shot." }
            },
            BranchC: {
                name: "Control & Utility Mage",
                Tier2: { name: "Teleport", desc: "Instantly teleport to a target location." },
                Tier3: { name: "Arcane Shield", desc: "Absorbs damage." },
                Tier4: { name: "Gravity Well", desc: "Pulls enemies together for combos with Fireball." },
                Tier5: { name: "Time Warp", desc: "Party haste + cooldown reduction. Immediately refreshes your own Teleport and Gravity Well; mana and the global cooldown still apply. Does not reset allies' skills or itself." }
            }
        },
        Cleric: {
            Tier1: { name: "Spirit Guardians", desc: "Persistent radius damage." },
            BranchA: {
                name: "Pure Healer Path",
                Tier2: { name: "Healing Light", desc: "Restores health to yourself or a target." },
                Tier3: { name: "Guardian Embrace", desc: "AoE heal over time around the cleric." },
                Tier4: { name: "Purifying Wave", desc: "Cleanse nearby allies. A holy pulse damages nearby enemies and slows susceptible targets by 30% for 2s base; existing slows are preserved." },
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
                Tier3: { name: "Blessing of Zeal", desc: "Party attack and movement speed buff. Refreshes your own Spirit Guardians; follow with it within 3s for boosted damage and radius. Normal mana and global cooldown apply." },
                Tier4: { name: "Mark of Weakness", desc: "Enemies take more damage from all sources." },
                Tier5: { name: "Heaven's Trumpet", desc: "Massive AoE stun + damage taken buff on enemies." }
            }
        }
    },
    BASIC_ATTACK_RANGES: Object.freeze({
        Fighter: 4.0,
        Rogue: 16.0,
        Wizard: 16.0,
        Cleric: 4.0
    }),
    ABILITY_CONFIG: {
        Fighter: {
            default: { mana: 20, cooldown: 5.0, range: 28.0 },
            skills: {
                Charge: { mana: 20, cooldown: 5.0, range: 28.0 },
                Whirlwind: { mana: 30, cooldown: 8.0, range: 5.0 },
                "Shield Slam": { mana: 25, cooldown: 6.0, range: 4.0 },
                "Iron Fortress": { mana: 40, cooldown: 60.0, range: 0.0 },
                "Guardian Roar": { mana: 35, cooldown: 30.0, range: 8.0 },
                "Sweeping Strike": { mana: 30, cooldown: 4.0, range: 4.0 },
                Earthshaker: { mana: 40, cooldown: 12.0, range: 6.0 },
                "Unbreakable Grip": { mana: 35, cooldown: 15.0, range: 10.0 },
                "Juggernaut Charge": { mana: 30, cooldown: 20.0, range: 10.0 },
                "Berserker Edge": { mana: 0, cooldown: 45.0, range: 0.0 },
                "Shattering Charge": { mana: 30, cooldown: 12.0, range: 28.0 },
                "Executioner Spin": { mana: 40, cooldown: 15.0, range: 5.0 },
                "Last Stand Rampage": { mana: 0, cooldown: 120.0, range: 0.0 },
            },
        },
        Rogue: {
            default: { mana: 15, cooldown: 1.0, range: 24.0 },
            skills: {
                "Piercing Throw": { mana: 15, cooldown: 1.0, range: 24.0 },
                Backstab: { mana: 20, cooldown: 6.0, range: 2.5 },
                "Weak Point Mark": { mana: 25, cooldown: 12.0, range: 10.0 },
                "Shadow Lunge": { mana: 25, cooldown: 10.0, range: 10.0 },
                "Death Spiral": { mana: 35, cooldown: 20.0, range: 4.0 },
                "Fan of Knives": { mana: 25, cooldown: 6.0, range: 5.0 },
                "Serrated Edges": { mana: 30, cooldown: 20.0, range: 0.0 },
                "Blade Storm": { mana: 30, cooldown: 15.0, range: 10.0 },
                "Phantom Volley": { mana: 40, cooldown: 18.0, range: 12.0 },
                "Smoke Bomb": { mana: 35, cooldown: 20.0, range: 8.0 },
                "Poison Coating": { mana: 30, cooldown: 30.0, range: 0.0 },
                Tripwire: { mana: 25, cooldown: 15.0, range: 6.0 },
                "Cloak & Vanish": { mana: 30, cooldown: 30.0, range: 0.0 },
            },
        },
        Wizard: {
            default: { mana: 30, cooldown: 2.0, range: 36.0 },
            skills: {
                Fireball: { mana: 30, cooldown: 2.0, range: 36.0 },
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
                { name: "Combat Discipline", desc: "+1% cooldown reduction per rank (5% max).", maxRank: 5 },
                { name: "Battle Breathing", desc: "-3% mana cost per rank (15% max).", maxRank: 5 },
                { name: "Threat Mastery", desc: "+2% Damage stat per rank (10% max).", maxRank: 5 },
                { name: "Crowd Control Drills", desc: "+4% ability buff, stun, root and slow duration per rank (20% max).", maxRank: 5 },
                { name: "Frontliner Routine", desc: "+2% maximum health per rank (10% max).", maxRank: 5 },
                { name: "Heavy Weapon Technique", desc: "+3 Strength per rank (+15 max).", maxRank: 5 },
                { name: "Lineholder Instinct", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Rally Presence", desc: "+2 Vitality and +1% maximum health per rank (+10 Vitality / 5% health max).", maxRank: 5 },
                { name: "Aggressor Footwork", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Shieldwall Training", desc: "+2 flat defense per rank (+10 max).", maxRank: 5 },
                { name: "Breakthrough", desc: "+3% ability buff, stun, root and slow duration per rank (15% max). Adds to Crowd Control Drills.", maxRank: 5 },
                { name: "Enduring Rhythm", desc: "+2% skill damage and AoE radius per rank (10% each max).", maxRank: 5 },
                { name: "Battlefield Awareness", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Vanguard Momentum", desc: "+1.5% cooldown reduction per rank (7.5% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `FTR_${String(i + 1).padStart(2, '0')}`, ...t,
                ...(i === 6 ? { desc: '+4% Iron Fortress duration per rank (20% max). Does not increase protection or reflection strength.' } : {}),
                ...(i === 8 ? { desc: '+4% Guardian Roar buff duration per rank (20% max). Nearby allies inherit your duration; protection strength and taunt threat are unchanged.' } : {}),
                ...(i === 14 ? { desc: '+4% Unbreakable Grip root duration per rank (20% max). Pull distance is unchanged; immune targets still resist control.' } : {}),
                ...(i === 15 ? { desc: '+3% Unbreakable Grip cooldown reduction and +2% targeting range per rank. Does not enlarge the cursor selection tolerance.' } : {}),
                ...(i === 18 ? { desc: '+4% Berserker Edge damage multiplier per rank (20% max): 1.5× to 1.8× Damage stat. Nearby party members inherit your strength; defense cost stays 20%.' } : {}),
                ...(i === 24 ? { desc: '+4% Last Stand Rampage damage multiplier per rank (20% max): 2× to 2.4× Damage stat, or 3× to 3.6× when activated below 30% health.' } : {}),
                abilityDuration: i === 6 ? { skill: 'Iron Fortress', duration: 0.04 }
                    : i === 8 ? { skill: 'Guardian Roar', duration: 0.04 }
                    : i === 14 ? { skill: 'Unbreakable Grip', duration: 0.04 } : undefined,
                abilityDamage: i < 26 && i % 2 === 0 && i !== 6 && i !== 8 && i !== 14 ? { skill: skills[Math.floor(i / 2)], damage: 0.04 }
                    : i === 37 ? { damage: 0.02 } : undefined,
                abilityRange: i === 15 ? { skill: 'Unbreakable Grip', range: 0.02 } : undefined,
                criticalChance: i === 38 ? { chance: 0.02 } : undefined,
                abilityArea: i === 3 ? { skill: 'Whirlwind', radius: 0.02 }
                    : i === 13 ? { skill: 'Earthshaker', radius: 0.02 }
                    : i === 17 ? { skill: 'Juggernaut Charge', radius: 0.02 }
                    : i === 5 ? { skill: 'Shield Slam', radius: 0.02 }
                    : i === 11 ? { skill: 'Sweeping Strike', radius: 0.02 }
                    : i === 9 ? { skill: 'Guardian Roar', radius: 0.02 }
                    : i === 21 ? { skill: 'Shattering Charge', radius: 0.02 }
                    : i === 23 ? { skill: 'Executioner Spin', radius: 0.02 }
                    : i === 32 ? { radius: 0.03 } : i === 37 ? { radius: 0.02 } : undefined,
                abilityEconomy: i < 26 && i % 2 === 1 ? { skill: skills[Math.floor(i / 2)], cdr: 0.03 }
                    : i === 27 ? { manaReduction: 0.03 } : undefined }));
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
                { name: "Opportunist's Flow", desc: "+1.5% cooldown reduction per rank (7.5% max).", maxRank: 5 },
                { name: "Dirty Tricks", desc: "+4% ability-effect duration per rank (20% max), including buffs, debuffs and wounds.", maxRank: 5 },
                { name: "Quickhands", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Shadow Poise", desc: "+1 flat defense and +1% maximum health per rank (+5 defense / 5% health max).", maxRank: 5 },
                { name: "Silent Balance", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Needle Precision", desc: "+3% crit chance per rank (15% max).", maxRank: 5 },
                { name: "Lightstep", desc: "-2% skill cooldowns and +1% movement speed per rank (10% / 5% max).", maxRank: 5 },
                { name: "Fine Motor", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Catlike Reflexes", desc: "+1% cooldown reduction per rank (5% max).", maxRank: 5 },
                { name: "Quick Draw", desc: "+3% ability range per rank (15% max).", maxRank: 5 },
                { name: "Evasive Flow", desc: "+3 Dexterity per rank (+15 max).", maxRank: 5 },
                { name: "Close-Quarters Grace", desc: "+2% skill damage per rank (10% max).", maxRank: 5 },
                { name: "Edge Awareness", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Wrist Control", desc: "+2% Damage stat per rank (10% max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `ROG_${String(i + 1).padStart(2, '0')}`, ...t,
                ...([4, 18, 24].includes(i) ? { desc: `+4% ${skills[Math.floor(i / 2)]} effect duration per rank (20% max).` } : {}),
                abilityDuration: [4, 18, 24].includes(i) ? { skill: skills[Math.floor(i / 2)], duration: 0.04 }
                    : i === 27 ? { duration: 0.04 } : undefined,
                abilityDamage: [0, 2, 8, 10, 14, 16, 22].includes(i) ? { skill: skills[Math.floor(i / 2)], damage: 0.04 }
                    : i === 37 ? { damage: 0.02 } : undefined,
                statusTraining: [6, 12, 20].includes(i) ? { skill: skills[Math.floor(i / 2)], damage: 0.04 }
                    : i === 37 ? { damage: 0.02 } : undefined,
                ...(i < 26 && i % 2 === 1 ? { desc: [5, 13, 19, 25].includes(i)
                    ? `+3% ${skills[Math.floor(i / 2)]} CDR and -2% mana cost per rank (15% / 10% max).`
                    : `+3% ${skills[Math.floor(i / 2)]} CDR and +2% critical chance per rank (15% / 10% max).` } : {}),
                criticalChance: i < 26 && i % 2 === 1 && ![5, 13, 19, 25].includes(i) ? { skill: skills[Math.floor(i / 2)], chance: 0.02 }
                    : i === 31 ? { chance: 0.03 } : i === 38 ? { chance: 0.02 } : undefined,
                abilityRange: i === 35 ? { range: 0.03 } : undefined,
                abilityArea: i === 33 ? { radius: 0.03 } : undefined,
                abilityEconomy: i < 26 && i % 2 === 1 ? { skill: skills[Math.floor(i / 2)], cdr: 0.03,
                    ...([5, 13, 19, 25].includes(i) ? { manaReduction: 0.02 } : {}) }
                    : i === 32 ? { cdr: 0.02 } : undefined }));
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
                { name: "Quickened Formulae", desc: "+1.5% cooldown reduction per rank (7.5% max).", maxRank: 5 },
                { name: "Runic Precision", desc: "+3% spell range per rank (15% max).", maxRank: 5 },
                { name: "Leyline Recall", desc: "-5% Teleport cooldown per rank (25% max).", maxRank: 5 },
                { name: "Overchannel", desc: "+2% Damage stat per rank (10% max).", maxRank: 5 },
                { name: "Arcane Stability", desc: "+5% Arcane Shield duration per rank (25% max).", maxRank: 5 },
                { name: "Elemental Rhythm", desc: "+1% cooldown reduction per rank (5% max).", maxRank: 5 },
                { name: "Prismatic Control", desc: "+4% timed Wizard buff/debuff duration per rank (20% max). Does not extend projectiles or zones.", maxRank: 5 },
                { name: "Aether Reach", desc: "+4% spell range per rank (20% max).", maxRank: 5 },
                { name: "Volatile Insight", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Channel Discipline", desc: "+3 Intelligence per rank (+15 max).", maxRank: 5 },
                { name: "Mana Geometry", desc: "+2% spell range and AoE radius per rank (10% each at max).", maxRank: 5 },
                { name: "Sigil Mastery", desc: "+2% crit chance per rank (10% max).", maxRank: 5 },
                { name: "Contingency Wards", desc: "+2% maximum health and +2 Wisdom per rank (10% health / +10 Wisdom max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `WIZ_${String(i + 1).padStart(2, '0')}`, ...t,
                abilityDamage: i < 26 && i % 2 === 0 && i !== 20 && i !== 24
                    ? { skill: skills[Math.floor(i / 2)], damage: 0.04 } : undefined,
                ...(i === 14 ? { desc: '+4% focused-spell damage per rank (20% max). Snapshotted when Spell Focus is cast.' } : {}),
                ...(i === 20 ? { desc: '+4% Arcane Shield damage absorption per rank (20% max).' } : {}),
                ...(i === 24 ? { desc: '+4% Time Warp duration per rank (20% max). Extends the caster and allies; does not increase haste strength.' } : {}),
                shieldTraining: i === 20 ? { absorption: 0.04 } : i === 31 ? { duration: 0.05 }
                    : i === 33 ? { duration: 0.04 } : undefined,
                abilityDuration: i === 24 ? { skill: 'Time Warp', duration: 0.04 }
                    : i === 31 ? { skill: 'Arcane Shield', duration: 0.05 }
                    : i === 33 ? { duration: 0.04 } : undefined,
                criticalChance: i === 38 ? { chance: 0.02 } : undefined,
                abilityRange: i === 28 ? { range: 0.03 } : i === 34 ? { range: 0.04 } : i === 37 ? { range: 0.02 } : undefined,
                abilityArea: i === 35 ? { radius: 0.03 } : i === 37 ? { radius: 0.02 } : undefined,
                ...(i < 26 && i % 2 === 1 ? { desc: `+3% ${skills[Math.floor(i / 2)]} CDR and -2% mana cost per rank (15% / 10% max).` } : {}),
                abilityEconomy: i < 26 && i % 2 === 1 ? { skill: skills[Math.floor(i / 2)], cdr: 0.03, manaReduction: 0.02 }
                    : i === 26 ? { manaReduction: 0.04 } : i === 29 ? { skill: 'Teleport', cdr: 0.05 } : undefined }));
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
                const benefit = s === 'Purifying Wave' ? 'radius'
                    : ['Healing Light', 'Guardian Embrace', 'Divine Intervention'].includes(s) ? 'healing' : 'power';
                entries.push({ name: `${s} - Mastery`, desc: `+4% ${s} ${benefit} per rank (20% max).`, maxRank: 5 });
                entries.push({ name: `${s} - Technique`, desc: `+3% ${s} CDR, +2% duration per rank.`, maxRank: 5 });
            }

            entries.push(
                { name: "Efficient Rites", desc: "-4% mana cost per rank (20% max).", maxRank: 5 },
                { name: "Rites of Haste", desc: "+1.5% cooldown reduction per rank (7.5% max).", maxRank: 5 },
                { name: "Mercy Routine", desc: "+3% spell healing per rank (15% max).", maxRank: 5 },
                { name: "Sanctuary Practice", desc: "+4% ability-effect duration per rank (20% max).", maxRank: 5 },
                { name: "Radiant Doctrine", desc: "+2% Damage stat per rank (10% max).", maxRank: 5 },
                { name: "Cleanse Discipline", desc: "-5% Purifying Wave cooldown per rank (25% max).", maxRank: 5 },
                { name: "Chorus of Faith", desc: "+3% ability-effect duration per rank (15% max).", maxRank: 5 },
                { name: "Battlefield Ministry", desc: "+3% AoE radius per rank (15% max).", maxRank: 5 },
                { name: "Warden's Instinct", desc: "+2% maximum health per rank (10% max).", maxRank: 5 },
                { name: "Blessed Footwork", desc: "+2% movement speed per rank (10% max).", maxRank: 5 },
                { name: "Hymncraft", desc: "+1% cooldown reduction per rank (5% max).", maxRank: 5 },
                { name: "Pilgrim Patience", desc: "+3 Wisdom per rank (+15 max).", maxRank: 5 },
                { name: "Mercy Doctrine", desc: "+2% spell healing and ability-effect duration per rank (10% each max).", maxRank: 5 },
                { name: "Ritekeeper", desc: "+2 flat defense and +1% cooldown reduction per rank (+10 defense / 5% cooldown reduction max).", maxRank: 5 },
            );

            return entries.slice(0, 40).map((t, i) => ({ id: `CLR_${String(i + 1).padStart(2, '0')}`, ...t,
                ...(i < 26 && i % 2 === 1 ? { desc: `+3% ${skills[Math.floor(i / 2)]} CDR and +2% timed-effect duration per rank (15% / 10% max).` } : {}),
                abilityDuration: i < 26 && i % 2 === 1 ? { skill: skills[Math.floor(i / 2)], duration: 0.02 }
                    : i === 29 ? { duration: 0.04 } : i === 32 ? { duration: 0.03 } : i === 38 ? { duration: 0.02 } : undefined,
                summonTraining: i === 16 ? { damage: 0.04 } : i === 17 ? { duration: 0.02 }
                    : i === 29 ? { duration: 0.04 } : i === 32 ? { duration: 0.03 } : i === 38 ? { duration: 0.02 } : undefined,
                ...(i === 17 ? { desc: '+3% Avenging Seraph CDR and +2% summon duration per rank (15% / 10% max).' } : {}),
                abilityEconomy: i < 26 && i % 2 === 1 ? { skill: skills[Math.floor(i / 2)], cdr: 0.03 }
                    : i === 26 ? { manaReduction: 0.04 } : i === 31 ? { skill: 'Purifying Wave', cdr: 0.05 } : undefined,
                abilityArea: i === 6 ? { skill: 'Purifying Wave', radius: 0.04 }
                    : i === 33 ? { radius: 0.03 } : undefined,
                abilityHealing: [2, 4, 8].includes(i) ? { skill: skills[i / 2], healing: 0.04 }
                    : i === 28 ? { healing: 0.03 } : i === 38 ? { healing: 0.02 } : undefined }));
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
            { id: "whirlwind_extended", name: "Extended", skill: "Whirlwind", unlockLevel: 50, description: "+100% duration, -50% damage per pulse" },
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
            {"id": "guardianroar_rally", "name": "Rally", "skill": "Guardian Roar", "unlockLevel": 50, "description": "Reach 60% farther, but protection lasts 6s instead of 10s."},
            {"id": "guardianroar_vigil", "name": "Vigil", "skill": "Guardian Roar", "unlockLevel": 70, "description": "Protection lasts 15s, but the radius is 40% smaller."},
            {"id": "guardianroar_cadence", "name": "Cadence", "skill": "Guardian Roar", "unlockLevel": 90, "description": "Recast 35% sooner, but protection lasts 6s."},
            {"id": "sweepingstrike_wide", "name": "Wide Sweep", "skill": "Sweeping Strike", "unlockLevel": 50, "description": "40% wider reach, with 20% less damage."},
            {"id": "sweepingstrike_close", "name": "Close Cut", "skill": "Sweeping Strike", "unlockLevel": 70, "description": "30% more damage, with 25% less reach."},
            {"id": "sweepingstrike_quick", "name": "Quick Cut", "skill": "Sweeping Strike", "unlockLevel": 90, "description": "Recast 35% sooner, with 25% less damage."},
            {"id": "grip_harpoon", "name": "Harpoon", "skill": "Unbreakable Grip", "unlockLevel": 50, "description": "50% more targeting range, with 25% less damage."},
            {"id": "grip_binding", "name": "Binding Grip", "skill": "Unbreakable Grip", "unlockLevel": 70, "description": "Root lasts 3s instead of 1s, with 30% less damage."},
            {"id": "grip_impact", "name": "Crushing Grip", "skill": "Unbreakable Grip", "unlockLevel": 90, "description": "40% more damage; no pull or root. Useful against control-immune foes."},
            {"id": "juggernaut_avalanche", "name": "Avalanche", "skill": "Juggernaut Charge", "unlockLevel": 50, "description": "50% wider shockwave, with 25% less damage."},
            {"id": "juggernaut_rush", "name": "Long Rush", "skill": "Juggernaut Charge", "unlockLevel": 70, "description": "Charge 50% farther, with a 25% smaller shockwave."},
            {"id": "juggernaut_breach", "name": "Breach", "skill": "Juggernaut Charge", "unlockLevel": 90, "description": "40% more shockwave damage, but it no longer slows."},
            {"id": "berserker_rally", "name": "War Rally", "skill": "Berserker Edge", "unlockLevel": 50, "description": "Reach party members 50% farther away, but the buff lasts 10s."},
            {"id": "berserker_solitary", "name": "Solitary Fury", "skill": "Berserker Edge", "unlockLevel": 70, "description": "Buff lasts 20s and affects only you. The defense cost remains."},
            {"id": "berserker_cadence", "name": "Battle Cadence", "skill": "Berserker Edge", "unlockLevel": 90, "description": "Recast twice as often, but the buff lasts 8s."},
            {"id": "shattering_lasting", "name": "Lasting Fracture", "skill": "Shattering Charge", "unlockLevel": 50, "description": "Armor break lasts 10s instead of 5s, with 30% less impact damage."},
            {"id": "shattering_shock", "name": "Shattering Wave", "skill": "Shattering Charge", "unlockLevel": 70, "description": "40% wider impact, with 30% less damage."},
            {"id": "shattering_quick", "name": "Quick Breach", "skill": "Shattering Charge", "unlockLevel": 90, "description": "Recast 35% sooner, with a 30% smaller impact."},
            {"id": "executionerspin_wide", "name": "Wide Reaping", "skill": "Executioner Spin", "unlockLevel": 50, "description": "50% wider spin, with 25% less damage."},
            {"id": "executionerspin_marked", "name": "Marked for Death", "skill": "Executioner Spin", "unlockLevel": 70, "description": "Marked or threatened targets take double base damage instead of 1.5x; base damage is 20% lower."},
            {"id": "executionerspin_quick", "name": "Quick Reaping", "skill": "Executioner Spin", "unlockLevel": 90, "description": "Recast 35% sooner, with 30% less damage."},
            {"id": "rampage_endurance", "name": "Enduring Rampage", "skill": "Last Stand Rampage", "unlockLevel": 50, "description": "Lasts 15s instead of 10s, with a 180s base cooldown."},
            {"id": "rampage_burst", "name": "Measured Rampage", "skill": "Last Stand Rampage", "unlockLevel": 70, "description": "Lasts 6s, with a 72s base cooldown. Keeps the low-health damage bonus."},
            {"id": "rampage_reprise", "name": "Breach Reprise", "skill": "Last Stand Rampage", "unlockLevel": 90, "description": "Refresh Shattering Charge on cast, but Rampage lasts only 5s. Mana and the global cooldown still apply."},
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
            {"id": "weakpoint_lasting", "name": "Lasting Mark", "skill": "Weak Point Mark", "unlockLevel": 50, "description": "Mark lasts 15s, with a 25% longer cooldown."},
            {"id": "weakpoint_distant", "name": "Distant Mark", "skill": "Weak Point Mark", "unlockLevel": 70, "description": "50% more cast range; mark lasts 6s."},
            {"id": "weakpoint_fleeting", "name": "Fleeting Mark", "skill": "Weak Point Mark", "unlockLevel": 90, "description": "Recast 40% sooner; mark lasts 6s."},
            {"id": "deathspiral_wide", "name": "Wide Spiral", "skill": "Death Spiral", "unlockLevel": 50, "description": "50% wider spin, with 25% less base damage. Bleed payoff remains."},
            {"id": "deathspiral_ruthless", "name": "Ruthless Spiral", "skill": "Death Spiral", "unlockLevel": 70, "description": "30% more base damage, with a 30% smaller radius."},
            {"id": "deathspiral_quick", "name": "Quick Spiral", "skill": "Death Spiral", "unlockLevel": 90, "description": "Recast 40% sooner, with 30% less base damage."},
            {"id": "serratededges_lasting", "name": "Lasting Edge", "skill": "Serrated Edges", "unlockLevel": 50, "description": "Buff lasts 15s, with a 50% longer cooldown."},
            {"id": "serratededges_rapid", "name": "Rapid Edge", "skill": "Serrated Edges", "unlockLevel": 70, "description": "Recast 40% sooner; buff lasts 6s."},
            {"id": "serratededges_reprise", "name": "Blade Reprise", "skill": "Serrated Edges", "unlockLevel": 90, "description": "Refresh Fan of Knives on cast, but the buff lasts only 5s. Mana and global cooldown still apply."},
            {"id": "bladestorm_focused", "name": "Focused Blades", "skill": "Blade Storm", "unlockLevel": 50, "description": "Half the spread, with 25% more damage per blade."},
            {"id": "bladestorm_broad", "name": "Broad Blades", "skill": "Blade Storm", "unlockLevel": 70, "description": "50% wider spread, with 20% less damage per blade."},
            {"id": "bladestorm_long", "name": "Far Blades", "skill": "Blade Storm", "unlockLevel": 90, "description": "50% more travel distance, with 25% less damage per blade."},
            {"id": "phantomvolley_barrage", "name": "Barrage", "skill": "Phantom Volley", "unlockLevel": 50, "description": "Fire five arrows instead of three, each dealing 35% less damage."},
            {"id": "phantomvolley_burst", "name": "Burst Volley", "skill": "Phantom Volley", "unlockLevel": 70, "description": "Arrows launch twice as quickly, with a 20% longer cooldown."},
            {"id": "phantomvolley_piercing", "name": "Piercing Volley", "skill": "Phantom Volley", "unlockLevel": 90, "description": "Arrows always pierce, but deal 40% less damage."},
            {"id": "poisoncoating_lasting", "name": "Lasting Venom", "skill": "Poison Coating", "unlockLevel": 50, "description": "Coating lasts 24s, with a 30% longer cooldown."},
            {"id": "poisoncoating_rapid", "name": "Rapid Venom", "skill": "Poison Coating", "unlockLevel": 70, "description": "Recast 40% sooner; coating lasts 9s."},
            {"id": "poisoncoating_rearm", "name": "Venom Rearm", "skill": "Poison Coating", "unlockLevel": 90, "description": "Refresh Tripwire on cast, but coating lasts 7.5s. Mana and global cooldown still apply."},
            {"id": "smokebomb_wide", "name": "Wide Smoke", "skill": "Smoke Bomb", "unlockLevel": 50, "description": "50% wider cloud; slow and blindness last 3s."},
            {"id": "smokebomb_choking", "name": "Choking Smoke", "skill": "Smoke Bomb", "unlockLevel": 70, "description": "Reduce accuracy by 50%, but slow by only 25%."},
            {"id": "smokebomb_dense", "name": "Dense Smoke", "skill": "Smoke Bomb", "unlockLevel": 90, "description": "Slow by 70%, but the cloud radius is 35% smaller."},
            {"id": "tripwire_distant", "name": "Distant Wire", "skill": "Tripwire", "unlockLevel": 50, "description": "50% more placement range, with 30% less damage."},
            {"id": "tripwire_grasp", "name": "Grasping Wire", "skill": "Tripwire", "unlockLevel": 70, "description": "Root lasts 5s instead of 3s, with 35% less damage."},
            {"id": "tripwire_quick", "name": "Quick Wire", "skill": "Tripwire", "unlockLevel": 90, "description": "Recast 40% sooner; root lasts 1.5s and damage is 20% lower."},
        ],
        Wizard: [
            // Fireball Runes
            { id: "fireball_magma", name: "Magma Orb", skill: "Fireball", unlockLevel: 50, description: "Slower projectile; damaging hits leave a 5-unit fire field for 3s. Pulses inherit one-sixth of the first hit; leaving stops the burn." },
            { id: "fireball_chain", name: "Chain Reaction", skill: "Fireball", unlockLevel: 70, description: "Bounces to 3 additional targets at 50% damage" },
            { id: "fireball_empowered", name: "Empowered", skill: "Fireball", unlockLevel: 90, description: "+100% damage, +3s cooldown" },
            // Meteor Drop Runes
            { id: "meteor_cluster", name: "Cluster", skill: "Meteor Drop", unlockLevel: 50, description: "Three smaller meteors, each with two-thirds damage and 40% less radius." },
            { id: "meteor_extinction", name: "Extinction", skill: "Meteor Drop", unlockLevel: 70, description: "+50% explosion radius" },
            { id: "meteor_apocalypse", name: "Apocalypse", skill: "Meteor Drop", unlockLevel: 90, description: "Five extra meteors over 5s, each with half damage and 30% less radius." },
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
            // Precision caster: distribute a paid charge, defend, or commit to burst.
        {"id": "flamewhip_reach", "name": "Reach", "skill": "Flame Whip", "unlockLevel": 50, "description": "50% greater reach, but 25% less damage. Retains the trained stun."},
        {"id": "flamewhip_binding", "name": "Binding Flame", "skill": "Flame Whip", "unlockLevel": 70, "description": "5s base stun, but 35% less damage. Control-immune enemies still take damage."},
        {"id": "flamewhip_flash", "name": "Flash Lash", "skill": "Flame Whip", "unlockLevel": 90, "description": "6s base cooldown and 1s base stun, but 20% less damage. Mana cost is unchanged."},
        {"id": "flametornado_broad", "name": "Firefront", "skill": "Flame Tornado", "unlockLevel": 50, "description": "50% wider and travels at 6 instead of 10 speed, but deals 25% less damage. Each enemy is hit once."},
        {"id": "flametornado_swift", "name": "Firestorm", "skill": "Flame Tornado", "unlockLevel": 70, "description": "Travels at 18 instead of 10 speed, but is one-third narrower. Damage is unchanged."},
        {"id": "flametornado_focused", "name": "Fire Needle", "skill": "Flame Tornado", "unlockLevel": 90, "description": "40% more damage, but half the width. Each enemy is hit once."},
        {"id": "inferno_lingering", "name": "Lingering Embers", "skill": "Inferno Cataclysm", "unlockLevel": 50, "description": "Burns for 12s instead of 8s, but each pulse deals 35% less damage."},
        {"id": "inferno_concentrated", "name": "Crucible", "skill": "Inferno Cataclysm", "unlockLevel": 70, "description": "40% more damage per pulse, but 35% less radius. Duration is unchanged."},
        {"id": "inferno_flashburn", "name": "Flashburn", "skill": "Inferno Cataclysm", "unlockLevel": 90, "description": "Burns for 4s with 50% more damage per pulse and 40s base cooldown. Mana cost is unchanged."},
        {"id": "timewarp_communion", "name": "Communion", "skill": "Time Warp", "unlockLevel": 50, "description": "60% greater radius, but 6s base haste duration. Retains both personal cooldown resets."},
        {"id": "timewarp_lingering", "name": "Enduring Time", "skill": "Time Warp", "unlockLevel": 70, "description": "12s base haste duration, but does not reset Teleport or Gravity Well."},
        {"id": "timewarp_quickening", "name": "Quickening", "skill": "Time Warp", "unlockLevel": 90, "description": "40s base cooldown and 5s base haste. Resets Teleport only; Gravity Well keeps its cooldown."},
            { id: "spellfocus_reservoir", name: "Reservoir", skill: "Spell Focus", unlockLevel: 50, description: "Split Focus's trained bonus damage between your next two paid damaging spells. Utility and rejected casts keep both charges." },
            { id: "spellfocus_aegis", name: "Aegis", skill: "Spell Focus", unlockLevel: 70, description: "Double Focus's ward capacity, but retain only 60% of its bonus damage. Does not replace an active ward." },
            { id: "spellfocus_overchannel", name: "Overchannel", skill: "Spell Focus", unlockLevel: 90, description: "Increase Focus's bonus damage by 25%, but gain no Focus ward. Existing shields remain." },
            { id: "scorchbeam_longshot", name: "Longshot", skill: "Scorch Beam", unlockLevel: 50, description: "Reach 50% farther, but deal 20% less damage. Retains armor melt and the brief slow." },
            { id: "scorchbeam_incision", name: "Incision", skill: "Scorch Beam", unlockLevel: 70, description: "Deal 25% more damage, but lose the beam slow. Armor melt remains." },
            { id: "scorchbeam_snare", name: "Snare", skill: "Scorch Beam", unlockLevel: 90, description: "Slow susceptible enemies by 50% for 5s base, but deal 25% less damage. Preserves existing slows; immune enemies still take damage." },
            { id: "arcanemissiles_salvo", name: "Salvo", skill: "Arcane Missiles", unlockLevel: 50, description: "Fire two extra missiles at 60% damage each: five normally, seven after Scorch Beam. Spends one Focus charge for the entire volley." },
            { id: "arcanemissiles_compression", name: "Compression", skill: "Arcane Missiles", unlockLevel: 70, description: "Fire one fewer missile at 140% damage each: two normally, four after Scorch Beam. Trades ordinary volley damage for stronger prepared volleys." },
            { id: "arcanemissiles_convergence", name: "Convergence", skill: "Arcane Missiles", unlockLevel: 90, description: "Missiles fly straight toward your aim at 40 speed and deal 20% more damage, but no longer home onto moving targets." },
            { id: "dragonfire_needle", name: "Needle", skill: "Dragonfire Lance", unlockLevel: 50, description: "Deal 25% more damage with half the projectile width. Stops at the first enemy hit." },
            { id: "dragonfire_broadside", name: "Broadside", skill: "Dragonfire Lance", unlockLevel: 70, description: "Pierce enemies with 2.5 times the projectile width, but deal 25% less damage to each. Each enemy can be hit once." },
            { id: "dragonfire_quickfire", name: "Quickfire", skill: "Dragonfire Lance", unlockLevel: 90, description: "Reduce base cooldown from 20s to 12s and projectile speed rises from 40 to 60, but deal 35% less damage. Mana cost remains 50 before discounts." },
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
    // Learned-branch skill sequences; the number can vary by class.
    // ================================================================
    SKILL_COMBOS: {
        Fighter: [
            { id: "fortress_counter", name: "Fortress Counter", firstSkill: "Iron Fortress", secondSkill: "Shield Slam", description: "Shield Slam deals 50% more damage. Normal mana and global cooldown apply." },
            { id: "momentum_strike", name: "Momentum Strike", firstSkill: "Charge", secondSkill: "Whirlwind", description: "+50% Whirlwind damage" },
            { id: "tremor_rush", name: "Tremor Rush", firstSkill: "Earthshaker", secondSkill: "Charge", description: "+2s knockdown on Charge" },
            { id: "guardian_combo", name: "Guardian Combo", firstSkill: "Shield Slam", secondSkill: "Guardian Roar", description: "Guardian Roar protection lasts 50% longer; taunt is still a one-time threat boost." },
            { id: "iron_will", name: "Iron Will", firstSkill: "Berserker Edge", secondSkill: "Last Stand Rampage", description: "Gain an absorb ward equal to 20% of maximum health for Rampage's duration. Does not replace or stack with an active ward." },
        ],
        Rogue: [
            { id: "ambush", name: "Ambush", firstSkill: "Weak Point Mark", secondSkill: "Backstab", description: "Guaranteed critical hit" },
            { id: "venom_burst", name: "Venom Burst", firstSkill: "Poison Coating", secondSkill: "Tripwire", description: "Tripwire deals 100% more impact damage." },
            { id: "blade_tornado", name: "Blade Tornado", firstSkill: "Fan of Knives", secondSkill: "Phantom Volley", description: "Volley pierces all targets" },
            { id: "shadow_dance", name: "Shadow Dance", firstSkill: "Cloak & Vanish", secondSkill: "Smoke Bomb", description: "Smoke Bomb refreshes Tripwire. Normal mana and cooldowns apply." },
        ],
        Wizard: [
            { id: "implosion", name: "Implosion", firstSkill: "Gravity Well", secondSkill: "Fireball", description: "This Fireball deals +100% damage to slowed or control-immune targets. Does not bypass control immunity." },
            { id: "arcane_barrage", name: "Arcane Barrage", firstSkill: "Scorch Beam", secondSkill: "Arcane Missiles", description: "Scorch Beam prepares two extra Arcane Missiles. Runes keep their volley and damage tradeoffs; normal mana and cooldown apply." },
            { id: "time_burn", name: "Time Burn", firstSkill: "Flame Tornado", secondSkill: "Inferno Cataclysm", description: "Cataclysm ticks twice as fast" },
            { id: "nova_cascade", name: "Nova Cascade", firstSkill: "Fireball", secondSkill: "Flame Whip", description: "360° Flame Whip" },
        ],
        Cleric: [
            { id: "divine_storm", name: "Divine Storm", firstSkill: "Blessing of Zeal", secondSkill: "Spirit Guardians", description: "Activates boosted Spirit Guardians damage and radius." },
            { id: "sanctuary_combo", name: "Sanctuary", firstSkill: "Healing Light", secondSkill: "Guardian Embrace", description: "Guardian Embrace also protects the caster from damage for 3s base. Does not make allies immune." },
            { id: "holy_fury", name: "Holy Fury", firstSkill: "Consecrated Ground", secondSkill: "Radiant Strike", description: "Radiant Strike deals 100% more damage. No enemy mark required." },
            { id: "mass_revival", name: "Mass Revival", firstSkill: "Divine Intervention", secondSkill: "Healing Light", description: "Healing Light heals living nearby allies around you (base 20-unit radius). Does not resurrect." },
        ],
    }
};
