import { jest } from '@jest/globals';
import fs from 'node:fs';
import { COSMETIC_CATALOGUE, SEASON_COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';
import { resolveEquipmentVisualDescriptor, createProceduralEquipmentVisual } from '../src/art/ProceduralEquipment.js';
import { CosmeticVendorUI } from '../src/ui/CosmeticVendorUI.js';
import { CosmeticVendor } from '../src/entities/CosmeticVendor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { GARMENT_MODELS } from '../src/assets/garments.generated.js';

function offers() {
    return COSMETIC_CATALOGUE.map(offer => ({ ...offer, appearance: { baseName: offer.name, rarity: 'Common', slot: offer.kind === 'outfit' ? 'outfit' : resolveEquipmentVisualDescriptor({ name: offer.base }).slot } }));
}

function fixture() {
    let player = { id: 'player-hero', subType: 'Fighter', level: 70, state: 'IDLE', position: { x: 12, z: 185 },
        equipment: { chest: { id: 'real-armor', name: 'Plate Mail', slot: 'chest', type: 'ARMOR', stats: { defense: 99 } } }, appearances: {} };
    const send = jest.fn(), preview = { update: jest.fn(), dispose: jest.fn() };
    const ui = new CosmeticVendorUI({ getPlayer: () => player, send, createPreview: () => preview });
    ui.root.showModal = () => ui.root.setAttribute('open', '');
    ui.root.close = () => { ui.root.removeAttribute('open'); ui.root.dispatchEvent(new Event('close')); };
    ui.open();
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 100, catalogue: offers(), collection: {} });
    return { ui, send, preview, player, changePlayer: id => { player = { ...player, id }; } };
}

test('cosmetics are generated from the server catalogue and all resolve to renderable, recolored gear', () => {
    expect(COSMETIC_CATALOGUE).toEqual([...JSON.parse(fs.readFileSync('server/internal/game/content/cosmetics.json', 'utf8')),
        ...JSON.parse(fs.readFileSync('server/internal/game/content/garments.json', 'utf8'))]);
    expect(COSMETIC_CATALOGUE).toHaveLength(24);
    for (const offer of COSMETIC_CATALOGUE) {
        if (offer.kind === 'outfit') {
            expect(Object.keys(GARMENT_MODELS.outfits[offer.name].models).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
            continue;
        }
        const original = resolveEquipmentVisualDescriptor({ name: offer.base });
        const look = resolveEquipmentVisualDescriptor({ name: offer.name });
        expect(look.slot).toBe(original.slot); expect(look.family).toBe(original.family);
        expect(look.primary).toBe(offer.primary); expect(look.primary).not.toBe(original.primary);
        expect(createProceduralEquipmentVisual({ id: offer.id, name: offer.name, slot: look.slot, rarity: 'Common' }, { slot: look.slot })).toBeTruthy();
    }
});

test('collection search and slot filters preserve cards, selection and authoritative purchase state', () => {
    const { ui, send, player } = fixture(), original = JSON.stringify(player);
    const first = ui.list.querySelector('button'), selected = ui.selected;
    ui.reviewPurchase(); expect(ui.confirmation.hidden).toBe(false);
    ui.category.value = 'outfit'; ui.category.dispatchEvent(new Event('change'));
    expect(ui.list.querySelectorAll('button:not([hidden])')).toHaveLength(12);
    expect(ui.list.querySelector('button')).toBe(first); expect(ui.selected).toBe(selected);
    expect(ui.confirmation.hidden).toBe(true); ui.confirmPurchase(); first.click();
    expect(send).toHaveBeenCalledTimes(1); expect(ui.selected).toBe(selected);
    ui.search.value = '  HALLOWEEN  '; ui.search.dispatchEvent(new Event('input'));
    expect([...ui.list.querySelectorAll('button:not([hidden])')].map(button => button.dataset.offerId)).toEqual(['hollow-court-v1']);
    expect(ui.results.textContent).toBe('1 of 24 looks');
    ui.search.value = 'no such festival'; ui.search.dispatchEvent(new Event('input'));
    expect(ui.empty.hidden).toBe(false); expect(ui.results.textContent).toBe('0 of 24 looks');
    expect(JSON.stringify(player)).toBe(original); ui.dispose();
});

test('filtered browsing survives current-owner refresh and reopening, and clears for another character', () => {
    const { ui, changePlayer, player } = fixture();
    ui.category.value = 'offHand'; ui.category.dispatchEvent(new Event('change'));
    expect(ui.list.querySelectorAll('button:not([hidden])')).toHaveLength(4);
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: offers(), collection: {} });
    expect(ui.category.value).toBe('offHand'); expect(ui.results.textContent).toBe('4 of 24 looks');
    ui.close(); ui.open(); expect(ui.category.value).toBe('offHand');
    expect(ui.search.disabled).toBe(true); expect(ui.results.textContent).toBe('Loading collection…');
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: offers(), collection: {} });
    expect(ui.selected.appearance.slot).toBe('offHand');
    ui.search.value = 'tome'; changePlayer('other-hero'); ui.open();
    expect(ui.search.value).toBe(''); expect(ui.category.value).toBe('all');
    expect(ui.list.children).toHaveLength(0); ui.dispose();
});

test('filtering retains an exact pending unlock and empty reopen cannot show a stale selected look', () => {
    const { ui, send, player } = fixture();
    ui.reviewPurchase(); ui.confirmPurchase(); const purchase = send.mock.calls.at(-1);
    ui.search.value = 'no such look'; ui.search.dispatchEvent(new Event('input'));
    ui.retry.click(); expect(send.mock.calls.at(-1)).toEqual(purchase);
    ui.close(); ui.open();
    ui.handleResult({ playerID: player.id, success: true, pending: true, ep: 75, catalogue: offers(), collection: {} });
    expect(ui.selected).toBeUndefined(); expect(ui.previewHost.hidden).toBe(true);
    expect(ui.title.textContent).toBe('Choose a look'); expect(ui.apply.disabled).toBe(true);
    expect(ui.buy.disabled).toBe(true); ui.dispose();
});

test('settled-season styles resolve as cosmetic-only pendants and are not EP offers', () => {
    expect(SEASON_COSMETIC_CATALOGUE).toEqual(JSON.parse(fs.readFileSync('server/internal/game/content/season-cosmetics.json', 'utf8')));
    expect(SEASON_COSMETIC_CATALOGUE.map(offer => offer.medal)).toEqual(['Bronze', 'Silver', 'Gold']);
    for (const offer of SEASON_COSMETIC_CATALOGUE) {
        expect(COSMETIC_CATALOGUE.some(sold => sold.id === offer.id || sold.name === offer.name)).toBe(false);
        expect(offer.priceEP).toBeUndefined();
        const look = resolveEquipmentVisualDescriptor({ name: offer.name });
        expect(look.slot).toBe('neck'); expect(look.family).toBe('neckwear');
        expect(look.variant).toBe('arena-medallion');
        expect(look.primary).toBe(offer.primary); expect(look.secondary).toBe(offer.secondary);
        const model = createProceduralEquipmentVisual({ id: offer.id, name: offer.name, slot: 'neck', rarity: 'Common' }, { slot: 'neck' });
        expect(model.getObjectByName('Gear_MedallionDisc').geometry.type).toBe('CylinderGeometry');
        expect(model.getObjectByName('Gear_MedallionRim')).toBeTruthy();
        expect(model.getObjectByName('Gear_MedallionCrest')).toBeTruthy();
    }
});

test('preview and cost confirmation never change actual gear, and duplicate purchase uses the same unique unlock', () => {
    const { ui, send, player, preview } = fixture();
    const original = JSON.stringify(player);
    ui.reviewPurchase();
    expect(ui.cost.textContent).toContain('25 EP');
    expect(send).toHaveBeenCalledTimes(1); // Only catalogue read.
    ui.confirmPurchase(); ui.confirmPurchase();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]).toEqual(['buy_cosmetic', { id: offers()[0].id, priceEP: 25, confirmed: true }]);
    expect(JSON.stringify(player)).toBe(original);
    expect(preview.update.mock.calls[0][0].equipment.chest.id).toBe('cosmetic-preview');
    ui.handleResult({ playerID: player.id, success: true, pending: false, id: offers()[0].id, ep: 75, catalogue: offers(), collection: { [ui.lookKey(offers()[0])]: offers()[0].appearance } });
    expect(ui.buy.disabled).toBe(true);
    expect(ui.apply.disabled).toBe(false);
    ui.apply.click();
    expect(send).toHaveBeenLastCalledWith('select_appearance', { slot: 'chest', key: ui.lookKey(offers()[0]) });
    ui.dispose();
});

test('owned complete outfit applies without armor items and previews the real gear without inventing a hand item', () => {
    const { ui, send, player, preview } = fixture();
    const offer = offers().find(offer => offer.kind === 'outfit'), before = JSON.stringify(player);
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, catalogue: offers(), collection: { [ui.lookKey(offer)]: offer.appearance } });
    ui.select(offer);
    expect(ui.apply.disabled).toBe(false);
    const model = preview.update.mock.calls.at(-1)[0];
    expect(model.equipment.chest.id).toBe('real-armor'); expect(model.equipment.outfit).toBeUndefined();
    expect(model.equipment.mainHand).toBeUndefined(); expect(model.appearances.outfit).toEqual(offer.appearance);
    ui.apply.click(); expect(send).toHaveBeenLastCalledWith('select_appearance', { slot: 'outfit', key: ui.lookKey(offer) });
    expect(JSON.stringify(player)).toBe(before); ui.dispose();
});

test('pending purchase retries the same offer and quoted price, and changing selection cancels confirmation', () => {
    const { ui, send } = fixture();
    ui.reviewPurchase(); ui.select(offers()[1]); ui.confirmPurchase();
    expect(send).toHaveBeenCalledTimes(1);
    ui.reviewPurchase(); ui.confirmPurchase();
    const purchase = send.mock.calls[1];
    ui.handleResult({ playerID: 'player-hero', success: false, pending: true, id: offers()[1].id, ep: 75, catalogue: offers(), collection: {} });
    ui.retry.click();
    expect(send.mock.calls[2]).toEqual(purchase);
    expect(ui.buy.disabled).toBe(true);
    ui.dispose();
});

test('vendor is a neutral physical NPC, and the window closes on character change or leaving', () => {
    const npc = GameEngine.prototype.createRemotePlayer.call({}, 'NPC', 'vip-cosmetic-vendor', 'CosmeticVendor');
    expect(npc).toBeInstanceOf(CosmeticVendor);
    expect(GameEngine.prototype.isInteractableEntity(npc)).toBe(true);
    const { ui, changePlayer, preview } = fixture();
    changePlayer('someone-else'); ui.refreshPlayer();
    expect(ui.root.open).toBe(false); expect(preview.dispose).toHaveBeenCalledTimes(1);
    ui.dispose();
});

test('reopening for another character clears old balances, collection, selection and preview before any result', () => {
    const { ui, changePlayer, preview } = fixture();
    const oldID = ui.playerID;
    ui.collection[ui.lookKey(offers()[0])] = offers()[0].appearance;
    ui.reviewPurchase(); ui.confirmPurchase();
    changePlayer('new-hero'); ui.open();
    expect(ui.collection).toEqual({}); expect(ui.catalogue).toEqual([]);
    expect(ui.selected).toBeNull(); expect(ui.pendingID).toBeNull();
    expect(ui.balance.textContent).not.toContain('100 EP'); expect(preview.dispose).toHaveBeenCalledTimes(1);
    const before = ui.root.textContent;
    ui.handleResult({ playerID: oldID, success: true, pending: false, ep: 999, catalogue: offers(), collection: {} });
    expect(ui.root.textContent).toBe(before); expect(ui.list.children).toHaveLength(0);
    ui.dispose();
});

test('missing-owner and malformed final replies cannot clear a pending unlock or replace the balance', () => {
    const { ui, player } = fixture(); ui.reviewPurchase(); ui.confirmPurchase();
    const id = ui.pendingID;
    const reply = { playerID: player.id, success: true, pending: false, id, ep: 75, catalogue: offers(), collection: {} };
    for (const invalid of [{ ...reply, playerID: undefined }, { ...reply, playerID: 'other' },
        { ...reply, ep: -1 }, { ...reply, ep: 2.5 }, { ...reply, pending: undefined }]) {
        ui.handleResult(invalid);
        expect(ui.pendingID).toBe(id); expect(ui.ep).toBe(100);
    }
    ui.handleResult(reply); expect(ui.pendingID).toBeNull(); expect(ui.ep).toBe(75); ui.dispose();
});

test('retired catalogue buttons and a stale cost confirmation cannot submit another purchase', () => {
    const { ui, send, player } = fixture();
    const stale = ui.list.querySelector('button');
    ui.reviewPurchase();
    const newer = offers().map(offer => ({ ...offer, priceEP: offer.priceEP + 1 }));
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 100, catalogue: newer, collection: {} });
    ui.confirmPurchase(); expect(send).toHaveBeenCalledTimes(1);
    ui.select(newer[1]); stale.click(); expect(ui.selected.id).toBe(newer[1].id);
    ui.reviewPurchase(); ui.confirmPurchase();
    expect(send).toHaveBeenLastCalledWith('buy_cosmetic', { id: newer[1].id, priceEP: newer[1].priceEP, confirmed: true });
    ui.dispose();
});

test('disposed wardrobe UI cannot reopen, send retained button actions, accept late results or recreate its preview', () => {
    const { ui, send, preview, player } = fixture();
    ui.reviewPurchase(); ui.confirmPurchase();
    const calls = send.mock.calls.length, previews = preview.update.mock.calls.length;
    ui.dispose(); ui.dispose();
    expect(ui.open()).toBe(false);
    ui.retry.click(); ui.compare.click(); ui.apply.click(); ui.reviewPurchase(); ui.confirmPurchase();
    ui.handleResult({ playerID: player.id, success: true, pending: false, ep: 75, id: ui.pendingID, catalogue: offers(), collection: {} });
    ui.handleAppearanceResult({ playerID: player.id, success: true, message: 'late appearance' });
    expect(send).toHaveBeenCalledTimes(calls); expect(preview.update).toHaveBeenCalledTimes(previews);
    expect(preview.dispose).toHaveBeenCalledTimes(1); expect(ui.root.isConnected).toBe(false);
});

test('appearance replies are restricted to the current owner and an open vendor', () => {
    const { ui, player } = fixture(), original = ui.status.textContent;
    ui.handleAppearanceResult({ playerID: 'other', message: 'wrong appearance' });
    expect(ui.status.textContent).toBe(original);
    ui.handleAppearanceResult({ playerID: player.id, message: 'Current appearance saved.' });
    expect(ui.status.textContent).toBe('Current appearance saved.');
    ui.close(); ui.handleAppearanceResult({ playerID: player.id, message: 'closed appearance' });
    expect(ui.status.textContent).toBe('Current appearance saved.'); ui.dispose();
});

test('held inspection and comparison keep authority unchanged and reset for armor or a new character', () => {
    const { ui, preview, player, send, changePlayer } = fixture();
    preview.setFocusSlot = jest.fn();
    const before = JSON.stringify(player), requests = send.mock.calls.length;
    ui.select(offers().find(offer => offer.id === 'grovekeeper-blade-v1'));
    expect(ui.inspect.hidden).toBe(false); ui.inspect.click();
    expect(preview.setFocusSlot).toHaveBeenLastCalledWith('mainHand'); expect(ui.inspect.getAttribute('aria-pressed')).toBe('true');
    ui.compare.click(); expect(preview.setFocusSlot).toHaveBeenLastCalledWith('mainHand');
    expect(JSON.stringify(player)).toBe(before); expect(send).toHaveBeenCalledTimes(requests);
    ui.select(offers()[0]); expect(ui.inspect.hidden).toBe(true); expect(preview.setFocusSlot).toHaveBeenLastCalledWith(null);
    ui.select(offers().find(offer => offer.id === 'skyweaver-tome-v1')); ui.inspect.click();
    changePlayer('other-character'); ui.refreshPlayer(); ui.open();
    expect(ui.inspectHeld).toBe(false); expect(ui.inspect.hidden).toBe(true); ui.dispose();
});
