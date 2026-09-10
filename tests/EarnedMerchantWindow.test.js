import { jest } from '@jest/globals';

jest.unstable_mockModule('@playwright/test', () => ({ expect: locator => ({
    async toBeVisible() { expect(await locator.isVisible()).toBe(true); }
}) }));
const { ensureEarnedMerchantWindow } = await import('./e2e/earned-merchant-window.js');

function setup(shopOpen, bagOpen = shopOpen) {
    const visible = { '#shop-screen': shopOpen, '#inventory-screen': bagOpen };
    return { visible, page: { locator: id => ({ isVisible: async () => visible[id] }) } };
}

test('an already open real shop is retained without a second toggle click', async () => {
    const { page } = setup(true);
    const interact = jest.fn();
    expect(await ensureEarnedMerchantWindow(page, interact)).toBe('already-open');
    expect(interact).not.toHaveBeenCalled();
});

test('a closed shop is opened once by the supplied ordinary interaction', async () => {
    const { page, visible } = setup(false);
    const interact = jest.fn(async () => {
        visible['#shop-screen'] = true;
        visible['#inventory-screen'] = true;
    });
    expect(await ensureEarnedMerchantWindow(page, interact)).toBe('opened');
    expect(interact).toHaveBeenCalledTimes(1);
});

test('a failed interaction does not become success or repeated blind clicks', async () => {
    const { page } = setup(false);
    const interact = jest.fn();
    await expect(ensureEarnedMerchantWindow(page, interact)).rejects.toThrow();
    expect(interact).toHaveBeenCalledTimes(1);
});

test('an open shop with a hidden bag is still an actionable failure', async () => {
    const { page } = setup(true, false);
    const interact = jest.fn();
    await expect(ensureEarnedMerchantWindow(page, interact)).rejects.toThrow();
    expect(interact).not.toHaveBeenCalled();
});
