import { expect } from '@playwright/test';

export const productionWebSocketURL = 'wss://eserver.mendola.tech/ws';

export function collectBrowserFailures(page, baseURL) {
    const failures = [];
    const firstPartyOrigin = new URL(baseURL).origin;

    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') failures.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
        if (new URL(request.url()).origin === firstPartyOrigin) {
            failures.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText})`);
        }
    });
    page.on('response', (response) => {
        if (new URL(response.url()).origin === firstPartyOrigin && response.status() >= 400) {
            failures.push(`response: ${response.status()} ${response.url()}`);
        }
    });

    return failures;
}

export async function assertWebSocketReachable(page, url = productionWebSocketURL) {
    const result = await page.evaluate((socketURL) => new Promise((resolve) => {
        const socket = new WebSocket(socketURL);
        const timeout = setTimeout(() => {
            socket.close();
            resolve('timeout');
        }, 10_000);
        socket.addEventListener('open', () => {
            clearTimeout(timeout);
            socket.close(1000, 'Playwright connectivity check');
            resolve('open');
        }, { once: true });
        socket.addEventListener('error', () => {
            clearTimeout(timeout);
            resolve('error');
        }, { once: true });
    }), url);

    expect(result).toBe('open');
}

export async function loginAndEnterWorld(page, credentials) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#game-title')).toHaveText('EIDOLON ONLINE');

    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#btn-login').click();

    await expect(page.locator('#auth-status')).toHaveCSS('color', 'rgb(76, 175, 80)', { timeout: 20_000 });

    const enterWorld = page.locator('#btn-play-character');
    const classButton = page.locator(`.class-btn[data-type="${credentials.characterClass}"]`);
    await expect(enterWorld.or(classButton)).toBeVisible({ timeout: 20_000 });

    if (await enterWorld.isVisible()) {
        await enterWorld.click();
    } else {
        await classButton.click();
    }

    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect.poll(() => page.evaluate(() => Boolean(
        window.game?.player?.position &&
        window.game?._firstStateReceived &&
        window.game?.network?.socket?.readyState === WebSocket.OPEN
    )), { timeout: 30_000 }).toBe(true);
}

export async function readPlayerState(page) {
    return page.evaluate(() => {
        const player = window.game?.player;
        return player ? {
            id: player.id,
            name: player.name,
            type: player.constructor?.name,
            level: player.level,
            health: player.health,
            inventoryCount: (player.inventory || []).filter((item) => item?.id).length,
            x: player.position?.x,
            y: player.position?.y,
            z: player.position?.z,
            instanceType: window.game?.currentInstanceType || 'overworld'
        } : null;
    });
}

export async function exerciseMovement(page) {
    const before = await readPlayerState(page);
    expect(before).not.toBeNull();

    await page.keyboard.down('w');
    await page.waitForTimeout(1_500);
    await page.keyboard.up('w');

    await expect.poll(async () => {
        const after = await readPlayerState(page);
        return Math.hypot(after.x - before.x, after.z - before.z);
    }, { timeout: 10_000 }).toBeGreaterThan(0.25);
}

const menuChecks = [
    ['c', '#character-sheet'],
    ['i', '#inventory-screen'],
    ['j', '#quest-journal'],
    ['k', '#skill-tree-window'],
    ['m', '#world-map'],
    ['o', '#social-window'],
    ['p', '#abilities-menu']
];

export async function exerciseMenus(page) {
    for (const [key, selector] of menuChecks) {
        await page.keyboard.press(key);
        await expect(page.locator(selector)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator(selector)).toBeHidden();
    }
}

export async function exerciseReconnect(page) {
    const before = await readPlayerState(page);
    const originalSocket = await page.evaluateHandle(() => window.game.network.socket);

    // Closing the transport simulates a real network interruption. Gameplay
    // remains driven through browser input; evaluate is used for this transport
    // fault and read-only state assertions.
    await originalSocket.evaluate((socket) => socket.close());
    await originalSocket.dispose();

    await expect.poll(() => page.evaluate(() =>
        window.game?.network?.socket?.readyState === WebSocket.OPEN
    ), { timeout: 30_000 }).toBe(true);

    const after = await readPlayerState(page);
    expect(after.id === before.id && after.name === before.name).toBe(true);
}

export async function projectNearestHostile(page) {
    return page.evaluate(() => {
        const game = window.game;
        if (!game?.player || !game.renderSystem?.camera) return null;

        let best = null;
        for (const entity of game.activeEntitiesCache || []) {
            if (!entity?.isActive || !entity.mesh || !game.isHostileActorTarget?.(entity)) continue;
            const projected = entity.position.clone().project(game.renderSystem.camera);
            if (projected.z < -1 || projected.z > 1) continue;
            const x = (projected.x + 1) * window.innerWidth / 2;
            const y = (-projected.y + 1) * window.innerHeight / 2;
            if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) continue;
            const distance = game.player.position.distanceTo(entity.position);
            if (!best || distance < best.distance) {
                best = { id: entity.id, x, y, distance, health: entity.health };
            }
        }
        return best;
    });
}

async function readEntity(page, targetId) {
    return page.evaluate((id) => {
        const entity = (window.game?.activeEntitiesCache || []).find((candidate) => candidate.id === id);
        return entity ? {
            id: entity.id,
            health: entity.health,
            state: entity.state,
            isActive: entity.isActive
        } : null;
    }, targetId);
}

export async function projectEntity(page, targetId) {
    return page.evaluate((id) => {
        const game = window.game;
        const entity = (game?.activeEntitiesCache || []).find((candidate) => candidate.id === id);
        if (!entity?.position || !game?.renderSystem?.camera) return null;
        const projected = entity.position.clone().project(game.renderSystem.camera);
        return {
            x: (projected.x + 1) * window.innerWidth / 2,
            y: (-projected.y + 1) * window.innerHeight / 2,
            visible: projected.z >= -1 && projected.z <= 1 &&
                projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1
        };
    }, targetId);
}

async function projectNearestLoot(page) {
    return page.evaluate(() => {
        const game = window.game;
        if (!game?.player || !game.renderSystem?.camera) return null;
        let best = null;
        for (const entity of game.activeEntitiesCache || []) {
            if (!entity?.isActive || entity.constructor?.name !== 'LootDrop') continue;
            const projected = entity.position.clone().project(game.renderSystem.camera);
            const x = (projected.x + 1) * window.innerWidth / 2;
            const y = (-projected.y + 1) * window.innerHeight / 2;
            const distance = game.player.position.distanceTo(entity.position);
            if (projected.z < -1 || projected.z > 1 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) continue;
            if (!best || distance < best.distance) best = { id: entity.id, x, y, distance };
        }
        return best;
    });
}

async function findOverworldTarget(page) {
    let target = await projectNearestHostile(page);
    for (let attempt = 0; !target && attempt < 30; attempt += 1) {
        await page.keyboard.down('w');
        await page.waitForTimeout(1_000);
        await page.keyboard.up('w');
        target = await projectNearestHostile(page);
    }
    return target;
}

export async function exerciseCombatAndLoot(page) {
    const inventoryBefore = (await readPlayerState(page)).inventoryCount;
    let abilityWasUsed = false;

    for (let encounter = 0; encounter < 5; encounter += 1) {
        const target = await findOverworldTarget(page);
        expect(target, 'A visible hostile is required for the extended gameplay run').not.toBeNull();

        for (let attack = 0; attack < 45; attack += 1) {
            const state = await readEntity(page, target.id);
            if (!state || !state.isActive || state.state === 'DEAD' || state.health <= 0) break;

            const projection = await projectEntity(page, target.id);
            if (projection?.visible) await page.mouse.click(projection.x, projection.y);
            const abilityKey = String((attack % 4) + 1);
            await page.keyboard.press(abilityKey);
            abilityWasUsed = true;
            await page.waitForTimeout(700);
        }

        await expect.poll(async () => {
            const state = await readEntity(page, target.id);
            return !state || !state.isActive || state.state === 'DEAD' || state.health <= 0;
        }, { timeout: 15_000 }).toBe(true);

        let loot = null;
        try {
            await expect.poll(async () => {
                loot = await projectNearestLoot(page);
                return Boolean(loot);
            }, { timeout: 5_000 }).toBe(true);
        } catch {
            continue;
        }

        await page.mouse.click(loot.x, loot.y);
        await expect.poll(async () => (await readPlayerState(page)).inventoryCount, {
            timeout: 20_000
        }).toBeGreaterThan(inventoryBefore);
        expect(abilityWasUsed).toBe(true);
        return (await readPlayerState(page)).inventoryCount;
    }

    throw new Error('Five overworld kills produced no loot that could be added to the QA inventory');
}

export async function ensureDungeonReadyLevel(page, level = 100) {
    const current = await readPlayerState(page);
    if (current.level >= level) return current.level;

    await page.keyboard.press('Enter');
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeFocused();
    await chatInput.fill(`/level ${level}`);
    await chatInput.press('Enter');
    await expect.poll(async () => (await readPlayerState(page)).level, { timeout: 15_000 }).toBe(level);
    return level;
}

async function projectVerdantEntrance(page) {
    return page.evaluate(() => {
        const game = window.game;
        let entrance = null;
        game?.renderSystem?.environmentGroup?.traverse((object) => {
            if (!entrance && object.name === 'DungeonEntrance' && object.userData?.dungeonType === 'verdant_bastion_catacombs') {
                const projected = object.position.clone().project(game.renderSystem.camera);
                entrance = {
                    x: (projected.x + 1) * window.innerWidth / 2,
                    y: (-projected.y + 1) * window.innerHeight / 2,
                    visible: projected.z >= -1 && projected.z <= 1 &&
                        projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1,
                    distance: game.player.position.distanceTo(object.position)
                };
            }
        });
        return entrance;
    });
}

export async function enterAndExitDungeon(page) {
    await page.keyboard.press('b');
    await expect.poll(async () => {
        const state = await readPlayerState(page);
        return Math.hypot(state.x + 1.25, state.z - 200);
    }, { timeout: 15_000 }).toBeLessThan(3);

    // S+D is due east in Eidolon's isometric WASD mapping. Read-only position
    // checks stop the real key input close enough to click the portal itself.
    await page.keyboard.down('s');
    await page.keyboard.down('d');
    try {
        await expect.poll(async () => (await readPlayerState(page)).x, {
            timeout: 150_000,
            intervals: [1_000]
        }).toBeGreaterThan(700);
    } finally {
        await page.keyboard.up('d');
        await page.keyboard.up('s');
    }

    const entrance = await projectVerdantEntrance(page);
    expect(entrance, 'Verdant Bastion entrance must be loaded').not.toBeNull();
    expect(entrance.visible, `Dungeon entrance is not on screen at distance ${entrance.distance}`).toBe(true);
    await page.mouse.move(entrance.x, entrance.y);
    await page.mouse.click(entrance.x, entrance.y);
    await expect(page.locator('#dungeon-menu')).toBeVisible({ timeout: 20_000 });
    await page.locator('#diff-btn-normal').click();
    await page.locator('#btn-enter-dungeon').click();

    await expect.poll(async () => (await readPlayerState(page)).instanceType, {
        timeout: 60_000
    }).toBe('verdant_bastion_catacombs');

    await page.keyboard.press('b');
    await expect.poll(async () => (await readPlayerState(page)).instanceType, {
        timeout: 30_000
    }).toBe('overworld');
}

export async function verifyPersistenceAfterFreshLogin(page, credentials, minimumInventoryCount) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loginAndEnterWorld(page, credentials);
    const restored = await readPlayerState(page);
    expect(restored.level).toBeGreaterThanOrEqual(100);
    expect(restored.inventoryCount).toBeGreaterThanOrEqual(minimumInventoryCount);
}

export async function exerciseCombat(page) {
    const target = await findOverworldTarget(page);
    expect(target, 'A visible hostile is required for the extended gameplay run').not.toBeNull();

    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(1_000);
    await page.keyboard.press('1');

    await expect.poll(() => page.evaluate((targetId) =>
        window.game?.pendingInteraction?.id === targetId ||
        !(window.game?.activeEntitiesCache || []).some(({ id }) => id === targetId), target.id
    ), { timeout: 15_000 }).toBe(true);
}

export function credentialsFromEnvironment(suffix = '') {
    return {
        username: process.env[`EIDOLON_E2E_USERNAME${suffix}`] || '',
        password: process.env[`EIDOLON_E2E_PASSWORD${suffix}`] || '',
        characterClass: process.env[`EIDOLON_E2E_CLASS${suffix}`] || 'Wizard'
    };
}
