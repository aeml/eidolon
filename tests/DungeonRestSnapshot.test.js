import { dungeonRestSnapshot } from './dungeonRestSnapshot.js';
import { readFileSync } from 'node:fs';

const game = () => ({ currentInstanceId: 'run-a', currentInstanceType: 'verdant_bastion_catacombs',
    currentDungeonLayout: { generationSeed: '-5388765118892393174', generatorVersion: 2 },
    currentDungeonRoomState: { difficulty: 'normal', runLevel: 30,
        rooms: [{ index: 0, cleared: true }, { index: 1, cleared: false }] },
    player: { gold: 123, level: 100, inventory: [{ id: 'z', stats: { damage: 20 } }, null, { id: 'a', count: 2 }],
        quests: [{ id: 'story', accepted: true, completed: false, count: 1, maxCount: 4 }] } });

test('snapshot detaches run identity, rewards and quest progress without changing source order', () => {
    const source = game(), before = JSON.stringify(source);
    const result = dungeonRestSnapshot(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(result.inventory.map(item => item.id)).toEqual(['a', 'z']);
    expect(result).toMatchObject({ instance: 'run-a', gold: 123, difficulty: 'normal', runLevel: 30,
        quests: [{ id: 'story', completed: false, count: 1 }] });
    source.player.inventory[0].stats.damage = 999;
    source.currentDungeonRoomState.rooms[0].cleared = false;
    source.player.quests[0].count = 2;
    expect(result.inventory[1].stats.damage).toBe(20);
    expect(result.rooms[0].cleared).toBe(true);
    expect(result.quests[0].count).toBe(1);
});

test.each(['identity', 'seed', 'rooms'])('missing actual dungeon %s fails closed', field => {
    const source = game();
    if (field === 'identity') source.currentInstanceId = '';
    if (field === 'seed') source.currentDungeonLayout.generationSeed = '';
    if (field === 'rooms') source.currentDungeonRoomState.rooms = [];
    expect(() => dungeonRestSnapshot(source)).toThrow('actual active run');
});

test('inventory ordering is irrelevant but lost rewards, reset rooms or replaced instances are detectable', () => {
    const source = game(), baseline = dungeonRestSnapshot(source);
    source.player.inventory.reverse();
    expect(dungeonRestSnapshot(source)).toEqual(baseline);
    for (const change of [g => g.player.inventory.pop(), g => g.player.gold++,
        g => g.currentDungeonRoomState.rooms[0].cleared = false, g => g.currentInstanceId = 'run-b',
        g => g.player.quests[0].completed = true]) {
        const changed = game();
        change(changed);
        expect(dungeonRestSnapshot(changed)).not.toEqual(baseline);
    }
});

test('prepared recovery is explicit and is not inserted into earned or release routes', () => {
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    const spec = readFileSync('tests/e2e/prepared-dungeon-town-rest.spec.js', 'utf8');
    expect(script.match(/prepared-dungeon-town-rest\.spec\.js/g)).toHaveLength(1);
    expect(script).toContain('prepared-dungeon-rest)');
    expect(script).toContain('npx playwright test --retries=0 tests/e2e/prepared-dungeon-town-rest.spec.js');
    expect(spec.indexOf("process.env.EIDOLON_E2E_PREPARED_DUNGEON_REST !== '1'"))
        .toBeLessThan(spec.indexOf('await loginAndEnterWorld('));
    expect(spec).toContain('expect(await snapshot(page)).toEqual(progress)');
});
