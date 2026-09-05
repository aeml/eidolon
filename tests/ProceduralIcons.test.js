import { readFileSync } from 'node:fs';
import {
    PROCEDURAL_ABILITY_ICON_DEFINITIONS,
    PROCEDURAL_ITEM_ICON_DEFINITIONS,
    getProceduralAbilityIcon,
    getProceduralIconCacheMetrics,
    getProceduralItemIcon
} from '../src/art/ProceduralIcons.js';
import {
    PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS,
    PROCEDURAL_ABILITY_CAST_DEFINITIONS
} from '../src/art/ProceduralAbilityCasts.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../src/art/ProceduralEquipment.js';
import { BASE_ITEMS, GEM_QUALITIES, GEM_TYPES, RARITY } from '../src/core/ItemSystem.js';
import { UIManager } from '../src/ui/UIManager.js';

function decodeIcon(uri) {
    expect(uri.startsWith('data:image/svg+xml;charset=UTF-8,')).toBe(true);
    return decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
}

function canonicalValues(record) {
    return Object.entries(record).filter(([key]) => key === key.toUpperCase()).map(([, value]) => value);
}

describe('procedural UI icons', () => {
    test('every authoritative Chronicle quest drop has a distinct bag icon', () => {
        const source = readFileSync('server/internal/game/quests.go', 'utf8');
        const dropTable = source.match(/var chronicleDropSources = [^\n]+\{([\s\S]*?)\n\}/)?.[1] || '';
        const names = [...dropTable.matchAll(/"([^"]+)":\s*\{/g)].map(match => match[1]);
        expect(names).toHaveLength(4);
        expect(names.sort()).toEqual(Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.quest).sort());
        const icons = names.map(name => {
            const item = { id: 'chronicle-item-123', name, type: 'RELIC', slot: 'relic' };
            const icon = UIManager.prototype.getItemIconPath(item);
            expect(decodeIcon(icon)).toContain('data-procedural-icon="quest:');
            expect(getProceduralItemIcon({ ...item, id: 'chronicle-item-456', stack: 4 })).toBe(icon);
            return icon;
        });
        expect(new Set(icons).size).toBe(4);
        expect(decodeIcon(getProceduralItemIcon({ id: 'chronicle-item-future', name: 'Future relic' })))
            .toContain('quest:chronicle-relic');
    });
    test('every canonical and compatibility ability owns a unique code-generated sigil', () => {
        const expected = Object.values(PROCEDURAL_ABILITY_CAST_DEFINITIONS)
            .reduce((sum, abilities) => sum + Object.keys(abilities).length, 0)
            + Object.values(PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS)
                .reduce((sum, abilities) => sum + Object.keys(abilities).length, 0);
        expect(Object.keys(PROCEDURAL_ABILITY_ICON_DEFINITIONS)).toHaveLength(expected);

        const icons = Object.values(PROCEDURAL_ABILITY_ICON_DEFINITIONS).map((definition) => {
            const uri = getProceduralAbilityIcon(definition.className, definition.abilityName);
            const svg = decodeIcon(uri);
            expect(svg).toContain('data-procedural-icon="ability-');
            expect(svg).toContain('<linearGradient');
            expect(svg).toContain('<filter id="glow">');
            expect(svg).not.toContain('.png');
            return uri;
        });
        expect(new Set(icons).size).toBe(expected);
        expect(getProceduralAbilityIcon('unknown', 'Charge')).toBeNull();
        expect(getProceduralAbilityIcon('Fighter', 'Missing Skill')).toBeNull();
    });

    test('every equippable base family resolves through its exact 3D visual descriptor', () => {
        const equippable = BASE_ITEMS.filter((item) => !['MATERIAL', 'RELIC'].includes(item.type));
        expect(Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.equipment)).toHaveLength(36);
        expect(equippable).toHaveLength(36);
        const icons = equippable.map((baseItem, index) => {
            expect(EQUIPMENT_VISUAL_DESCRIPTORS[baseItem.name]).toBeDefined();
            const uri = getProceduralItemIcon({
                ...baseItem,
                baseName: baseItem.name,
                rarity: Object.values(RARITY)[index % Object.keys(RARITY).length],
                level: index + 1
            });
            const svg = decodeIcon(uri);
            expect(svg).toContain(`data-procedural-icon="equipment-${EQUIPMENT_VISUAL_DESCRIPTORS[baseItem.name].variant}"`);
            expect(svg).not.toContain('assets/icons');
            return uri;
        });
        expect(new Set(icons).size).toBe(icons.length);
    });

    test('the authoritative server loot catalog cannot outgrow the procedural icon catalog', () => {
        const serverItems = readFileSync('server/internal/game/items.go', 'utf8');
        const baseItemsBlock = serverItems.match(/var BaseItems = \[\]BaseItem\{([\s\S]*?)\n\}/)?.[1] || '';
        const serverBaseNames = [...baseItemsBlock.matchAll(/\{"([^"]+)",\s*Item/g)]
            .map((match) => match[1]);
        const clientBaseNames = BASE_ITEMS.map((item) => item.name);
        const generatedNames = [
            ...Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.equipment),
            ...Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.currency)
        ];

        expect(serverBaseNames).toHaveLength(38);
        expect(serverBaseNames.sort()).toEqual(clientBaseNames.sort());
        expect(serverBaseNames.sort()).toEqual(generatedNames.sort());
        expect(serverItems).toContain('item.Name = fmt.Sprintf("%s %s", setDef.Name, baseItem.Name)');
        expect(serverItems).not.toMatch(/item\.Name\s*=\s*[^\n]*Unique/);
    });

    test('currency and the complete gem type-quality matrix are intentional inventory-only icons', () => {
        expect(Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.currency).sort()).toEqual([
            'Eidolon Heart', 'Eidolon Shard'
        ]);
        const gemTypes = canonicalValues(GEM_TYPES);
        const gemQualities = canonicalValues(GEM_QUALITIES);
        expect(Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.gems)).toHaveLength(
            gemTypes.length * gemQualities.length
        );

        const currencyIcons = [
            getProceduralItemIcon({ name: 'Eidolon Heart', type: 'RELIC', icon: 'assets/legacy-heart.png' }),
            getProceduralItemIcon({ name: 'Shard', type: 'MATERIAL', icon: 'assets/legacy-shard.png' })
        ];
        currencyIcons.forEach((uri) => expect(decodeIcon(uri)).toContain('data-procedural-icon="currency-'));

        const gemIcons = gemTypes.flatMap((type) => gemQualities.map((quality) =>
            getProceduralItemIcon({
                name: `${quality.name} ${type.name}`,
                type: 'GEM',
                slot: 'gem',
                gemType: type.name,
                gemQuality: quality.name,
                icon: `assets/icons/gems/${quality.name}_${type.name}.svg`
            })
        ));
        gemIcons.forEach((uri) => expect(decodeIcon(uri)).toContain('data-procedural-icon="gem-'));
        expect(new Set(gemIcons).size).toBe(gemIcons.length);
    });

    test('rarity, tier, potency, sockets, sets, and unique effects alter item icon identity', () => {
        const base = {
            name: 'Iron Sword', baseName: 'Iron Sword', type: 'WEAPON', slot: 'mainHand',
            rarity: RARITY.COMMON, level: 1
        };
        const plain = getProceduralItemIcon(base);
        const authored = getProceduralItemIcon({
            ...base,
            rarity: RARITY.LEGENDARY,
            level: 70,
            potency: 6,
            sockets: 2,
            gems: [{ type: 'Ruby' }, { type: 'Sapphire' }],
            setId: 'warlord_fury',
            uniqueEffect: 'vampiric'
        });
        expect(authored).not.toBe(plain);
        const svg = decodeIcon(authored);
        expect(svg).toContain('#c44a32');
        expect(svg).toContain('#a32d3d');
        expect(svg).toContain('#c52d3b');
        expect(svg).toContain('#3566cc');
    });

    test('all UI routes use generated data without trusting persisted legacy icon paths', () => {
        const skill = UIManager.prototype.getSkillIconPath.call({}, 'Fireball', 'Wizard');
        const equipment = UIManager.prototype.getItemIconPath.call({}, {
            name: 'Ancient Iron Helm', baseName: 'Iron Helm', rarity: RARITY.RARE,
            icon: 'assets/icons/equipment/iron_helm.png'
        });
        const gem = UIManager.prototype.getGemIconPath.call({}, {
            name: 'Flawed Ruby', type: 'GEM', gemType: 'Ruby', gemQuality: 'Flawed',
            icon: 'assets/icons/gems/flawed_ruby.svg'
        });
        [skill, equipment, gem].forEach((uri) => expect(uri.startsWith('data:image/svg+xml')).toBe(true));
        expect(skill).not.toContain('.png');
        expect(equipment).not.toContain('.png');
        expect(gem).not.toContain('.svg');
        expect(getProceduralIconCacheMetrics()).toEqual(expect.objectContaining({
            icons: expect.any(Number), abilities: expect.any(Number), items: expect.any(Number), itemLimit: 512
        }));
        expect(getProceduralItemIcon({ name: 'Unknown Relic', type: 'RELIC' })).toBeNull();
    });

    test('dynamic equipment icon history is bounded for long-running sessions', () => {
        for (let level = 1; level <= 600; level += 1) {
            getProceduralItemIcon({
                name: 'Iron Sword', baseName: 'Iron Sword', rarity: 'Rare', level
            });
        }
        const metrics = getProceduralIconCacheMetrics();
        expect(metrics.items).toBeLessThanOrEqual(metrics.itemLimit);
        expect(getProceduralItemIcon({
            name: 'Iron Sword', baseName: 'Iron Sword', rarity: 'Rare', level: 600
        })).toBe(getProceduralItemIcon({
            name: 'Iron Sword', baseName: 'Iron Sword', rarity: 'Rare', level: 600
        }));
    });

    test('runtime icon code contains no authored ability, equipment, currency, or gem path', () => {
        const sources = [
            'src/ui/UIManager.js',
            'src/core/ItemSystem.js',
            'server/internal/game/items.go',
            'server/main.go'
        ].map((path) => readFileSync(path, 'utf8')).join('\n');
        expect(sources).not.toMatch(/assets\/icons\/(?:fighter|rogue|wizard|cleric|equipment|gems)\//);
        expect(sources).not.toMatch(/assets\/items\/(?:eidolon_heart|eidolon_shard)\//);
        expect(sources).toContain('procedural:item:eidolon-heart');
        expect(sources).toContain('procedural:gem:');
    });
});
