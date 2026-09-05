import { expect } from '@playwright/test';
import {
    isBenignCanceledAssetRequest,
    isIgnoredBrowserRequest
} from './browserFailurePolicy.js';

export const productionWebSocketURL = 'wss://eserver.mendola.tech/ws';
const browserFailureState = new WeakMap();

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function discardFailuresSince(page, startIndex) {
    const failures = browserFailureState.get(page);
    if (failures && failures.length > startIndex) failures.splice(startIndex);
}

function discardRecoveredWebSocketFailures(page, startIndex = 0) {
    const failures = browserFailureState.get(page);
    if (!failures) return;
    for (let index = failures.length - 1; index >= startIndex; index -= 1) {
        if (/WebSocket|Auth socket error/i.test(failures[index])) failures.splice(index, 1);
    }
}

export function collectBrowserFailures(page, baseURL) {
    const failures = [];
    browserFailureState.set(page, failures);
    const firstPartyOrigin = new URL(baseURL).origin;
    const successfulResponses = new Set();
    const canceledAssetFailures = new Map();
    const transientDocumentFailures = new Map();
    const transientDocumentRequestFailures = new Map();

    page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        // The response listener records the actionable URL and status. Avoid a
        // duplicate generic console entry that cannot itself be reconciled
        // when a later navigation successfully reloads that resource.
        if (/Failed to load resource: the server responded with a status of 5\d\d/i.test(text)) return;
        failures.push(`console: ${text}`);
    });
    page.on('requestfailed', (request) => {
        const requestURL = new URL(request.url());
        if (requestURL.origin === firstPartyOrigin &&
            !isIgnoredBrowserRequest(request.method(), request.url())) {
            const errorText = request.failure()?.errorText;
            const detail = `requestfailed: ${request.method()} ${request.url()} (${errorText})`;

            if (isBenignCanceledAssetRequest(
                request.resourceType(),
                errorText,
                request.url()
            )) return;

            // A CDN/edge navigation can fail before an HTTP response exists.
            // Keep the final failure actionable, but reconcile an earlier
            // failed document when a bounded openGame retry later loads the
            // same route successfully.
            if (request.resourceType() === 'document') {
                failures.push(detail);
                const documentKey = requestURL.pathname;
                const details = transientDocumentRequestFailures.get(documentKey) || [];
                details.push(detail);
                transientDocumentRequestFailures.set(documentKey, details);
                return;
            }

            // Chrome can cancel a GLB request while the newly activated asset
            // service worker takes control, after which MeshFactory retries it.
            // Retain that cancellation unless a later response proves that the
            // exact first-party asset loaded successfully.
            if (errorText === 'net::ERR_ABORTED' && new URL(request.url()).pathname.includes('/assets/')) {
                if (!successfulResponses.has(request.url())) {
                    failures.push(detail);
                    const details = canceledAssetFailures.get(request.url()) || [];
                    details.push(detail);
                    canceledAssetFailures.set(request.url(), details);
                }
                return;
            }
            failures.push(detail);
        }
    });
    page.on('response', (response) => {
        const responseURL = new URL(response.url());
        if (responseURL.origin !== firstPartyOrigin) return;
        if (isIgnoredBrowserRequest(response.request().method(), response.url())) return;
        const documentKey = responseURL.pathname;
        if (response.status() >= 400) {
            const detail = `response: ${response.status()} ${response.url()}`;
            failures.push(detail);
            if (response.status() >= 500 && response.request().resourceType() === 'document') {
                const details = transientDocumentFailures.get(documentKey) || [];
                details.push(detail);
                transientDocumentFailures.set(documentKey, details);
            }
            return;
        }

        successfulResponses.add(response.url());
        if (response.request().resourceType() === 'document') {
            for (const detail of transientDocumentFailures.get(documentKey) || []) {
                const index = failures.indexOf(detail);
                if (index !== -1) failures.splice(index, 1);
            }
            transientDocumentFailures.delete(documentKey);
            for (const detail of transientDocumentRequestFailures.get(documentKey) || []) {
                const index = failures.indexOf(detail);
                if (index !== -1) failures.splice(index, 1);
            }
            transientDocumentRequestFailures.delete(documentKey);
        }
        for (const detail of canceledAssetFailures.get(response.url()) || []) {
            const index = failures.indexOf(detail);
            if (index !== -1) failures.splice(index, 1);
        }
        canceledAssetFailures.delete(response.url());
    });

    return failures;
}

export async function openGame(page, options = {}) {
    let response = null;
    let readinessError = null;
    const attempts = options.attempts || 10;
    const expectedCommit = process.env.EIDOLON_EXPECTED_COMMIT;
    const gameDocument = expectedCommit
        ? `/?release=${encodeURIComponent(expectedCommit)}`
        : '/';
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const failureStart = browserFailureState.get(page)?.length || 0;
        try {
            response = await page.goto(gameDocument, {
                waitUntil: options.waitUntil || 'domcontentloaded',
                timeout: 20_000
            });
        } catch (error) {
            response = null;
            readinessError = error;
        }
        if (response?.status() === 200) {
            try {
                await expect(page.locator('#game-title')).toHaveText('EIDOLON ONLINE');
                await expect.poll(() => page.evaluate(() => Boolean(
                    document.documentElement.dataset.eidolonReady === 'true' &&
                    typeof globalThis.protobuf === 'object'
                )), {
                    message: 'The complete game runtime must load before browser QA continues',
                    timeout: 15_000
                }).toBe(true);
                return response;
            } catch (error) {
                readinessError = error;
            }
        }
        if (attempt === attempts - 1) break;

        // A full navigation replaces the failed document/runtime. Discard only
        // failures belonging to that abandoned attempt; the final attempt is
        // retained if recovery never succeeds.
        discardFailuresSince(page, failureStart);
        await page.waitForTimeout(Math.min(1_000 * (attempt + 1), 5_000));
    }
    if (response?.status() !== 200) {
        expect(response?.status(), 'The live game document must recover from transient edge errors').toBe(200);
    }
    throw readinessError || new Error('The complete game runtime did not become ready');
}

export async function assertWebSocketReachable(page, url = productionWebSocketURL) {
    const failureStart = browserFailureState.get(page)?.length || 0;
    let result = 'untried';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        result = await page.evaluate((socketURL) => new Promise((resolve) => {
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
        if (result === 'open') {
            discardRecoveredWebSocketFailures(page, failureStart);
            return;
        }
        await page.waitForTimeout(Math.min(1_000 * (attempt + 1), 5_000));
    }
    expect(result).toBe('open');
}

export async function getJSONWithRetry(request, url, validate, label = 'live endpoint') {
    let lastStatus = 'unavailable';
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            const response = await request.get(url, {
                headers: { 'Cache-Control': 'no-cache' },
                timeout: 20_000
            });
            lastStatus = response.status();
            if (response.ok()) {
                const json = await response.json();
                if (!validate || validate(json)) return json;
                lastError = new Error(`${label} returned an unexpected payload`);
            }
        } catch (error) {
            lastError = error;
        }
        if (attempt < 7) await delay(Math.min(1_000 * (attempt + 1), 5_000));
    }
    throw new Error(`${label} did not recover after bounded retries (last status: ${lastStatus})`, {
        cause: lastError
    });
}

export async function loginAndEnterWorld(page, credentials) {
    let authenticated = false;
    for (let pageAttempt = 0; pageAttempt < 3 && !authenticated; pageAttempt += 1) {
        const failureStart = browserFailureState.get(page)?.length || 0;
        await openGame(page);

        await page.locator('#auth-username').fill(credentials.username);
        await page.locator('#auth-password').fill(credentials.password);
        if (process.env.EIDOLON_E2E_REGISTER === '1' && pageAttempt === 0) {
            await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
            await page.locator('#btn-register').click();
            await expect(page.locator('#auth-status')).toContainText(
                /Registration successful|username already exists/,
                { timeout: 30_000 }
            );
        }
        for (let socketAttempt = 0; socketAttempt < 4 && !authenticated; socketAttempt += 1) {
            await page.locator('#btn-login').click();
            try {
                await expect(page.locator('#auth-status')).toHaveCSS('color', 'rgb(76, 175, 80)', {
                    timeout: 15_000
                });
                authenticated = true;
                discardRecoveredWebSocketFailures(page, failureStart);
            } catch {
                // A fresh button click recreates a closed auth socket or resends
                // on an open one. A replaced page retries the complete runtime.
            }
        }
        if (!authenticated && pageAttempt < 2) {
            discardFailuresSince(page, failureStart);
        }
    }
    expect(authenticated, 'The browser must complete a credentialed auth handshake').toBe(true);

    const enterWorld = page.locator('#btn-play-character');
    const classButton = page.locator(`.class-btn[data-type="${credentials.characterClass}"]`);
    await expect.poll(async () =>
        await enterWorld.isVisible() || await classButton.isVisible(),
    { timeout: 20_000 }).toBe(true);

    if (await enterWorld.isVisible()) {
        await enterWorld.click();
    } else {
        await classButton.click();
    }

    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 120_000 });
    try {
        await expect.poll(() => page.evaluate(() => Boolean(
            window.game?.player?.position &&
            window.game?._firstStateReceived &&
            window.game?.network?.socket?.readyState === WebSocket.OPEN
        )), { timeout: 30_000 }).toBe(true);
    } catch (error) {
        const diagnostic = await page.evaluate(() => ({
            playerReady: Boolean(window.game?.player?.position),
            firstStateReceived: Boolean(window.game?._firstStateReceived),
            socketState: window.game?.network?.socket?.readyState ?? null,
            queuedMessages: window.game?.network?.messageQueue?.length ?? null,
            frameCount: window.game?.frameCount ?? null,
            visibility: document.visibilityState,
            focused: document.hasFocus()
        }));
        throw new Error(`The rendered world did not receive authoritative state: ${JSON.stringify(diagnostic)}`, {
            cause: error
        });
    }
}

export async function readPlayerState(page) {
    return page.evaluate(() => {
        const player = window.game?.player;
        return player ? {
            id: player.id,
            name: player.name,
            type: player.constructor?.name,
            level: player.level,
            health: player.health ?? player.stats?.hp,
            state: player.state,
            inventoryCount: (player.inventory || []).filter((item) => item?.id).length,
            x: player.position?.x,
            y: player.position?.y,
            z: player.position?.z,
            instanceType: window.game?.currentInstanceType || 'overworld'
        } : null;
    });
}

export async function projectGroundOffset(page, deltaX, deltaZ) {
    return page.evaluate(({ deltaX: dx, deltaZ: dz }) => {
        const game = window.game;
        if (!game?.player?.position || !game.renderSystem?.camera) return null;
        let lastProjection = null;
        for (const scale of [1, 0.75, 0.5, 0.25, 0.125]) {
            const target = game.player.position.clone();
            target.x += dx * scale;
            target.z += dz * scale;
            const projected = target.project(game.renderSystem.camera);
            lastProjection = {
                x: (projected.x + 1) * window.innerWidth / 2,
                y: (-projected.y + 1) * window.innerHeight / 2,
                visible: projected.z >= -1 && projected.z <= 1 &&
                    projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1
            };
            lastProjection.canvas = lastProjection.visible &&
                document.elementFromPoint(lastProjection.x, lastProjection.y)?.tagName === 'CANVAS';
            if (lastProjection.canvas) return lastProjection;
        }
        return lastProjection;
    }, { deltaX, deltaZ });
}

export async function moveByGroundClick(page, deltaX, deltaZ, options = {}) {
    const before = await readPlayerState(page);
    expect(before).not.toBeNull();
    const magnitude = Math.hypot(deltaX, deltaZ) || 1;
    const sideDistance = Math.max(8, magnitude * 0.4);
    const sideX = -deltaZ / magnitude * sideDistance;
    const sideZ = deltaX / magnitude * sideDistance;
    const candidates = [
        [deltaX, deltaZ],
        [deltaX + sideX, deltaZ + sideZ],
        [deltaX - sideX, deltaZ - sideZ]
    ];

    for (const [candidateX, candidateZ] of candidates) {
        let target = null;
        try {
            await expect.poll(async () => {
                target = await projectGroundOffset(page, candidateX, candidateZ);
                return Boolean(target?.canvas);
            }, { timeout: 1_000 }).toBe(true);
        } catch {
            continue;
        }

        await page.mouse.move(target.x, target.y);
        // A projected ground point can be crossed by a moving actor between
        // projection and click. Wait for the production hover route and only
        // click coordinates that are still genuinely clear ground; otherwise
        // this movement helper can accidentally start combat and misdiagnose
        // an animation or movement regression.
        await page.waitForTimeout(75);
        const isClearGround = await page.evaluate(() => !window.game?.hoveredEntity);
        if (!isClearGround) continue;
        await page.mouse.click(target.x, target.y);
        try {
            await expect.poll(async () => {
                const after = await readPlayerState(page);
                return Math.hypot(after.x - before.x, after.z - before.z);
            }, { timeout: options.timeout || 1_500 }).toBeGreaterThan(options.minimumDistance || 1);
            return readPlayerState(page);
        } catch {
            if (options.allowJumpFallback !== false) {
                // Jump is a real desktop input path and lets the character clear
                // small town props or fence edges that block click-to-move.
                await page.keyboard.down('Control');
                try {
                    await page.mouse.click(target.x, target.y);
                } finally {
                    await page.keyboard.up('Control');
                }
                try {
                    await expect.poll(async () => {
                        const after = await readPlayerState(page);
                        return Math.hypot(after.x - before.x, after.z - before.z);
                    }, { timeout: 2_500 }).toBeGreaterThan(options.minimumDistance || 1);
                    return readPlayerState(page);
                } catch {
                    // Try a nearby ground vector.
                }
            }
        }
    }

    // Dense randomized town props can occupy every projected click target.
    // Preserve the browser-input guarantee with bounded real WASD fallbacks.
    for (const key of ['w', 'a', 's', 'd']) {
        await page.keyboard.down(key);
        try {
            await page.waitForTimeout(2_500);
        } finally {
            await page.keyboard.up(key);
        }
        try {
            await expect.poll(async () => {
                const after = await readPlayerState(page);
                return Math.hypot(after.x - before.x, after.z - before.z);
            }, { timeout: 3_000 }).toBeGreaterThan(options.minimumDistance || 1);
            return readPlayerState(page);
        } catch {
            // Try the next real movement key.
        }
    }

    const diagnostic = await page.evaluate(() => {
        const game = window.game;
        const player = game?.player;
        return {
            player: player ? {
                level: player.level,
                health: player.health ?? player.stats?.hp,
                state: player.state,
                x: player.position?.x,
                z: player.position?.z,
                targetX: player.targetPosition?.x,
                targetZ: player.targetPosition?.z
            } : null,
            pendingType: game?.pendingInteraction?.constructor?.name || null,
            pendingSubtype: game?.pendingInteraction?.subType ||
                game?.pendingInteraction?.constructor?.name || null,
            skeletons: (game?.activeEntitiesCache || [])
                .filter((entity) => entity?.isActive &&
                    (entity.subType || entity.constructor?.name) === 'Skeleton')
                .slice(0, 5)
                .map((entity) => ({
                    health: entity.health ?? entity.stats?.hp,
                    state: entity.state,
                    x: entity.position?.x,
                    z: entity.position?.z
                })),
            escMenuOpen: Boolean(game?.uiManager?.isEscMenuOpen),
            patchNotesOpen: Boolean(game?.uiManager?.isPatchNotesOpen),
            focusedControl: document.activeElement?.id || document.activeElement?.tagName,
            openPanels: [...document.querySelectorAll('.window')]
                .filter((element) => getComputedStyle(element).display !== 'none')
                .map((element) => element.id),
            deathScreenVisible: game?.uiManager?.deathScreen?.style?.display !== 'none'
        };
    });
    throw new Error(
        `No real canvas click moved the character toward (${deltaX}, ${deltaZ}): ${JSON.stringify(diagnostic)}`
    );
}

export async function jumpByGroundClick(page, deltaX, deltaZ) {
    const before = await readPlayerState(page);
    const target = await projectGroundOffset(page, deltaX, deltaZ);
    expect(target?.canvas, 'A real Ctrl-click jump requires an unobscured canvas destination').toBe(true);

    await page.mouse.move(target.x, target.y);
    await page.keyboard.down('Control');
    try {
        await page.mouse.click(target.x, target.y);
    } finally {
        await page.keyboard.up('Control');
    }

    const magnitude = Math.hypot(deltaX, deltaZ) || 1;
    await expect.poll(async () => {
        const after = await readPlayerState(page);
        return ((after.x - before.x) * deltaX + (after.z - before.z) * deltaZ) / magnitude;
    }, { timeout: 4_000 }).toBeGreaterThan(1);
    try {
        await expect.poll(() => page.evaluate(() => window.game?.playerJumpState === null), {
            timeout: 8_000
        }).toBe(true);
    } catch {
        const diagnostic = await page.evaluate(() => {
            const game = window.game;
            const jump = game?.playerJumpState;
            return {
                playerState: game?.player?.state,
                x: game?.player?.position?.x,
                y: game?.player?.position?.y,
                z: game?.player?.position?.z,
                frameCount: game?.frameCount,
                inputControl: game?.inputManager?.keys?.control,
                primaryMouseButtonDown: game?.inputManager?.primaryMouseButtonDown,
                queued: game?.playerQueuedJump,
                jump: jump ? {
                    serverDriven: jump.serverDriven,
                    progress: jump.progress,
                    visualProgress: jump.visualProgress,
                    elapsed: jump.elapsed,
                    duration: jump.duration,
                    startX: jump.start?.x,
                    endX: jump.end?.x,
                    displayX: jump.displayPosition?.x
                } : null
            };
        });
        throw new Error(`Real Ctrl-click jump did not land: ${JSON.stringify(diagnostic)}`);
    }
}

export async function exerciseMovement(page) {
    await moveByGroundClick(page, 20, 0);
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
        const menu = page.locator(selector);
        let opened = false;
        for (let attempt = 0; attempt < 4 && !opened; attempt += 1) {
            await page.keyboard.press(key);
            try {
                await expect(menu).toBeVisible({ timeout: 2_000 });
                opened = true;
            } catch {
                // A service window reached during click-to-move can consume
                // Escape priority. Close one visible layer with real input,
                // then retry the intended gameplay hotkey.
                await page.keyboard.press('Escape');
                await page.waitForTimeout(150);
            }
        }
        expect(opened, `${key.toUpperCase()} must open ${selector} through keyboard input`).toBe(true);

        if (selector === '#character-sheet') {
            await expect(menu.locator('.character-preview-stage canvas')).toBeVisible();
            await expect.poll(() => page.evaluate(() => {
                const game = window.game;
                const preview = game?.uiManager?.characterPreview;
                return Boolean(preview?.renderer?.info.render.calls > 0 &&
                    preview.model?.userData.proceduralClass === game.player.mesh?.userData.proceduralClass &&
                    preview.model?.userData.equipmentVisualSignature === game.player.mesh?.userData.equipmentVisualSignature);
            }), { message: 'Character preview must render the live actor class and equipped appearance' }).toBe(true);
        }

        for (let attempt = 0; attempt < 4 && await menu.isVisible(); attempt += 1) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(150);
        }
        await expect(menu).toBeHidden();
    }

    const characterSheet = page.locator('#character-sheet');
    const inventory = page.locator('#inventory-screen');
    await page.keyboard.press('c');
    await expect(characterSheet).toBeVisible();
    await page.keyboard.press('i');
    await expect(inventory).toBeVisible();
    await expect(characterSheet, 'Opening inventory must keep the equipment sheet visible').toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(characterSheet).toBeHidden();
    await expect(inventory).toBeHidden();
}

export async function exerciseReconnect(page) {
    const before = await readPlayerState(page);

    // Trigger a server-originated transport close through visible chat input.
    // The command is available only to the production QA allowlist, and no
    // game/network method is invoked from page code or from the test harness.
    await page.keyboard.press('Enter');
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeFocused();
    await chatInput.fill('/qa-disconnect');
    await chatInput.press('Enter');

    await expect.poll(() => page.evaluate(() =>
        window.game?.network?.socket?.readyState !== WebSocket.OPEN
    ), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => Boolean(
        window.game?._firstStateReceived &&
        window.game?.network?.socket?.readyState === WebSocket.OPEN
    )), { timeout: 45_000 }).toBe(true);

    const after = await readPlayerState(page);
    expect(after.id === before.id && after.name === before.name).toBe(true);
}

export async function projectNearestHostile(page, desiredSubtype = null) {
    return page.evaluate((subtype) => {
        const game = window.game;
        if (!game?.player || !game.renderSystem?.camera) return null;

        let best = null;
        // Match GameEngine.performRaycast(): a network entity outside the
        // active rendered chunks may project onto the canvas mathematically,
        // but it has no scene hitbox and therefore cannot be clicked by a
        // player. Navigation below can use the broader remote map to approach;
        // acquisition must select from the actual raycastable cache.
        for (const entity of game.activeEntitiesCache || []) {
            if (!entity?.isActive || !entity.mesh || !game.isHostileActorTarget?.(entity)) continue;
            const resolvedSubtype = entity.subType || entity.constructor?.name;
            if (subtype && resolvedSubtype !== subtype) continue;
            const worldPoint = entity.position.clone();
            let foundMesh = false;
            entity.mesh.updateWorldMatrix?.(true, true);
            // Actor.setMesh installs a transparent, raycastable hitbox tagged
            // with the entity id. Its center is the most reliable real-click
            // coordinate while an animated GLB is moving.
            entity.mesh.traverse?.((child) => {
                if (foundMesh || child?.userData?.entityId !== entity.id || !child.geometry) return;
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
                const box = child.geometry.boundingBox;
                if (!box) return;
                box.getCenter(worldPoint);
                child.localToWorld(worldPoint);
                foundMesh = true;
            });
            if (!foundMesh) {
                entity.mesh.traverse?.((child) => {
                    if (foundMesh || !child?.isMesh || !child.geometry) return;
                    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
                    const box = child.geometry.boundingBox;
                    if (!box) return;
                    box.getCenter(worldPoint);
                    child.localToWorld(worldPoint);
                    foundMesh = true;
                });
            }
            const projected = worldPoint.project(game.renderSystem.camera);
            if (projected.z < -1 || projected.z > 1) continue;
            const x = (projected.x + 1) * window.innerWidth / 2;
            const y = (-projected.y + 1) * window.innerHeight / 2;
            if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) continue;
            if (document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue;
            const distance = game.player.position.distanceTo(entity.position);
            if (!best || distance < best.distance) {
                best = {
                    id: entity.id,
                    x,
                    y,
                    distance,
                    health: entity.health ?? entity.stats?.hp,
                    maxHealth: entity.maxHealth ?? entity.stats?.maxHp,
                    level: entity.level,
                    subType: resolvedSubtype
                };
            }
        }
        return best;
    }, desiredSubtype);
}

async function readEntity(page, targetId) {
    return page.evaluate((id) => {
        const game = window.game;
        const entity = (game?.activeEntitiesCache || []).find((candidate) => candidate.id === id) ||
            game?.remotePlayers?.get?.(id);
        return entity ? {
            id: entity.id,
            health: entity.health ?? entity.stats?.hp,
            maxHealth: entity.maxHealth ?? entity.stats?.maxHp,
            level: entity.level,
            subType: entity.subType || entity.constructor?.name,
            state: entity.state,
            isActive: entity.isActive,
            x: entity.position?.x,
            z: entity.position?.z
        } : null;
    }, targetId);
}

export async function projectEntity(page, targetId) {
    return page.evaluate((id) => {
        const game = window.game;
        const entity = (game?.activeEntitiesCache || []).find((candidate) => candidate.id === id) ||
            game?.remotePlayers?.get?.(id);
        if (!entity?.position || !game?.renderSystem?.camera) return null;
        const worldPoint = entity.position.clone();
        let foundMesh = false;
        entity.mesh?.updateWorldMatrix?.(true, true);
        entity.mesh?.traverse?.((child) => {
            if (foundMesh || child?.userData?.entityId !== entity.id || !child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
            const box = child.geometry.boundingBox;
            if (!box) return;
            box.getCenter(worldPoint);
            child.localToWorld(worldPoint);
            foundMesh = true;
        });
        if (!foundMesh) {
            entity.mesh?.traverse?.((child) => {
                if (foundMesh || !child?.isMesh || !child.geometry) return;
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
                const box = child.geometry.boundingBox;
                if (!box) return;
                box.getCenter(worldPoint);
                child.localToWorld(worldPoint);
                foundMesh = true;
            });
        }
        const projected = worldPoint.project(game.renderSystem.camera);
        const x = (projected.x + 1) * window.innerWidth / 2;
        const y = (-projected.y + 1) * window.innerHeight / 2;
        return {
            x,
            y,
            visible: projected.z >= -1 && projected.z <= 1 &&
                projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1 &&
                document.elementFromPoint(x, y)?.tagName === 'CANVAS'
        };
    }, targetId);
}

async function projectNearestLoot(page) {
    return page.evaluate(() => {
        const game = window.game;
        if (!game?.player || !game.renderSystem?.camera) return null;
        let best = null;
        const entities = new Map();
        for (const entity of game.activeEntitiesCache || []) entities.set(entity.id, entity);
        for (const entity of game.remotePlayers?.values?.() || []) entities.set(entity.id, entity);
        for (const entity of entities.values()) {
            if (!entity?.isActive || entity.constructor?.name !== 'LootDrop') continue;
            const projected = entity.position.clone().project(game.renderSystem.camera);
            const x = (projected.x + 1) * window.innerWidth / 2;
            const y = (-projected.y + 1) * window.innerHeight / 2;
            const distance = game.player.position.distanceTo(entity.position);
            const visible = projected.z >= -1 && projected.z <= 1 &&
                x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight &&
                document.elementFromPoint(x, y)?.tagName === 'CANVAS';
            if (!best || distance < best.distance) {
                best = {
                    id: entity.id,
                    x,
                    y,
                    distance,
                    visible,
                    deltaX: entity.position.x - game.player.position.x,
                    deltaZ: entity.position.z - game.player.position.z
                };
            }
        }
        return best;
    });
}

async function openSettingsThroughEscape(page) {
    const escMenu = page.locator('#esc-menu');
    for (let attempt = 0; attempt < 3 && !await escMenu.isVisible(); attempt += 1) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
    }
    await expect(escMenu).toBeVisible();
    await page.locator('#btn-settings').click();
    await expect(page.locator('#settings-screen')).toBeVisible();
    return escMenu;
}

async function closeSettingsAndResume(page, escMenu) {
    await page.locator('#btn-close-settings').click();
    await expect(page.locator('#settings-screen')).toBeHidden();
    // Chat remains visible while Escape closes the menu layer.
    for (let attempt = 0; attempt < 4 && await escMenu.isVisible(); attempt += 1) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
    }
    await expect(escMenu).toBeHidden();
}

export async function selectGraphicsThroughSettings(page, graphicsQuality) {
    expect(['low', 'medium', 'high']).toContain(graphicsQuality);
    const escMenu = await openSettingsThroughEscape(page);
    const quality = page.locator('#graphics-quality');
    await expect(quality).toBeVisible();
    await quality.selectOption(graphicsQuality);
    await expect(quality).toHaveValue(graphicsQuality);
    await closeSettingsAndResume(page, escMenu);
}

export async function selectLowGraphicsThroughSettings(page) {
    await selectGraphicsThroughSettings(page, 'low');
}

async function disableAutoLootThroughSettings(page) {
    const escMenu = await openSettingsThroughEscape(page);
    const quality = page.locator('#graphics-quality');
    await expect(quality).toBeVisible();
    await quality.selectOption('low');
    await expect(quality).toHaveValue('low');
    const autoLootToggle = page.locator('#auto-loot-enabled');
    await expect(autoLootToggle).toBeVisible();
    if (await autoLootToggle.isChecked()) {
        await autoLootToggle.click();
    }
    await expect(autoLootToggle).not.toBeChecked();
    await closeSettingsAndResume(page, escMenu);
}

async function findAndApproachLoot(page, inventoryBefore) {
    const immediateState = await readPlayerState(page);
    if (immediateState.inventoryCount > inventoryBefore) {
        expect(await page.locator('#auto-loot-enabled').isChecked()).toBe(false);
        return { alreadyPickedUp: true };
    }

    let loot = null;
    try {
        await expect.poll(async () => {
            loot = await projectNearestLoot(page);
            return Boolean(loot);
        }, { timeout: 15_000 }).toBe(true);
    } catch {
        const diagnostic = await page.evaluate(() => {
            const game = window.game;
            const typeCounts = {};
            for (const entity of game?.remotePlayers?.values?.() || []) {
                const type = entity.constructor?.name || entity.subType || 'unknown';
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            }
            return {
                inventoryCount: (game?.player?.inventory || []).filter((item) => item?.id).length,
                autoLootEnabled: game?.autoLootEnabled,
                remoteTypeCounts: typeCounts,
                creationQueueCount: game?.entityCreationQueue?.length || 0,
                pendingEntityCount: game?.pendingEntityIds?.size || 0
            };
        });
        if (diagnostic.inventoryCount > inventoryBefore && diagnostic.autoLootEnabled === false) {
            return { alreadyPickedUp: true };
        }
        throw new Error(`Guaranteed QA kill produced no manual loot result: ${JSON.stringify(diagnostic)}`);
    }

    for (let step = 0; !loot.visible && step < 20; step += 1) {
        const distance = Math.hypot(loot.deltaX, loot.deltaZ) || 1;
        await moveByGroundClick(
            page,
            loot.deltaX / distance * Math.min(30, distance),
            loot.deltaZ / distance * Math.min(30, distance)
        );
        loot = await projectNearestLoot(page);
        if (!loot) break;
    }
    expect(loot?.visible, 'The browser must walk until the guaranteed loot hitbox is on canvas').toBe(true);
    return loot;
}

export async function findOverworldTarget(page) {
    // Spawn sits among randomized town props. Cross the fixed east gate with
    // real Ctrl-click jumps and prove directional authoritative movement,
    // rather than treating any sideways collision response as progress.
    for (let exitStep = 0; (await readPlayerState(page)).x < 115 && exitStep < 20; exitStep += 1) {
        const state = await readPlayerState(page);
        await jumpByGroundClick(page, 30, Math.max(-8, Math.min(8, 200 - state.z)));
    }
    expect((await readPlayerState(page)).x, 'The character must clear the east town fence').toBeGreaterThanOrEqual(115);

    // Prefer the low-level Skeleton population, but do not make production QA
    // depend on one randomized subtype being alive and on-camera. Every caller
    // needs a real raycastable hostile, and the adjacent overworld sectors can
    // legitimately make another hostile the nearest visible encounter.
    const projectPreferredHostile = async () =>
        await projectNearestHostile(page, 'Skeleton') || await projectNearestHostile(page);
    let target = await projectPreferredHostile();
    if (!target) {
        // Enemy spawns are deliberately randomized over a large sector. Ask
        // the allowlisted server command to place this QA character near the
        // live enemy closest to the fixed combat anchor; the enemy remains a
        // normal authoritative world entity and all acquisition stays real UI.
        await useEncounterQAWaypoint(page);
        target = await projectPreferredHostile();
    }
    for (let attempt = 0; !target && attempt < 12; attempt += 1) {
        const navigation = await page.evaluate(() => {
            const game = window.game;
            const entities = new Map();
            for (const entity of game?.activeEntitiesCache || []) entities.set(entity.id, entity);
            for (const entity of game?.remotePlayers?.values?.() || []) entities.set(entity.id, entity);
            const hostiles = [...entities.values()]
                .filter((entity) => entity?.isActive &&
                    entity.state !== 'DEAD' &&
                    game.isHostileActorTarget?.(entity) && entity.position);
            const nearest = hostiles.sort((first, second) =>
                game.player.position.distanceTo(first.position) - game.player.position.distanceTo(second.position)
            )[0];
            if (!nearest) {
                const playerX = game?.player?.position?.x || 0;
                const playerZ = game?.player?.position?.z || 200;
                if (playerX < 120) {
                    return {
                        deltaX: 30,
                        deltaZ: Math.max(-10, Math.min(10, 200 - playerZ)),
                        hasTarget: false
                    };
                }
                return { deltaX: 0, deltaZ: -30, hasTarget: false };
            }
            const deltaX = nearest.position.x - game.player.position.x;
            const deltaZ = nearest.position.z - game.player.position.z;
            const distance = Math.hypot(deltaX, deltaZ) || 1;
            return {
                deltaX: deltaX / distance * Math.min(30, distance),
                deltaZ: deltaZ / distance * Math.min(30, distance),
                hasTarget: true
            };
        });
        try {
            await moveByGroundClick(page, navigation.deltaX, navigation.deltaZ);
        } catch {
            continue;
        }
        target = await projectPreferredHostile();
    }
    if (!target) {
        const diagnostic = await page.evaluate(() => {
            const game = window.game;
            const counts = {};
            const activeCounts = {};
            for (const entity of game?.remotePlayers?.values?.() || []) {
                counts[entity.subType || entity.constructor?.name || 'unknown'] =
                    (counts[entity.subType || entity.constructor?.name || 'unknown'] || 0) + 1;
            }
            for (const entity of game?.activeEntitiesCache || []) {
                activeCounts[entity.subType || entity.constructor?.name || 'unknown'] =
                    (activeCounts[entity.subType || entity.constructor?.name || 'unknown'] || 0) + 1;
            }
            const nearestHostiles = [...(game?.remotePlayers?.values?.() || [])]
                .filter((entity) => entity?.isActive &&
                    game.isHostileActorTarget?.(entity))
                .map((entity) => {
                    const projected = entity.position.clone().project(game.renderSystem.camera);
                    return {
                        subType: entity.subType || entity.constructor?.name,
                        distance: game.player.position.distanceTo(entity.position),
                        active: (game.activeEntitiesCache || []).includes(entity),
                        state: entity.state,
                        hostile: game.isHostileActorTarget?.(entity),
                        mesh: Boolean(entity.mesh),
                        ndcX: projected.x,
                        ndcY: projected.y,
                        ndcZ: projected.z
                    };
                })
                .sort((first, second) => first.distance - second.distance)
                .slice(0, 5);
            return {
                x: game?.player?.position?.x,
                z: game?.player?.position?.z,
                remoteCounts: counts,
                activeCounts,
                activeCount: game?.activeEntitiesCache?.length || 0,
                cameraTargetX: game?.renderSystem?.cameraTarget?.x,
                cameraTargetZ: game?.renderSystem?.cameraTarget?.z,
                nearestHostiles
            };
        });
        throw new Error(`No visible hostile after bounded east-gate navigation: ${JSON.stringify(diagnostic)}`);
    }
    return target;
}

export async function useCombatQAWaypoint(page) {
    const chatInput = page.locator('#chat-input');
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const chatIsFocused = await chatInput.evaluate((element) => element === document.activeElement);
        if (!chatIsFocused) await page.keyboard.press('Enter');
        await expect(chatInput).toBeFocused();
        await chatInput.fill('/qa-waypoint combat');
        await chatInput.press('Enter');
        // Releases before the propagation fix immediately refocus chat through
        // the global Enter listener. Escape is the visible user recovery path
        // and becomes unnecessary once the fixed client is deployed.
        if (await chatInput.evaluate((element) => element === document.activeElement)) {
            await page.keyboard.press('Escape');
        }
        await expect(chatInput).not.toBeFocused();
        try {
            await expect.poll(async () => {
                const state = await readPlayerState(page);
                return Math.hypot(state.x - 120, state.z - 200);
            }, { timeout: 30_000 }).toBeLessThan(3);
            await expect(page.locator('#chat-box')).toBeVisible();
            // The fixed waypoint intentionally rejects movement for one second
            // so packets queued at the pre-teleport position cannot undo the
            // authoritative handoff. Do not let the next real click appear to
            // move only in local prediction while the server correctly drops it.
            await page.waitForTimeout(1_100);
            return;
        } catch (error) {
            lastError = error;
        }
    }
    const diagnostic = await page.evaluate(() => {
        const queue = window.game?.network?.messageQueue || [];
        const queuedTypes = {};
        for (const message of queue) {
            const type = message?.type || 'unknown';
            queuedTypes[type] = (queuedTypes[type] || 0) + 1;
        }
        return {
            socketState: window.game?.network?.socket?.readyState ?? null,
            queuedMessages: queue.length,
            queuedTypes,
            frameCount: window.game?.frameCount ?? null,
            x: window.game?.player?.position?.x ?? null,
            z: window.game?.player?.position?.z ?? null,
            waypointConfirmationVisible: [...document.querySelectorAll('#chat-messages > *')]
                .some((element) => element.textContent?.includes('QA waypoint set outside the east town gate'))
        };
    });
    throw new Error(`The QA combat waypoint did not settle after a visible resend: ${JSON.stringify(diagnostic)}`, {
        cause: lastError
    });
}

const LIVE_HAZARD_QA_ROUTES = Object.freeze([
    Object.freeze({ destination: 'earth', id: 'hazard-sandstorm-0', type: 'sandstorm', x: -800, z: -450, radius: 10 }),
    Object.freeze({ destination: 'water', id: 'hazard-lightning-0', type: 'lightning_zone', x: -50, z: -750, radius: 7 }),
    Object.freeze({ destination: 'fire', id: 'hazard-lava-0', type: 'lava_pool', x: -1150, z: 100, radius: 6 }),
    Object.freeze({ destination: 'air', id: 'hazard-wind-0', type: 'wind_gust', x: 1150, z: 100, radius: 6 })
]);

async function submitVisibleQACommand(page, command) {
    const chatInput = page.locator('#chat-input');
    if (!await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Enter');
    }
    await expect(chatInput).toBeFocused();
    await chatInput.fill(command);
    await chatInput.press('Enter');
    if (await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Escape');
    }
    await expect(chatInput).not.toBeFocused();
}

async function readLiveHazardMetrics(page, route) {
    return page.evaluate(({ id }) => {
        const game = window.game;
        const hazard = game?.hazards?.get?.(id);
        if (!hazard) return { catalogSize: game?.hazards?.size ?? 0, found: false };
        return {
            catalogSize: game.hazards.size,
            found: true,
            type: hazard.hazardType,
            radius: hazard.radius,
            boundaryRadius: hazard.boundaryMesh?.geometry?.boundingSphere?.radius ?? null,
            gameplayRadius: hazard.boundaryMesh?.userData?.gameplayRadius ?? null,
            x: hazard.position?.x ?? null,
            z: hazard.position?.z ?? null,
            attachedMeshes: hazard.meshes.filter((mesh) => Boolean(mesh.parent)).length,
            meshCount: hazard.meshes.length,
            matchingIds: [...game.hazards.keys()].filter((hazardId) => hazardId === id).length
        };
    }, route);
}

export async function exerciseAreaHazards(page) {
    await page.evaluate(() => {
        const game = window.game;
        window.__qaHazardDamageEvents = [];
        if (!game || game.__qaHazardMessageWrapped) return;
        const originalHandleServerMessage = game.handleServerMessage.bind(game);
        game.handleServerMessage = (message) => {
            if (message?.type === 'damage'
                && message.payload?.targetId === game.player?.id
                && String(message.payload?.sourceId || '').startsWith('hazard-')) {
                window.__qaHazardDamageEvents.push({ ...message.payload });
            }
            return originalHandleServerMessage(message);
        };
        game.__qaHazardMessageWrapped = true;
    });

    for (const route of LIVE_HAZARD_QA_ROUTES) {
        await page.evaluate(() => { window.__qaHazardDamageEvents = []; });
        await submitVisibleQACommand(page, `/qa-hazard ${route.destination}`);

        await expect.poll(async () => {
            const state = await readPlayerState(page);
            return Math.hypot(state.x - route.x, state.z - route.z);
        }, {
            message: `${route.destination} QA hazard waypoint must reach its canonical center`,
            timeout: 30_000
        }).toBeLessThan(0.1);

        await expect.poll(async () => {
            const metrics = await readLiveHazardMetrics(page, route);
            return metrics.found;
        }, {
            message: `${route.destination} canonical hazard must finish loading in the interest-managed scene`,
            timeout: 30_000
        }).toBe(true);

        const metrics = await readLiveHazardMetrics(page, route);
        expect(metrics.catalogSize).toBeGreaterThan(0);
        expect(metrics.type).toBe(route.type);
        expect(metrics.radius).toBeCloseTo(route.radius, 5);
        expect(metrics.boundaryRadius).toBeCloseTo(route.radius, 5);
        expect(metrics.gameplayRadius).toBeCloseTo(route.radius, 5);
        expect(metrics.x).toBeCloseTo(route.x, 5);
        expect(metrics.z).toBeCloseTo(route.z, 5);
        expect(metrics.attachedMeshes).toBe(metrics.meshCount);
        expect(metrics.meshCount).toBeGreaterThan(1);
        expect(metrics.matchingIds).toBe(1);

        await expect.poll(() => page.evaluate(({ id, type }) => (
            window.__qaHazardDamageEvents.some((event) => event.sourceId === id && event.kind === type && event.amount > 0)
        ), route), {
            message: `${route.destination} hazard must deal normal authoritative damage`,
            timeout: 15_000
        }).toBe(true);

        await expect(page.locator('#chat-box')).toBeVisible();
    }

    await submitVisibleQACommand(page, '/qa-hazard town');
    await expect.poll(async () => {
        const state = await readPlayerState(page);
        return Math.hypot(state.x + 1.25, state.z - 200);
    }, { timeout: 30_000 }).toBeLessThan(0.1);
    await page.evaluate(() => { window.__qaHazardDamageEvents = []; });
    await page.waitForTimeout(1_250);
    expect(await page.evaluate(() => window.__qaHazardDamageEvents)).toEqual([]);
    await expect(page.locator('#chat-box')).toBeVisible();
}

export async function useEncounterQAWaypoint(page) {
    const chatInput = page.locator('#chat-input');
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!await chatInput.evaluate((element) => element === document.activeElement)) {
            await page.keyboard.press('Enter');
        }
        await expect(chatInput).toBeFocused();
        await chatInput.fill('/qa-waypoint encounter');
        await chatInput.press('Enter');
        if (await chatInput.evaluate((element) => element === document.activeElement)) {
            await page.keyboard.press('Escape');
        }
        await expect(chatInput).not.toBeFocused();
        try {
            await expect.poll(() => page.evaluate(() => {
                const game = window.game;
                if (!game?.player?.position) return Infinity;
                let nearest = Infinity;
                for (const entity of game.activeEntitiesCache || []) {
                    if (!entity?.isActive || entity.state === 'DEAD' ||
                        !game.isHostileActorTarget?.(entity) || !entity.position) continue;
                    nearest = Math.min(nearest, game.player.position.distanceTo(entity.position));
                }
                return nearest;
            }), { timeout: 30_000 }).toBeLessThan(12);
            await expect(page.locator('#chat-box')).toBeVisible();
            await page.waitForTimeout(1_100);
            return;
        } catch (error) {
            lastError = error;
        }
    }
    const diagnostic = await page.evaluate(() => ({
        x: window.game?.player?.position?.x ?? null,
        z: window.game?.player?.position?.z ?? null,
        state: window.game?.player?.state ?? null,
        confirmationVisible: [...document.querySelectorAll('#chat-messages > *')]
            .some((element) => element.textContent?.includes('near a live overworld encounter')),
        activeHostiles: (window.game?.activeEntitiesCache || []).filter((entity) =>
            entity?.isActive && entity.state !== 'DEAD' && window.game?.isHostileActorTarget?.(entity)
        ).length
    }));
    throw new Error(`The QA encounter waypoint did not settle near a live hostile: ${JSON.stringify(diagnostic)}`, {
        cause: lastError
    });
}

async function readCombatDiagnostic(page, targetId) {
    return page.evaluate((id) => {
        const game = window.game;
        const player = game?.player;
        const target = (game?.activeEntitiesCache || []).find((candidate) => candidate.id === id) ||
            game?.remotePlayers?.get?.(id);
        return {
            player: player ? {
                level: player.level,
                health: player.health ?? player.stats?.hp,
                damage: player.stats?.damage,
                abilityCooldown: player.abilityCooldown,
                x: player.position?.x,
                z: player.position?.z
            } : null,
            target: target ? {
                subType: target.subType || target.constructor?.name,
                level: target.level,
                health: target.health ?? target.stats?.hp,
                maxHealth: target.maxHealth ?? target.stats?.maxHp,
                state: target.state,
                distance: player?.position?.distanceTo?.(target.position)
            } : null,
            pendingTarget: game?.pendingInteraction?.id === id,
            pendingAbilityTarget: game?.abilityController?.pendingAbilityTarget?.id === id
        };
    }, targetId);
}

export async function exerciseCombatAndLoot(page) {
    // Persistent production QA characters can reconnect where a previous run
    // was killed after its final assertion. Clear that legitimate gameplay
    // state through the visible respawn action before opening Settings; the
    // death overlay intentionally intercepts every menu click while active.
    await recoverThroughDeathScreen(page);

    // The persistent release account eventually fills across successful runs.
    // Rotate one equippable item through the existing sell path so this test can
    // continue proving a real loot pickup and its persistence on every deploy.
    if ((await readPlayerState(page)).inventoryCount >= 25) {
        const soldItemId = await page.evaluate(() => {
            const game = window.game;
            const equipmentSlots = new Set([
                'head', 'chest', 'legs', 'feet', 'gloves', 'shoulders',
                'belt', 'ring', 'neck', 'trinket', 'mainHand', 'offHand'
            ]);
            const index = (game?.player?.inventory || []).findIndex((item) =>
                item?.id && equipmentSlots.has(item.slot)
            );
            if (index < 0 || typeof game?.uiManager?.inventory?.onSellItem !== 'function') return null;
            const itemId = game.player.inventory[index].id;
            game.uiManager.inventory.onSellItem(index);
            return itemId;
        });
        expect(soldItemId, 'A full QA inventory must contain equipment that can be rotated').not.toBeNull();
        await expect.poll(async () => (await readPlayerState(page)).inventoryCount, {
            timeout: 15_000
        }).toBeLessThan(25);
    }

    const inventoryBefore = (await readPlayerState(page)).inventoryCount;
    let abilityWasUsed = false;

    await disableAutoLootThroughSettings(page);
    await useCombatQAWaypoint(page);

    // Prove the real right-click ability before arming the deterministic basic
    // attack kill. Otherwise /qa-loot-next can legitimately make the first
    // left-click lethal before the ability path has a chance to run.
    let abilityTarget = await findOverworldTarget(page);
    let abilityDiagnostic = null;
    for (let attempt = 0; attempt < 3 && !abilityWasUsed; attempt += 1) {
        let projection = await projectEntity(page, abilityTarget.id);
        if (!projection?.visible) {
            await useEncounterQAWaypoint(page);
            abilityTarget = await findOverworldTarget(page);
            projection = await projectEntity(page, abilityTarget.id);
        }
        if (!projection?.visible) continue;
        await page.mouse.move(projection.x, projection.y);
        await page.waitForTimeout(50);
        await page.mouse.click(projection.x, projection.y, { button: 'right' });
        try {
            await expect.poll(() => page.evaluate(() =>
                Number(window.game?.player?.abilityCooldown || 0)
            ), { timeout: 5_000, intervals: [25, 50, 100, 250] }).toBeGreaterThan(0);
            abilityWasUsed = true;
        } catch {
            abilityDiagnostic = await readCombatDiagnostic(page, abilityTarget.id);
            await useEncounterQAWaypoint(page);
            abilityTarget = await findOverworldTarget(page);
        }
    }
    if (!abilityWasUsed) {
        throw new Error(`The primary ability never entered cooldown after bounded real right-clicks: ${JSON.stringify(abilityDiagnostic)}`);
    }

    await useEncounterQAWaypoint(page);

    await page.keyboard.press('Enter');
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeFocused();
    await chatInput.fill('/qa-loot-next');
    await chatInput.press('Enter');

    for (let encounter = 0; encounter < 5; encounter += 1) {
        let target = await findOverworldTarget(page);
        expect(target, 'A visible hostile is required for the extended gameplay run').not.toBeNull();
        let observedDamage = false;

        let acquiredTargetId = null;
        for (let attempt = 0; attempt < 10 && !acquiredTargetId; attempt += 1) {
            const initialProjection = await projectEntity(page, target.id);
            if (!initialProjection?.visible) {
                await page.waitForTimeout(250);
                continue;
            }
            await page.mouse.move(initialProjection.x, initialProjection.y);
            await page.waitForTimeout(100);
            await page.mouse.click(initialProjection.x, initialProjection.y);
            await page.waitForTimeout(500);
            acquiredTargetId = await page.evaluate((targetId) => {
                const game = window.game;
                const entity = (game?.activeEntitiesCache || [])
                    .find((candidate) => candidate.id === targetId) || game?.remotePlayers?.get?.(targetId);
                const pending = game?.pendingInteraction;
                if (pending?.id && pending.isActive && pending.state !== 'DEAD' &&
                    game.isHostileActorTarget?.(pending)) {
                    return pending.id;
                }
                if (!entity || !entity.isActive || entity.state === 'DEAD' ||
                    (entity.health ?? entity.stats?.hp) <= 0) {
                    return targetId;
                }
                return null;
            }, target.id);
        }
        expect(acquiredTargetId, 'A real mouse click must acquire a hostile').not.toBeNull();
        if (acquiredTargetId !== target.id) {
            target = { ...target, id: acquiredTargetId };
        }
        const acquiredState = await readEntity(page, target.id);
        const initialHealth = acquiredState?.health ?? target.health;

        for (let attack = 0; attack < 60; attack += 1) {
            const state = await readEntity(page, target.id);
            if (!state || !state.isActive || state.state === 'DEAD' || state.health <= 0) break;
            if (state.health < initialHealth) observedDamage = true;

            const projection = await projectEntity(page, target.id);
            if (projection?.visible) {
                await page.mouse.move(projection.x, projection.y);
                await page.waitForTimeout(50);
                await page.mouse.click(projection.x, projection.y);
            }
            await page.waitForTimeout(500);
        }

        const combatResult = await readEntity(page, target.id);
        if (combatResult?.isActive && combatResult.state !== 'DEAD' && combatResult.health > 0) {
            const diagnostic = await readCombatDiagnostic(page, target.id);
            throw new Error(`Browser combat did not defeat the target: ${JSON.stringify(diagnostic)}`);
        }
        // A normal multi-hit kill must expose an intermediate health change;
        // an immediate one-shot is already proven by acquisition plus death.
        const finalTargetState = await readEntity(page, target.id);
        expect(observedDamage || !finalTargetState || finalTargetState.state === 'DEAD').toBe(true);

        const loot = await findAndApproachLoot(page, inventoryBefore);

        if (loot.alreadyPickedUp) {
            return (await readPlayerState(page)).inventoryCount;
        }

        await page.mouse.click(loot.x, loot.y);
        await expect.poll(async () => (await readPlayerState(page)).inventoryCount, {
            timeout: 20_000
        }).toBeGreaterThan(inventoryBefore);
        return (await readPlayerState(page)).inventoryCount;
    }

    throw new Error('Five overworld kills produced no loot that could be added to the QA inventory');
}

export async function ensureDungeonReadyLevel(page, level = 100) {
    const current = await readPlayerState(page);
    if (current.level >= level) return current.level;

    for (let attempt = 0; attempt < 2 && (await readPlayerState(page)).level < level; attempt += 1) {
        await page.keyboard.press('Enter');
        const chatInput = page.locator('#chat-input');
        await expect(chatInput).toBeFocused();
        await chatInput.fill(`/level ${level}`);
        await chatInput.press('Enter');
        await expect(page.locator('#chat-messages')).toContainText(`Level set to ${level}`, {
            timeout: 15_000
        });
        try {
            await expect.poll(async () => (await readPlayerState(page)).level, {
                timeout: 30_000
            }).toBe(level);
        } catch {
            // One idempotent chat resend remains a real browser input path and
            // distinguishes a lost state frame from missing QA authorization.
        }
    }
    expect((await readPlayerState(page)).level).toBe(level);
    return level;
}

async function recoverThroughDeathScreen(page) {
    const deathScreen = page.locator('#death-screen');
    if (!await deathScreen.isVisible()) return;

    await page.locator('#btn-death-respawn').click();
    await expect(deathScreen).toBeHidden({ timeout: 15_000 });
    await expect.poll(async () => (await readPlayerState(page)).state, {
        timeout: 15_000
    }).not.toBe('DEAD');
}

async function useVerdantQAWaypoint(page) {
    await recoverThroughDeathScreen(page);
    await page.keyboard.press('Enter');
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeFocused();
    await chatInput.fill('/qa-waypoint verdant');
    await chatInput.press('Enter');
    await expect.poll(async () => {
        const state = await readPlayerState(page);
        return Math.hypot(state.x - 800, state.z - 200);
    }, { timeout: 30_000 }).toBeLessThan(3);
    await expect(page.locator('#chat-box')).toBeVisible();
}

async function zoomOutForPortal(page) {
    const startingZoom = await page.evaluate(() => window.game?.renderSystem?.currentZoom);
    for (let step = 0; step < 30; step += 1) {
        const canvasPoint = await page.evaluate(() => {
            const canvas = window.game?.renderSystem?.renderer?.domElement;
            if (!canvas) return null;
            for (let yStep = 1; yStep < 20; yStep += 1) {
                for (let xStep = 1; xStep < 20; xStep += 1) {
                    const x = window.innerWidth * xStep / 20;
                    const y = window.innerHeight * yStep / 20;
                    if (document.elementFromPoint(x, y) === canvas) return { x, y };
                }
            }
            return null;
        });
        if (!canvasPoint) {
            const diagnostic = await page.evaluate(() => {
                const game = window.game;
                const center = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
                return {
                    playerState: game?.player?.state,
                    health: game?.player?.health ?? game?.player?.stats?.hp,
                    escMenuOpen: game?.uiManager?.isEscMenuOpen,
                    deathScreenVisible: game?.uiManager?.deathScreen?.style?.display !== 'none',
                    centerElement: center?.id || center?.className || center?.tagName,
                    settingsDisplay: game?.uiManager?.settingsScreen?.style?.display,
                    dungeonMenuDisplay: game?.uiManager?.dungeonMenu?.style?.display
                };
            });
            throw new Error(`No unobscured canvas point for real wheel input: ${JSON.stringify(diagnostic)}`);
        }
        await page.mouse.move(canvasPoint.x, canvasPoint.y);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(100);
        if (await page.evaluate(() => window.game?.renderSystem?.currentZoom >= 30)) break;
    }
    expect(await page.evaluate(() => window.game?.renderSystem?.currentZoom)).toBeGreaterThan(startingZoom);
}

async function projectVerdantEntrance(page) {
    return page.evaluate(() => {
        const game = window.game;
        let entrance = null;
        game?.renderSystem?.environmentGroup?.traverse((object) => {
            if (!entrance && object.name === 'DungeonEntrance' && object.userData?.dungeonType === 'verdant_bastion_catacombs') {
                object.updateWorldMatrix?.(true, true);
                let bestMeshProjection = null;
                object.traverse?.((child) => {
                    if (!child?.visible || !child.isMesh || !child.geometry) return;
                    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox?.();
                    const box = child.geometry.boundingBox;
                    if (!box) return;
                    const worldPoint = object.position.clone();
                    box.getCenter(worldPoint);
                    child.localToWorld(worldPoint);
                    const projected = worldPoint.project(game.renderSystem.camera);
                    const visible = projected.z >= -1 && projected.z <= 1 &&
                        projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1;
                    if (!visible) return;
                    const score = projected.x * projected.x + projected.y * projected.y;
                    if (!bestMeshProjection || score < bestMeshProjection.score) {
                        bestMeshProjection = { projected, score };
                    }
                });
                const projected = bestMeshProjection?.projected ||
                    object.getWorldPosition(object.position.clone()).project(game.renderSystem.camera);
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
    await useVerdantQAWaypoint(page);
    await zoomOutForPortal(page);

    let entered = false;
    for (let attempt = 0; attempt < 3 && !entered; attempt += 1) {
        let entrance = null;
        await expect.poll(async () => {
            entrance = await projectVerdantEntrance(page);
            return Boolean(entrance?.visible);
        }, { timeout: 15_000 }).toBe(true);
        expect(entrance, 'Verdant Bastion entrance must be loaded').not.toBeNull();
        await page.mouse.move(entrance.x, entrance.y);
        await page.mouse.click(entrance.x, entrance.y);

        const menu = page.locator('#dungeon-menu');
        await expect(menu).toBeVisible({ timeout: 20_000 });
        await page.locator('#diff-btn-normal').click();
        const runLevel = page.locator('#dungeon-run-level-select');
        if (await runLevel.locator('option[value="30"]').count()) {
            await runLevel.selectOption('30');
        }
        const enterButton = page.locator('#btn-enter-dungeon');
        await expect(enterButton).toBeEnabled();
        await enterButton.click();
        await expect(menu).toBeHidden();

        try {
            await expect.poll(async () => (await readPlayerState(page)).instanceType, {
                timeout: 45_000
            }).toBe('verdant_bastion_catacombs');
            entered = true;
        } catch {
            // Reopening the same real portal is idempotent: if the first click
            // created a party run but its response was lost, the next menu
            // continues it; otherwise it retries the visible user path.
        }
    }

    if (!entered) {
        const diagnostic = await page.evaluate(() => ({
            instanceType: window.game?.currentInstanceType || 'overworld',
            hasParty: Boolean(window.game?.player?.partyId),
            socketOpen: window.game?.network?.socket?.readyState === WebSocket.OPEN,
            playerState: window.game?.player?.state,
            deathScreenVisible: window.game?.uiManager?.deathScreen?.style?.display !== 'none'
        }));
        throw new Error(`Real dungeon entry did not transition instances: ${JSON.stringify(diagnostic)}`);
    }

    await page.keyboard.press('b');
    await expect.poll(async () => (await readPlayerState(page)).instanceType, {
        timeout: 30_000
    }).toBe('overworld');
    // Instance type changes at the start of the asynchronous scene transition.
    // Do not accept that alone as proof recall reached the starting city.
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return Boolean(game?.player && !game.currentInstanceId && !game.currentDungeonLayout
            && Math.hypot(game.player.position.x + 1.25, game.player.position.z - 200) < 3
            && game.collisionManager.dungeonWalkableRects.length === 0
            && game.renderSystem.instanceEnvironmentGroup.children.some(child => child.name === 'DungeonEntrance'));
    }), { timeout: 30_000, message: 'recall must finish town scenery, collision and authoritative-position recovery' }).toBe(true);
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
        (!(window.game?.activeEntitiesCache || []).some(({ id }) => id === targetId) &&
            !window.game?.remotePlayers?.has?.(targetId)), target.id
    ), { timeout: 15_000 }).toBe(true);
}

export function credentialsFromEnvironment(suffix = '') {
    return {
        username: process.env[`EIDOLON_E2E_USERNAME${suffix}`] || '',
        password: process.env[`EIDOLON_E2E_PASSWORD${suffix}`] || '',
        characterClass: process.env[`EIDOLON_E2E_CLASS${suffix}`] || 'Wizard'
    };
}
