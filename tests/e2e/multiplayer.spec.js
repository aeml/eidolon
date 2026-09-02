import { expect, test } from '@playwright/test';
import { CONSTANTS } from '../../src/core/Constants.js';
import {
    backendOriginBrowserArgs,
    hardwareWebGLBrowserArgs
} from './browserLaunchPolicy.js';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    ensureDungeonReadyLevel,
    findOverworldTarget,
    loginAndEnterWorld,
    moveByGroundClick,
    projectEntity,
    projectGroundOffset,
    selectLowGraphicsThroughSettings,
    useCombatQAWaypoint
} from './helpers.js';

const primary = credentialsFromEnvironment();
const secondary = credentialsFromEnvironment('_SECONDARY');
const hasTwoAccounts = Boolean(
    primary.username && primary.password && secondary.username && secondary.password
);

async function pressBodyKey(page, key) {
    await page.locator('body').press(key, { timeout: 20_000 });
}

async function dismissChatIfVisible(page) {
    const chatBox = page.locator('#chat-box');
    for (let attempt = 0; attempt < 4 && await chatBox.isVisible(); attempt += 1) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
    }
    await expect(chatBox).toBeHidden();
}

async function closeSocialWindow(page) {
    await dismissChatIfVisible(page);
    const socialWindow = page.locator('#social-window');
    if (await socialWindow.isVisible()) await pressBodyKey(page, 'Escape');
    await expect(socialWindow).toBeHidden();
}

async function leavePartyIfPresent(page) {
    const inParty = () => page.evaluate(() => Boolean(
        window.game?.socialController?.myPartyId ||
        window.game?.uiManager?.social?.inParty
    ));
    if (!await inParty()) return;
    await dismissChatIfVisible(page);
    await pressBodyKey(page, 'o');
    await expect(page.locator('#social-window')).toBeVisible();
    await page.locator('#btn-leave-party').click();
    await expect.poll(inParty, { timeout: 20_000 }).toBe(false);
    await closeSocialWindow(page);
}

async function prepareAnimationCast(page, persistent = false) {
    const sequence = await page.evaluate(() => window.game?.animationQAReadySequence || 0);
    const chatInput = page.locator('#chat-input');
    if (!await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Enter');
    }
    await expect(chatInput).toBeFocused();
    await chatInput.fill(`/qa-animation-ready${persistent ? ' persistent' : ''}`);
    await chatInput.press('Enter');
    await expect(page.locator('#chat-messages')).toContainText(
        persistent
            ? 'Animation QA readiness restored for persistent-effect reconstruction.'
            : 'Animation QA readiness restored.', {
        timeout: 20_000
        });
    if (await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Escape');
    }
    await dismissChatIfVisible(page);
    await expect.poll(() => page.evaluate(() => window.game?.animationQAReadySequence || 0), {
        timeout: 20_000
    }).toBeGreaterThan(sequence);
}

async function selectBranch(page, className, branch) {
    const expectedSkills = [2, 3, 4, 5].map((tier) =>
        CONSTANTS.SKILL_TREES[className][`Branch${branch}`][`Tier${tier}`].name
    );
    const current = await page.evaluate(() => ({
        branch: window.game?.player?.selectedBranch,
        hotbar: window.game?.player?.hotbar || []
    }));
    if (current.branch === branch && expectedSkills.every((skill, index) => current.hotbar[index] === skill)) {
        return expectedSkills;
    }

    await dismissChatIfVisible(page);
    await pressBodyKey(page, 'k');
    const skillWindow = page.locator('#skill-tree-window');
    await expect(skillWindow).toBeVisible();
    await skillWindow.getByRole('button', { name: 'Skills', exact: true }).click();
    const branchCard = page.locator('.skill-branch').nth(['A', 'B', 'C'].indexOf(branch));
    const selectButton = branchCard.getByRole('button', { name: 'Select Spec' });
    if (await selectButton.count()) await selectButton.click();
    await expect.poll(() => page.evaluate(() => window.game?.player?.selectedBranch), {
        timeout: 20_000
    }).toBe(branch);
    await expect.poll(() => page.evaluate(() => window.game?.player?.hotbar || []), {
        timeout: 20_000
    }).toEqual(expectedSkills);
    await pressBodyKey(page, 'Escape');
    await expect(skillWindow).toBeHidden();
    return expectedSkills;
}

async function remotePlayerSnapshot(page, username) {
    return page.evaluate((remoteUsername) => {
        const game = window.game;
        const entity = [...(game?.remotePlayers?.values?.() || [])]
            .find((candidate) => candidate?.name === remoteUsername);
        if (!entity) return null;
        const spiritGroups = game?.renderSystem?.effectGroup?.children?.filter?.((child) =>
            child?.userData?.effectType === 'spirit_guardians' &&
            child?.userData?.ownerId === entity.id
        ) || [];
        return {
            id: entity.id,
            partyId: entity.partyId,
            state: entity.state,
            currentAnimation: entity.currentAnimationName || null,
            meshReady: Boolean(entity.mesh),
            meshLoading: Boolean(entity.isMeshLoading),
            animationClips: Object.keys(entity.animations || {}),
            assetFallback: Boolean(entity.mesh?.userData?.assetFallback),
            jumpProgress: entity.jumpProgress,
            x: entity.position?.x,
            z: entity.position?.z,
            renderX: entity.mesh?.position?.x,
            renderZ: entity.mesh?.position?.z,
            movementBuffer: entity.remoteTransformBuffer?.getMetrics?.() || null,
            lastAbility: entity.lastRemoteAbilityPresentation || null,
            spiritsActive: Boolean(entity.spiritsActive),
            spiritBoosted: Boolean(entity.spiritBoosted),
            spiritDuration: Number(entity.spiritDuration || 0),
            guardianCount: entity.spiritEffect?.guardians?.length || 0,
            spiritGroupCount: spiritGroups.length,
            spiritEffectRadius: entity.spiritEffect?.effectRadius ?? null,
            spiritRingRadius: entity.spiritEffect?.pulseRing?.geometry?.parameters?.outerRadius ?? null,
            spiritFollowDistance: entity.spiritEffect?.group?.position?.distanceTo?.(
                entity.mesh?.position || entity.position
            ) ?? null
        };
    }, username);
}

async function sampleRemoteMovement(page, username, durationMs = 4_000) {
    return page.evaluate(({ remoteUsername, duration }) => new Promise((resolve) => {
        const frames = [];
        const startedAt = performance.now();
        const initialEntity = [...(window.game?.remotePlayers?.values?.() || [])]
            .find((candidate) => candidate?.name === remoteUsername);
        const initialBuffer = initialEntity?.remoteTransformBuffer || null;
        const initialMetrics = initialBuffer?.getMetrics?.() || null;
        const capture = (now) => {
            const game = window.game;
            const entity = [...(game?.remotePlayers?.values?.() || [])]
                .find((candidate) => candidate?.name === remoteUsername);
            if (entity?.position && entity.mesh?.position) {
                frames.push({
                    t: now - startedAt,
                    x: entity.position.x,
                    z: entity.position.z,
                    renderX: entity.mesh.position.x,
                    renderZ: entity.mesh.position.z,
                    visualOffsetX: entity.visualOffset?.x || 0,
                    visualOffsetZ: entity.visualOffset?.z || 0,
                    state: entity.state,
                    animation: entity.currentAnimationName || null
                });
            }
            if (now - startedAt >= duration) {
                const metrics = entity?.remoteTransformBuffer?.getMetrics?.() || null;
                resolve({
                    frames,
                    metrics,
                    sameBuffer: Boolean(initialBuffer && entity?.remoteTransformBuffer === initialBuffer),
                    metricDelta: initialMetrics && metrics ? {
                        accepted: metrics.accepted - initialMetrics.accepted,
                        interpolated: metrics.interpolated - initialMetrics.interpolated,
                        extrapolated: metrics.extrapolated - initialMetrics.extrapolated
                    } : null
                });
                return;
            }
            requestAnimationFrame(capture);
        };
        requestAnimationFrame(capture);
    }), { remoteUsername: username, duration: durationMs });
}

function analyzeRemoteMovement(frames) {
    expect(frames.length).toBeGreaterThan(10);
    const first = frames[0];
    const last = frames.at(-1);
    const directionX = last.renderX - first.renderX;
    const directionZ = last.renderZ - first.renderZ;
    const magnitude = Math.hypot(directionX, directionZ);
    expect(magnitude).toBeGreaterThan(0.25);
    const unitX = directionX / magnitude;
    const unitZ = directionZ / magnitude;
    let previousProgress = 0;
    let largestBacktrack = 0;
    let largestStep = 0;
    let maxRenderLogicalGap = 0;
    const uniqueRenderPositions = new Set();

    for (const [index, frame] of frames.entries()) {
        const progress = (frame.renderX - first.renderX) * unitX +
            (frame.renderZ - first.renderZ) * unitZ;
        if (index > 0) {
            largestBacktrack = Math.min(largestBacktrack, progress - previousProgress);
            largestStep = Math.max(
                largestStep,
                Math.hypot(frame.renderX - frames[index - 1].renderX, frame.renderZ - frames[index - 1].renderZ)
            );
        }
        previousProgress = progress;
        maxRenderLogicalGap = Math.max(
            maxRenderLogicalGap,
            Math.hypot(
                frame.renderX - (frame.x + frame.visualOffsetX),
                frame.renderZ - (frame.z + frame.visualOffsetZ)
            )
        );
        uniqueRenderPositions.add(`${frame.renderX.toFixed(3)},${frame.renderZ.toFixed(3)}`);
    }

    return {
        travel: magnitude,
        largestBacktrack,
        largestStep,
        maxRenderLogicalGap,
        uniqueRenderPositions: uniqueRenderPositions.size
    };
}

async function castAndObserveRemote(
    sourcePage,
    observerPage,
    sourceUsername,
    skillName,
    key,
    { persistent = false } = {}
) {
    await prepareAnimationCast(sourcePage, persistent);
    let target = null;
    await expect.poll(async () => {
        target = await projectGroundOffset(sourcePage, 6, 2);
        return Boolean(target?.canvas);
    }, { timeout: 8_000 }).toBe(true);
    const previous = (await remotePlayerSnapshot(observerPage, sourceUsername))?.lastAbility?.timestamp || -1;
    await sourcePage.mouse.move(target.x, target.y);
    if (key === 'right') {
        await sourcePage.mouse.click(target.x, target.y, { button: 'right' });
    } else {
        await sourcePage.keyboard.press(key);
    }
    await observerPage.bringToFront();
    await Promise.all([
        expect.poll(async () => {
            const presentation = (await remotePlayerSnapshot(observerPage, sourceUsername))?.lastAbility;
            return Boolean(presentation?.skillName === skillName && presentation.timestamp > previous);
        }, {
            message: `${skillName} must play through the remote production VFX route`,
            timeout: 15_000,
            intervals: [25, 50, 100, 250]
        }).toBe(true),
        expect.poll(async () =>
            (await remotePlayerSnapshot(observerPage, sourceUsername))?.currentAnimation || null,
        {
            message: `${skillName} must retain an animated remote actor after on-demand mesh loading`,
            timeout: 30_000,
            intervals: [25, 50, 100, 250]
        }).toMatch(/^(Attack|Run|Walk|Idle)$/)
    ]);
    const snapshot = await remotePlayerSnapshot(observerPage, sourceUsername);
    expect(snapshot.lastAbility.fallback).toBe(false);
    expect(snapshot.lastAbility.layerCount).toBeGreaterThan(0);
    expect(snapshot.currentAnimation).toMatch(/^(Attack|Run|Walk|Idle)$/);
    return snapshot;
}

async function attackAndObserveRemote(sourcePage, observerPage, sourceUsername, initialHostile) {
    let hostile = initialHostile;
    let lastDiagnostic = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
            await sourcePage.waitForTimeout(1_200);
            await useCombatQAWaypoint(sourcePage);
            hostile = await findOverworldTarget(sourcePage);
        }

        // Projection must use the foreground camera. Bringing a throttled tab
        // forward can advance camera follow and actor interpolation enough to
        // invalidate a coordinate sampled immediately beforehand—especially
        // now that procedural enemies use exact rather than oversized bounds.
        await sourcePage.bringToFront();
        await sourcePage.evaluate(() => new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        }));
        let projected = await projectEntity(sourcePage, hostile.id);
        if (!projected?.visible) {
            hostile = await findOverworldTarget(sourcePage);
            projected = await projectEntity(sourcePage, hostile.id);
        }
        if (!projected?.visible) continue;

        // Follow the live projected center until the production hover raycast
        // confirms that the pointer is genuinely over a hostile. Enemies keep
        // moving while the two-browser assertion runs, so a fixed coordinate
        // plus an arbitrary delay can turn into a ground click under load.
        let aimedHostileId = null;
        for (let aimAttempt = 0; aimAttempt < 20 && !aimedHostileId; aimAttempt += 1) {
            projected = await projectEntity(sourcePage, hostile.id);
            if (!projected?.visible) break;
            await sourcePage.mouse.move(projected.x, projected.y);
            await sourcePage.waitForTimeout(75);
            aimedHostileId = await sourcePage.evaluate(() => {
                const game = window.game;
                return game?.isHostileActorTarget?.(game.hoveredEntity)
                    ? game.hoveredEntity.id
                    : null;
            });
        }
        if (!aimedHostileId) {
            lastDiagnostic = {
                attempt: attempt + 1,
                hostileId: hostile.id,
                projected,
                reason: 'production hover raycast found no hostile at its live projected center'
            };
            continue;
        }
        if (aimedHostileId !== hostile.id) {
            hostile = { ...hostile, id: aimedHostileId };
        }
        await sourcePage.mouse.click(projected.x, projected.y);
        await observerPage.bringToFront();
        try {
            await expect.poll(async () => {
                const remote = await remotePlayerSnapshot(observerPage, sourceUsername);
                return Boolean(
                    remote?.state === 'ATTACKING' ||
                    remote?.currentAnimation === 'Attack'
                );
            }, {
                message: 'the observer must render the real-input basic attack',
                timeout: 8_000,
                intervals: [25, 50, 100, 250]
            }).toBe(true);
            return hostile;
        } catch {
            const [local, remote] = await Promise.all([
                sourcePage.evaluate((targetId) => {
                    const game = window.game;
                    const target = (game?.activeEntitiesCache || [])
                        .find((candidate) => candidate.id === targetId) || game?.remotePlayers?.get?.(targetId);
                    return {
                        state: game?.player?.state || null,
                        animation: game?.player?.currentAnimationName || null,
                        pendingTargetId: game?.pendingInteraction?.id || null,
                        targetState: target?.state || null,
                        targetActive: target?.isActive ?? null
                    };
                }, hostile.id),
                remotePlayerSnapshot(observerPage, sourceUsername)
            ]);
            lastDiagnostic = { attempt: attempt + 1, hostileId: hostile.id, local, remote };
        }
    }

    throw new Error(
        `Remote basic attack never followed a bounded real hostile click: ${JSON.stringify(lastDiagnostic)}`
    );
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('two-account multiplayer', () => {
    test.skip(!hasTwoAccounts, 'Set primary and _SECONDARY credentials for multiplayer QA');

    test('both real characters observe one another through the live state stream', async ({ browser, baseURL }) => {
        test.setTimeout(1_200_000);
        const phase = (name) => console.log(`[multiplayer] ${name}`);
        expect(primary.username !== secondary.username).toBe(true);
        // Use an actual second Chrome process so two WebGL render loops cannot
        // starve one another inside a shared browser process/GPU scheduler.
        const secondBrowser = await browser.browserType().launch({
            executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || undefined,
            headless: process.env.EIDOLON_E2E_HEADLESS !== '0',
            args: [
                ...hardwareWebGLBrowserArgs(),
                ...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)
            ]
        });
        const firstContext = await browser.newContext();
        const secondContext = await secondBrowser.newContext();
        const firstPage = await firstContext.newPage();
        const secondPage = await secondContext.newPage();
        firstPage.setDefaultTimeout(20_000);
        secondPage.setDefaultTimeout(20_000);
        const firstFailures = collectBrowserFailures(firstPage, baseURL);
        const secondFailures = collectBrowserFailures(secondPage, baseURL);

        try {
            phase('loading primary character');
            await firstPage.bringToFront();
            await loginAndEnterWorld(firstPage, primary);
            await ensureDungeonReadyLevel(firstPage, 100);
            // A real user can lower rendering cost before opening another game.
            // This keeps two production WebGL clients responsive on the
            // repository runner without bypassing gameplay or mutating page state.
            await selectLowGraphicsThroughSettings(firstPage);
            phase('loading secondary character');
            await secondPage.bringToFront();
            await loginAndEnterWorld(secondPage, secondary);
            await ensureDungeonReadyLevel(secondPage, 100);
            await selectLowGraphicsThroughSettings(secondPage);

            // Persistent accounts may retain a party across disconnects. Start
            // this scenario from a fresh two-member party through visible UI.
            await leavePartyIfPresent(firstPage);
            await leavePartyIfPresent(secondPage);
            phase('cleared stale party state');

            // Persistent QA characters can begin outside the server's 200-unit
            // replication radius. Put both at the same fixed allowlisted point
            // through the visible chat UI before requiring remote visibility.
            await useCombatQAWaypoint(firstPage);
            await useCombatQAWaypoint(secondPage);
            phase('colocated characters');

            const remoteSnapshot = remotePlayerSnapshot;

            await expect.poll(() => remoteSnapshot(firstPage, secondary.username), { timeout: 30_000 }).not.toBeNull();
            await expect.poll(() => remoteSnapshot(secondPage, primary.username), { timeout: 30_000 }).not.toBeNull();
            phase('verified bidirectional state visibility');

            await firstPage.bringToFront();
            await pressBodyKey(firstPage, 'o');
            await expect(firstPage.locator('#social-window')).toBeVisible();
            await firstPage.locator('#social-status-select').selectOption('looking_party');
            await secondPage.bringToFront();
            await pressBodyKey(secondPage, 'o');
            await expect.poll(() => secondPage.evaluate((primaryName) =>
                [...document.querySelectorAll('#social-list .social-window__row')].some((row) =>
                    row.textContent.includes(primaryName) && row.textContent.includes('Looking for Party')
            ), primary.username), { timeout: 20_000 }).toBe(true);
            phase('verified social presence');
            await closeSocialWindow(secondPage);
            phase('closed secondary social window');
            await firstPage.bringToFront();
            await dismissChatIfVisible(firstPage);
            await expect(firstPage.locator('#social-window')).toBeVisible();
            phase('cleared chat overlay from party controls');
            await firstPage.locator('#party-invite-input').fill(secondary.username);
            phase('filled party invite');
            await firstPage.locator('#btn-invite-party').click();
            phase('submitted party invite');
            await expect(secondPage.locator('#party-request-modal')).toBeVisible({ timeout: 20_000 });
            expect(await secondPage.locator('#party-inviter-name').evaluate(
                (element, primaryName) => element.textContent === primaryName,
                primary.username
            )).toBe(true);
            await secondPage.locator('#btn-accept-party').click();
            phase('accepted party invite');

            await expect.poll(() => firstPage.locator('#party-list').evaluate(
                (element, secondaryName) => element.textContent.includes(secondaryName),
                secondary.username
            ), { timeout: 20_000 }).toBe(true);
            await expect.poll(() => secondPage.locator('#party-list').evaluate(
                (element, primaryName) => element.textContent.includes(primaryName),
                primary.username
            ), { timeout: 20_000 }).toBe(true);
            const partyReplication = async () => {
                const [firstSees, secondSees, firstLocalPartyId, secondLocalPartyId] = await Promise.all([
                    remoteSnapshot(firstPage, secondary.username),
                    remoteSnapshot(secondPage, primary.username),
                    firstPage.evaluate(() => window.game?.socialController?.myPartyId || ''),
                    secondPage.evaluate(() => window.game?.socialController?.myPartyId || '')
                ]);
                return {
                    firstLocalPartyId,
                    firstRemotePartyId: firstSees?.partyId || '',
                    secondLocalPartyId,
                    secondRemotePartyId: secondSees?.partyId || ''
                };
            };
            try {
                await expect.poll(async () => {
                    const snapshot = await partyReplication();
                    return Boolean(
                        snapshot.firstLocalPartyId &&
                        snapshot.firstLocalPartyId === snapshot.secondLocalPartyId &&
                        snapshot.firstLocalPartyId === snapshot.firstRemotePartyId &&
                        snapshot.firstLocalPartyId === snapshot.secondRemotePartyId
                    );
                }, { timeout: 20_000 }).toBe(true);
            } catch (error) {
                throw new Error(
                    `Party state stream did not converge: ${JSON.stringify(await partyReplication())}`,
                    { cause: error }
                );
            }
            phase('formed fresh replicated party');
            await closeSocialWindow(firstPage);

            if (primary.characterClass === 'Cleric') {
                phase('verifying remote Spirit Guardians lifecycle');
                await firstPage.bringToFront();
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Spirit Guardians',
                    'right',
                    { persistent: true }
                );
                try {
                    await expect.poll(async () => {
                        const remote = await remoteSnapshot(secondPage, primary.username);
                        return {
                            active: remote?.spiritsActive,
                            count: remote?.guardianCount,
                            groups: remote?.spiritGroupCount,
                            effectRadius: remote?.spiritEffectRadius,
                            ringRadius: remote?.spiritRingRadius,
                            attached: Number(remote?.spiritFollowDistance) < 0.4
                        };
                    }, { timeout: 10_000 }).toEqual({
                        active: true,
                        count: 3,
                        groups: 1,
                        effectRadius: 16,
                        ringRadius: 16,
                        attached: true
                    });
                } catch (error) {
                    const [local, remote] = await Promise.all([
                        firstPage.evaluate(() => ({
                            active: window.game?.player?.spiritsActive,
                            boosted: window.game?.player?.spiritBoosted,
                            duration: window.game?.player?.spiritDuration,
                            socket: window.game?.network?.socket?.readyState,
                            queued: window.game?.network?.messageQueue?.length
                        })),
                        remoteSnapshot(secondPage, primary.username)
                    ]);
                    throw new Error(`Spirit Guardians did not become remotely persistent: ${JSON.stringify({ local, remote })}`, {
                        cause: error
                    });
                }

                await selectBranch(firstPage, 'Cleric', 'B');
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Spirit Guardians Boost',
                    '3',
                    { persistent: true }
                );
                await expect.poll(async () => {
                    const remote = await remoteSnapshot(secondPage, primary.username);
                    return {
                        active: remote?.spiritsActive,
                        boosted: remote?.spiritBoosted,
                        count: remote?.guardianCount,
                        groups: remote?.spiritGroupCount,
                        effectRadius: remote?.spiritEffectRadius,
                        ringRadius: remote?.spiritRingRadius
                    };
                }, { timeout: 10_000 }).toEqual({
                    active: true,
                    boosted: true,
                    count: 5,
                    groups: 1,
                    effectRadius: 20,
                    ringRadius: 20
                });

                // Refresh through the real hotbar path, then replace the
                // observer runtime while the server-authoritative aura is live.
                // The fresh page must reconstruct one boosted orbit set from
                // the state stream rather than relying on the original cast event.
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Spirit Guardians Boost',
                    '3'
                );
                // Prove the active observer runtime was clean before deliberately
                // replacing it. A navigation is allowed to cancel that abandoned
                // document's pending embedded-GLB image decodes; reset only those
                // teardown diagnostics, then keep auditing the replacement runtime.
                expect(secondFailures, secondFailures.join('\n')).toEqual([]);
                await secondPage.bringToFront();
                await secondPage.reload({ waitUntil: 'domcontentloaded' });
                await expect(secondPage.locator('#game-title')).toHaveText('EIDOLON ONLINE');
                secondFailures.length = 0;
                await secondPage.locator('#auth-username').fill(secondary.username);
                await secondPage.locator('#auth-password').fill(secondary.password);
                await secondPage.locator('#btn-login').click();
                await expect(secondPage.locator('#auth-status')).toHaveCSS('color', 'rgb(76, 175, 80)', {
                    timeout: 20_000
                });
                await expect(secondPage.locator('#btn-play-character')).toBeVisible();

                // The replacement browser is authenticated but has not joined
                // the world, so it cannot receive the cast event. Refresh the
                // aura through normal source input, then join and require the
                // first authoritative snapshot to reconstruct it.
                await firstPage.bringToFront();
                await prepareAnimationCast(firstPage, true);
                let refreshTarget = null;
                await expect.poll(async () => {
                    refreshTarget = await projectGroundOffset(firstPage, 6, 2);
                    return Boolean(refreshTarget?.canvas);
                }, { timeout: 8_000 }).toBe(true);
                const priorLocalPresentation = await firstPage.evaluate(() =>
                    window.game?.player?.lastAbilityPresentation?.timestamp || -1
                );
                await firstPage.mouse.move(refreshTarget.x, refreshTarget.y);
                await firstPage.keyboard.press('3');
                await expect.poll(() => firstPage.evaluate((previous) => {
                    const presentation = window.game?.player?.lastAbilityPresentation;
                    return Boolean(
                        presentation?.skillName === 'Spirit Guardians Boost' &&
                        presentation.timestamp > previous
                    );
                }, priorLocalPresentation), { timeout: 8_000 }).toBe(true);

                await secondPage.bringToFront();
                await secondPage.locator('#btn-play-character').click();
                await expect.poll(() => secondPage.evaluate(() => Boolean(
                    window.game?.player?.position &&
                    window.game?._firstStateReceived &&
                    window.game?.network?.socket?.readyState === WebSocket.OPEN
                )), { timeout: 45_000 }).toBe(true);
                await expect.poll(async () => {
                    const remote = await remoteSnapshot(secondPage, primary.username);
                    return {
                        active: remote?.spiritsActive,
                        boosted: remote?.spiritBoosted,
                        count: remote?.guardianCount,
                        groups: remote?.spiritGroupCount,
                        effectRadius: remote?.spiritEffectRadius,
                        ringRadius: remote?.spiritRingRadius,
                        attached: Number(remote?.spiritFollowDistance) < 0.4
                    };
                }, { timeout: 12_000 }).toEqual({
                    active: true,
                    boosted: true,
                    count: 5,
                    groups: 1,
                    effectRadius: 20,
                    ringRadius: 20,
                    attached: true
                });
                await expect(secondPage.locator('#loading-screen')).toBeHidden({ timeout: 120_000 });
                await selectLowGraphicsThroughSettings(secondPage);
                phase('verified Spirit Guardians refresh and join-in-progress reconstruction');

                await firstPage.bringToFront();
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Spirit Guardians Boost',
                    '3'
                );

                await expect.poll(async () => {
                    const remote = await remoteSnapshot(secondPage, primary.username);
                    return {
                        active: remote?.spiritsActive,
                        count: remote?.guardianCount,
                        groups: remote?.spiritGroupCount
                    };
                }, { timeout: 18_000 }).toEqual({ active: false, count: 0, groups: 0 });
                phase('verified Spirit Guardians authoritative expiration and cleanup');

                await firstPage.bringToFront();
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Consecrated Ground',
                    '2'
                );
                const priorSeraphIds = await secondPage.evaluate(() =>
                    [...(window.game?.remotePlayers?.values?.() || [])]
                        .filter((candidate) =>
                            (candidate?.subType || candidate?.meshType || candidate?.constructor?.name) === 'AvengingSeraph'
                        )
                        .map((candidate) => candidate.id)
                );
                await castAndObserveRemote(
                    firstPage,
                    secondPage,
                    primary.username,
                    'Avenging Seraph',
                    '4'
                );
                await expect.poll(() => secondPage.evaluate((beforeIds) =>
                    [...(window.game?.remotePlayers?.values?.() || [])].some((candidate) =>
                        (candidate?.subType || candidate?.meshType || candidate?.constructor?.name) === 'AvengingSeraph' &&
                        !beforeIds.includes(candidate.id)
                    ), priorSeraphIds), { timeout: 15_000 }).toBe(true);
                phase('verified remote ground effect and summon categories');
            }

            if (secondary.characterClass === 'Wizard') {
                phase('verifying remote projectile, teleport, and area categories');
                await secondPage.bringToFront();
                await castAndObserveRemote(
                    secondPage,
                    firstPage,
                    secondary.username,
                    'Fireball',
                    'right'
                );
                await selectBranch(secondPage, 'Wizard', 'C');
                const beforeTeleport = await remoteSnapshot(firstPage, secondary.username);
                await castAndObserveRemote(
                    secondPage,
                    firstPage,
                    secondary.username,
                    'Teleport',
                    '1'
                );
                await expect.poll(async () => {
                    const remote = await remoteSnapshot(firstPage, secondary.username);
                    return Math.hypot(remote.x - beforeTeleport.x, remote.z - beforeTeleport.z);
                }, { timeout: 15_000 }).toBeGreaterThan(0.5);
                await castAndObserveRemote(
                    secondPage,
                    firstPage,
                    secondary.username,
                    'Gravity Well',
                    '3'
                );
                phase('verified remote projectile, forced movement, and persistent-area visuals');
                await useCombatQAWaypoint(firstPage);
            }

            const beforeMovement = await remoteSnapshot(secondPage, primary.username);
            const remoteMovementPromise = sampleRemoteMovement(secondPage, primary.username);
            await firstPage.bringToFront();
            await moveByGroundClick(firstPage, 20, 0, { allowJumpFallback: false });

            await expect.poll(async () => {
                const after = await remoteSnapshot(secondPage, primary.username);
                return Math.hypot(after.x - beforeMovement.x, after.z - beforeMovement.z);
            }, { timeout: 15_000 }).toBeGreaterThan(0.25);
            const remoteMovement = await remoteMovementPromise;
            const remoteMovementAnalysis = analyzeRemoteMovement(remoteMovement.frames);
            expect(remoteMovementAnalysis.largestBacktrack).toBeGreaterThanOrEqual(-0.35);
            expect(remoteMovementAnalysis.largestStep).toBeLessThan(3);
            expect(remoteMovementAnalysis.maxRenderLogicalGap).toBeLessThan(0.75);
            expect(remoteMovementAnalysis.uniqueRenderPositions).toBeGreaterThan(4);
            expect(remoteMovement.metrics).toEqual(expect.objectContaining({
                samples: expect.any(Number),
                accepted: expect.any(Number),
                interpolated: expect.any(Number)
            }));
            expect(remoteMovement.metrics.samples).toBeLessThanOrEqual(32);
            expect(remoteMovement.sameBuffer).toBe(true);
            expect(remoteMovement.metricDelta.accepted).toBeGreaterThan(2);
            expect(remoteMovement.metricDelta.interpolated + remoteMovement.metricDelta.extrapolated).toBeGreaterThan(0);
            phase('verified remote movement');

            const gameCanvas = firstPage.locator('body > canvas').last();
            const canvasBox = await gameCanvas.boundingBox();
            expect(canvasBox).not.toBeNull();
            await firstPage.keyboard.down('Control');
            await firstPage.mouse.click(
                canvasBox.x + canvasBox.width * 0.62,
                canvasBox.y + canvasBox.height * 0.65
            );
            await firstPage.keyboard.up('Control');
            await expect.poll(async () => {
                const remote = await remoteSnapshot(secondPage, primary.username);
                return remote?.state === 'JUMPING' || Number(remote?.jumpProgress) > 0;
            }, { timeout: 5_000, intervals: [50, 100, 200] }).toBe(true);
            phase('verified remote jump');

            await moveByGroundClick(secondPage, 20, 0);

            // Reset both characters to the deterministic combat area after the
            // movement/jump assertions, then reuse the bounded full-gameplay
            // hostile finder instead of wandering until the test times out.
            await useCombatQAWaypoint(firstPage);
            await useCombatQAWaypoint(secondPage);
            let hostile = await findOverworldTarget(firstPage);
            phase('acquired shared hostile');
            hostile = await attackAndObserveRemote(
                firstPage,
                secondPage,
                primary.username,
                hostile
            );
            phase('verified remote basic-attack presentation');

            const expectedCombatSkill = await firstPage.evaluate(() => window.game?.player?.hotbar?.[0] || '');
            await castAndObserveRemote(
                firstPage,
                secondPage,
                primary.username,
                expectedCombatSkill,
                '1'
            );
            phase('verified remote ability presentation after combat');

            const primaryPosition = await firstPage.evaluate(() => ({
                x: window.game.player.position.x,
                z: window.game.player.position.z
            }));
            await expect.poll(async () => {
                const converged = await remoteSnapshot(secondPage, primary.username);
                return Math.hypot(converged.x - primaryPosition.x, converged.z - primaryPosition.z);
            }, { timeout: 15_000 }).toBeLessThan(2);

            const secondaryTarget = await projectEntity(secondPage, hostile.id);
            if (secondaryTarget?.visible) {
                await secondPage.mouse.click(secondaryTarget.x, secondaryTarget.y);
                await pressBodyKey(secondPage, '1');
            }
            expect(firstFailures, firstFailures.join('\n')).toEqual([]);
            expect(secondFailures, secondFailures.join('\n')).toEqual([]);
            phase('completed browser failure audit');
        } finally {
            for (const page of [firstPage, secondPage]) {
                if (!page.isClosed()) {
                    await leavePartyIfPresent(page).catch(() => {});
                }
            }
            await Promise.allSettled([
                firstContext.close(),
                secondContext.close(),
                secondBrowser.close()
            ]);
        }
    });
});
