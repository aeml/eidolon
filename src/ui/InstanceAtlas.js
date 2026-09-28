import { buildDungeonSurfaceUnion } from '../world/dungeonSurfaceUnion.js';
import { findNextDungeonMeaningfulRoom, getDungeonBeatLabel, getDungeonCadenceLabel, isLiveDungeonBossRoom } from '../utils/dungeonRoomMetadata.js';
import { getCasinoMapState } from './CasinoMap.js';
import { CASINO_INTERIOR_LAYOUT } from '../data/casinoInteriorLayout.js';
import { DARK_REALM_COURTS, DARK_REALM_PATHS } from '../data/darkRealmPopulation.js';

const TITLES = Object.freeze({
    crypt: 'Crypt', verdant_bastion_catacombs: 'Verdant Bastion', abyssal_well: 'Abyssal Well',
    molten_core: 'Molten Core', tempest_spire: 'Tempest Spire', umbral_nexus: 'Umbral Nexus',
    earth_crystal_raid: 'Rootheart Sanctum', water_crystal_raid: 'Tidestar Confluence',
    fire_crystal_raid: 'Ember Crown Crucible', air_crystal_raid: 'Skyglass Eyrie',
    weekly_raid: 'Dark Realm Raid', dark_realm: 'Dark Realm', pvp_arena: 'PvP Arena'
});
const DISTRICTS = ['Resonant Foothold', 'Unwritten Shore', 'Tithe of Names', 'Stillwater Foundry', 'City Without Tomorrow'];
const CASINO_RECTS = Object.freeze([{ x: 0, z: CASINO_INTERIOR_LAYOUT.centerZ,
    width: CASINO_INTERIOR_LAYOUT.width, height: CASINO_INTERIOR_LAYOUT.depth, kind: 'room' }]);
const geometryCache = new WeakMap();
const validRect = r => r && [r.x, r.z, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;

export function atlasSpaceKey(engine) {
    return JSON.stringify([engine?.currentInstanceId || '', engine?.currentInstanceType || 'overworld',
        engine?.currentInstanceType === 'casino' ? engine?.casino?.floor || 'public' : '']);
}

function geometry(rects) {
    if (!geometryCache.has(rects)) {
        const valid = rects.filter(validRect);
        const surface = buildDungeonSurfaceUnion(valid);
        const bounds = valid.length ? {
            minX: Math.min(...valid.map(r => r.x - r.width / 2)), maxX: Math.max(...valid.map(r => r.x + r.width / 2)),
            minZ: Math.min(...valid.map(r => r.z - r.height / 2)), maxZ: Math.max(...valid.map(r => r.z + r.height / 2))
        } : null;
        geometryCache.set(rects, { ...surface, bounds });
    }
    return geometryCache.get(rects);
}

export function getInstanceAtlas(engine) {
    const type = engine?.currentInstanceType;
    if (!engine?.currentInstanceId && (!type || type === 'overworld')) return null;
    const summary = engine.getDungeonRoomSummary?.();
    const layout = engine.currentDungeonLayout;
    const casino = type === 'casino' ? getCasinoMapState(engine) : null;
    const source = casino ? CASINO_RECTS : layout?.walkRects?.length ? layout.walkRects : layout?.rooms || summary?.rooms;
    const surface = Array.isArray(source) ? geometry(source) : { floors: [], walls: [], bounds: null };
    const rooms = (summary?.rooms || layout?.rooms || []).filter(validRect);
    const objective = summary?.rooms?.find(r => r.index === summary.objectiveRoomIndex);
    const next = objective ? findNextDungeonMeaningfulRoom(summary, objective.index) : null;
    const title = casino ? `Lanternhold Casino · ${casino.floor === 'vip' ? 'VIP / EP' : 'Public / Gold'}` : TITLES[type] || 'Current instance';
    const model = { ...surface, title, rooms, summary, objective, next, casino, locations: [] };
    if (!engine.currentInstanceId) return model; // transition not yet identified
    const add = (id, name, x, z, category, purpose, availability) => {
        if (![x, z].every(Number.isFinite)) return;
        model.locations.push({ id, name, x, z, category, purpose, availability,
            instanceId: engine.currentInstanceId, spaceKey: atlasSpaceKey(engine) });
    };
    if (casino) {
        casino.landmarks.forEach((p, i) => add(`casino-landmark-${i}`, p.label, p.x, p.z, 'passages', 'Walk to this venue interaction.', title));
        casino.tables.forEach(p => add(`table-${p.id}`, `${p.label} · ${p.id}`, p.x, p.z, 'services', 'Approach and interact with this station to take a seat.', title));
    } else if (type === 'dark_realm') {
        if (layout?.walkRects?.length) model.paths = DARK_REALM_PATHS;
        (layout?.rooms || []).forEach((r, i) => add(`district-${i}`, DISTRICTS[i] || 'Dark Realm district', r.x, r.z, 'passages',
            i === 0 ? 'Expedition recovery and Ilyra’s projection.' : 'A district of the shared Dark Realm expedition.', i === 0 ? 'Recovery camp' : 'Level 100 combat territory'));
        if (layout?.walkRects?.length) DARK_REALM_COURTS.forEach(site => {
            if (!layout.walkRects.some(r => Math.abs(site.arrivalX - r.x) < r.width / 2 && Math.abs(site.arrivalZ - r.z) < r.height / 2)) return;
            add(site.id, site.name, site.arrivalX, site.arrivalZ, 'places', site.purpose, 'Level 100 combat territory');
        });
    } else if (type !== 'pvp_arena') {
        rooms.forEach((r, i) => {
            const index = r.index ?? i;
            if (!r.explored && !r.cleared && r.type !== 'start' && index !== objective?.index && index !== next?.index) return;
            const beat = getDungeonBeatLabel(r, summary) || 'Chamber';
            add(`room-${index}`, `${index + 1} · ${beat}`, r.x, r.z, index === objective?.index ? 'quests' : 'passages',
                r.type === 'start' ? 'Instance entrance and return route.' : 'Known chamber in this run; follow the actual connected corridors.',
                r.cleared ? 'Cleared' : index === objective?.index ? 'Current objective' : index === next?.index ? 'Next encounter preview' : 'Explored');
        });
    }
    return model;
}

export function drawInstanceAtlasFloor(ctx, model, project) {
    ctx.fillStyle = model.casino?.floor === 'vip' ? '#3e344a' : '#303d42';
    for (const r of model.floors) {
        const a = project(r.left, r.top), b = project(r.right, r.top), c = project(r.right, r.bottom), d = project(r.left, r.bottom);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }
    // These are exposed union edges, not per-rectangle outlines across doorways.
    ctx.strokeStyle = '#a49370'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const wall of model.walls) {
        const a = wall.axis === 'x' ? project(wall.start, wall.at) : project(wall.at, wall.start);
        const b = wall.axis === 'x' ? project(wall.end, wall.at) : project(wall.at, wall.end);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    if (model.paths?.length) {
        ctx.strokeStyle = '#887f82'; ctx.lineWidth = 1; ctx.beginPath();
        for (const path of model.paths) path.points.forEach(([x, z], index) => {
            const p = project(x, z);
            if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
    }
}

export function drawInstanceAtlas(ctx, model, project, width, height) {
    ctx.fillStyle = '#111a22'; ctx.fillRect(0, 0, width, height);
    drawInstanceAtlasFloor(ctx, model, project);
    for (const room of model.rooms) {
        const p = project(room.x, room.z);
        if (room.cleared) { ctx.fillStyle = '#8fc2a1'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✓', p.x, p.y - 13); }
        if (room.index === model.objective?.index && model.objective) {
            ctx.strokeStyle = isLiveDungeonBossRoom(room, model.summary) ? '#ed9990' : '#e6c67e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.fillStyle = '#e4d3af'; ctx.textAlign = 'left'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(model.title, 12, 22, Math.max(1, width - 60));
    ctx.font = '12px system-ui';
    if (!model.bounds) ctx.fillText('Waiting for this instance’s floor layout.', 12, 43, width - 24);
    else if (model.objective) {
        const cadence = getDungeonCadenceLabel(model.objective);
        ctx.fillText(`${getDungeonBeatLabel(model.objective, model.summary)}${cadence ? ` · ${cadence}` : ''}`, 12, 43, width - 24);
        if (model.next) ctx.fillText(`Next: ${getDungeonBeatLabel(model.next, model.summary)}`, 12, 61, width - 24);
    }
}
