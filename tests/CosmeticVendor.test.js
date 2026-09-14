import { jest } from '@jest/globals';
import fs from 'node:fs';
import { COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';
import { resolveEquipmentVisualDescriptor, createProceduralEquipmentVisual } from '../src/art/ProceduralEquipment.js';
import { CosmeticVendorUI } from '../src/ui/CosmeticVendorUI.js';
import { CosmeticVendor } from '../src/entities/CosmeticVendor.js';
import { GameEngine } from '../src/core/GameEngine.js';

function offers() {
    return COSMETIC_CATALOGUE.map(offer => ({ ...offer, appearance: { baseName: offer.name, rarity: 'Common', slot: resolveEquipmentVisualDescriptor({ name: offer.base }).slot } }));
}

function fixture() {
    let player = { id: 'player-hero', subType: 'Fighter', level: 70, state: 'IDLE', position: { x: 12, z: 185 },
        equipment: { chest: { id: 'real-armor', name: 'Plate Mail', slot: 'chest', type: 'ARMOR', stats: { defense: 99 } } }, appearances: {} };
    const send = jest.fn(), preview = { update: jest.fn(), dispose: jest.fn() };
    const ui = new CosmeticVendorUI({ getPlayer: () => player, send, createPreview: () => preview });
    ui.root.showModal = () => ui.root.setAttribute('open', '');
    ui.root.close = () => { ui.root.removeAttribute('open'); ui.root.dispatchEvent(new Event('close')); };
    ui.open();
    ui.handleResult({ success: true, ep: 100, catalogue: offers(), collection: {} });
    return { ui, send, preview, player, changePlayer: id => { player = { ...player, id }; } };
}

test('cosmetics are generated from the server catalogue and all resolve to renderable, recolored gear', () => {
    expect(COSMETIC_CATALOGUE).toEqual(JSON.parse(fs.readFileSync('server/internal/game/content/cosmetics.json', 'utf8')));
    expect(COSMETIC_CATALOGUE).toHaveLength(12);
    for (const offer of COSMETIC_CATALOGUE) {
        const original = resolveEquipmentVisualDescriptor({ name: offer.base });
        const look = resolveEquipmentVisualDescriptor({ name: offer.name });
        expect(look.slot).toBe(original.slot); expect(look.family).toBe(original.family);
        expect(look.primary).toBe(offer.primary); expect(look.primary).not.toBe(original.primary);
        expect(createProceduralEquipmentVisual({ id: offer.id, name: offer.name, slot: look.slot, rarity: 'Common' }, { slot: look.slot })).toBeTruthy();
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
    ui.handleResult({ success: true, id: offers()[0].id, ep: 75, catalogue: offers(), collection: { [ui.lookKey(offers()[0])]: offers()[0].appearance } });
    expect(ui.buy.disabled).toBe(true);
    expect(ui.apply.disabled).toBe(false);
    ui.apply.click();
    expect(send).toHaveBeenLastCalledWith('select_appearance', { slot: 'chest', key: ui.lookKey(offers()[0]) });
    ui.dispose();
});

test('pending purchase retries the same offer and quoted price, and changing selection cancels confirmation', () => {
    const { ui, send } = fixture();
    ui.reviewPurchase(); ui.select(offers()[1]); ui.confirmPurchase();
    expect(send).toHaveBeenCalledTimes(1);
    ui.reviewPurchase(); ui.confirmPurchase();
    const purchase = send.mock.calls[1];
    ui.handleResult({ success: false, pending: true, id: offers()[1].id, ep: 75, catalogue: offers(), collection: {} });
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
