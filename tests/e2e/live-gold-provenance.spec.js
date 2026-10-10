import { expect, test } from '@playwright/test';
import protobuf from 'protobufjs/minimal.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGoldProvenanceObserver } from '../../scripts/gold-provenance-observer.mjs';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel, exerciseAreaHazards,
    exerciseCombatAndLoot, loginAndEnterWorld } from './helpers.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';

globalThis.protobuf = protobuf;
const { eidolon } = await import('../../src/proto/state_pb.js');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('records the actual live persistent QA Gold boundary once with unchanged assertions', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_GOLD_PROVENANCE_ONCE !== '1', 'Explicit one-run live diagnostic only');
    test.setTimeout(180_000);
    const credentials = credentialsFromEnvironment();
    expect(Boolean(credentials.username && credentials.password)).toBe(true);
    const expected = '77859697a71329facd0584a95167c80eac392398';
    const release = await (await page.request.get(`${baseURL}/release.json`, { timeout: 10_000 })).json();
    const health = await (await page.request.get(process.env.EIDOLON_E2E_HEALTH_URL, { timeout: 10_000 })).json();
    expect(release.commit).toBe(expected); expect(health.commit).toBe(expected);
    expect(health.status).toBe('ok'); expect(health.database).toBe('ready');
    let observer;
    let decodeErrors = 0;
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
        const server = socket.connectToServer();
        socket.onMessage(message => {
            try { if (typeof message === 'string') observer?.observeJSON('outgoing', JSON.parse(message)); }
            catch { decodeErrors++; }
            finally { server.send(message); }
        });
        server.onMessage(message => {
            try {
                if (typeof message === 'string') observer?.observeJSON('incoming', JSON.parse(message));
                else if (message.length > 5 && message.subarray(0, 4).toString() === 'EDPB' && message[4] === 2)
                    observer?.observeEnvelope(eidolon.state.StateEnvelope.decode(message.subarray(5)));
                else decodeErrors++;
            } catch { decodeErrors++; }
            finally { socket.send(message); }
        });
    });
    const observedPage = new Proxy(page, { get(target, property) {
        if (property !== 'evaluate') {
            const value = Reflect.get(target, property);
            return typeof value === 'function' ? value.bind(target) : value;
        }
        return async (fn, argument) => {
            const value = await page.evaluate(fn, argument), source = String(fn);
            if (value?.expectedGold !== undefined && value?.itemId) observer?.observeClient('sale_plan', value);
            else if (source.includes('get_ep_wallet') && value?.gold !== undefined) observer?.observeClient('wallet_baseline', value);
            else if (value?.inventory && value?.stash && value?.gold !== undefined) observer?.observeClient('custody_snapshot', value);
            else if (source.includes('player?.gold') && typeof value === 'number') observer?.observeClient('gold_poll', value);
            return value;
        };
    } });
    const failures = collectBrowserFailures(page, baseURL);
    let routeCompleted = false;
    try {
        await loginAndEnterWorld(observedPage, credentials);
        observer = createGoldProvenanceObserver(await page.evaluate(() => window.game.player.id));
        await ensureDungeonReadyLevel(observedPage);
        await exerciseAreaHazards(observedPage);
        await exerciseCombatAndLoot(observedPage, { storeSpare: storePersistentQALootSpare });
        routeCompleted = true;
        expect(failures, failures.join('\n')).toEqual([]);
        expect(decodeErrors).toBe(0);
        expect(observer.snapshot().complete).toBe(true);
    } finally {
        const receipt = { recordedUTC: new Date().toISOString(), expectedLiveCommit: expected, frontend: release,
            backend: { commit: health.commit, version: health.version, status: health.status, database: health.database },
            routeCompleted, decodeErrors, observation: observer?.snapshot() || { records: [], complete: false, ownerBound: false },
            scope: 'One instrumented instance of the existing live login/level/hazard/combat-loot route. Original helpers/assertions/budgets unchanged. Every packet forwarded verbatim; no host scheduling, balance or queue changes. This is diagnostic evidence, not a rerun/waiver of the failed release gate.' };
        await mkdir('gold-provenance-evidence', { recursive: true, mode: 0o700 });
        const encoded = JSON.stringify(receipt, null, 2);
        await writeFile(path.join('gold-provenance-evidence', 'live-gold-provenance.json'), encoded, { mode: 0o600 });
        await testInfo.attach('live-gold-provenance', { body: encoded, contentType: 'application/json' });
    }
});
