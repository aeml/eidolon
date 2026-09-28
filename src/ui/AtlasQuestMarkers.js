import { getChronicleInvestigation, getCurrentChronicleQuest, getRecordedChronicleDiscoveries } from '../core/ChronicleInvestigation.js';
import { darkRealmChaptersById } from '../data/chronicleCatalog.js';
import { chronicleHunts } from '../data/chronicleHunts.generated.js';
import { WORLD_LOCATIONS } from '../data/worldLocations.js';
import { WORLD_REGIONS } from '../data/worldGeography.js';
import { TOWN_SERVICE_POINTS } from './townServiceConfig.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../data/dungeonEntrances.js';
import { earthQuestSearch } from '../data/earthQuestSearch.js';
import { waterQuestSearch } from '../data/waterQuestSearch.js';
import { fireQuestSearch } from '../data/fireQuestSearch.js';
import { airQuestSearch } from '../data/airQuestSearch.js';

const hunts = new Map(chronicleHunts.map(q => [q.id, q]));
const questSearchers = { earth: earthQuestSearch, water: waterQuestSearch, fire: fireQuestSearch, air: airQuestSearch };
const targetsByRealm = {
    earth: ['Skeleton', 'Imp', 'DemonOrc', 'Construct', 'InfernoTitan', 'Verdant Memory Seed'],
    water: ['MountainTroll', 'AquaGolem', 'Siren', 'FrostGuardian', 'Moon-Tide Pearl'],
    fire: ['SandstormDjinn', 'MagmaGolem', 'ScorchedWraith', 'InfernalBehemoth', 'PhoenixSentinel', 'Cinderheart Ore'],
    air: ['StormHarpy', 'CloudElemental', 'ThunderRoc', 'TempestGiant', 'CycloneAvatar', 'Stormglass Pinion']
};
const dungeonTargets = {
    HollowSentinel: 'verdant_bastion_catacombs', VerdantBastionBoss: 'verdant_bastion_catacombs',
    Thalorath: 'abyssal_well', AbyssalWellBoss: 'abyssal_well',
    LordInfernax: 'molten_core', MoltenCoreBoss: 'molten_core',
    Zephyrion: 'tempest_spire', TempestSpireBoss: 'tempest_spire'
};
const districtIds = ['resonant_foothold', 'unwritten_shore', 'tithe_of_names', 'stillwater_foundry', 'city_without_tomorrow'];
const story = q => q.category === 'chronicle' || q.id?.startsWith('chronicle_');
const ready = q => q.accepted && !q.completed && q.maxCount > 0 && q.count >= q.maxCount;

export function getAtlasQuestGiverState(quests, isStory) {
    let available = (quests || []).filter(q => q && story(q) === isStory && !q.completed);
    if (isStory) {
        const current = getCurrentChronicleQuest(available);
        available = available.filter(q => q.legacyOptional || q.id === current?.id);
    }
    if (available.some(ready)) return { symbol: '?', availability: 'Ready to turn in · speak to the NPC and click Complete Quest' };
    if (available.some(q => !q.accepted)) return { symbol: '!', availability: 'Quests available · speak to the NPC to accept' };
    return { symbol: '·', availability: available.length ? 'Accepted quests in progress' : 'No new quests currently offered' };
}

function trackedIds(engine, quests) {
    const ui = engine?.uiManager?.quest;
    // Use the journal's existing per-character preferences, not another storage
    // key or the phone's single currently displayed tracker card.
    if (ui?.getTrackedObjectives && ui?.buildObjectiveSummary) {
        return new Set(ui.getTrackedObjectives(ui.buildObjectiveSummary(quests)).map(q => q.id));
    }
    const current = getCurrentChronicleQuest(quests);
    return new Set([current, ...quests.filter(q => q.accepted && !q.completed && q !== current)].filter(Boolean).slice(0, 3).map(q => q.id));
}

export function getAtlasQuestLocations(engine) {
    const quests = (engine?.player?.quests || []).filter(Boolean), tracked = trackedIds(engine, quests);
    const instanceId = engine?.currentInstanceId || '';
    const overworld = !instanceId && (!engine?.currentInstanceType || engine.currentInstanceType === 'overworld');
    const dark = instanceId === 'dark-realm' && engine.currentInstanceType === 'dark_realm';
    const locations = [];
    const add = (q, point, category, availability, purpose, symbol = '!') => {
        if (!point || ![point.x, point.z].every(Number.isFinite)) return;
        locations.push({ id: `quest-${q.id}-${point.id}`, name: point.name || point.label || point.title,
            x: point.x, z: point.z, instanceId, category, symbol,
            color: category === 'discoveries' ? '#a9c5dd' : story(q) ? '#efd184' : '#65baff',
            availability, purpose, questId: q.id, area: point.area });
    };
    for (const q of quests) {
        const chapter = getChronicleInvestigation(q.id);
        const sameSpace = chapter && (chapter.instanceId || '') === instanceId && (overworld || dark);
        const recorded = getRecordedChronicleDiscoveries(q), known = new Set(recorded.map(p => p.id));
        if (sameSpace) for (const p of recorded) add(q, p, 'discoveries', 'Recorded discovery',
            'Already recorded by this character. Read your saved account in the Chronicle journal.', '✓');
        if (q.completed || !tracked.has(q.id)) continue;
        const title = q.title || `${q.type === 'COLLECT' ? 'Collect' : 'Defeat'} ${q.target || 'quest targets'}`;
        if (!q.accepted || ready(q)) {
            const npc = overworld ? TOWN_SERVICE_POINTS.find(p => p.id === (story(q) ? 'story-wizard' : 'quest-giver'))
                : dark && story(q) ? WORLD_LOCATIONS.find(p => p.id === 'story-wizard-dark-realm') : null;
            if (npc) add(q, { ...npc, name: `${ready(q) ? 'Turn in' : 'Accept'} · ${title}` }, 'quests',
                ready(q) ? 'Ready to turn in' : 'Quest available',
                `Speak to ${npc.label || npc.name} and click ${ready(q) ? 'Complete Quest' : 'Accept Quest'}.`, ready(q) ? '?' : '!');
            continue;
        }
        if (sameSpace) {
            for (const site of chapter.sites) if (!known.has(site.id) && (!site.requires || known.has(site.requires))) {
                add(q, site, 'quests', `Tracked · ${title}`, 'Investigate for your accepted quest. Story text is revealed through play.');
            }
            continue;
        }
        const darkChapter = darkRealmChaptersById.get(q.id);
        if (dark && darkChapter && !chapter) {
            const room = engine.currentDungeonLayout?.rooms?.[districtIds.indexOf(darkChapter.district)];
            const enemy = darkChapter.enemy?.replace(/([a-z\d])([A-Z])/g, '$1 $2');
            const instruction = darkChapter.type === 'COLLECT'
                ? `Recover ${darkChapter.item} from ${enemy} in this district. Quest items are chance drops: pick up the dropped item; kills alone do not collect it.`
                : `Only level-100-or-higher ${enemy} defeated inside this district count for this hunt.`;
            if (room) add(q, { id: darkChapter.district, name: `${title} · district`, x: room.x, z: room.z,
                area: { minX: room.x - room.width / 2, maxX: room.x + room.width / 2, minZ: room.z - room.height / 2, maxZ: room.z + room.height / 2 } },
            'quests', 'Tracked · search this district', [q.objectiveText, instruction,
                'This marks a search area, not a live enemy. Follow the connected roads; a waypoint is not a safe path. Return to Ilyra’s projection at the Resonant Foothold and click Complete Quest when ready.'].filter(Boolean).join(' '));
        }
        if (!overworld) continue;
        if (darkChapter || ['EidolonDevourer', 'UmbraPrime'].includes(q.target)) {
            add(q, TOWN_SERVICE_POINTS.find(p => p.id === 'resonance-portal'), 'quests', 'Tracked · Dark Realm journey',
                'Enter through the Fourfold Portal when eligible. Follow the expedition and use the Dungeon Guide for eligible dungeon/raid admission.');
            continue;
        }
        const dungeon = DUNGEON_ENTRANCE_DEFINITIONS[dungeonTargets[q.target]];
        if (dungeon) {
            add(q, { id: dungeon.dungeonType, name: `${title} · entrance`, x: dungeon.position[0], z: dungeon.position[2] },
                'quests', 'Tracked · dungeon entrance', 'This is the public entrance, not the boss location. Check admission requirements and clear the instance with your party.');
            continue;
        }
        if (q.type === 'REPAIR' || /^DungeonBoss/.test(q.target || '')) {
            add(q, { ...TOWN_SERVICE_POINTS.find(p => p.id === 'dungeon-guide'), name: `${title} · Dungeon Guide` }, 'quests', 'Tracked · prepare a party',
                'Speak to the Dungeon Guide for the required raid or dungeon. Entry requirements still apply; this marker is not the crystal or boss.');
            continue;
        }
        const hunt = hunts.get(q.id);
        const realmId = hunt?.huntingRealm || Object.keys(targetsByRealm).find(id => targetsByRealm[id].includes(q.target));
        const realm = WORLD_REGIONS[realmId];
        const search = questSearchers[realmId]?.(q, hunt);
        if (search) {
            const enemyName = (hunt?.enemy || q.target || 'quest targets').replace(/([a-z\d])([A-Z])/g, '$1 $2');
            add(q, { id: realmId, name: `${title} · ${realm.name} area`, ...search }, 'quests',
                'Tracked · search area, not a live target',
                `${q.objectiveText || `Find ${enemyName} in ${realm.name}.`} ${search.directions} ${hunt ? `Only ${enemyName} enemies of level ${hunt.minEnemyLevel} or higher count for this hunt. ` : ''}This marks a search area, not a specific spawn. Check enemy levels before fighting.`);
            continue;
        }
        if (realm) add(q, { id: realmId, name: `${title} · ${realm.name} area`, x: (realm.minX + realm.maxX) / 2,
            z: (realm.minZ + realm.maxZ) / 2, area: realm }, 'quests', 'Tracked · broad search area, not a live target',
        `${q.objectiveText || `Find ${q.target} in ${realm.name}.`} The marker is the region center, not a specific spawn. Follow the quest’s level requirements.`);
    }
    return locations.sort((a, b) => Number(b.category === 'quests') - Number(a.category === 'quests'));
}
