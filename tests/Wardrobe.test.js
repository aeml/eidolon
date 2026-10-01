import { jest } from '@jest/globals';
import { WardrobeUI } from '../src/ui/WardrobeUI.js';
import { equipmentWithAppearances } from '../src/core/EquipmentAppearance.js';
import { eidolon } from '../src/proto/state_pb.js';
import { equipmentVisualSignature } from '../src/art/ProceduralEquipment.js';

const look = { baseName: 'Silk Hood', rarity: 'Rare', slot: 'head' };
const gear = { id: 'combat-helm', name: 'Iron Helm', type: 'ARMOR', slot: 'head', rarity: 'Common', level: 70, potency: 5, sockets: 2, stats: { defense: 99 } };

test('rendering selects an earned silhouette without changing item stats, sockets or upgrades', () => {
    const equipment = { head: gear };
    const result = equipmentWithAppearances(equipment, { head: look });
    expect(result.head).toMatchObject({ baseName: 'Silk Hood', rarity: 'Rare', id: gear.id, level: 70, potency: 5, sockets: 2, stats: { defense: 99 } });
    expect(gear.name).toBe('Iron Helm');
    expect(gear.rarity).toBe('Common');
    expect(equipmentVisualSignature(result)).not.toBe(equipmentVisualSignature(equipment));
    expect(equipmentWithAppearances(equipment, {}).head).toBe(gear);
});

test('cosmetics cannot create empty equipment or cross slots', () => {
    expect(equipmentWithAppearances({}, { head: look })).toEqual({});
    expect(equipmentWithAppearances({ head: gear }, { head: { ...look, slot: 'chest' } }).head).toBe(gear);
});

test('multiplayer packets carry looks separately and an empty map resets them', () => {
    const packet = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'remote', appearances: { head: look }, equipment: { head: gear } }).finish());
    expect(packet.appearances.head.baseName).toBe('Silk Hood');
    expect(packet.equipment.head.name).toBe('Iron Helm');
    const reset = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'remote', appearances: {} }).finish());
    expect(reset.appearances).toEqual({});
});

test('wardrobe offers owned compatible looks, requests server changes, and clears on character switch', () => {
    document.body.innerHTML = '<div id="host"></div>';
    let player = { id: 'first', equipment: { head: gear }, appearances: {} };
    const send = jest.fn();
    const ui = new WardrobeUI({ host: document.getElementById('host'), getPlayer: () => player, send });
    ui.root.open = true;
    ui.handleResult({ playerID: 'first', success: true, collection: { 'Silk Hood|Rare': look, 'Robes|Rare': { baseName: 'Robes', rarity: 'Rare', slot: 'chest' } } });
    expect(ui.root.textContent).toContain('settled arena seasons');
    expect([...ui.look.options].map(o => o.value)).toEqual(['', 'Silk Hood|Rare']);
    ui.look.value = 'Silk Hood|Rare';
    ui.apply.click();
    expect(send).toHaveBeenCalledWith('select_appearance', { slot: 'head', key: 'Silk Hood|Rare' });
    expect(player.appearances).toEqual({});
    ui.handleResult({ playerID: 'first', success: true, collection: { 'Silk Hood|Rare': look } });
    ui.learn.click();
    expect(send).toHaveBeenCalledWith('collect_appearances', {});
    expect(ui.status.textContent).toContain('checking settled season rewards');
    player = { id: 'second', equipment: {}, appearances: {} };
    ui.refreshPlayer();
    expect(ui.look.options).toHaveLength(1);
    expect(ui.apply.disabled).toBe(true);
    ui.dispose();
});

function wardrobeFixture() {
    document.body.innerHTML = '<div id="host"></div>';
    let player = { id: 'first', equipment: { head: gear }, appearances: {} };
    const send = jest.fn();
    const ui = new WardrobeUI({ host: document.getElementById('host'), getPlayer: () => player, send });
    ui.root.open = true;
    ui.handleResult({ playerID: 'first', success: true, collection: { 'Silk Hood|Rare': look } });
    return { ui, send, switchPlayer: next => { player = next; } };
}

test('wardrobe ignores missing, foreign and malformed private replies without enabling controls', () => {
    const { ui, send, switchPlayer } = wardrobeFixture();
    switchPlayer({ id: 'second', equipment: { head: gear }, appearances: {} });
    ui.refreshPlayer();
    for (const reply of [
        { success: true, collection: { 'Silk Hood|Rare': look } },
        { playerID: 'first', success: true, collection: { 'Silk Hood|Rare': look } },
        { playerID: 'second', success: true, collection: [] }
    ]) {
        expect(ui.handleResult(reply)).toBe(false);
        expect(ui.look.options).toHaveLength(1);
        expect(ui.apply.disabled).toBe(true);
    }
    send.mockClear(); ui.apply.click(); ui.learn.click();
    expect(send).not.toHaveBeenCalled();
    ui.dispose();
});

test('switching characters retires the selected look before the periodic refresh', () => {
    const { ui, send, switchPlayer } = wardrobeFixture();
    ui.look.value = 'Silk Hood|Rare';
    switchPlayer({ id: 'second', equipment: { head: gear }, appearances: {} });
    ui.apply.click(); ui.learn.click();
    expect(send).not.toHaveBeenCalled();
    ui.dispose();
});

test('wardrobe actions wait for the current owner reply and Original gear sends an explicit reset', () => {
    const { ui, send } = wardrobeFixture();
    ui.look.value = 'Silk Hood|Rare';
    ui.apply.click(); ui.apply.click(); ui.learn.click();
    expect(send.mock.calls).toEqual([['select_appearance', { slot: 'head', key: 'Silk Hood|Rare' }]]);
    ui.handleResult({ playerID: 'first', success: true, collection: { 'Silk Hood|Rare': look } });
    ui.look.value = ''; ui.apply.click();
    expect(send).toHaveBeenLastCalledWith('select_appearance', { slot: 'head', key: '' });
    ui.dispose();
});

test('an untouched character can learn looks from the server null collection and a refreshed actor reference', () => {
    const { ui, send, switchPlayer } = wardrobeFixture();
    switchPlayer({ id: 'first', equipment: { head: gear }, appearances: {} });
    ui.refreshPlayer();
    expect(ui.look.options).toHaveLength(2);
    expect(ui.handleResult({ playerID: 'first', success: true, collection: null })).toBe(true);
    expect(ui.look.options).toHaveLength(1);
    expect(ui.learn.disabled).toBe(false);
    ui.learn.click();
    expect(send).toHaveBeenCalledWith('collect_appearances', {});
    ui.dispose();
});

test('collapsed and disposed wardrobe controls cannot send or accept retired results', () => {
    const { ui, send } = wardrobeFixture();
    ui.root.open = false;
    ui.apply.click(); ui.learn.click();
    expect(send).not.toHaveBeenCalled();
    ui.dispose(); ui.dispose();
    const prior = ui.root.textContent;
    expect(ui.handleResult({ playerID: 'first', success: true, message: 'Stale update', collection: {} })).toBe(false);
    ui.refreshPlayer();
    expect(ui.root.textContent).toBe(prior);
    expect(ui.root.isConnected).toBe(false);
});
