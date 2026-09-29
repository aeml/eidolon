import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });
test('ability families render distinct bounded cues through the combat bus', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const samples = await page.evaluate(async () => {
        const { AudioManager, AUDIO_CUES } = await import('/src/audio/AudioManager.js');
        const families = [
            ['fighterCast', 'Sweeping Strike'], ['fighterCast', 'Shield Slam'], ['fighterCast', 'Earthshaker'],
            ['rogueCast', 'Backstab'], ['rogueCast', 'Shadow Lunge'], ['rogueCast', 'Tripwire'],
            ['wizardCast', 'Fireball'], ['wizardCast', 'Arcane Missiles'], ['wizardCast', 'Gravity Well'],
            ['wizardCast', 'Time Warp'], ['wizardCast', 'Frost Nova'],
            ['clericCast', 'Healing Light'], ['clericCast', 'Radiant Strike'], ['clericCast', 'Avenging Seraph']
        ];
        const samples = [];
        for (const [cue, skillName] of [...families, ['wizardCast', 'Fireball']]) {
            const context = new OfflineAudioContext(2, 24000, 48000);
            const audio = new AudioManager({ context, storage: { getItem: () => null, setItem: () => {} } });
            audio.setVolume(1);
            const muted = samples.length === families.length;
            if (muted) audio.setBusVolume('combat', 0);
            const played = audio.play(AUDIO_CUES[cue], { skillName });
            const buffer = await context.startRendering(), data = buffer.getChannelData(0);
            let peak = 0, squares = 0, tailPeak = 0;
            for (let i = 0; i < data.length; i++) {
                peak = Math.max(peak, Math.abs(data[i])); squares += data[i] ** 2;
                if (i > 19200) tailPeak = Math.max(tailPeak, Math.abs(data[i]));
            }
            const hash = await crypto.subtle.digest('SHA-256', data.buffer);
            samples.push({ skillName, muted, played, peak, rms: Math.sqrt(squares / data.length), tailPeak,
                signature: Array.from(new Uint8Array(hash)).map(v => v.toString(16).padStart(2, '0')).join('') });
            audio.dispose();
        }
        return samples;
    });
    expect(new Set(samples.slice(0, 14).map(s => s.signature)).size).toBe(14);
    for (const sample of samples.slice(0, 14)) {
        expect(sample.played, sample.skillName).toBe(true);
        expect(sample.rms, sample.skillName).toBeGreaterThan(.0001);
        expect(sample.peak, sample.skillName).toBeLessThan(.12);
        expect(sample.tailPeak, sample.skillName).toBe(0);
    }
    expect(samples.at(-1).played).toBe(false); expect(samples.at(-1).peak).toBe(0);
    await testInfo.attach('ability-audio-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
    expect(failures).toEqual([]);
});

test('cue voice budget and browser audio suspension recover without stale effects', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { AudioManager, AUDIO_CUES, MAX_CUE_TONES } = await import('/src/audio/AudioManager.js');
        document.getElementById('start-screen').style.display = 'none';
        let now = 1000;
        const audio = new AudioManager({ storage: { getItem: () => null, setItem: () => {} }, now: () => now });
        const button = document.createElement('button'); button.textContent = 'Activate audio review';
        button.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999';
        button.onclick = () => audio.unlock(); document.body.appendChild(button);
        window.__cueReview = { audio, cues: AUDIO_CUES, limit: MAX_CUE_TONES, advance: () => { now += 1000; } };
    });
    await page.getByRole('button', { name: 'Activate audio review' }).click();
    await expect.poll(() => page.evaluate(() => window.__cueReview.audio.context?.state)).toBe('running');
    const burst = await page.evaluate(() => {
        const q = window.__cueReview;
        for (let i = 0; i < 11; i++) { q.advance(); q.audio.play(q.cues.wizardCast); }
        const before = q.audio.activeTones.size;
        const extra = q.audio.play(q.cues.clericCast);
        const warning = q.audio.play(q.cues.dangerWarning);
        return { before, extra, warning, after: q.audio.activeTones.size, limit: q.limit };
    });
    expect(burst.before).toBe(burst.limit - 2);
    expect(burst.extra).toBe(false); expect(burst.warning).toBe(true);
    expect(burst.after).toBe(burst.limit);
    const queued = await page.evaluate(async () => {
        const q = window.__cueReview;
        q.audio.stopOneShots(); q.advance();
        if (!q.audio.play(q.cues.casinoJackpot)) throw new Error('Expected a fresh delayed cue');
        const count = q.audio.activeTones.size;
        await q.audio.context.suspend();
        return count;
    });
    expect(queued).toBe(6);
    await expect.poll(() => page.evaluate(() => window.__cueReview.audio.activeTones.size)).toBe(0);
    expect(await page.evaluate(() => {
        const q = window.__cueReview; q.advance(); return q.audio.play(q.cues.casinoJackpot);
    })).toBe(false);
    await page.getByRole('button', { name: 'Activate audio review' }).click();
    await expect.poll(() => page.evaluate(() => window.__cueReview.audio.context.state)).toBe('running');
    expect(await page.evaluate(() => window.__cueReview.audio.activeTones.size)).toBe(0);
    expect(await page.evaluate(() => {
        // Same cue and clock as the rejected suspended attempt: it must not
        // have consumed a playback cooldown.
        const q = window.__cueReview; return q.audio.play(q.cues.casinoJackpot);
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__cueReview.audio.activeTones.size)).toBe(0);
    await page.evaluate(() => window.__cueReview.audio.dispose());
    expect(failures).toEqual([]);
});

test('realm and casino ambience render finite distinct stereo sound beds', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async () => {
        const { AMBIENCE_PROFILES, createAmbienceNoise, createAmbienceLayer } = await import('/src/audio/WorldAmbience.js');
        const results = [];
        for (const [name, profile] of Object.entries(AMBIENCE_PROFILES)) {
            const context = new OfflineAudioContext(2, 96000, 48000);
            const layer = createAmbienceLayer(context, context.destination, createAmbienceNoise(context), profile);
            const buffer = await context.startRendering();
            let squares = 0, peak = 0, stereoDifference = 0;
            const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
            for (let i = 0; i < left.length; i++) {
                squares += left[i] ** 2; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
                stereoDifference += (left[i] - right[i]) ** 2;
            }
            results.push({ name, rms: Math.sqrt(squares / left.length), peak, stereoDifference });
            layer.dispose(); layer.dispose();
        }
        return results;
    });
    await testInfo.attach('ambient-samples', { body: JSON.stringify(results), contentType: 'application/json' });
    expect(results).toHaveLength(9);
    expect(new Set(results.map(result => result.rms.toFixed(7))).size).toBe(9);
    for (const result of results) {
        expect(result.rms, result.name).toBeGreaterThan(.0005);
        expect(result.peak, result.name).toBeLessThan(.1);
        expect(result.stereoDifference, result.name).toBeGreaterThan(0);
    }
    expect(failures).toEqual([]);
});

test('danger audio renders directional samples through the combat and master controls', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const samples = await page.evaluate(async () => {
        const { AudioManager, AUDIO_CUES } = await import('/src/audio/AudioManager.js');
        const output = [];
        for (const [pan, enabled, volume] of [[-.8, true, 1], [.8, true, 1], [.8, false, 1], [.8, true, 0]]) {
            const context = new OfflineAudioContext(2, 24000, 48000);
            const audio = new AudioManager({ context, storage: { getItem: () => null, setItem: () => {} }, now: () => 1000 });
            audio.setVolume(1); audio.setEnabled(enabled); audio.setBusVolume('combat', volume);
            const played = audio.play(AUDIO_CUES.dangerWarning, { pan, gain: .75 });
            const buffer = await context.startRendering();
            const channels = [0, 1].map(channel => {
                const values = buffer.getChannelData(channel);
                let squares = 0, peak = 0;
                for (const value of values) { squares += value * value; peak = Math.max(peak, Math.abs(value)); }
                return { rms: Math.sqrt(squares / values.length), peak };
            });
            output.push({ pan, enabled, volume, played, channels });
        }
        return output;
    });
    await testInfo.attach('directional-audio-samples', { body: JSON.stringify(samples), contentType: 'application/json' });
    expect(samples[0].channels[0].rms).toBeGreaterThan(samples[0].channels[1].rms * 2);
    expect(samples[1].channels[1].rms).toBeGreaterThan(samples[1].channels[0].rms * 2);
    for (const sample of samples.slice(0, 2)) {
        expect(sample.played).toBe(true);
        for (const channel of sample.channels) {
            expect(channel.rms).toBeGreaterThan(.0001);
            expect(channel.peak).toBeLessThan(.15);
        }
    }
    for (const sample of samples.slice(2)) {
        expect(sample.played).toBe(false);
        sample.channels.forEach(channel => expect(channel.peak).toBe(0));
    }
    expect(failures).toEqual([]);
});

for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone settings and larger menu text stay reachable`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            localStorage.setItem('eidolon.uiScale', '85');
            const ui = new UIManager(true); window.__phoneSettings = ui;
            ui.showHUD(); ui.toggleChat(true); ui.toggleEscMenu(); ui.toggleSettings();
        });
        const panel = page.locator('#settings-screen'), body = panel.locator('.support-window__body--settings');
        const tabs = panel.locator('.phone-settings-tabs');
        await expect(page.locator('#esc-menu')).not.toBeVisible();
        expect(await panel.locator('label[for="graphics-quality"]').evaluate(n => getComputedStyle(n).fontSize)).toBe('16px');
        const scale = page.locator('#ui-scale');
        await scale.scrollIntoViewIfNeeded();
        const box = await scale.boundingBox();
        await page.touchscreen.tap(box.x + box.width - 4, box.y + box.height / 2);
        await expect(scale).toHaveValue('125');
        expect(await page.evaluate(() => localStorage.getItem('eidolon.uiScale'))).toBe('85');
        expect(await panel.locator('label[for="ui-scale"]').evaluate(n => getComputedStyle(n).fontSize)).toBe('20px');
        const screenScroll = await body.evaluate(n => n.scrollTop);
        await tabs.getByRole('button', { name: 'Play', exact: true }).tap();
        const autoLoot = page.locator('#auto-loot-enabled');
        await autoLoot.scrollIntoViewIfNeeded();
        expect((await autoLoot.boundingBox()).width).toBeGreaterThanOrEqual(44);
        await autoLoot.tap(); await expect(autoLoot).toBeChecked();
        await tabs.getByRole('button', { name: 'Screen', exact: true }).tap();
        expect(await body.evaluate(n => n.scrollTop)).toBeCloseTo(screenScroll, 0);
        for (const route of ['Sound', 'Device', 'Screen']) {
            await tabs.getByRole('button', { name: route, exact: true }).tap();
            expect(await body.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
            if (route === 'Sound') {
                const menus = page.locator('#audio-interface-volume');
                await menus.scrollIntoViewIfNeeded();
                const slider = await menus.boundingBox();
                await page.touchscreen.tap(slider.x + 2, slider.y + slider.height / 2);
                await expect(menus).toHaveValue('0');
                await expect(page.locator('#audio-combat-volume')).toHaveValue('100');
                expect(await page.evaluate(() => {
                    const audio = window.__phoneSettings.audioManager;
                    return { combat: audio.play('ability.fighter'), menus: audio.play('casino.win'),
                        saved: localStorage.getItem('eidolon.audioBus.interface'), state: audio.context?.state };
                })).toEqual({ combat: true, menus: false, saved: '0', state: 'running' });
                const mute = page.locator('#audio-enabled');
                await mute.scrollIntoViewIfNeeded(); await mute.tap();
                expect(await page.evaluate(() => window.__phoneSettings.audioManager.masterGain.gain.value)).toBe(0);
                await mute.tap();
            }
        }
        for (const button of await tabs.locator('button').all()) {
            await expect(button).toBeInViewport();
            expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
            expect(await button.evaluate(n => getComputedStyle(n).whiteSpace)).toBe('nowrap');
        }
        const bounds = await panel.boundingBox(), chat = await page.locator('#chat-box').boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(chat.y);
        await page.screenshot({ path: `/tmp/eidolon-phone-settings-${width}.png` });
        await page.locator('#chat-mobile-toggle').tap();
        await expect(panel).not.toBeVisible(); await expect(page.locator('#chat-input')).toBeVisible();
        await page.locator('#chat-mobile-toggle').tap();
        await page.evaluate(() => window.__phoneSettings.toggleSettings());
        await page.locator('#btn-close-settings-header').tap(); await expect(panel).not.toBeVisible();
        await page.evaluate(() => {
            const ui = window.__phoneSettings;
            ui.lastPlayerRef = { id: 'large-build', subType: 'Fighter', level: 100, selectedBranch: 'A', talentRanks: {}, skillRunes: {}, unlockedSkills: ['Charge', 'Iron Fortress'] };
            ui.skillTree.toggle(); ui.skillTree.skillTreeMode = 'runes'; ui.skillTree.renderSkillTree('Fighter');
        });
        expect(await page.locator('#skill-tree-content p').first().evaluate(n => getComputedStyle(n).fontSize)).toBe('20px');
        const equip = page.locator('button[data-build-action^="rune:"]').first();
        await equip.scrollIntoViewIfNeeded(); await expect(equip).toBeInViewport();
        expect(await page.locator('#skill-tree-content').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/eidolon-phone-large-build-${width}.png` });
        await page.evaluate(() => window.__phoneSettings.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
