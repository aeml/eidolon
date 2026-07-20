import { expect, test } from '@playwright/test';
import { CONSTANTS } from '../../src/core/Constants.js';
import {
    PLAYER_ABILITY_VISUALS,
    getAbilityRuneVariants
} from '../../src/skills/abilityVisualManifest.js';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    ensureDungeonReadyLevel,
    findOverworldTarget,
    jumpByGroundClick,
    loginAndEnterWorld,
    moveByGroundClick,
    projectEntity,
    projectGroundOffset,
    readPlayerState,
    selectGraphicsThroughSettings,
    useCombatQAWaypoint
} from './helpers.js';

const credentials = credentialsFromEnvironment();
const supportedClasses = new Set(Object.keys(PLAYER_ABILITY_VISUALS));
const hasCredentials = Boolean(credentials.username && credentials.password);

function classMatrix(className) {
    const tree = CONSTANTS.SKILL_TREES[className];
    if (!tree) throw new Error(`No skill tree exists for ${className}`);
    const base = tree.Tier1.name;
    const branches = ['A', 'B', 'C'].map((branch) => ({
        branch,
        skills: [2, 3, 4, 5].map((tier) => tree[`Branch${branch}`][`Tier${tier}`].name)
    }));
    const skillBranch = new Map([[base, null]]);
    for (const entry of branches) {
        for (const skill of entry.skills) skillBranch.set(skill, entry.branch);
    }
    return { base, branches, skillBranch };
}

async function dismissChat(page) {
    const chatBox = page.locator('#chat-box');
    for (let attempt = 0; attempt < 4 && await chatBox.isVisible(); attempt += 1) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
    }
    await expect(chatBox).toBeHidden();
}

async function visibleChatCommand(page, command, confirmation) {
    const chatInput = page.locator('#chat-input');
    if (!await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Enter');
    }
    await expect(chatInput).toBeFocused();
    await chatInput.fill(command);
    await chatInput.press('Enter');
    await expect(page.locator('#chat-messages')).toContainText(confirmation, { timeout: 20_000 });
    if (await chatInput.evaluate((element) => element === document.activeElement)) {
        await page.keyboard.press('Escape');
    }
    await dismissChat(page);
}

async function prepareAnimationCast(page, lowHealth = false) {
    const sequence = await page.evaluate(() => window.game?.animationQAReadySequence || 0);
    await visibleChatCommand(
        page,
        `/qa-animation-ready${lowHealth ? ' low-health' : ''}`,
        lowHealth ? 'Animation QA readiness restored at low health.' : 'Animation QA readiness restored.'
    );
    await expect.poll(() => page.evaluate(() => window.game?.animationQAReadySequence || 0), {
        timeout: 20_000
    }).toBeGreaterThan(sequence);
}

async function selectBranch(page, className, branch, expectedSkills) {
    if (await page.evaluate((wanted) => window.game?.player?.selectedBranch === wanted, branch)) {
        const current = await page.evaluate(() => window.game?.player?.hotbar || []);
        if (expectedSkills.every((skill, index) => current[index] === skill)) return;
    }

    await page.keyboard.press('k');
    const window = page.locator('#skill-tree-window');
    await expect(window).toBeVisible();
    await window.getByRole('button', { name: 'Skills', exact: true }).click();
    const branchCard = page.locator('.skill-branch').nth(['A', 'B', 'C'].indexOf(branch));
    await expect(branchCard).toContainText(CONSTANTS.SKILL_TREES[className][`Branch${branch}`].name);
    const selectButton = branchCard.getByRole('button', { name: 'Select Spec' });
    if (await selectButton.count()) await selectButton.click();

    await expect.poll(() => page.evaluate(() => window.game?.player?.selectedBranch), {
        timeout: 20_000
    }).toBe(branch);
    await expect.poll(() => page.evaluate(() => window.game?.player?.hotbar || []), {
        timeout: 20_000
    }).toEqual(expectedSkills);
    await closeSkillWindow(page, window);

    const visibleHotbar = await page.locator('.hotbar-icon').evaluateAll((icons) =>
        icons.slice(0, 4).map((icon) => icon.dataset.skill || '')
    );
    expect(visibleHotbar).toEqual(expectedSkills);
}

async function closeSkillWindow(page, window = page.locator('#skill-tree-window')) {
    if (!await window.isVisible()) return;
    await page.locator('body').press('Escape');
    if (await window.isVisible()) {
        await page.locator('#btn-close-skills').click();
    }
    await expect(window).toBeHidden();
}

async function selectRune(page, skillName, rune) {
    const window = page.locator('#skill-tree-window');
    const selectedRune = () => page.evaluate(({ skill }) =>
        window.game?.player?.skillRunes?.[skill] || '', { skill: skillName });
    if (await selectedRune() === rune.id) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!await window.isVisible()) await page.keyboard.press('k');
        await expect(window).toBeVisible();
        await window.getByRole('button', { name: 'Runes', exact: true }).click();
        if (await selectedRune() === rune.id) break;
        const skillCard = window.getByText(skillName, { exact: true }).locator('..');
        const runeName = skillCard.getByText(rune.name, { exact: true });
        await expect(runeName).toBeVisible();
        await runeName.click();
        try {
            await expect.poll(selectedRune, { timeout: 7_000 }).toBe(rune.id);
            break;
        } catch {
            // Retry the same visible selection after a lost acknowledgement.
        }
    }
    expect(await selectedRune(), `${skillName}/${rune.id} must equip through the rune UI`).toBe(rune.id);
    await closeSkillWindow(page, window);
}

async function exerciseBasicAttack(page) {
    let lastDiagnostic = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) await useCombatQAWaypoint(page);
        const hostile = await findOverworldTarget(page);
        const projected = await projectEntity(page, hostile.id);
        if (projected?.visible) {
            await page.mouse.click(projected.x, projected.y);
        } else {
            await page.mouse.click(hostile.x, hostile.y);
        }
        try {
            await expect.poll(() => page.evaluate(() => ({
                state: window.game?.player?.state,
                animation: window.game?.player?.currentAnimationName
            })), {
                timeout: 15_000,
                intervals: [25, 50, 100, 250]
            }).toEqual(expect.objectContaining({ animation: 'Attack' }));
            return;
        } catch {
            lastDiagnostic = await page.evaluate((targetId) => {
                const game = window.game;
                const target = (game?.activeEntitiesCache || []).find((entity) => entity.id === targetId);
                return {
                    playerState: game?.player?.state,
                    playerAnimation: game?.player?.currentAnimationName,
                    playerX: game?.player?.position?.x,
                    playerZ: game?.player?.position?.z,
                    pendingTargetId: game?.pendingInteraction?.id || null,
                    targetState: target?.state || null,
                    targetActive: target?.isActive ?? null,
                    targetX: target?.position?.x,
                    targetZ: target?.position?.z
                };
            }, hostile.id);
        }
    }
    throw new Error(`Basic attack did not reach its visible Attack clip: ${JSON.stringify(lastDiagnostic)}`);
}

async function castThroughInput(page, className, skillName, key, presentation) {
    await prepareAnimationCast(page, skillName === 'Last Stand Rampage');
    let target = null;
    await expect.poll(async () => {
        target = await projectGroundOffset(page, 7, 2);
        return Boolean(target?.canvas);
    }, { timeout: 8_000 }).toBe(true);
    await page.mouse.move(target.x, target.y);
    const previousTimestamp = await page.evaluate(() =>
        window.game?.player?.lastAbilityPresentation?.timestamp || -1
    );
    if (key === 'right') {
        await page.mouse.click(target.x, target.y, { button: 'right' });
    } else {
        await page.keyboard.press(key);
    }

    await expect.poll(() => page.evaluate(({ expectedSkill, previous }) => {
        const record = window.game?.player?.lastAbilityPresentation;
        return Boolean(record?.skillName === expectedSkill && record.timestamp > previous);
    }, { expectedSkill: skillName, previous: previousTimestamp }), {
        message: `${className}/${skillName} must create its production presentation through real input`,
        timeout: 8_000,
        intervals: [25, 50, 100, 200]
    }).toBe(true);

    const snapshot = await page.evaluate(() => {
        const game = window.game;
        const player = game?.player;
        let nonFiniteTransforms = 0;
        game?.renderSystem?.scene?.traverse?.((object) => {
            for (const value of [
                object.position?.x, object.position?.y, object.position?.z,
                object.scale?.x, object.scale?.y, object.scale?.z,
                object.quaternion?.x, object.quaternion?.y,
                object.quaternion?.z, object.quaternion?.w
            ]) {
                if (value !== undefined && !Number.isFinite(value)) nonFiniteTransforms += 1;
            }
        });
        return {
            presentation: player?.lastAbilityPresentation || null,
            currentAbility: player?.currentAbilityAnimation?.skillName || null,
            currentAnimation: player?.currentAnimationName || null,
            missingClips: [...(player?.missingAnimationClips || [])],
            effects: game?.effects?.length || 0,
            effectChildren: game?.renderSystem?.effectGroup?.children?.length || 0,
            nonFiniteTransforms
        };
    });
    expect(snapshot.presentation.layerCount).toBe(presentation.layers.length);
    expect(snapshot.currentAnimation, `${className}/${skillName} animation snapshot: ${JSON.stringify(snapshot)}`)
        .toMatch(/^(Attack|Run|Walk)$/);
    expect(snapshot.missingClips).toEqual([]);
    expect(snapshot.nonFiniteTransforms).toBe(0);
    expect(snapshot.effects + snapshot.effectChildren).toBeGreaterThan(0);
    await page.waitForTimeout(120);
    return snapshot;
}

async function assertHardwareRenderer(page) {
    const renderer = await page.evaluate(() => {
        const context = window.game?.renderSystem?.renderer?.getContext?.();
        if (!context) return null;
        const info = context.getExtension('WEBGL_debug_renderer_info');
        return {
            vendor: info ? context.getParameter(info.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR),
            renderer: info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)
        };
    });
    expect(renderer).not.toBeNull();
    expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);
    return renderer;
}

async function exerciseDeathAndRespawn(page) {
    await useCombatQAWaypoint(page);
    const target = await findOverworldTarget(page);
    await visibleChatCommand(page, '/level 1', 'Level set to 1.');
    await visibleChatCommand(
        page,
        '/qa-protection off',
        'QA waypoint protection disabled; hostile damage is authoritative.'
    );
    for (let attempt = 0; attempt < 5 && !await page.locator('#death-screen').isVisible(); attempt += 1) {
        // Aim at the animated actor's tagged hitbox, not its ground-level
        // world origin. A feet projection can sit below the visible mesh and
        // turn this real input into a ground click instead of an engagement.
        const projected = await projectEntity(page, target.id);
        if (projected?.visible) await page.mouse.click(projected.x, projected.y);
        await page.waitForTimeout(4_000);
    }
    await expect(page.locator('#death-screen')).toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => (await readPlayerState(page)).state).toBe('DEAD');
    const deathAnimation = await page.evaluate(() => window.game?.player?.currentAnimationName);
    expect(deathAnimation).toBe('Death');
    await page.locator('#btn-death-respawn').click();
    await expect(page.locator('#death-screen')).toBeHidden({ timeout: 20_000 });
    await expect.poll(async () => (await readPlayerState(page)).state).not.toBe('DEAD');
    await ensureDungeonReadyLevel(page, 100);
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('real-input animation gameplay matrix', () => {
    test.skip(!hasCredentials, 'Set dedicated animation QA credentials');
    test.skip(!supportedClasses.has(credentials.characterClass), 'Set a supported EIDOLON_E2E_CLASS');

    test('plays every class ability and rune through the production game UI', async ({ page, baseURL }, testInfo) => {
        test.setTimeout(900_000);
        const failures = collectBrowserFailures(page, baseURL);
        const className = credentials.characterClass;
        const matrix = classMatrix(className);
        const presentations = PLAYER_ABILITY_VISUALS[className];

        await loginAndEnterWorld(page, credentials);
        const renderer = await assertHardwareRenderer(page);
        await ensureDungeonReadyLevel(page, 100);
        await useCombatQAWaypoint(page);
        await selectGraphicsThroughSettings(page, 'high');

        await expect.poll(() => page.evaluate(() => window.game?.player?.currentAnimationName), {
            timeout: 15_000
        }).toBe('Idle');
        await moveByGroundClick(page, 15, 0);
        await expect.poll(() => page.evaluate(() => window.game?.player?.currentAnimationName), {
            timeout: 5_000,
            intervals: [25, 50, 100]
        }).toMatch(/^(Run|Walk)$/);
        await expect.poll(() => page.evaluate(() => window.game?.player?.state), {
            timeout: 12_000
        }).toBe('IDLE');
        await jumpByGroundClick(page, 12, 2);
        await expect.poll(() => page.evaluate(() => window.game?.player?.currentAnimationName), {
            timeout: 8_000
        }).toBe('Idle');

        await exerciseBasicAttack(page);

        await castThroughInput(page, className, matrix.base, 'right', presentations[matrix.base]);
        for (const branch of matrix.branches) {
            await selectBranch(page, className, branch.branch, branch.skills);
            for (let index = 0; index < branch.skills.length; index += 1) {
                const skill = branch.skills[index];
                await castThroughInput(page, className, skill, String(index + 1), presentations[skill]);
            }
        }

        await selectGraphicsThroughSettings(page, 'low');
        await castThroughInput(page, className, matrix.base, 'right', presentations[matrix.base]);
        for (const [skillName, branch] of matrix.skillBranch) {
            const runes = getAbilityRuneVariants(className, skillName);
            if (runes.length === 0) continue;
            if (branch) {
                const branchEntry = matrix.branches.find((entry) => entry.branch === branch);
                await selectBranch(page, className, branch, branchEntry.skills);
            }
            const key = branch
                ? String(matrix.branches.find((entry) => entry.branch === branch).skills.indexOf(skillName) + 1)
                : 'right';
            for (const rune of runes) {
                await selectRune(page, skillName, rune);
                await castThroughInput(page, className, skillName, key, presentations[skillName]);
            }
        }

        await page.screenshot({
            path: testInfo.outputPath(`${className.toLowerCase()}-animation-matrix.png`),
            animations: 'allow'
        });
        const endMetrics = await page.evaluate(() => ({
            effects: window.game?.effects?.length || 0,
            effectChildren: window.game?.renderSystem?.effectGroup?.children?.length || 0,
            managedTimers: window.game?.player?.managedTimers?.size || 0,
            attachedEffects: window.game?.player?.attachedStatusEffects?.size || 0
        }));
        expect(endMetrics.effects).toBeLessThan(80);
        expect(endMetrics.effectChildren).toBeLessThan(160);
        expect(endMetrics.managedTimers).toBeLessThan(24);
        expect(endMetrics.attachedEffects).toBeLessThan(12);

        await exerciseDeathAndRespawn(page);
        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
        testInfo.annotations.push({
            type: 'coverage',
            description: `${className}: 13 abilities and ${
                [...matrix.skillBranch].reduce((count, [skill]) =>
                    count + getAbilityRuneVariants(className, skill).length, 0)
            } runes through real input`
        });
    });
});
