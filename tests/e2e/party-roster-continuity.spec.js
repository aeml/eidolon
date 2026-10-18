import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const width of [1280, 1440]) test.describe(`Desktop party press continuity ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('held healing and leader actions survive health updates', async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { SocialUI } = await import('/src/ui/SocialUI.js');
            document.getElementById('start-screen').style.display = 'none';
            const state = window.__partyContinuity = { player: { id: 'self' }, sent: [],
                data: { partyId: 'prepared-roster', leaderId: 'self', members: [
                    { id: 'self', name: 'Healer', class: 'Cleric', level: 30, hp: 100, maxHp: 100, isLeader: true },
                    { id: 'ally', name: 'Tank', class: 'Fighter', level: 30, hp: 50, maxHp: 100 }
                ] } };
            state.ui = new SocialUI({ isMobile: false, getLastPlayer: () => state.player });
            state.ui.onPartyKick = id => state.sent.push(['kick', id]);
            state.ui.onPartyPromote = id => state.sent.push(['promote', id]);
            state.ui.updateParty(state.data);
        });
        const update = () => page.evaluate(async () => {
            const state = window.__partyContinuity;
            state.data.members[1].hp--; state.ui.updateParty(structuredClone(state.data));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const pressAcrossUpdate = async button => {
            await button.scrollIntoViewIfNeeded(); const box = await button.boundingBox(); expect(box).toBeTruthy();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
            try { await update(); } finally { await page.mouse.up(); }
        };
        try {
            const heal = page.getByRole('button', { name: 'Select Tank for healing', exact: true });
            await pressAcrossUpdate(heal); await expect(heal).toHaveAttribute('aria-pressed', 'true');
            const clear = page.getByRole('button', { name: 'Clear healing target · Tank', exact: true });
            await clear.focus(); await page.keyboard.down('Space');
            try { await update(); } finally { await page.keyboard.up('Space'); }
            await expect(heal).toHaveAttribute('aria-pressed', 'false');
            await pressAcrossUpdate(page.getByRole('button', { name: 'Promote Tank to party leader', exact: true }));
            await pressAcrossUpdate(page.getByRole('button', { name: 'Kick Tank from party', exact: true }));
            expect(await page.evaluate(() => window.__partyContinuity.sent)).toEqual([['promote', 'ally'], ['kick', 'ally']]);
            expect(await page.evaluate(() => {
                const state = window.__partyContinuity, ui = state.ui;
                const old = ui.partyList.querySelector('[title="Kick"]'), oldCallback = old.onclick;
                state.data.leaderId = 'ally'; ui.updateParty(state.data); oldCallback.call(old);
                state.data.leaderId = 'self'; ui.updateParty(state.data); oldCallback.call(old);
                const heal = ui.partyList.querySelector('[data-party-support-target="ally"]'), captured = heal.onclick;
                const current = ui.partyList.querySelector('[title="Kick"]'), kick = current.onclick;
                ui.dispose(); captured.call(heal); kick.call(current);
                return { sent: state.sent, selected: ui.selectedSupportTargetId, connectedControls: ui.partyList.childElementCount };
            })).toEqual({ sent: [['promote', 'ally'], ['kick', 'ally']], selected: null, connectedControls: 0 });
            expect(failures, failures.join('\n')).toEqual([]);
        } finally { await page.evaluate(() => window.__partyContinuity?.ui.dispose()); }
    });
});
