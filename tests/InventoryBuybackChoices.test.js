import { jest } from '@jest/globals';
import { InventoryUI } from '../src/ui/InventoryUI.js';

function setup() {
    document.body.innerHTML = '<div id="buyback-grid"></div>';
    const inventory = new InventoryUI({ isMobile: false, getLastPlayer: () => null,
        getItemIconPath: () => '/icons/item.png', formatStatName: key => key });
    inventory.onBuyback = jest.fn();
    return inventory;
}
const item = (id, extra = {}) => ({ id, name: `Blade ${id}`, value: 125,
    rarity: { name: 'Rare', color: '#5599ff' }, ...extra });

test('buyback exposes safe item names, quantities and exact server-compatible total prices', () => {
    const inventory = setup();
    const items = [item('normal', { name: '<img src=x onerror=alert(1)>', stack: 2 }),
        item('legacy', { value: -3, stack: 0 }), item('zero', { value: 0, stack: 3 })];
    const before = JSON.stringify(items);
    inventory.updateBuybackList(items);
    const choices = [...inventory.buybackGrid.children];
    expect(choices.map(node => node.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
    expect(choices.map(node => node.getAttribute('aria-label'))).toEqual([
        'Buy back Blade zero ×3 for 3 Gold', 'Buy back Blade legacy for 1 Gold',
        'Buy back <img src=x onerror=alert(1)> ×2 for 250 Gold'
    ]);
    expect(choices[2].textContent).toContain('250 Gold');
    expect(choices[2].querySelector('img')).toBeNull();
    choices[2].click();
    expect(inventory.onBuyback).toHaveBeenCalledTimes(1);
    expect(inventory.onBuyback).toHaveBeenCalledWith('normal');
    expect(JSON.stringify(items)).toBe(before);
    items[0].id = 'changed-before-redraw';
    choices[2].click();
    expect(inventory.onBuyback.mock.calls).toEqual([['normal'], ['normal']]);
});

test('unchanged refresh and reorder retain native choices, focus and reading position by item identity', () => {
    const inventory = setup(), items = [item('first'), item('second')];
    inventory.updateBuybackList(items);
    const original = inventory.buybackGrid.lastElementChild;
    original.focus(); inventory.buybackGrid.scrollTop = 80;
    inventory.updateBuybackList(JSON.parse(JSON.stringify(items)));
    expect(inventory.buybackGrid.lastElementChild).toBe(original);
    expect(document.activeElement).toBe(original);
    expect(inventory.buybackGrid.scrollTop).toBe(80);
    inventory.updateBuybackList([...items].reverse());
    expect(inventory.buybackGrid.firstElementChild).toBe(original);
    expect(document.activeElement).toBe(original);
    original.click();
    expect(inventory.onBuyback).toHaveBeenCalledTimes(1);
    expect(inventory.onBuyback).toHaveBeenCalledWith('first');
});

test('changed or removed choices cannot invoke obsolete actions; removal and empty lists have named focus fallback', () => {
    const inventory = setup();
    inventory.updateBuybackList([item('a')]);
    const old = inventory.buybackGrid.firstElementChild;
    old.focus();
    inventory.updateBuybackList([item('a', { value: 20, stack: 3 })]);
    expect(document.activeElement.getAttribute('aria-label')).toBe('Buy back Blade a ×3 for 60 Gold');
    old.onclick();
    expect(inventory.onBuyback).not.toHaveBeenCalled();
    const current = document.activeElement;
    inventory.updateBuybackList([]);
    expect(document.activeElement).toBe(inventory.buybackGrid);
    expect(inventory.buybackGrid.getAttribute('aria-label')).toBe('Items available to buy back');
    expect(inventory.buybackGrid.textContent).toContain('No items available');
    current.onclick();
    inventory.updateBuybackList([item('last')]);
    const last = inventory.buybackGrid.firstElementChild;
    inventory.dispose(); last.click();
    inventory.updateBuybackList([item('after-disposal')]);
    expect(inventory.buybackGrid.firstElementChild).toBe(last);
    expect(inventory.onBuyback).not.toHaveBeenCalled();
});

test('unrepresentable or unknown prices and ambiguous item IDs are readable but cannot be purchased', () => {
    const inventory = setup();
    inventory.updateBuybackList([item('missing', { value: undefined }), item('fraction', { value: 1.5 }),
        item('overflow', { value: Number.MAX_SAFE_INTEGER, stack: 2 }), item('bad-stack', { stack: Infinity }),
        item('duplicate'), item('duplicate', { name: 'Other blade' })]);
    const choices = [...inventory.buybackGrid.children];
    expect(choices).toHaveLength(6);
    for (const choice of choices) {
        expect(choice.disabled).toBe(true);
        choice.click();
    }
    expect(choices[0].textContent).toContain('Item unavailable');
    expect(choices[5].textContent).toContain('Price unavailable');
    expect(inventory.onBuyback).not.toHaveBeenCalled();
});
