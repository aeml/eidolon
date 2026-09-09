import { execFileSync } from 'node:child_process';

export function seedReturningCharacter(username) {
    const container = process.env.EIDOLON_E2E_INVESTIGATION_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_INVESTIGATION_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Returning-story fixture requires disposable authenticated local Mongo and loopback QA');
    }
    // Explicit old-save functional fixture through the four original dungeons.
    // No investigation or raid is seeded. This is not earned leveling evidence.
    const milestones = [
        ['chronicle_01_bell_below', 'KILL', 'Skeleton', 3],
        ['chronicle_02_seeds_first_grove', 'COLLECT', 'Verdant Memory Seed', 4],
        ['chronicle_03_roots_remember', 'KILL', 'HollowSentinel', 1],
        ['chronicle_04_pearls_without_tides', 'COLLECT', 'Moon-Tide Pearl', 4],
        ['chronicle_05_drowned_name', 'KILL', 'Thalorath', 1],
        ['chronicle_06_ash_refuses_cool', 'COLLECT', 'Cinderheart Ore', 4],
        ['chronicle_07_crown_of_embers', 'KILL', 'LordInfernax', 1],
        ['chronicle_08_feathers_thunder', 'COLLECT', 'Stormglass Pinion', 4],
        ['chronicle_09_sky_answers', 'KILL', 'Zephyrion', 1]
    ];
    const character = { name: username, class: 'Wizard', level: 100, xp: 0, gold: 0,
        x: -1.25, y: 0, z: 200,
        // Canonical Wizard level-100 growth and a common level-100 staff
        // (round(12 * (1 + 100 * .15) / 25) = 8 damage), without talents.
        stats: { strength: 208, dexterity: 109, intelligence: 119, wisdom: 109, vitality: 208 },
        inventory: [], stash: [], unlocked_skills: ['Fireball'],
        equipment: { mainHand: { id: 'returning-staff', name: 'Wooden Staff', type: 'WEAPON', slot: 'mainHand',
            rarity: 'Common', level: 100, potency: 0, stats: { damage: 8 }, stat_scale_version: 1 } },
        quests: milestones.map(([id, type, target, count], index) => ({ id, type, target, count, max_count: count,
            accepted: true, completed: true, category: 'chronicle', chapter: index + 1, reward_xp: 0, reward_gold: 0 })) };
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const result = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Requires one newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch { throw new Error('Could not seed disposable returning-story fixture'); }
}
