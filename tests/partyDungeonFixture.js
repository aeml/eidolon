export const PARTY_ROLES = ['Fighter', 'Cleric', 'Wizard', 'Rogue'];
const PRIMARY = { Fighter: ['strength', 'Strong'], Rogue: ['dexterity', 'Agile'],
    Wizard: ['intelligence', 'Brilliant'], Cleric: ['wisdom', 'Wise'] };
const RARE_SLOTS = new Set(['mainHand', 'offHand', 'chest', 'legs', 'trinket1']);

export function partyGearProfile(env = {}) {
    const profile = env.EIDOLON_E2E_PARTY_GEAR || 'progressed';
    if (!['common', 'progressed'].includes(profile)) throw new Error('Unknown party gear profile');
    return profile;
}

export function partyGraphicsQuality(env = {}) {
    const quality = env.EIDOLON_E2E_PARTY_QUALITY || 'high';
    if (!['high', 'medium', 'low'].includes(quality)) throw new Error('Unknown party graphics quality');
    return quality;
}

export function requireIsolatedPartyFixture(env) {
    if (env.EIDOLON_E2E_PARTY_DUNGEON !== '1' || env.EIDOLON_E2E_REGISTER !== '1' ||
        !/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(env.EIDOLON_E2E_BUILD_MONGO_CONTAINER || '') ||
        !/^\d+$/.test(env.EIDOLON_E2E_BUILD_MONGO_PORT || '') ||
        !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(env.EIDOLON_E2E_WS_URL || '') ||
        !/^codexqa[a-f0-9]{12}$/.test(env.EIDOLON_E2E_USERNAME || '')) {
        throw new Error('Party fixture requires explicit disposable loopback services and dedicated QA accounts');
    }
}

export function partyDungeonCharacter(catalog, quests, className, name, profile = 'progressed') {
    if (!PARTY_ROLES.includes(className)) throw new Error('Unknown party role');
    partyGearProfile({ EIDOLON_E2E_PARTY_GEAR: profile });
    if (catalog.gearProfile && catalog.gearProfile !== profile) throw new Error('Party catalog profile mismatch');
    const tank = className === 'Fighter', rogue = className === 'Rogue';
    const names = {
        mainHand: { Fighter: 'Iron Sword', Cleric: 'Cleric Mace', Wizard: 'Wooden Staff', Rogue: 'Steel Dagger' }[className],
        offHand: tank || rogue ? 'Wooden Shield' : 'Spell Tome',
        head: tank ? 'Iron Helm' : rogue ? 'Leather Cap' : 'Silk Hood',
        chest: tank ? 'Plate Mail' : rogue ? 'Leather Tunic' : 'Robes',
        legs: tank ? 'Plate Greaves' : rogue ? 'Leather Pants' : 'Silk Skirt',
        feet: tank ? 'Iron Boots' : rogue ? 'Leather Boots' : 'Sandals',
        gloves: tank ? 'Iron Gauntlets' : rogue ? 'Leather Gloves' : 'Silk Gloves',
        shoulders: tank ? 'Steel Pauldrons' : rogue ? 'Reinforced Spaulders' : 'Velvet Mantle',
        belt: tank ? 'Plated Girdle' : rogue ? 'Studded Belt' : 'Silk Sash',
        ring1: 'Gold Ring', ring2: className === 'Cleric' ? 'Silver Ring' : 'Gold Ring',
        neck: 'Pendant', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana'
    };
    const equipment = Object.fromEntries(Object.entries(names).map(([slot, itemName]) => {
        const rarity = profile === 'common' ? 'Common' : RARE_SLOTS.has(slot) ? 'Rare' : 'Uncommon';
        const item = profile === 'common' ? catalog.items?.[itemName] : catalog.roleItems?.[className]?.[rarity]?.[itemName];
        if (!item || item.level !== 30 || item.rarity !== rarity || (item.potency || 0) !== 0) {
            throw new Error(`Invalid catalog item ${itemName}`);
        }
        if (profile === 'progressed' && (!item.name.startsWith(`${PRIMARY[className][1]} `) ||
            !(item.stats?.[PRIMARY[className][0]] > 0) ||
            (rarity === 'Rare' && (!item.name.endsWith(' of the Whale') || !(item.stats?.vitality > 0))))) {
            throw new Error(`Wrong role affixes for ${className}: ${itemName}`);
        }
        const { maxStack, statScaleVersion, ...rest } = item;
        return [slot, { ...rest, id: `party-${className}-${slot}`, max_stack: maxStack, stat_scale_version: statScaleVersion }];
    }));
    const skills = {
        Fighter: ['Charge', 'Whirlwind', 'Shield Slam', 'Iron Fortress'],
        Cleric: ['Spirit Guardians', 'Healing Light', 'Guardian Embrace', 'Purifying Wave'],
        Wizard: ['Fireball', 'Teleport', 'Arcane Shield', 'Gravity Well'],
        Rogue: ['Piercing Throw', 'Smoke Bomb', 'Poison Coating', 'Tripwire']
    }[className];
    const mastery = { Fighter: 'FTR_03', Cleric: 'CLR_03', Wizard: 'WIZ_01', Rogue: 'ROG_01' }[className];
    return { name, class: className, level: 30, xp: 0, progression_version: 2,
        gold: 0, x: -1.25, y: 0, z: 200, stats: catalog.stats, equipment,
        talent_ranks: { [mastery]: 5 }, selected_branch: tank || className === 'Cleric' ? 'A' : 'C',
        unlocked_skills: skills, inventory: [], stash: [], quests: JSON.parse(JSON.stringify(quests)) };
}
