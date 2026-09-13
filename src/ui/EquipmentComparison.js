import { isActiveEquipment } from '../core/EquipmentSlots.js';

export function itemStatTotals(item) {
    const totals = {};
    for (const source of [item?.stats, ...(item?.gems || []).map(gem => gem?.stats)]) {
        for (const [stat, value] of Object.entries(source || {})) {
            if (Number.isFinite(Number(value))) totals[stat] = (totals[stat] || 0) + Number(value);
        }
    }
    return totals;
}

// Item plus socket contributions, not a speculative DPS score. Class scaling,
// talents and percentage-based set effects remain the character sheet's job.
export function renderEquipmentComparison(host, candidate, comparison, player, formatStat, sets = {}) {
    const current = itemStatTotals(comparison.equippedItem);
    const next = itemStatTotals(candidate);
    const panel = document.createElement('div'); panel.className = 'equipment-change-summary';
    const title = document.createElement('strong'); title.textContent = `If equipped in ${comparison.slotLabel}`; panel.append(title);
    const list = document.createElement('ul'); panel.append(list);
    for (const stat of [...new Set([...Object.keys(current), ...Object.keys(next)])].sort()) {
        const change = (next[stat] || 0) - (current[stat] || 0);
        if (!change) continue;
        const row = document.createElement('li');
        row.className = change > 0 ? 'item-gain' : 'item-loss';
        row.textContent = `${change > 0 ? '+' : ''}${change} ${formatStat(stat)}`;
        list.append(row);
    }
    if (!list.children.length) { const row = document.createElement('li'); row.textContent = 'No item or socket-stat change.'; list.append(row); }
    const note = text => { const row = document.createElement('p'); row.textContent = text; panel.append(row); };
    if (candidate.uniqueEffect !== comparison.equippedItem?.uniqueEffect) {
        if (comparison.equippedItem?.uniqueEffect) note(`Loses special effect: ${comparison.equippedItem.uniqueEffect}.`);
        if (candidate.uniqueEffect) note(`Gains special effect: ${candidate.uniqueEffect}.`);
    }
    for (const setID of new Set([candidate.setId, comparison.equippedItem?.setId].filter(Boolean))) {
        const definition = sets[setID]; if (!definition) continue;
        const count = Object.entries(player.equipment || {}).filter(([slot, item]) => isActiveEquipment(slot, item) && item?.setId === setID).length;
        const after = count - Number(comparison.equippedItem?.setId === setID) + Number(candidate.setId === setID);
        for (const pieces of [2, 4, 6]) {
            if (!definition[`bonus${pieces}`]) continue;
            if (count >= pieces && after < pieces) note(`Loses ${definition.name} ${pieces}-piece bonus.`);
            if (count < pieces && after >= pieces) note(`Gains ${definition.name} ${pieces}-piece bonus.`);
        }
    }
    note('Includes socketed gems. Class scaling, talents and set effects are not included in these raw stat changes.');
    host.append(panel);
    return panel;
}
