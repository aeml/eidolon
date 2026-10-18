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

export function getAtlasLocations(engine, { questId = null } = {}) {
    // Interiors have their own maps. Public entrances are not interior targets.
    if (!isOverworldAtlas(engine)) return [...(getInstanceAtlas(engine)?.locations || []), ...getAtlasQuestLocations(engine, { questId })];
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
    return [...result, ...getAtlasQuestLocations(engine, { questId }), ...getAtlasWorldLocations(engine)];
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
        map.navigation?.dispose?.();
        this.map = map; this.engine = map.gameEngine;
        map.navigation = this;
        this.listeners = new AbortController();
        this.locationRows = new Map();
        this.filters = new Set(Object.keys(ATLAS_CATEGORIES));
        this.query = ''; this.selectedId = null; this.waypoint = null;
        this.questFocusId = null; this.questFocusReturn = null;
        map.container.querySelector('.atlas-navigation')?.remove();
        this.root = document.createElement('section'); this.root.className = 'atlas-navigation';
        this.root.setAttribute('aria-label', 'Atlas destinations');
        this.root.innerHTML = `<div class="atlas-search-row"><label>Find a known location<input type="search" maxlength="80" placeholder="Town, dungeon, event…" aria-label="Find a known location"></label>
            <button type="button" data-atlas-overview>World overview</button></div>
            <details class="atlas-directory"><summary>Locations & legend</summary>
            <div class="atlas-filters" role="group" aria-label="Location filters"></div>
            <p data-atlas-terrain-legend hidden>Earth contours: 3m elevation intervals. Shaded hills are terrain, not roads.</p>
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
        this.waypointRow = this.root.querySelector('.atlas-waypoint-row');
        const controls = map.container.querySelector('.world-map-controls');
        if (controls) {
            controls.querySelector('.atlas-waypoint-row')?.remove();
            controls.prepend(this.root.querySelector('.atlas-waypoint-row'));
        }
        this.bindControl(this.search, 'input', () => {
            this.restoreQuestFocus({ viewport: false, search: false });
            this.query = this.search.value.trim().toLocaleLowerCase();
            this.root.querySelector('details').open = true; this.refresh(true);
        });
        this.questFocusNotice = document.createElement('div'); this.questFocusNotice.className = 'atlas-quest-focus';
        this.questFocusNotice.hidden = true;
        this.questFocusLabel = document.createElement('p'); this.questFocusLabel.setAttribute('role', 'status');
        const returnToMap = document.createElement('button'); returnToMap.type = 'button'; returnToMap.className = 'menu-btn';
        returnToMap.textContent = 'Return to map';
        this.bindControl(returnToMap, 'click', () => this.clearQuestFocus({ focusSearch: true }));
        this.questFocusNotice.append(this.questFocusLabel, returnToMap); this.root.prepend(this.questFocusNotice);
        const filters = this.root.querySelector('.atlas-filters');
        for (const [id, category] of Object.entries(ATLAS_CATEGORIES)) {
            const label = document.createElement('label'), input = document.createElement('input');
            input.type = 'checkbox'; input.checked = true; input.dataset.atlasCategory = id;
            this.bindControl(input, 'change', () => {
                const checked = input.checked; this.restoreQuestFocus({ viewport: false });
                if (checked) this.filters.add(id); else this.filters.delete(id);
                this.refresh(true); map._redrawIfVisible();
            });
            label.append(input, ` ${category.symbol} ${category.name}`); filters.append(label);
        }
        this.bindControl(this.root.querySelector('[data-atlas-overview]'), 'click', () => map.showWorldOverview());
        this.bindControl(this.clear, 'click', () => {
            this.waypoint = null; this.refresh(true); map._redrawIfVisible();
            // Disabling the focused button otherwise drops keyboard focus out
            // of the atlas, letting the next key reach character controls.
            map.canvas.focus();
        });
        for (const event of ['pointerdown', 'mousedown', 'touchstart', 'touchmove', 'touchend', 'click', 'wheel']) {
            this.root.addEventListener(event, e => e.stopPropagation(), { signal: this.listeners.signal });
        }
        this.refresh(true);
    }

    refresh(force = false) {
        if (this.disposed || this.map.disposed) return;
        const space = atlasSpaceKey(this.engine);
        if (this.space && this.space !== space) {
            this.retireLocationRows();
            this.restoreQuestFocus({ viewport: false });
            this.selectedId = null; this.query = ''; this.search.value = '';
        }
        this.space = space;
        if (this.questFocusId && !this.engine.player?.quests?.some(q => q.id === this.questFocusId && !q.completed)) this.restoreQuestFocus();
        this.root.querySelector('[data-atlas-terrain-legend]').hidden = !this.map.cartography?.elevation || !isOverworldAtlas(this.engine);
        this.locations = getAtlasLocations(this.engine, { questId: this.questFocusId });
        if (this.questFocusId && !this.locations.some(p => p.id === this.selectedId && p.questId === this.questFocusId && p.category === 'quests')) {
            const target = this.nearestQuestTarget(this.locations.filter(p => p.questId === this.questFocusId && p.category === 'quests'));
            if (target) { this.selectedId = target.id; this.positionOnLocation(target); }
            else { this.restoreQuestFocus(); this.locations = getAtlasLocations(this.engine); }
        }
        this.questFocusNotice.hidden = !this.questFocusId;
        const focusedQuest = this.engine.player?.quests?.find(q => q.id === this.questFocusId);
        this.questFocusLabel.textContent = focusedQuest ? `Quest focus · ${focusedQuest.title || focusedQuest.id}` : '';
        for (const input of this.root.querySelectorAll('[data-atlas-category]')) input.checked = this.filters.has(input.dataset.atlasCategory);
        const signature = JSON.stringify([this.locations, this.query, [...this.filters], this.selectedId]);
        if (force || signature !== this.signature) {
            const focused = this.root.contains(document.activeElement) ? document.activeElement : null;
            const readingDetail = this.detail.contains(focused);
            this.signature = signature;
            const visible = this.locations.filter(p => this.filters.has(p.category) && `${p.name} ${p.purpose}`.toLocaleLowerCase().includes(this.query));
            const visibleIds = new Set(visible.map(p => p.id));
            for (const [id, entry] of this.locationRows) if (!visibleIds.has(id)) {
                entry.button.onclick = null; entry.row.remove(); this.locationRows.delete(id);
            }
            // Keep unchanged press targets attached; only obsolete rows or
            // the empty-state text retire when authoritative locations change.
            for (const child of [...this.results.childNodes]) if (child.nodeType !== 1) child.remove();
            let cursor = this.results.firstChild;
            for (const p of visible) {
                let entry = this.locationRows.get(p.id);
                if (!entry) {
                    const row = document.createElement('div'); row.setAttribute('role', 'listitem');
                    const button = document.createElement('button'); button.type = 'button'; row.append(button);
                    this.bindControl(button, 'click', () => this.select(p.id), { space });
                    entry = { row, button }; this.locationRows.set(p.id, entry);
                }
                const { row, button } = entry;
                const text = `${p.symbol || ATLAS_CATEGORIES[p.category].symbol} ${p.name}`;
                if (button.textContent !== text) button.textContent = text;
                button.setAttribute('aria-pressed', String(this.selectedId === p.id));
                if (row === cursor) cursor = cursor.nextSibling;
                else this.results.insertBefore(row, cursor);
            }
            if (!visible.length) this.results.textContent = isOverworldAtlas(this.engine) ? 'No matching known locations.' : 'Current instance map. Overworld destinations return when you leave this instance.';
            this.renderDetail();
            const overview = this.root.querySelector('[data-atlas-overview]');
            overview.textContent = isOverworldAtlas(this.engine) ? 'World overview' : 'Area overview';
            overview.disabled = !isOverworldAtlas(this.engine) && !getInstanceAtlas(this.engine)?.bounds;
            if (focused && !focused.isConnected) (readingDetail && this.detail.querySelector('h3') || this.search).focus({ preventScroll: true });
        }
        const guidance = getWaypointGuidance(this.engine, this.waypoint);
        const text = guidance?.text || (this.waypoint ? `${this.waypoint.name} · waypoint in ${this.waypoint.instanceId ? 'another area' : 'the overworld'}` : 'No personal waypoint');
        if (this.status.textContent !== text) this.status.textContent = text;
        this.clear.disabled = !this.waypoint;
    }

    select(id) {
        if (this.disposed || this.map.disposed || this.space !== atlasSpaceKey(this.engine)) return;
        const location = this.locations.find(p => p.id === id);
        if (!location) return;
        if (this.questFocusId && (location.questId !== this.questFocusId || location.category !== 'quests')) this.restoreQuestFocus({ viewport: false });
        this.selectedId = id; this.positionOnLocation(location);
        this.root.querySelector('details').open = false;
        this.refresh(true); this.map._redrawIfVisible();
        this.detail.querySelector('h3')?.focus();
    }

    positionOnLocation(location) {
        this.map.syncAtlasSpace?.();
        this.map.autoFitAtlas = false;
        this.map.cameraX = location.x; this.map.cameraZ = location.z;
        this.map.mapOffsetX = 0; this.map.mapOffsetY = 0;
        this.map.scale = location.category === 'services' || location.category === 'quests' ? 3 : 1;
        if (location.area) { this.map.fitAtlasBounds(location.area); this.map.autoFitAtlas = false; }
        this.map.updateZoomLabel();
    }

    focusQuest(questId) {
        if (this.disposed || this.map.disposed) return false;
        if (this.space !== atlasSpaceKey(this.engine)) {
            this.map.syncAtlasSpace?.(); this.refresh(true);
        }
        const targets = getAtlasLocations(this.engine, { questId }).filter(p => p.category === 'quests' && p.questId === questId);
        if (!targets.length) return false;
        const target = this.nearestQuestTarget(targets);
        if (!this.questFocusReturn) this.questFocusReturn = { query: this.query, search: this.search.value, filters: [...this.filters], selectedId: this.selectedId,
            viewport: Object.fromEntries(['cameraX', 'cameraZ', 'scale', 'mapOffsetX', 'mapOffsetY', 'autoFitAtlas'].map(key => [key, this.map[key]])) };
        this.questFocusId = questId; this.selectedId = target.id; this.query = ''; this.search.value = ''; this.filters.add('quests');
        this.refresh(true); this.select(target.id); return true;
    }

    nearestQuestTarget(targets) {
        const position = this.engine.player?.position || { x: 0, z: 0 };
        const distance = p => (p.x - position.x) ** 2 + (p.z - position.z) ** 2;
        return targets.length ? targets.reduce((nearest, p) => distance(p) < distance(nearest) ? p : nearest) : null;
    }

    restoreQuestFocus({ viewport = true, search = true } = {}) {
        if (this.disposed || this.map.disposed) return false;
        if (!this.questFocusReturn) return false;
        const saved = this.questFocusReturn; this.questFocusReturn = null; this.questFocusId = null;
        this.query = saved.query; if (search) this.search.value = saved.search;
        this.filters = new Set(saved.filters); this.selectedId = saved.selectedId;
        if (viewport && this.space === atlasSpaceKey(this.engine)) {
            Object.assign(this.map, saved.viewport); this.map.updateZoomLabel?.();
        }
        return true;
    }

    clearQuestFocus({ focusSearch = false } = {}) {
        if (!this.restoreQuestFocus()) return false;
        this.refresh(true); this.map._redrawIfVisible();
        if (focusSearch) this.search.focus({ preventScroll: true });
        return true;
    }

    renderDetail() {
        if (this.disposed || this.map.disposed) return;
        const p = this.locations.find(p => p.id === this.selectedId);
        const key = p ? JSON.stringify([this.space, p.id]) : null;
        this.detail.hidden = !p;
        if (this.detailParts && this.detailKey !== key) {
            this.detailParts.waypoint.onclick = null; this.detail.replaceChildren(); this.detailParts = null;
        }
        this.detailKey = key;
        if (!p) return;
        if (!this.detailParts) {
            const title = document.createElement('h3'), copy = document.createElement('p'), availability = document.createElement('p');
            title.tabIndex = -1;
            const waypoint = document.createElement('button'); waypoint.type = 'button'; waypoint.textContent = 'Set personal waypoint';
            this.bindControl(waypoint, 'click', () => {
                const current = this.locations.find(location => location.id === p.id);
                if (!current || this.selectedId !== p.id) return;
                this.waypoint = { id: current.id, name: current.name, x: current.x, z: current.z,
                    instanceId: current.instanceId, spaceKey: this.space };
                this.refresh(); this.map._redrawIfVisible();
            }, { space: this.space });
            this.detailParts = { title, copy, availability, waypoint };
            this.detail.append(title, copy, availability, waypoint);
        }
        const { title, copy, availability } = this.detailParts;
        if (title.textContent !== p.name) title.textContent = p.name;
        if (copy.textContent !== p.purpose) copy.textContent = p.purpose;
        const status = `${p.availability} · ${Math.round(p.x)}, ${Math.round(p.z)}`;
        if (availability.textContent !== status) availability.textContent = status;
    }

    bindControl(element, type, callback, { space } = {}) {
        element[`on${type}`] = event => {
            if (this.disposed || this.map.disposed || this.map.navigation !== this ||
                this.engine !== this.map.gameEngine || !this.root.isConnected || !element.isConnected ||
                (space !== undefined && space !== atlasSpaceKey(this.engine))) return;
            callback(event);
        };
    }

    retireLocationRows() {
        for (const { row, button } of this.locationRows.values()) { button.onclick = null; row.remove(); }
        this.locationRows.clear();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.listeners.abort(); this.retireLocationRows();
        this.search.oninput = null; this.clear.onclick = null;
        for (const control of this.root.querySelectorAll('button, input')) { control.onclick = null; control.onchange = null; }
        this.root.remove(); this.waypointRow.remove();
    }
}

export const OVERWORLD_CENTER = Object.freeze({
    x: (WORLD_REGIONS.fire.minX + WORLD_REGIONS.air.maxX) / 2,
    z: (WORLD_REGIONS.water.minZ + WORLD_REGIONS.earth.maxZ) / 2
});
