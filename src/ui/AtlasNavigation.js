import { TOWN_SERVICE_POINTS } from './townServiceConfig.js';
import { WORLD_GEOGRAPHY, WORLD_REGIONS } from '../data/worldGeography.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../data/dungeonEntrances.js';
import { DUNGEON_ENTRY_LEVELS } from '../data/dungeonProgression.js';
import { getResonancePortalState } from '../core/ResonancePortalState.js';
import { getInstanceAtlas, atlasSpaceKey } from './InstanceAtlas.js';
import { isCasinoMapGuestVisible } from './CasinoMap.js';
import { getAtlasQuestLocations, getAtlasQuestGiverState } from './AtlasQuestMarkers.js';
import { EARTH_LOCATIONS, WORLD_READINGS, LANTERNHOLD_COURTYARDS } from '../data/worldPopulation.js';
import { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS } from '../data/elementalPopulation.js';
import { getPublicEventLocations } from './PublicEventDiscovery.js';

export const ATLAS_CATEGORIES = Object.freeze({
    services: { name: 'Services', symbol: '■', color: '#9bd5cb' },
    quests: { name: 'Quests', symbol: '!', color: '#efd184' },
    discoveries: { name: 'Discoveries', symbol: '✓', color: '#a9c5dd' },
    places: { name: 'Places & lore', symbol: '◇', color: '#c9ba91' },
    entrances: { name: 'Entrances', symbol: '◆', color: '#d6b3ef' },
    passages: { name: 'Passages', symbol: '↔', color: '#cfbc97' },
    events: { name: 'Events', symbol: '✦', color: '#b4dda4' },
    party: { name: 'Party', symbol: '●', color: '#a4ddac' }
});

export const isOverworldAtlas = engine => !engine?.currentInstanceId && (!engine?.currentInstanceType || engine.currentInstanceType === 'overworld');

const publicWorldLocations = Object.freeze([...EARTH_LOCATIONS, ...WATER_LOCATIONS, ...FIRE_LOCATIONS, ...AIR_LOCATIONS, ...LANTERNHOLD_COURTYARDS].filter(site => site.visibility === 'public').map(site => {
    const reading = WORLD_READINGS.find(reading => reading.locationId === site.id);
    return Object.freeze({ id: site.id, name: site.name, instanceId: '', category: 'places',
        symbol: reading ? '▤' : '◇', x: reading?.x ?? site.x + (site.arrivalOffset?.[0] || 0),
        z: reading?.z ?? site.z + (site.arrivalOffset?.[1] || 0), purpose: site.purpose,
        availability: site.region === 'town' ? 'Lanternhold safe zone · recovery works throughout town' :
            reading ? 'Optional public reading · approach and inspect · not a saved quest discovery' :
            site.role === 'camp' ? 'Abandoned site · combat territory, not a safe zone' : 'Public landmark · combat territory' });
}));

// Public wayfinding is separate from saved Chronicle masks. Mandatory story
// surroundings remain represented by their eligible quest/discovery markers.
export function getAtlasWorldLocations(engine) {
    return isOverworldAtlas(engine) ? publicWorldLocations : [];
}

// Party snapshots explicitly include instanceId. Missing identity is not proof
// of shared space; do not project private coordinates onto a public atlas.
export function isAtlasPartyMemberVisible(engine, member) {
    return typeof member?.instanceId === 'string' && member.instanceId === (engine?.currentInstanceId || '') &&
        (engine?.currentInstanceType !== 'casino' || isCasinoMapGuestVisible(engine, engine.remotePlayers?.get(member.id))) &&
        Number.isFinite(member.x) && Number.isFinite(member.z);
}

const SERVICE_PURPOSE = {
    'quest-giver': 'Accept daily quests and return here to claim completed rewards.',
    'story-wizard': 'Archmage Ilyra needs your help to restore the four elemental crystals. Accept and turn in story quests here.',
    forge: 'Upgrade equipment and potency at the Forge.', stash: 'Store and retrieve items from your stash.',
    'trading-house': 'Browse the Trading House and manage your listings.',
    'vendor-repair': 'Buy supplies, sell items and repair equipment.',
    'dungeon-guide': 'Prepare a party, check entry requirements and resume eligible dungeon or raid runs.'
};

export function getAtlasLocations(engine) {
    // Interiors have their own maps. Public entrances are not interior targets.
    if (!isOverworldAtlas(engine)) return [...(getInstanceAtlas(engine)?.locations || []), ...getAtlasQuestLocations(engine)];
    const player = engine?.player;
    const result = TOWN_SERVICE_POINTS.map(point => {
        const portal = point.id === 'resonance-portal';
        const category = portal ? 'entrances' : ['quest-giver', 'story-wizard'].includes(point.id) ? 'quests' : 'services';
        const questState = category === 'quests' ? getAtlasQuestGiverState(player?.quests, point.id === 'story-wizard') : null;
        return { id: point.id, name: point.label, x: point.x, z: point.z, category, instanceId: '',
            ...(questState || {}), color: point.color,
            purpose: portal ? 'Fourfold Portal to the shared Dark Realm expedition. This marker is the town entrance.' : SERVICE_PURPOSE[point.id],
            availability: portal ? (getResonancePortalState(player).eligible ? 'Portal attuned: approach to enter.' :
                'Requires level 100 and personally claimed repairs of all four crystals. Speak to Ilyra.') : questState?.availability || 'Lanternhold · safe zone' };
    });
    result.push({ id: 'lanternhold', name: 'Lanternhold', category: 'services', instanceId: '',
        x: 0, z: 200, purpose: 'Town services, Ilyra and the Fourfold Portal. Select to inspect the town map.',
        availability: 'Safe zone · health and mana recovery' });
    for (const [id, definition] of Object.entries(DUNGEON_ENTRANCE_DEFINITIONS)) {
        const provided = Number(engine?.atlasDungeonEntryLevels?.[id]);
        const level = Number.isInteger(provided) && provided > 0 ? provided : DUNGEON_ENTRY_LEVELS[id];
        result.push({ id, name: definition.label.replace(/^The /, ''), category: 'entrances', instanceId: '',
            x: definition.position[0], z: definition.position[2],
            purpose: 'Physical dungeon entrance, not the private interior or its crystal raid. Interact here or speak to the Dungeon Guide.',
            availability: `Minimum level ${level}. ${Number(player?.level) >= level ? 'Level requirement met; party and run admission checked on entry.' : `Your level: ${Number(player?.level) || 1}.`} Suitable party recommended.` });
    }
    for (const r of WORLD_GEOGRAPHY.regions) for (const wall of r.walls) {
        if (!wall.gap) continue;
        const vertical = wall.side === 'west' || wall.side === 'east';
        const middle = (wall.gap[0] + wall.gap[1]) / 2;
        const destination = r.id === 'town' ? 'Earth Realm' : { north: 'Water Realm', west: 'Fire Realm', east: 'Air Realm' }[wall.side];
        result.push({ id: `gate-${r.id}-${wall.side}`, name: `${r.name} · ${wall.side} gate`, category: 'passages', instanceId: '',
            x: vertical ? (wall.side === 'west' ? r.minX : r.maxX) : middle,
            z: vertical ? middle : (wall.side === 'north' ? r.minZ : r.maxZ),
            purpose: `Walkable opening toward ${destination}.`, availability: 'Open passage · combat territory beyond town' });
    }
    result.push(...getPublicEventLocations(engine?.publicEvents?.data));
    return [...result, ...getAtlasQuestLocations(engine), ...getAtlasWorldLocations(engine)];
}

export function getWaypointGuidance(engine, waypoint) {
    if (!waypoint || waypoint.instanceId !== (engine?.currentInstanceId || '')) return null;
    if (waypoint.spaceKey ? waypoint.spaceKey !== atlasSpaceKey(engine) : !isOverworldAtlas(engine)) return null;
    const position = engine?.player?.position;
    if (!position || ![position.x, position.z, waypoint.x, waypoint.z].every(Number.isFinite)) return null;
    const dx = waypoint.x - position.x, dz = waypoint.z - position.z;
    const distance = Math.hypot(dx, dz);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const direction = directions[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];
    return { distance, direction, text: distance < 5 ? `${waypoint.name} · nearby` : `${waypoint.name} · ${Math.round(distance)}m ${direction} · straight line` };
}

// A small canvas overlay shared by atlas and radar; no pathfinding or movement.
export function drawAtlasWaypoint(ctx, point, center, radius, label) {
    const dx = point.x - center.x, dy = point.y - center.y;
    const distance = Math.hypot(dx, dy), edge = distance > radius;
    const factor = edge ? radius / distance : 1;
    const x = center.x + dx * factor, y = center.y + dy * factor;
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#fff3bc'; ctx.fillStyle = '#d6ad54'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (edge) {
        ctx.rotate(Math.atan2(dy, dx)); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    } else {
        ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    if (label) {
        ctx.save(); ctx.fillStyle = '#fff3bc'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(label, x, y < center.y ? y + 22 : y - 13); ctx.restore();
    }
}

export class AtlasNavigation {
    constructor(map) {
        this.map = map; this.engine = map.gameEngine;
        this.filters = new Set(Object.keys(ATLAS_CATEGORIES));
        this.query = ''; this.selectedId = null; this.waypoint = null;
        map.container.querySelector('.atlas-navigation')?.remove();
        this.root = document.createElement('section'); this.root.className = 'atlas-navigation';
        this.root.setAttribute('aria-label', 'Atlas destinations');
        this.root.innerHTML = `<div class="atlas-search-row"><label>Find a known location<input type="search" maxlength="80" placeholder="Town, dungeon, event…" aria-label="Find a known location"></label>
            <button type="button" data-atlas-overview>World overview</button></div>
            <details class="atlas-directory"><summary>Locations & legend</summary>
            <div class="atlas-filters" role="group" aria-label="Location filters"></div>
            <div class="atlas-results" role="list" aria-label="Known locations"></div></details>
            <section class="atlas-detail" aria-label="Selected destination" hidden></section>
            <div class="atlas-waypoint-row"><output aria-label="Waypoint guidance" aria-live="off">No personal waypoint</output>
            <button type="button" data-atlas-clear disabled>Clear waypoint</button></div>`;
        map.canvas.before(this.root);
        this.search = this.root.querySelector('input');
        this.results = this.root.querySelector('.atlas-results');
        this.detail = this.root.querySelector('.atlas-detail');
        this.status = this.root.querySelector('output');
        this.clear = this.root.querySelector('[data-atlas-clear]');
        const controls = map.container.querySelector('.world-map-controls');
        if (controls) {
            controls.querySelector('.atlas-waypoint-row')?.remove();
            controls.prepend(this.root.querySelector('.atlas-waypoint-row'));
        }
        this.search.oninput = () => {
            this.query = this.search.value.trim().toLocaleLowerCase();
            this.root.querySelector('details').open = true; this.refresh(true);
        };
        const filters = this.root.querySelector('.atlas-filters');
        for (const [id, category] of Object.entries(ATLAS_CATEGORIES)) {
            const label = document.createElement('label'), input = document.createElement('input');
            input.type = 'checkbox'; input.checked = true;
            input.onchange = () => { if (input.checked) this.filters.add(id); else this.filters.delete(id); this.refresh(true); map._redrawIfVisible(); };
            label.append(input, ` ${category.symbol} ${category.name}`); filters.append(label);
        }
        this.root.querySelector('[data-atlas-overview]').onclick = () => map.showWorldOverview();
        this.clear.onclick = () => {
            this.waypoint = null; this.refresh(true); map._redrawIfVisible();
            // Disabling the focused button otherwise drops keyboard focus out
            // of the atlas, letting the next key reach character controls.
            map.canvas.focus();
        };
        for (const event of ['pointerdown', 'mousedown', 'touchstart', 'click', 'wheel']) {
            this.root.addEventListener(event, e => e.stopPropagation());
        }
        this.refresh(true);
    }

    refresh(force = false) {
        const space = atlasSpaceKey(this.engine);
        if (this.space && this.space !== space) {
            this.selectedId = null; this.query = ''; this.search.value = '';
        }
        this.space = space;
        this.locations = getAtlasLocations(this.engine);
        const signature = JSON.stringify([this.locations, this.query, [...this.filters], this.selectedId]);
        if (force || signature !== this.signature) {
            const focused = this.root.contains(document.activeElement) ? document.activeElement : null;
            this.signature = signature;
            const visible = this.locations.filter(p => this.filters.has(p.category) && `${p.name} ${p.purpose}`.toLocaleLowerCase().includes(this.query));
            this.results.replaceChildren();
            for (const p of visible) {
                const row = document.createElement('div'); row.setAttribute('role', 'listitem');
                const button = document.createElement('button'); button.type = 'button';
                button.textContent = `${p.symbol || ATLAS_CATEGORIES[p.category].symbol} ${p.name}`;
                button.setAttribute('aria-pressed', String(this.selectedId === p.id));
                button.onclick = () => this.select(p.id); row.append(button); this.results.append(row);
            }
            if (!visible.length) this.results.textContent = isOverworldAtlas(this.engine) ? 'No matching known locations.' : 'Current instance map. Overworld destinations return when you leave this instance.';
            this.renderDetail();
            const overview = this.root.querySelector('[data-atlas-overview]');
            overview.textContent = isOverworldAtlas(this.engine) ? 'World overview' : 'Area overview';
            overview.disabled = !isOverworldAtlas(this.engine) && !getInstanceAtlas(this.engine)?.bounds;
            if (focused && !focused.isConnected) this.search.focus();
        }
        const guidance = getWaypointGuidance(this.engine, this.waypoint);
        const text = guidance?.text || (this.waypoint ? `${this.waypoint.name} · waypoint in ${this.waypoint.instanceId ? 'another area' : 'the overworld'}` : 'No personal waypoint');
        if (this.status.textContent !== text) this.status.textContent = text;
        this.clear.disabled = !this.waypoint;
    }

    select(id) {
        const location = this.locations.find(p => p.id === id);
        if (!location) return;
        this.map.autoFitAtlas = false;
        this.selectedId = id; this.map.cameraX = location.x; this.map.cameraZ = location.z;
        this.root.querySelector('details').open = false;
        this.map.mapOffsetX = 0; this.map.mapOffsetY = 0;
        this.map.scale = location.category === 'services' || location.category === 'quests' ? 3 : 1;
        if (location.area) { this.map.fitAtlasBounds(location.area); this.map.autoFitAtlas = false; }
        this.map.updateZoomLabel(); this.refresh(true); this.map._redrawIfVisible();
        this.detail.querySelector('h3')?.focus();
    }

    renderDetail() {
        const p = this.locations.find(p => p.id === this.selectedId);
        this.detail.replaceChildren(); this.detail.hidden = !p;
        if (!p) return;
        const title = document.createElement('h3'), copy = document.createElement('p'), availability = document.createElement('p');
        title.textContent = p.name; copy.textContent = p.purpose;
        title.tabIndex = -1;
        availability.textContent = `${p.availability} · ${Math.round(p.x)}, ${Math.round(p.z)}`;
        const waypoint = document.createElement('button'); waypoint.type = 'button'; waypoint.textContent = 'Set personal waypoint';
        waypoint.onclick = () => {
            this.waypoint = { id: p.id, name: p.name, x: p.x, z: p.z, instanceId: p.instanceId, spaceKey: atlasSpaceKey(this.engine) };
            this.refresh(); this.map._redrawIfVisible();
        };
        this.detail.append(title, copy, availability, waypoint);
    }
}

export const OVERWORLD_CENTER = Object.freeze({
    x: (WORLD_REGIONS.fire.minX + WORLD_REGIONS.air.maxX) / 2,
    z: (WORLD_REGIONS.water.minZ + WORLD_REGIONS.earth.maxZ) / 2
});
