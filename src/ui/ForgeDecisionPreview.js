import { forgePreview } from '../core/ForgeProgression.js';

export function renderForgeDecision(host, item, choices, formatStat, material, available) {
    const wrapper = document.createElement('div'); wrapper.className = 'forge-decision';
    const resources = document.createElement('p');
    resources.textContent = `Level: ${item.level || 1} · Potency +${item.potency || 0} · ${material} Available: ${available} / ${choices[0].cost}`;
    wrapper.append(resources);
    const table = document.createElement('table');
    const caption = document.createElement('caption'); caption.textContent = 'Before you spend'; table.append(caption);
    const head = document.createElement('thead'); const headings = document.createElement('tr');
    for (const title of ['Stat', 'Now', ...choices.map(choice => choice.label)]) {
        const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; headings.append(th);
    }
    head.append(headings); table.append(head);
    const body = document.createElement('tbody'); table.append(body);
    const previews = choices.map(choice => forgePreview(item, choice.level ?? item.level, choice.potency ?? item.potency));
    for (const [stat, current] of Object.entries(item.stats || {})) {
        const row = document.createElement('tr'); const label = document.createElement('th'); label.scope = 'row'; label.textContent = formatStat(stat); row.append(label);
        const now = document.createElement('td'); now.textContent = String(current); row.append(now);
        for (const preview of previews) {
            const value = preview.stats[stat] || 0, delta = value - current;
            const td = document.createElement('td'); td.textContent = `${value} (${delta > 0 ? '+' : ''}${delta})`;
            td.className = delta > 0 ? 'item-gain' : delta < 0 ? 'item-loss' : '';
            row.append(td);
        }
        body.append(row);
    }
    const remaining = document.createElement('tr');
    const label = document.createElement('th'); label.scope = 'row'; label.textContent = `${material} left`; remaining.append(label);
    const current = document.createElement('td'); current.textContent = String(available); remaining.append(current);
    for (const choice of choices) {
        const td = document.createElement('td'); const balance = available - choice.cost;
        td.textContent = balance >= 0 ? String(balance) : `Need ${-balance}`;
        td.className = balance < 0 ? 'item-loss' : ''; remaining.append(td);
    }
    body.append(remaining); wrapper.append(table);
    const help = document.createElement('p');
    help.textContent = (material === 'Hearts'
        ? 'Potency permanently boosts this item. Hearts are the fuel for each rank. '
        : 'Spend Shards to raise item level. Buying levels separately or together gives the same result. ')
        + 'Parentheses show the stat gain. A +0 is possible from rounding; progress carries forward. Socket gems are unchanged.';
    wrapper.append(help); host.append(wrapper);
}
