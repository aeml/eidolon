const attributes = [['strength', 'Strength'], ['dexterity', 'Dexterity'], ['intelligence', 'Intellect'], ['vitality', 'Vitality'], ['wisdom', 'Wisdom']];
const traits = [['power', 'Power', '+1% damage'], ['ward', 'Ward', '+1% health and armor'], ['fortune', 'Fortune', '+1% gold and XP']];
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const format = value => finite(value) ? numberFormat.format(Number(value)) : '—';

// Keep actionable DOM nodes mounted while server-owned HP, XP and stats change.
// Only fixed labels form markup; all player values go through textContent.
export function updateCharacterStatsPanel(host, player) {
    if (!host.querySelector('.character-summary')) {
        host.innerHTML = `
            <div class="character-summary">
                <strong data-character-value="level"></strong><span data-character-value="xp"></span>
                <span class="character-points" data-character-value="points"></span>
            </div>
            <div class="character-vitals">
                <span class="character-health">Health <strong data-character-value="hp"></strong></span>
                <span class="character-mana">Mana <strong data-character-value="mana"></strong></span>
            </div>
            <h3 class="character-section-heading">Attributes</h3>
            <div class="character-attributes">
                ${attributes.map(([stat, label]) => `<div class="stat-row" data-stat-name="${stat}">
                    <strong>${label}</strong><span class="character-stat-value"><span data-character-value="${stat}"></span>
                    <span class="character-stat-bonus" data-character-bonus="${stat}"></span></span>
                    <button type="button" class="stat-btn" data-stat="${stat}" aria-label="Increase ${stat}">+</button>
                </div>`).join('')}
            </div>
            <p class="character-stat-note">Totals include active equipment and buffs. Parentheses show the difference from base attributes.</p>
            <h3 class="character-section-heading">Combat</h3>
            <div class="character-combat-stats">
                <span>Damage <strong data-character-value="damage"></strong></span>
                <span>Defense <strong data-character-value="defense"></strong></span>
            </div>`;
    }
    const set = (key, value) => {
        const node = host.querySelector(`[data-character-value="${key}"]`);
        if (node && node.textContent !== value) node.textContent = value;
    };
    const stats = player.stats || {}, showPoints = !player.isMultiplayer;
    set('level', `Level ${format(player.level)}`);
    set('xp', `XP ${format(player.xp)} / ${format(player.xpToNextLevel)}`);
    host.querySelector('[data-character-value="xp"]').hidden = player.level >= 100;
    set('points', `${format(player.statPoints)} attribute points`);
    host.querySelector('.character-points').hidden = !showPoints;
    for (const key of ['hp', 'mana']) {
        set(key, `${format(finite(stats[key]) ? Math.ceil(Number(stats[key])) : undefined)} / ${format(stats[key === 'hp' ? 'maxHp' : 'maxMana'])}`);
    }
    for (const [stat] of attributes) {
        set(stat, format(stats[stat]));
        const base = player.baseStats?.[stat];
        const bonus = finite(stats[stat]) && finite(base) ? Number((Number(stats[stat]) - Number(base)).toFixed(2)) : 0;
        const badge = host.querySelector(`[data-character-bonus="${stat}"]`);
        badge.textContent = bonus ? `(${bonus > 0 ? '+' : ''}${format(bonus)})` : '';
        badge.classList.toggle('is-negative', bonus < 0);
        const button = host.querySelector(`[data-stat="${stat}"]`);
        button.hidden = !showPoints || !(player.statPoints > 0);
        button.disabled = !showPoints || !(player.statPoints > 0);
    }
    set('damage', format(stats.damage)); set('defense', format(stats.defense));

    let resonance = host.querySelector('.resonance-panel');
    if (!(player.level >= 100 || player.resonanceUnlocked)) {
        resonance?.remove(); return;
    }
    if (!resonance) {
        resonance = document.createElement('div');
        resonance.className = 'resonance-panel';
        resonance.setAttribute('aria-label', 'Endgame Resonance progression');
        resonance.innerHTML = `<strong data-character-value="resonance-level"></strong>
            <div data-character-value="resonance-xp"></div>
            <div class="resonance-guidance">At level 100, enemy, quest and dungeon XP becomes Resonance XP. Daily quests are optional. Each Resonance level grants one trait point; EP cannot buy these points.</div>
            <div class="resonance-traits">${traits.map(([trait, label, detail]) => `
                <button type="button" class="resonance-btn" data-resonance-trait="${trait}">
                    <span class="resonance-trait-label" data-character-value="resonance-${trait}">${label}</span><span>${detail}</span>
                </button>`).join('')}</div>`;
        host.appendChild(resonance);
    }
    set('resonance-level', `Resonance ${format(player.resonanceLevel || 0)}`);
    set('resonance-xp', `${format(player.resonanceXP || 0)} / ${format(player.resonanceXPToNext || 5000000)} resonance XP · ${format(player.resonancePoints || 0)} unspent`);
    for (const [trait, label] of traits) {
        const rank = player.resonanceRanks?.[trait] || 0;
        set(`resonance-${trait}`, `${label} ${format(rank)}/50`);
        resonance.querySelector(`[data-resonance-trait="${trait}"]`).disabled = !(player.resonancePoints > 0) || rank >= 50;
    }
}
