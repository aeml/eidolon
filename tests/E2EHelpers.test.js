import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import {
    isBenignCanceledAssetRequest,
    isIgnoredBrowserRequest
} from './e2e/browserFailurePolicy.js';
import {
    backendOriginBrowserArgs,
    hardwareWebGLBrowserArgs
} from './e2e/browserLaunchPolicy.js';

const playwrightExpect = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: playwrightExpect }));
const { collectBrowserFailures, openGame, returnToTown, jumpByGroundClick, settlePointerRaycast, waitForPersistedPickup, freePersistentQALootSlot } = await import('./e2e/helpers.js');

describe('persistent QA bag rotation with earned deliveries', () => {
    let previousGame;
    beforeEach(() => {
        previousGame = window.game;
        playwrightExpect.mockImplementation(actual => ({ not: { toBeNull: () => expect(actual).not.toBeNull() } }));
        playwrightExpect.poll = jest.fn(observe => ({
            toBe: async expected => expect(await observe()).toBe(expected),
            toBeLessThan: async expected => expect(await observe()).toBeLessThan(expected)
        }));
    });
    afterEach(() => {
        window.game = previousGame;
        playwrightExpect.mockReset();
        delete playwrightExpect.poll;
    });
    const spare = id => ({ id, type: 'ARMOR', slot: 'head', rarity: 'Common', value: 1 });
    const harness = (inventory, pending = [], rejectSale = false) => {
        const sales = [];
        window.game = { player: { inventory, equipment: {} }, uiManager: { inventory: { onSellItem: index => {
            sales.push(inventory[index].id);
            if (rejectSale) return;
            inventory.splice(index, 1);
            inventory.push(pending.shift() || null);
        } } } };
        const page = { evaluate: jest.fn(async (fn, arg) => fn.name === 'readPlayerStateInPage'
            ? { inventoryCount: inventory.filter(item => item?.id).length } : fn(arg)) };
        return { page, sales };
    };
    test('verifies individual removals and rechecks space after two preserved earned deliveries', async () => {
        const bag = Array.from({ length: 25 }, (_, index) => spare(`spare-${index}`));
        const invested = { ...spare('invested'), potency: 7, stats: { damage: 73 } };
        const protectedQuest = { ...spare('chronicle-item-protected') };
        bag[0] = invested;
        bag[1] = protectedQuest;
        const firstEarned = { ...spare('earned-one'), potency: 7 };
        const secondEarned = { ...spare('earned-two'), rarity: 'Legendary' };
        const { page, sales } = harness(bag, [firstEarned, secondEarned]);
        await freePersistentQALootSlot(page);
        expect(sales).toEqual(['spare-2', 'spare-3', 'spare-4']);
        expect(bag.filter(item => item?.id)).toHaveLength(24);
        expect(bag).toEqual(expect.arrayContaining([invested, protectedQuest, firstEarned, secondEarned]));
        expect(playwrightExpect.poll).toHaveBeenCalledTimes(3);
    });
    test('a rejected sale fails on that exact item, without retrying another obsolete index', async () => {
        const { page, sales } = harness(Array.from({ length: 25 }, (_, index) => spare(`spare-${index}`)), [], true);
        await expect(freePersistentQALootSlot(page)).rejects.toThrow();
        expect(sales).toEqual(['spare-0']);
    });
    test('a protected full bag is not cleared, sold or silently accepted', async () => {
        const { page, sales } = harness(Array.from({ length: 25 }, (_, index) => ({ ...spare(`protected-${index}`), potency: 1 })));
        await expect(freePersistentQALootSlot(page)).rejects.toThrow();
        expect(sales).toEqual([]);
    });
    test('an existing free slot requires no rotation', async () => {
        const { page, sales } = harness([...Array.from({ length: 24 }, (_, index) => spare(`spare-${index}`)), null]);
        await freePersistentQALootSlot(page);
        expect(sales).toEqual([]);
    });
    test('explicit reversible storage fallback rechecks capacity and returns retained gear for fresh-login proof', async () => {
        const bag = Array.from({ length: 25 }, (_, index) => ({ ...spare(`invested-${index}`), potency: 7 }));
        const { page, sales } = harness(bag);
        const stash = [];
        const storeSpare = jest.fn(async () => {
            const item = bag.find(entry => entry?.id);
            bag[bag.indexOf(item)] = null;
            stash.push(item);
            return item;
        });
        expect(await freePersistentQALootSlot(page, { storeSpare })).toEqual(stash);
        expect(sales).toEqual([]);
        expect(storeSpare).toHaveBeenCalledTimes(1);
        expect(bag.filter(item => item?.id)).toHaveLength(24);
        expect(stash[0].potency).toBe(7);
    });
    test('unbounded deferred loot cannot cause unbounded vendor actions', async () => {
        const { page, sales } = harness(Array.from({ length: 25 }, (_, index) => spare(`spare-${index}`)),
            Array.from({ length: 26 }, (_, index) => ({ ...spare(`earned-${index}`), potency: 7 })));
        await expect(freePersistentQALootSlot(page)).rejects.toThrow();
        expect(sales).toHaveLength(25);
    });
});

describe('fresh-login exact pickup readiness', () => {
    afterEach(() => { playwrightExpect.mockReset(); delete playwrightExpect.poll; });
    test.each([false, true])('the exact %s-stackable receipt is retained while private state arrives', async stackable => {
        const item = { id: 'earned-item', name: 'Earned item', maxStack: stackable ? 99 : 1 };
        const receipt = { item, quantity: stackable ? 7 : 1 };
        const page = { evaluate: jest.fn().mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ ...item, id: 'unrelated-item', name: 'Other item', stack: 99 }])
            .mockResolvedValueOnce([{ ...item, stack: receipt.quantity }]) };
        const compare = jest.fn(async expected => {
            const observe = playwrightExpect.poll.mock.calls[0][0];
            expect(await observe()).toBe(0);
            expect(await observe()).toBe(0);
            expect(await observe()).toBeGreaterThanOrEqual(expected);
        });
        playwrightExpect.poll = jest.fn(() => ({ toBeGreaterThanOrEqual: compare }));
        await waitForPersistedPickup(page, receipt);
        expect(compare).toHaveBeenCalledWith(receipt.quantity);
        expect(playwrightExpect.poll.mock.calls[0][1].timeout).toBe(10000);
    });
    test('a missing saved item still fails; there is no grant, retry login or receipt replacement', async () => {
        const failure = new Error('exact saved item absent');
        playwrightExpect.poll = jest.fn(() => ({ toBeGreaterThanOrEqual: jest.fn().mockRejectedValue(failure) }));
        const page = { evaluate: jest.fn() };
        await expect(waitForPersistedPickup(page, { item: { id: 'missing', name: 'Missing' }, quantity: 1 }))
            .rejects.toBe(failure);
    });
});

describe('pointer raycast settling', () => {
    test('waits for actual completion with a bounded frame recovery window', async () => {
        const page = { waitForFunction: jest.fn(async predicate => {
            const previous = window.game;
            try {
                window.game = undefined;
                expect(predicate()).toBe(false);
                window.game = { needsRaycast: true };
                expect(predicate()).toBe(false);
                window.game.needsRaycast = false;
                expect(predicate()).toBe(true);
            } finally { window.game = previous; }
        }), evaluate: jest.fn() };
        await settlePointerRaycast(page);
        expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), null,
            { polling: 'raf', timeout: 5000 });
        expect(page.evaluate).not.toHaveBeenCalled();
    });
    test.each([true, false])('a failed wait retains its cause (diagnostics available: %s)', async available => {
        const cause = new Error('Timeout 5000ms exceeded');
        const page = { waitForFunction: jest.fn().mockRejectedValue(cause),
            evaluate: available ? jest.fn().mockResolvedValue({ frameCount: 12, needsRaycast: true })
                : jest.fn().mockRejectedValue(new Error('page closed')) };
        const failure = await settlePointerRaycast(page).catch(error => error);
        expect(failure.cause).toBe(cause);
        expect(failure.message).toContain(cause.message);
        expect(failure.message).toContain(available ? '"needsRaycast":true' : '"unavailable":true');
    });
});

describe('jump landing failure evidence', () => {
    afterEach(() => playwrightExpect.mockReset());
    const attempt = async (cause, diagnosticAvailable = true) => {
        playwrightExpect.mockReturnValue({ toBe: jest.fn() });
        playwrightExpect.poll = jest.fn()
            .mockReturnValueOnce({ toBeGreaterThan: jest.fn().mockResolvedValue(undefined) })
            .mockReturnValueOnce({ toBe: jest.fn().mockRejectedValue(cause) });
        const evaluate = jest.fn().mockResolvedValueOnce({ x: 0, z: 0 })
            .mockResolvedValueOnce({ canvas: true, x: 400, y: 300 });
        if (diagnosticAvailable) evaluate.mockResolvedValueOnce({ jump: { progress: .984 } });
        else evaluate.mockRejectedValueOnce(new Error('page closed during diagnostics'));
        const page = { evaluate, mouse: { move: jest.fn(), click: jest.fn() },
            keyboard: { down: jest.fn(), up: jest.fn() } };
        let failure;
        try { await jumpByGroundClick(page, 25, 0); } catch (error) { failure = error; }
        expect(failure).toBeInstanceOf(Error);
        expect(failure.cause).toBe(cause);
        expect(failure.message).toContain(cause.message);
        expect(page.keyboard.up).toHaveBeenCalledWith('Control');
        expect(playwrightExpect.poll.mock.calls.map(call => call[1])).toEqual([
            { timeout: 4_000 }, { timeout: 8_000 }
        ]);
        return failure;
    };
    test('an overall route timeout remains distinguishable from a stalled jump', async () => {
        const failure = await attempt(new Error('Test timeout of 3600000ms exceeded'));
        expect(failure.message).toContain('"progress":0.984');
    });
    test('an actual landing assertion failure still fails with its original cause', async () => {
        await attempt(new Error('Landing poll timed out after 8000ms'));
    });
    test('lost diagnostic access cannot replace the original failure', async () => {
        const failure = await attempt(new Error('Test timeout of 3600000ms exceeded'), false);
        expect(failure.message).toContain('"unavailable":true');
        expect(failure.message).not.toContain('page closed');
    });
});

describe('unfinished hunt recall', () => {
    test('a death between the resource observation and Recall cannot become a free rest stop', async () => {
        const page = { evaluate: jest.fn(async () => ({ state: 'DEAD' })),
            locator: jest.fn(), keyboard: { press: jest.fn() } };
        await expect(returnToTown(page, { allowRespawn: false })).rejects.toThrow('cannot hide a respawn');
        expect(page.locator).not.toHaveBeenCalled();
        expect(page.keyboard.press).not.toHaveBeenCalled();
    });
    test('a living retreat still uses the ordinary Recall key', async () => {
        const page = { evaluate: jest.fn(async () => ({ state: 'IDLE' })), locator: jest.fn(),
            keyboard: { press: jest.fn(async () => { throw new Error('input receipt'); }) } };
        await expect(returnToTown(page, { allowRespawn: false })).rejects.toThrow('input receipt');
        expect(page.keyboard.press).toHaveBeenCalledWith('b');
        expect(page.locator).not.toHaveBeenCalled();
    });
    test('existing explicit recovery callers retain their respawn action', async () => {
        const click = jest.fn(async () => { throw new Error('respawn receipt'); });
        const page = { evaluate: jest.fn(async () => ({ state: 'DEAD' })),
            locator: jest.fn(() => ({ click })) };
        await expect(returnToTown(page)).rejects.toThrow('respawn receipt');
        expect(page.locator).toHaveBeenCalledWith('#btn-death-respawn');
    });
});

function request(url, resourceType = 'document', errorText = 'net::ERR_ABORTED') {
    return {
        url: () => url,
        method: () => 'GET',
        resourceType: () => resourceType,
        failure: () => ({ errorText })
    };
}

function response(url, status = 200, resourceType = 'document') {
    return {
        url: () => url,
        status: () => status,
        request: () => ({
            method: () => 'GET',
            resourceType: () => resourceType
        })
    };
}

describe('browser failure collection', () => {
    test('ignores only Cloudflare-injected RUM posts', () => {
        expect(isIgnoredBrowserRequest(
            'POST',
            'https://eidolon.mendola.tech/cdn-cgi/rum?'
        )).toBe(true);
        expect(isIgnoredBrowserRequest(
            'GET',
            'https://eidolon.mendola.tech/cdn-cgi/rum?'
        )).toBe(false);
        expect(isIgnoredBrowserRequest(
            'POST',
            'https://eidolon.mendola.tech/src/main.js'
        )).toBe(false);
    });

    test('does not suppress asset cancellations after the procedural icon cutover', () => {
        const iconURL = 'https://eidolon.mendola.tech/assets/icons/wizard/inferno_cataclysm.png';
        expect(isBenignCanceledAssetRequest('image', 'net::ERR_ABORTED', iconURL)).toBe(false);
        expect(isBenignCanceledAssetRequest('image', 'net::ERR_FAILED', iconURL)).toBe(false);
        expect(isBenignCanceledAssetRequest(
            'fetch',
            'net::ERR_ABORTED',
            'https://eidolon.mendola.tech/assets/models/wizard.glb'
        )).toBe(false);
        expect(isBenignCanceledAssetRequest(
            'image',
            'net::ERR_ABORTED',
            'https://eidolon.mendola.tech/src/main.js'
        )).toBe(false);
    });

    test('scopes the backend origin mapping to a validated literal address', () => {
        expect(hardwareWebGLBrowserArgs()).toEqual(expect.arrayContaining([
            '--use-angle=vulkan',
            '--enable-features=Vulkan'
        ]));
        expect(backendOriginBrowserArgs('')).toEqual([]);
        expect(backendOriginBrowserArgs('192.0.2.10')).toEqual(expect.arrayContaining([
            expect.stringContaining('MAP eserver.mendola.tech 192.0.2.10'),
            expect.stringContaining('MAP server.eidolonrealms.com 192.0.2.10'),
            expect.stringContaining('LocalNetworkAccessChecks')
        ]));
        expect(() => backendOriginBrowserArgs('backend.example.com')).toThrow(/literal IPv4 or IPv6/);
    });
});

describe('live browser failure reconciliation', () => {
    test('resource console errors retain the failed source without hiding DNS failures', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');
        page.emit('console', {
            type: () => 'error',
            text: () => 'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
            location: () => ({ url: 'https://external.example/collect', lineNumber: 0 })
        });
        expect(failures).toEqual([
            'console: Failed to load resource: net::ERR_NAME_NOT_RESOLVED [https://external.example/collect:0]'
        ]);
    });

    test('console failures without a source are still retained', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');
        page.emit('console', { type: () => 'error', text: () => 'Unexpected runtime failure' });
        expect(failures).toEqual(['console: Unexpected runtime failure']);
    });

    test('exhausted navigation reports the underlying DNS error and attempted release route', async () => {
        const previousCommit = process.env.EIDOLON_EXPECTED_COMMIT;
        process.env.EIDOLON_EXPECTED_COMMIT = 'exact-release';
        const cause = new Error('page.goto: net::ERR_NAME_NOT_RESOLVED at https://eidolon.example/');
        const assertion = jest.fn(() => { throw new Error('document assertion failed'); });
        playwrightExpect.mockReturnValue({ toBe: assertion });
        const page = { goto: jest.fn().mockRejectedValue(cause), waitForTimeout: jest.fn() };
        try {
            await expect(openGame(page, { attempts: 1 })).rejects.toThrow('document assertion failed');
            expect(page.goto).toHaveBeenCalledTimes(1);
            expect(page.waitForTimeout).not.toHaveBeenCalled();
            expect(playwrightExpect).toHaveBeenCalledWith(undefined,
                expect.stringContaining(`route=/?release=exact-release; last error=${cause.message}`));
            expect(assertion).toHaveBeenCalledWith(200);
        } finally {
            if (previousCommit === undefined) delete process.env.EIDOLON_EXPECTED_COMMIT;
            else process.env.EIDOLON_EXPECTED_COMMIT = previousCommit;
            playwrightExpect.mockReset();
        }
    });

    test('a successful retry clears an earlier failed document request for the same route', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/?release=old'));
        expect(failures).toHaveLength(1);

        page.emit('response', response('https://eidolon.example/?release=current'));
        expect(failures).toEqual([]);
    });

    test('an unrecovered failed document remains actionable', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/?release=current'));

        expect(failures).toEqual([
            'requestfailed: GET https://eidolon.example/?release=current (net::ERR_ABORTED)'
        ]);
    });

    test('success on a different document route does not hide the failure', () => {
        const page = new EventEmitter();
        const failures = collectBrowserFailures(page, 'https://eidolon.example');

        page.emit('requestfailed', request('https://eidolon.example/game?release=current'));
        page.emit('response', response('https://eidolon.example/repro.html'));

        expect(failures).toHaveLength(1);
    });
});
