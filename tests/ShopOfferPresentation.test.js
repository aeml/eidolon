import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function fixture(level = 7, gold = 1000) {
    document.body.innerHTML = '<div id="shop-grid"></div><h3 id="shop-gamble-title"></h3><p id="shop-purchase-status"></p>';
    const player = { level, gold, inventory: Array(25).fill(null) };
    const ui = Object.create(InventoryUI.prototype);
    ui.ctx = { getLastPlayer: () => player };
    ui.shopGambleTitle = document.getElementById('shop-gamble-title');
    ui.shopPurchaseStatus = document.getElementById('shop-purchase-status');
    ui.onBuyGamble = jest.fn(); ui.setupShop();
    return { ui, player, choices: [...ui.shopChoices.values()] };
}

afterEach(() => document.body.replaceChildren());

test.each([1, 7, 100])('every offer displays the exact35Gold per level purchase price at level%s', level => {
    const { choices } = fixture(level, 10000);
    expect(choices).toHaveLength(12);
    for (const { button, price, name } of choices) {
        expect(price.textContent.replace(/,/g, '')).toBe(`${35 * level} Gold`);
        expect(button.getAttribute('aria-label')).toBe(`${name}, ${35 * level} Gold`);
        expect(button.disabled).toBe(false);
        expect(button.querySelector('img').src).toMatch(/^data:image\/svg\+xml/);
    }
});

test('wallet and bag updates preserve card identity/focus and never mutate money or equipment', () => {
    const { ui, player, choices } = fixture(); const first = choices[0].button;
    first.focus(); const saved = JSON.stringify(player);
    first.click(); expect(ui.onBuyGamble).toHaveBeenCalledWith('head'); expect(JSON.stringify(player)).toBe(saved);
    player.level = 8; ui.refreshShopOffers(player);
    expect(ui.shopChoices.get('head').button).toBe(first); expect(document.activeElement).toBe(first);
    expect(choices[0].price.textContent).toBe('280 Gold');
    player.gold = 279; ui.refreshShopOffers(player);
    expect(choices.every(({ button }) => button.disabled)).toBe(true);
    expect(ui.shopPurchaseStatus.textContent).toContain('You need 280 Gold');
    first.click(); expect(ui.onBuyGamble).toHaveBeenCalledTimes(1);
    player.gold = 5000; player.inventory = Array.from({ length: 25 }, (_, i) => ({ id: `item-${i}` })); ui.refreshShopOffers(player);
    expect(choices.every(({ button }) => button.disabled)).toBe(true); expect(ui.shopPurchaseStatus.textContent).toContain('bag is full');
    player.inventory[0] = null; ui.refreshShopOffers(player);
    expect(choices.every(({ button }) => !button.disabled)).toBe(true);
});

test('missing character details never display an invented usable price', () => {
    const { ui, player, choices } = fixture(0);
    expect(choices.every(({ button, price }) => button.disabled && price.textContent === 'Price unavailable')).toBe(true);
    expect(ui.shopPurchaseStatus.textContent).toContain('character details');
    player.level = 7; ui.refreshShopOffers(player);
    expect(choices[0].price.textContent).toBe('245 Gold');
});
