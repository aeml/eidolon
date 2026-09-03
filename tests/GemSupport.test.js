import { Actor } from '../src/entities/Actor.js';
import { CONSTANTS } from '../src/core/Constants.js';
import { GEM_TYPES, GEM_QUALITIES, getGemStats } from '../src/core/ItemSystem.js';
import { UIManager } from '../src/ui/UIManager.js';

describe('gem client support', () => {
    test('human-readable gem keys resolve to the canonical definitions', () => {
        expect(GEM_TYPES.Ruby).toBe(GEM_TYPES.RUBY);
        expect(GEM_QUALITIES.Chipped).toBe(GEM_QUALITIES.CHIPPED);
        expect(getGemStats('Ruby', 'Chipped')).toEqual(getGemStats('RUBY', 'CHIPPED'));
    });

    test('gem icons resolve to quality-specific procedural soulstones', () => {
        const iconPath = UIManager.prototype.getGemIconPath.call({}, {
            type: 'GEM',
            gemType: 'Ruby',
            gemQuality: 'Flawed',
            name: 'Flawed Ruby'
        });

        expect(iconPath.startsWith('data:image/svg+xml;charset=UTF-8,')).toBe(true);
        expect(decodeURIComponent(iconPath)).toContain('gem-flawed-ruby-soulstone');
    });

    test('actor stat recalculation applies socketed gem bonuses', () => {
        const actor = new Actor('actor-gems', CONSTANTS.ENTITIES.WIZARD);
        actor.equipment = {
            mainHand: {
                stats: { damage: 10 },
                gems: [
                    { stats: getGemStats('Ruby', 'Flawed') },
                    { stats: getGemStats('Sapphire', 'Flawed') },
                    { stats: getGemStats('Emerald', 'Flawed') },
                    { stats: getGemStats('Topaz', 'Flawed') },
                    { stats: getGemStats('Diamond', 'Flawed') },
                    { stats: getGemStats('Onyx', 'Flawed') },
                    { stats: getGemStats('Opal', 'Flawed') }
                ]
            }
        };

        actor.recalculateStats();

        expect(actor.stats.fireDamageBonus).toBeGreaterThan(0);
        expect(actor.stats.critChanceBonus).toBeGreaterThan(0);
        expect(actor.stats.healingDoneBonus).toBeGreaterThan(0);
        expect(actor.stats.lifestealBonus).toBeGreaterThan(0);
        expect(actor.stats.allResistBonus).toBeGreaterThan(0);
        expect(actor.stats.cooldownReduction).toBeGreaterThan(0.1);
        expect(actor.stats.manaRegen).toBeGreaterThan(actor.baseStats.wisdom * 0.5);
        expect(actor.stats.speed).toBeGreaterThan((3 + (actor.baseStats.dexterity * 0.5)) * 1.2);
    });
});
