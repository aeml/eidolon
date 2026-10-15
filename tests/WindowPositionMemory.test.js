import { jest } from '@jest/globals';
import { installUIManagerWindows } from '../src/ui/UIManagerWindows.js';

class Layout {
    isElementVisible(element) { return Boolean(element && element.style.display !== 'none'); }
    playUICue() {}
    closeAllStaticModals() {}
}
installUIManagerWindows(Layout);

const viewport = { width: window.innerWidth, height: window.innerHeight };
const resize = (width, height) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};
beforeEach(() => resize(1280, 800));
afterEach(() => { resize(viewport.width, viewport.height); document.body.replaceChildren(); });

function panel(left = 100, top = 100) {
    const element = document.createElement('div');
    Object.assign(element.style, { display: 'none', left: `${left}px`, top: `${top}px` });
    element.getBoundingClientRect = jest.fn(() => ({
        left: parseFloat(element.style.left), top: parseFloat(element.style.top), width: 300, height: 240
    }));
    document.body.append(element);
    return element;
}
function fixture() {
    const ui = new Layout();
    ui.characterSheet = panel(58, 93);
    ui.inventory = { inventoryScreen: panel(890, 410), shopScreen: panel(422, 176) };
    ui.registerWindowLayouts();
    return ui;
}
const position = element => [element.style.left, element.style.top];

test('character and bag keep independent dragged positions through closing, reopening and content reflow', () => {
    const ui = fixture(), character = ui.characterSheet, bag = ui.inventory.inventoryScreen;
    character.dataset.draggedWindow = bag.dataset.draggedWindow = 'true';
    const saved = [position(character), position(bag)];
    ui.openManagedWindow('character'); ui.openManagedWindow('inventory');
    for (const id of ['character', 'inventory']) {
        ui.closeManagedWindow(id); ui.openManagedWindow(id); ui.reflowVisibleWindows();
        expect([position(character), position(bag)]).toEqual(saved);
    }
});

test('store and bag retain dragged positions when the shop opens its companion', () => {
    const ui = fixture(), shop = ui.inventory.shopScreen, bag = ui.inventory.inventoryScreen;
    shop.dataset.draggedWindow = bag.dataset.draggedWindow = 'true';
    const saved = [position(shop), position(bag)];
    for (let i = 0; i < 2; i++) {
        ui.openManagedWindow('shop', { keepCompanion: true }); ui.reflowVisibleWindows();
        expect([position(shop), position(bag)]).toEqual(saved);
        ui.closeManagedWindow('shop');
    }
});

test('a dragged store retains its position without a bag companion', () => {
    const ui = fixture(), shop = ui.inventory.shopScreen;
    shop.dataset.draggedWindow = 'true';
    ui.openManagedWindow('shop'); ui.closeManagedWindow('shop'); ui.openManagedWindow('shop');
    expect(position(shop)).toEqual(['422px', '176px']);
});

test('a default companion still gets positioned when only the other panel was moved', () => {
    const ui = fixture(), character = ui.characterSheet, bag = ui.inventory.inventoryScreen;
    character.dataset.draggedWindow = 'true';
    ui.openManagedWindow('character'); ui.openManagedWindow('inventory');
    expect(position(character)).toEqual(['58px', '93px']);
    expect(position(bag)).toEqual(['648px', '280px']);
});

test('viewport reduction clamps a dragged store and hides its unavailable companion', () => {
    const ui = fixture(), shop = ui.inventory.shopScreen;
    shop.dataset.draggedWindow = 'true'; shop.style.left = '920px'; shop.style.top = '540px';
    ui.openManagedWindow('shop', { keepCompanion: true });
    resize(390, 600); ui.reflowVisibleWindows();
    expect(position(shop)).toEqual(['78px', '348px']);
    expect(ui.inventory.inventoryScreen.style.display).toBe('none');
    ui.closeManagedWindow('shop'); ui.openManagedWindow('shop');
    expect(position(shop)).toEqual(['78px', '348px']);
});
