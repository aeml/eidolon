import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) test(`persistent six-seat card tables and clocks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { BlackjackTableUI } = await import('/src/ui/BlackjackTableUI.js');
        const { PokerTableUI } = await import('/src/ui/PokerTableUI.js');
        document.getElementById('start-screen').style.display = 'none';
        const panel = document.createElement('section'); panel.className = 'casino-session has-blackjack';
        const header = document.createElement('header'); header.className = 'casino-session-header';
        header.innerHTML = '<h2>Lanternhold Blackjack</h2><button>Leave table</button>'; panel.append(header);
        const blackjack = new BlackjackTableUI(() => {}), poker = new PokerTableUI(() => {});
        panel.append(blackjack.root, poker.root); document.body.append(panel);
        const occupants = ['Thorn', 'Mira', 'Orin', 'Selen', 'Ilyra', 'Aeral'].map((name, seat) => ({ name, seat, playerId: name, connected: true }));
        const presence = { yourSeat: { seat: 0 }, occupants };
        const fresh = phase => ({ available: true, processing: false, roundId: phase, phase, gold: 100000, players: [],
            serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(), nextRoundAt: new Date(Date.now() + 12000).toISOString() });
        blackjack.update(fresh('betting'), 'Thorn', presence);
        window.__cardFlow = { blackjack, poker, panel, presence, fresh };
    });
    const scene = page.locator('.blackjack-scene');
    await expect(scene.locator('.card-table-seat')).toHaveCount(6);
    await expect(scene.locator('.card-table-clock strong')).toHaveText('30s');
    await expect(scene.locator('.card-table-clock strong')).toHaveText('29s');
    await expect(scene.locator('.card-table-clock strong')).toHaveText('28s');
    for (const kind of ['blackjack', 'poker']) {
        await page.evaluate(kind => {
            const f = window.__cardFlow; f.blackjack.update(null); f.poker.update(null); f.panel.className = `casino-session has-${kind}`;
            f.panel.querySelector('h2').textContent = kind === 'poker' ? 'Fourfold Hold’em' : 'Lanternhold Blackjack';
            const view = f.fresh('playing');
            view.players = f.presence.occupants.map(p => ({ ...p, bet: 100, buyIn: 100 }));
            view.round = { revision: 1, phase: 'playing', turnPlayerId: 'Thorn', turnHand: 0, deadline: new Date(Date.now() + 30000).toISOString(),
                dealer: [9], dealerHidden: true, actions: kind === 'poker' ? ['check', 'fold'] : ['hit', 'stand'], street: 'flop', board: [0, 9, 10], buttonSeat: 3, pots: [{ amount: 120 }],
                players: view.players.map((p, index) => ({ ...p, stack: 80, streetBet: 20, committed: 20,
                    cards: index ? [-1, -1] : [1, 14], bestHand: index ? '' : 'Pair of 2s', hands: [{ cards: [index + 2, 20], bet: 100 }] })) };
            f[kind].update(view, 'Thorn', f.presence);
        }, kind);
        const table = page.locator(`.${kind}-scene`);
        await expect(table.locator('.card-table-seat')).toHaveCount(6);
        await expect(table.locator('.card-table-dealer')).toContainText('House dealer');
        expect(await page.locator('.casino-session').evaluate(n => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(1);
        // Every seat remains inside the table; no seat/card content intersects
        // another seat or the dealer. Table clock cannot sit over your cards.
        const overlaps = await table.evaluate(el => {
            const parts = [...el.querySelectorAll('.card-table-seat'), el.querySelector('.card-table-dealer'), el.querySelector('.card-table-clock')];
            const bad = [];
            for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
                const a = parts[i].getBoundingClientRect(), b = parts[j].getBoundingClientRect();
                if (Math.min(a.right,b.right)-Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 1) bad.push([i,j]);
            }
            return bad;
        });
        expect(overlaps).toEqual([]);
        await page.locator('.casino-session').evaluate(n => { n.scrollTop = 0; });
        await expect(page.getByRole('button', { name: kind === 'poker' ? 'Check' : 'Hit', exact: true })).toBeInViewport();
        await page.screenshot({ path: `/tmp/eidolon-${kind}-six-seats-${width}.png` });
        for (const phase of ['complete', 'betting']) {
            await page.evaluate(({ kind, phase }) => { const f = window.__cardFlow; f[kind].update(f.fresh(phase), 'Thorn', f.presence); }, { kind, phase });
            await expect(table.locator('.card-table-seat-name').filter({ hasText: 'Thorn' })).toHaveCount(1);
            await expect(table.locator('.card-table-dealer')).toBeVisible();
            await expect(table.locator('.card-table-clock strong')).toHaveText(phase === 'complete' ? '12s' : '30s');
        }
    }
});
