import { updateCharacterStatsPanel } from '../src/ui/CharacterStatsPanel.js';

describe('stable character stats and authoritative upgrade controls', () => {
    let host, player;
    beforeEach(() => {
        document.body.innerHTML = '<div id="stats"></div>';
        host = document.getElementById('stats');
        player = { level: 100, isMultiplayer: true, resonancePoints: 2, resonanceRanks: { power: 3 },
            resonanceXP: 1000000, stats: { hp: 500, maxHp: 1000, mana: 40, maxMana: 80, strength: 125.1, wisdom: 20 },
            baseStats: { strength: 100, wisdom: 30 } };
    });
    test('health, XP and stat updates retain the focused progression button', () => {
        updateCharacterStatsPanel(host, player);
        const button = host.querySelector('[data-resonance-trait="power"]'); button.focus();
        player.stats.hp++; player.resonanceXP++; player.stats.strength++;
        updateCharacterStatsPanel(host, player);
        expect(host.querySelector('[data-resonance-trait="power"]')).toBe(button);
        expect(document.activeElement).toBe(button);
        expect(host.querySelector('[data-character-value="hp"]').textContent).toBe('501 / 1,000');
        expect(host.querySelector('[data-character-value="resonance-xp"]').textContent).toContain('1,000,001');
        expect(player.resonancePoints).toBe(2);
    });
    test('base differences show both bonuses and penalties without floating-point noise', () => {
        updateCharacterStatsPanel(host, player);
        expect(host.querySelector('[data-character-bonus="strength"]').textContent).toBe('(+25.1)');
        const wisdom = host.querySelector('[data-character-bonus="wisdom"]');
        expect(wisdom.textContent).toBe('(-10)'); expect(wisdom.classList.contains('is-negative')).toBe(true);
        expect(host.querySelector('[data-character-value="damage"]').textContent).toBe('—');
        expect(host.textContent).not.toMatch(/NaN|undefined/);
    });
    test('attribute controls retain identity and respect multiplayer and point availability', () => {
        player.isMultiplayer = false; player.statPoints = 2;
        updateCharacterStatsPanel(host, player);
        const button = host.querySelector('[data-stat="strength"]'); button.focus();
        player.statPoints = 1; updateCharacterStatsPanel(host, player);
        expect(host.querySelector('[data-stat="strength"]')).toBe(button);
        expect(document.activeElement).toBe(button);
        expect(button.hidden).toBe(false); expect(button.disabled).toBe(false);
        player.isMultiplayer = true; updateCharacterStatsPanel(host, player);
        expect(button.hidden).toBe(true); expect(button.disabled).toBe(true);
    });
    test('resonance mounts only when unlocked and updates point/rank restrictions', () => {
        player.level = 99; updateCharacterStatsPanel(host, player);
        expect(host.querySelector('.resonance-panel')).toBeNull();
        player.level = 100; updateCharacterStatsPanel(host, player);
        expect(host.querySelector('[data-character-value="xp"]').hidden).toBe(true);
        player.resonanceRanks.power = 50; updateCharacterStatsPanel(host, player);
        expect(host.querySelector('[data-resonance-trait="power"]').disabled).toBe(true);
        expect(host.querySelector('[data-resonance-trait="ward"]').disabled).toBe(false);
        player.resonancePoints = 0; updateCharacterStatsPanel(host, player);
        expect([...host.querySelectorAll('.resonance-btn')].every(button => button.disabled)).toBe(true);
    });
});
