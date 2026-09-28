// ============================================================================
// WorldMap — config-driven full-screen zone map
// ============================================================================
// All spatial data (realms, zones, dungeons, fences) lives in static config
// tables. The draw() method iterates configs instead of containing inline
// coordinates, making it easy to add new zones or adjust layout.
// ============================================================================

import { TOWN_SERVICE_POINTS } from './townServiceConfig.js';
import { WORLD_REGIONS, WORLD_GEOGRAPHY, getRegionWallSegments } from '../data/worldGeography.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from '../data/dungeonEntrances.js';
import { drawDarkRealmWorldMap } from './DarkRealmMap.js';
import { drawCasinoWorldMap } from './CasinoMap.js';
import { AtlasNavigation, ATLAS_CATEGORIES, OVERWORLD_CENTER, isOverworldAtlas,
    isAtlasPartyMemberVisible, getWaypointGuidance, drawAtlasWaypoint } from './AtlasNavigation.js';
import {
    findNextDungeonMeaningfulRoom,
    getDungeonBeatLabel,
    getDungeonCadenceLabel,
    getDungeonRoomRole,
    isLiveDungeonBossRoom
} from '../utils/dungeonRoomMetadata.js';

// ---------------------------------------------------------------------------
// Config tables
// ---------------------------------------------------------------------------

/** Realm background fills drawn first (large tinted rectangles). */
const REALM_BACKGROUNDS = [
    // Water/Snow realm
    { id: 'water', fill: 'rgba(200, 240, 255, 0.2)' },
    // Fire realm
    { id: 'fire', fill: 'rgba(255, 100, 0, 0.15)' },
    // Air realm
    { id: 'air', fill: 'rgba(150, 200, 255, 0.15)' },
    // Town
    { id: 'town', fill: 'rgba(100, 100, 255, 0.3)' },
].map(({ id, ...style }) => {
    const r = WORLD_REGIONS[id];
    return { x: r.minX, z: r.minZ, w: r.maxX - r.minX, d: r.maxZ - r.minZ, ...style };
});

/**
 * Realm labels (large text drawn at every zoom level).
 * `minScale` controls the minimum zoom at which the label appears (0 = always).
 */
const REALM_LABELS = [
    { id: 'water', color: '#fff', fontSize: 48, minScale: 0 },
    { id: 'earth', color: '#fff', fontSize: 48, minScale: 0, offsetY: -100 },
    { id: 'fire', color: '#ff6600', fontSize: 48, minScale: 0 },
    { id: 'air', color: '#88ccff', fontSize: 48, minScale: 0 },
    { id: 'town', color: '#fff', fontSize: 36, minScale: 0.8 },
].map(({ id, ...style }) => {
    const r = WORLD_REGIONS[id];
    return { wx: (r.minX + r.maxX) / 2, wz: (r.minZ + r.maxZ) / 2, text: r.name, ...style };
});

/**
 * Enemy/level zones — rectangular regions with labels.
 * `tier` controls zoom-based culling: 'realm' always visible, 'zone' at scale>=0.8,
 * 'detail' at scale>=1.5.
 */
const ZONE_CONFIGS = [
    // ---- Earth realm level strips ----
    { x: -200, z: -600, w: 400, d: 1600, fill: 'rgba(0, 255, 0, 0.05)', label: 'Lv 1-10', labelColor: 'rgba(255,255,255,0.6)', fontSize: 36, tier: 'zone' },
    { x: -600, z: -600, w: 400, d: 1600, fill: 'rgba(255, 255, 0, 0.05)', label: 'Lv 10-20', labelColor: 'rgba(255,255,255,0.6)', fontSize: 36, tier: 'zone' },
    { x: 200, z: -600, w: 400, d: 1600, fill: 'rgba(255, 165, 0, 0.05)', label: 'Lv 20-30', labelColor: 'rgba(255,255,255,0.6)', fontSize: 36, tier: 'zone' },
    { x: -1000, z: -600, w: 400, d: 1600, fill: 'rgba(255, 0, 0, 0.05)', label: 'Lv 30-40', labelColor: 'rgba(255,255,255,0.6)', fontSize: 36, tier: 'zone' },
    { x: 600, z: -600, w: 400, d: 1600, fill: 'rgba(128, 0, 128, 0.05)', label: 'Lv 40-50', labelColor: 'rgba(255,255,255,0.6)', fontSize: 36, tier: 'zone' },

    // ---- Water realm enemy zones ----
    { x: -1000, z: -1000, w: 2000, d: 400, fill: 'rgba(139, 69, 19, 0.15)', stroke: 'rgba(139, 69, 19, 0.5)', label: 'Mountain Trolls (Lv 50-55)', labelColor: '#aaffff', fontSize: 36, tier: 'zone' },
    { x: -1000, z: -1400, w: 2000, d: 400, fill: 'rgba(0, 136, 255, 0.15)', stroke: 'rgba(0, 136, 255, 0.5)', label: 'Aqua Golems (Lv 55-60)', labelColor: '#aaffff', fontSize: 36, tier: 'zone' },
    { x: -1000, z: -1800, w: 2000, d: 400, fill: 'rgba(0, 100, 255, 0.15)', stroke: 'rgba(0, 200, 255, 0.5)', label: 'Sirens (Lv 60-65)', labelColor: '#aaffff', fontSize: 36, tier: 'zone' },
    { x: -1000, z: -2200, w: 2000, d: 400, fill: 'rgba(0, 255, 255, 0.15)', stroke: 'rgba(0, 255, 255, 0.5)', label: 'Frost Guardians (Lv 65-70)', labelColor: '#aaffff', fontSize: 36, tier: 'zone' },

    // ---- Fire realm enemy zones ----
    { x: -1400, z: -600, w: 400, d: 1600, fill: 'rgba(255, 200, 100, 0.1)', stroke: 'rgba(255, 200, 100, 0.3)', label: 'Djinn (70-75)', labelColor: '#ffcc66', fontSize: 32, tier: 'detail' },
    { x: -1800, z: -600, w: 400, d: 1600, fill: 'rgba(255, 150, 50, 0.1)', stroke: 'rgba(255, 150, 50, 0.3)', label: 'Magma (75-80)', labelColor: '#ff9933', fontSize: 32, tier: 'detail' },
    { x: -2200, z: -600, w: 400, d: 1600, fill: 'rgba(255, 100, 0, 0.1)', stroke: 'rgba(255, 100, 0, 0.3)', label: 'Wraith (80-85)', labelColor: '#ff6600', fontSize: 32, tier: 'detail', labelOffsetY: 60 },
    { x: -2600, z: -600, w: 400, d: 1600, fill: 'rgba(255, 50, 0, 0.1)', stroke: 'rgba(255, 50, 0, 0.3)', label: 'Behemoth (85-90)', labelColor: '#ff3300', fontSize: 32, tier: 'detail' },
    { x: -3000, z: -600, w: 400, d: 1600, fill: 'rgba(255, 0, 0, 0.1)', stroke: 'rgba(255, 0, 0, 0.3)', label: 'Phoenix (90-95)', labelColor: '#ff0000', fontSize: 32, tier: 'detail' },

    // ---- Air realm enemy zones ----
    { x: 1000, z: -600, w: 400, d: 1600, fill: 'rgba(200, 230, 255, 0.1)', stroke: 'rgba(200, 230, 255, 0.3)', label: 'Harpy (70-75)', labelColor: '#aaddff', fontSize: 32, tier: 'detail' },
    { x: 1400, z: -600, w: 400, d: 1600, fill: 'rgba(150, 200, 255, 0.1)', stroke: 'rgba(150, 200, 255, 0.3)', label: 'Cloud (75-80)', labelColor: '#88bbff', fontSize: 32, tier: 'detail' },
    { x: 1800, z: -600, w: 400, d: 1600, fill: 'rgba(100, 150, 255, 0.1)', stroke: 'rgba(100, 150, 255, 0.3)', label: 'Roc (80-85)', labelColor: '#6699ff', fontSize: 32, tier: 'detail', labelOffsetY: 60 },
    { x: 2200, z: -600, w: 400, d: 1600, fill: 'rgba(50, 100, 255, 0.1)', stroke: 'rgba(50, 100, 255, 0.3)', label: 'Giant (85-90)', labelColor: '#4488ff', fontSize: 32, tier: 'detail' },
    { x: 2600, z: -600, w: 400, d: 1600, fill: 'rgba(0, 50, 255, 0.1)', stroke: 'rgba(0, 50, 255, 0.3)', label: 'Cyclone (90-95)', labelColor: '#2266ff', fontSize: 32, tier: 'detail' },
];

/** Dungeon markers — gold star + circle + label. */
const DUNGEON_MARKERS = [
    { id: 'verdant_bastion_catacombs', name: 'Verdant Bastion', dotColor: '#00aa00', tier: 'zone' },
    { id: 'abyssal_well', name: 'Abyssal Well', dotColor: '#1aa3c8', tier: 'zone' },
    { id: 'molten_core', name: 'Molten Core', dotColor: '#ff4400', tier: 'zone', labelOffsetY: -40 },
    { id: 'tempest_spire', name: 'Tempest Spire', dotColor: '#4488ff', tier: 'zone', labelOffsetY: -40 },
].map(marker => {
    const [wx, , wz] = DUNGEON_ENTRANCE_DEFINITIONS[marker.id].position;
    return { ...marker, wx, wz };
});

const TOWN_POIS = TOWN_SERVICE_POINTS.map((point) => ({
    wx: point.x,
    wz: point.z,
    name: point.label,
    dotColor: point.color,
    strokeColor: point.strokeColor,
    minScale: point.minScale,
    labelOffsetY: point.labelOffsetY
}));

const DUNGEON_MARKER_LOOKUP = Object.freeze({
    verdant_bastion_catacombs: 'Verdant Bastion',
    abyssal_well: 'Abyssal Well',
    molten_core: 'Molten Core',
    tempest_spire: 'Tempest Spire'
});

/**
 * Fence segments (boundary walls).
 * Each entry is an array of line segments: [[x1,z1, x2,z2], ...].
 * Gaps are achieved by splitting a wall into separate line segments.
 */
const FENCE_SEGMENTS = WORLD_GEOGRAPHY.regions.map(region => ({
    color: region.id === "town" ? "#c4b18a" : "#8B4513", lineWidth: 3,
    lines: getRegionWallSegments(region)
}));

/** Tier → minimum scale thresholds for label / zone visibility. */
const TIER_MIN_SCALE = {
    realm: 0,      // always visible
    zone: 0.8,     // visible at moderate zoom
    detail: 1.5,   // visible only when zoomed in
};

/** Player class names used for entity type detection. */
const PLAYER_CLASSES = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];

/** Entity classification for map dots. Returns { color, size } or null to skip. */
function classifyEntity(entity) {
    const type = entity.constructor.name;
    const meshType = entity.meshType;

    // Players
    if (PLAYER_CLASSES.includes(type) || PLAYER_CLASSES.includes(meshType)) {
        return { color: '#00ffff', size: 4 };
    }

    // NPCs
    if (type === 'DwarfSalesman' || meshType === 'DwarfSalesman' ||
        type === 'RespecNPC' || meshType === 'RespecNPC') {
        return { color: '#00ff00', size: 3 };
    }

    // Elites (any realm)
    if (entity.isElite) {
        return { color: '#ffffff', size: 6 };
    }

    // Earth enemies
    const earthEnemies = ['Skeleton', 'Imp', 'DemonOrc', 'Construct', 'InfernoTitan'];
    if (earthEnemies.includes(type) || earthEnemies.includes(meshType)) {
        if (type === 'InfernoTitan' || meshType === 'InfernoTitan') {
            return { color: '#ff4500', size: 5 };
        }
        return { color: '#ff0000', size: 3 };
    }

    // Water enemies
    const waterEnemies = ['MountainTroll', 'AquaGolem', 'Siren', 'FrostGuardian'];
    if (waterEnemies.includes(type) || waterEnemies.includes(meshType)) {
        return { color: '#00aaff', size: 3 };
    }

    // Fire enemies
    const fireEnemies = ['SandstormDjinn', 'MagmaGolem', 'ScorchedWraith', 'InfernalBehemoth', 'PhoenixSentinel'];
    if (fireEnemies.includes(type) || fireEnemies.includes(meshType)) {
        return { color: '#ff6600', size: 4 };
    }

    // Air enemies
    const airEnemies = ['StormHarpy', 'CloudElemental', 'ThunderRoc', 'TempestGiant', 'CycloneAvatar'];
    if (airEnemies.includes(type) || airEnemies.includes(meshType)) {
        return { color: '#88ccff', size: 4 };
    }

    return null;
}

// ---------------------------------------------------------------------------
// WorldMap class
// ---------------------------------------------------------------------------

export class WorldMap {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.isMobile = Boolean(gameEngine.isMobile || document.body.classList.contains('mobile-mode'));
        this.container = document.getElementById('world-map');
        this.container.__eidolonWorldMap?.dispose();
        this.container.__eidolonWorldMap = this;
        this.listeners = new AbortController();
        this.canvas = document.getElementById('world-map-canvas');
        if (!this.container.querySelector('.world-map-body')) {
            const body = document.createElement('div'); body.className = 'world-map-body';
            this.canvas.before(body); body.append(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');

        this.visitedChunks = new Set();
        this.chunkSize = 50; // Match CONSTANTS.SCENE.CHUNK_SIZE

        // View state
        this.scale = 2;
        this.mapOffsetX = 0;
        this.mapOffsetY = 0;
        this.cameraX = 0;
        this.cameraZ = 0;

        // Drag state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupInteraction();
        this.navigation = new AtlasNavigation(this);
        this.container.setAttribute('role', 'dialog');
        this.container.setAttribute('aria-label', 'World atlas');
        this.canvas.tabIndex = 0;
        this.canvas.setAttribute('aria-label', 'Map view. Arrow keys pan. Use the location list to select destinations.');
        this.listen(this.container, 'keydown', e => {
            e.stopPropagation();
            const typing = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
            if (e.key === 'Escape' || (!typing && e.key.toLowerCase() === 'm')) {
                e.preventDefault(); this.toggle(); return;
            }
            if (e.target === this.canvas && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                this.mapOffsetX += e.key === 'ArrowLeft' ? 60 : e.key === 'ArrowRight' ? -60 : 0;
                this.mapOffsetY += e.key === 'ArrowUp' ? 60 : e.key === 'ArrowDown' ? -60 : 0;
                this._redrawIfVisible();
            }
            if (e.key === 'Tab') {
                const nodes = [...this.container.querySelectorAll('button, input, summary, canvas[tabindex]')]
                    .filter(node => !node.disabled && node.getClientRects().length);
                const first = nodes[0], last = nodes.at(-1);
                if (first && e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (last && !e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        for (const name of ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu']) {
            this.listen(this.container, name, e => e.stopPropagation());
        }

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resizeObserver.observe(this.canvas);
        this.resize();
    }

    // -----------------------------------------------------------------------
    // Interaction
    // -----------------------------------------------------------------------

    listen(target, type, handler, options = {}) {
        target.addEventListener(type, handler, { ...options, signal: this.listeners.signal });
    }

    dispose() {
        this.listeners.abort();
        this.resizeObserver?.disconnect();
    }

    setupInteraction() {
        const controls = document.createElement('div');
        controls.className = 'world-map-controls';
        controls.setAttribute('aria-label', 'Map controls');
        controls.innerHTML = `<button type="button" data-map-zoom="out" aria-label="Zoom map out">−</button>
            <output aria-label="Map zoom">100%</output>
            <button type="button" data-map-zoom="in" aria-label="Zoom map in">+</button>
            <button type="button" data-map-center>Find me</button>
            <span>Drag to explore · Pinch to zoom</span>`;
        this.container.querySelector('.world-map-controls')?.remove();
        this.container.append(controls);
        this.zoomLabel = controls.querySelector('output');
        controls.querySelector('[data-map-zoom="out"]').onclick = () => this.setMapScale(this.scale / 1.25);
        controls.querySelector('[data-map-zoom="in"]').onclick = () => this.setMapScale(this.scale * 1.25);
        controls.querySelector('[data-map-center]').onclick = () => this.centerOnPlayer();
        for (const event of ['pointerdown', 'touchstart', 'click']) controls.addEventListener(event, e => e.stopPropagation());
        this.listen(this.canvas, 'wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const zoomSpeed = 0.1;
            const delta = -Math.sign(e.deltaY);
            this.setMapScale(this.scale + delta * zoomSpeed * this.scale);
        }, { passive: false });

        this.listen(this.canvas, 'mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.pointerStart = { x: e.clientX, y: e.clientY };
            this.mapGestureMoved = false;
            this.canvas.style.cursor = 'grabbing';
        });

        this.listen(this.canvas, 'mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            this.mapOffsetX += e.clientX - this.lastMouseX;
            this.mapOffsetY += e.clientY - this.lastMouseY;
            if (Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 6) this.mapGestureMoved = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this._redrawIfVisible();
        });

        const stopDrag = () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        };
        this.listen(this.canvas, 'mouseup', stopDrag);
        this.listen(this.canvas, 'mouseleave', stopDrag);
        this.listen(this.canvas, 'click', e => {
            if (!this.mapGestureMoved) this.selectMapLocation(e.clientX, e.clientY);
        });

        const gesture = touches => {
            if (!touches.length || touches.length > 2) return null;
            const first = touches[0], second = touches[1] || first;
            const rect = this.canvas.getBoundingClientRect();
            return { count: touches.length,
                x: (first.clientX + second.clientX) / 2 - rect.left - rect.width / 2,
                y: (first.clientY + second.clientY) / 2 - rect.top - rect.height / 2,
                distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY) };
        };
        const begin = e => {
            e.preventDefault(); e.stopPropagation(); stopDrag();
            if (e.type === 'touchstart') {
                this.pointerStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
                this.mapGestureMoved = e.touches.length !== 1;
            } else if (e.type === 'touchend' && !e.touches.length && this.pointerStart && !this.mapGestureMoved) {
                this.selectMapLocation(this.pointerStart.x, this.pointerStart.y);
            }
            this.touchGesture = gesture(e.touches);
        };
        this.listen(this.canvas, 'touchstart', begin, { passive: false });
        this.listen(this.canvas, 'touchmove', e => {
            e.preventDefault(); e.stopPropagation();
            const next = gesture(e.touches), previous = this.touchGesture;
            if (e.touches.length !== 1 || !this.pointerStart || Math.hypot(e.touches[0].clientX - this.pointerStart.x, e.touches[0].clientY - this.pointerStart.y) > 6) this.mapGestureMoved = true;
            if (next && previous && next.count === previous.count) {
                const oldScale = this.scale;
                const zoom = next.count === 2 && previous.distance > 0 ? next.distance / previous.distance : 1;
                this.scale = Math.max(.01, Math.min(10, this.scale * zoom));
                const ratio = this.scale / oldScale;
                // Preserve the map location beneath the moving pinch midpoint.
                this.mapOffsetX = next.x + (this.mapOffsetX - previous.x) * ratio;
                this.mapOffsetY = next.y + (this.mapOffsetY - previous.y) * ratio;
                this.updateZoomLabel();
                this._redrawIfVisible();
            }
            this.touchGesture = next;
        }, { passive: false });
        this.listen(this.canvas, 'touchend', begin, { passive: false });
        this.listen(this.canvas, 'touchcancel', e => {
            e.stopPropagation(); this.touchGesture = null; this.mapGestureMoved = true; stopDrag();
        });
    }

    updateZoomLabel() {
        if (this.zoomLabel) this.zoomLabel.textContent = `${Math.round(this.scale / 2 * 100)}%`;
    }

    setMapScale(value) {
        if (!Number.isFinite(value)) return;
        const previous = this.scale;
        this.scale = Math.max(.01, Math.min(10, value));
        this.mapOffsetX *= this.scale / previous;
        this.mapOffsetY *= this.scale / previous;
        this.updateZoomLabel();
        this._redrawIfVisible();
    }

    centerOnPlayer() {
        const player = this.gameEngine.player;
        if (!player) return;
        this.cameraX = player.position.x;
        this.cameraZ = player.position.z;
        this.mapOffsetX = 0; this.mapOffsetY = 0;
        this.touchGesture = null; this.isDragging = false;
        this._redrawIfVisible();
    }

    isVisible() { return this.container.style.display === 'flex' || this.container.style.display === 'block'; }

    showWorldOverview() {
        if (!isOverworldAtlas(this.gameEngine)) return;
        this.cameraX = OVERWORLD_CENTER.x; this.cameraZ = OVERWORLD_CENTER.z;
        this.mapOffsetX = 0; this.mapOffsetY = 0;
        const width = WORLD_REGIONS.air.maxX - WORLD_REGIONS.fire.minX;
        const depth = WORLD_REGIONS.earth.maxZ - WORLD_REGIONS.water.minZ;
        // A 45-degree view projects the combined extent onto both axes.
        this.scale = Math.max(.01, Math.min(this.canvas.width - 64, this.canvas.height - 64) / ((width + depth) * Math.SQRT1_2));
        this.updateZoomLabel(); this._redrawIfVisible();
    }

    selectMapLocation(clientX, clientY) {
        if (!this.navigation || !isOverworldAtlas(this.gameEngine)) return;
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = (clientX - rect.left) * this.canvas.width / rect.width;
        const y = (clientY - rect.top) * this.canvas.height / rect.height;
        const w2s = this._makeWorldToScreen(this.canvas.width / 2, this.canvas.height / 2);
        const match = this.navigation.locations.filter(p => this.navigation.filters.has(p.category))
            .map(p => ({ p, distance: Math.hypot(w2s(p.x, p.z).x - x, w2s(p.x, p.z).y - y) }))
            .filter(p => p.distance <= 18).sort((a, b) => a.distance - b.distance)[0];
        if (match) this.navigation.select(match.p.id);
    }

    // -----------------------------------------------------------------------
    // Lifecycle helpers
    // -----------------------------------------------------------------------

    _redrawIfVisible() {
        if (this.gameEngine.player) {
            this.draw(this.gameEngine.player);
        }
    }

    resize() {
        if (!this.container || this.container.clientWidth === 0 || this.container.clientHeight === 0) return;
        this.canvas.width = this.canvas.clientWidth || this.container.clientWidth;
        this.canvas.height = this.canvas.clientHeight || Math.max(0, this.container.clientHeight -
            (document.getElementById('world-map-header')?.offsetHeight || 40) -
            (this.container.querySelector('.world-map-controls')?.offsetHeight || 0));
        this._redrawIfVisible();
    }

    toggle() {
        this.touchGesture = null; this.isDragging = false;
        const opening = !this.isVisible();
        if (opening) {
            this.opener = document.activeElement;
            this.gameEngine.inputManager?.clearInputState?.();
            this.navigation.refresh(true);
            // Focus after the existing window manager makes the map visible.
            queueMicrotask(() => { if (this.isVisible()) this.navigation.search.focus(); });
        } else this.opener?.focus?.();
        if (this.gameEngine?.uiManager?.windowLayouts) {
            const opened = this.gameEngine.uiManager.toggleManagedWindow('map');
            if (opened && this.gameEngine.player) {
                this.cameraX = this.gameEngine.player.position.x;
                this.cameraZ = this.gameEngine.player.position.z;
                this.mapOffsetX = 0;
                this.mapOffsetY = 0;
                this.draw(this.gameEngine.player);
            }
            return;
        }

        const isHidden = this.container.style.display === 'none' || this.container.style.display === '';
        this.container.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && this.gameEngine.player) {
            this.cameraX = this.gameEngine.player.position.x;
            this.cameraZ = this.gameEngine.player.position.z;
            this.mapOffsetX = 0;
            this.mapOffsetY = 0;
            this.draw(this.gameEngine.player);
        }
    }

    update(player) {
        if (!player) return;
        this.navigation?.refresh();
        const cx = Math.floor(player.position.x / this.chunkSize);
        const cz = Math.floor(player.position.z / this.chunkSize);
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let z = cz - 1; z <= cz + 1; z++) {
                if (isOverworldAtlas(this.gameEngine)) this.visitedChunks.add(`${x},${z}`);
            }
        }
        if (this.container.style.display !== 'none') {
            this.draw(player);
        }
    }

    // -----------------------------------------------------------------------
    // Coordinate transform (world → rotated screen)
    // -----------------------------------------------------------------------

    _makeWorldToScreen(cx, cy) {
        const cos = 0.70710678;
        const sin = 0.70710678;
        const scale = this.scale;
        const offX = this.mapOffsetX;
        const offY = this.mapOffsetY;
        const camX = this.cameraX;
        const camZ = this.cameraZ;
        return (wx, wz) => {
            const relX = wx - camX;
            const relZ = wz - camZ;
            return {
                x: cx + (relX * cos - relZ * sin) * scale + offX,
                y: cy + (relX * sin + relZ * cos) * scale + offY,
            };
        };
    }

    // -----------------------------------------------------------------------
    // Draw helpers
    // -----------------------------------------------------------------------

    /** Draw a world-space rectangle (rotated to match isometric view). */
    _drawRect(ctx, w2s, minX, minZ, width, depth, fillStyle, strokeStyle, lineWidth) {
        const p1 = w2s(minX, minZ);
        const p2 = w2s(minX + width, minZ);
        const p3 = w2s(minX + width, minZ + depth);
        const p4 = w2s(minX, minZ + depth);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
        if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
    }

    /** Return true if a tier label should be visible at the current scale. */
    _tierVisible(tier) {
        return this.scale >= (TIER_MIN_SCALE[tier] || 0);
    }

    /** Draw scaled text at a world position. */
    _drawLabel(ctx, w2s, wx, wz, text, color, fontSize, offsetY) {
        const pos = w2s(wx, wz);
        ctx.fillStyle = color;
        ctx.font = `${this.mapFontSize(fontSize)}px Arial`;
        ctx.textAlign = 'center';
        if (this.isMobile) ctx.fillText(text, pos.x, pos.y + (offsetY || 0) * this.scale, Math.max(1, this.canvas.width - 24));
        else ctx.fillText(text, pos.x, pos.y + (offsetY || 0) * this.scale);
    }

    mapFontSize(base) {
        const scaled = base * this.scale / 2;
        return this.isMobile ? Math.max(14, Math.min(base >= 36 ? 20 : 16, scaled)) : Math.max(12, Math.min(28, scaled));
    }

    _buildDungeonBeatPreview() {
        const instanceType = this.gameEngine?.currentInstanceType;
        const dungeonName = DUNGEON_MARKER_LOOKUP[instanceType];
        const summary = this.gameEngine?.getDungeonRoomSummary?.();
        if (!dungeonName || !summary || !Array.isArray(summary.rooms) || typeof summary.objectiveRoomIndex !== 'number' || summary.objectiveRoomIndex < 0) {
            return null;
        }

        const objectiveRoom = summary.rooms.find((room) => room && room.index === summary.objectiveRoomIndex);
        if (!objectiveRoom) {
            return null;
        }

        const nextRoom = findNextDungeonMeaningfulRoom(summary, summary.objectiveRoomIndex);

        const previewColor = getDungeonRoomRole(nextRoom) === 'event'
            ? 'rgba(255, 145, 90, 0.6)'
            : getDungeonRoomRole(nextRoom) === 'boss'
                ? 'rgba(255, 110, 110, 0.6)'
                : ['elite', 'approach'].includes(getDungeonRoomRole(nextRoom))
                    ? 'rgba(255, 190, 90, 0.6)'
                    : 'rgba(255, 215, 90, 0.6)';

        return {
            dungeonName,
            objectiveLabel: getDungeonBeatLabel(objectiveRoom, summary),
            objectiveCadenceLabel: getDungeonCadenceLabel(objectiveRoom),
            nextLabel: nextRoom ? getDungeonBeatLabel(nextRoom, summary) : '',
            previewColor,
            objectiveIsLiveBoss: isLiveDungeonBossRoom(objectiveRoom, summary)
        };
    }

    // -----------------------------------------------------------------------
    // Main draw
    // -----------------------------------------------------------------------

    draw(player) {
        if (!player || !this.ctx) return;
        const ctx = this.ctx;
        this.navigation?.refresh();
        const w = this.canvas.width;
        const h = this.canvas.height;
        if (this.gameEngine?.currentInstanceType === 'dark_realm') {
            drawDarkRealmWorldMap(ctx, w, h, this.gameEngine, player);
            return;
        }
        if (this.gameEngine?.currentInstanceType === 'casino') {
            drawCasinoWorldMap(ctx, w, h, this.gameEngine, player);
            return;
        }
        const cx = w / 2;
        const cy = h / 2;
        const w2s = this._makeWorldToScreen(cx, cy);

        // 1. Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // 2. Visited chunks (fog of war background)
        this.visitedChunks.forEach(key => {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            this._drawRect(ctx, w2s, chunkX * this.chunkSize, chunkZ * this.chunkSize,
                this.chunkSize, this.chunkSize, '#222', '#333', 1);
        });

        // 3. Realm backgrounds
        for (const bg of REALM_BACKGROUNDS) {
            this._drawRect(ctx, w2s, bg.x, bg.z, bg.w, bg.d, bg.fill, bg.stroke || null, bg.lineWidth || 1);
        }

        const event = this.gameEngine.publicEvents?.data;
        if (event && event.phase !== 'expired' && isOverworldAtlas(this.gameEngine) && this.navigation?.filters.has('events')) {
            const point = w2s(event.site.x, event.site.z);
            ctx.save();
            ctx.strokeStyle = '#d5f5ad'; ctx.fillStyle = '#d5f5ad'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(point.x, point.y, 8, 0, Math.PI * 2); ctx.stroke();
            ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(event.phase === 'complete' ? 'Road restored' : event.site.title, point.x, point.y - 13);
            ctx.restore();
        }

        // 4. Zone rectangles + labels (zoom-culled)
        for (const zone of ZONE_CONFIGS) {
            const visible = this._tierVisible(zone.tier);
            // Always draw zone fill (subtle); only draw stroke/label when in tier range
            this._drawRect(ctx, w2s, zone.x, zone.z, zone.w, zone.d,
                zone.fill, visible ? (zone.stroke || zone.fill.replace('0.05', '0.2')) : null, 1);
            if (visible && zone.label) {
                const labelCX = zone.x + zone.w / 2;
                const labelCZ = zone.z + zone.d / 2;
                // Avoid overlapping town label for center strip
                let yOff = zone.labelOffsetY || 0;
                if (Math.abs(labelCX) < 10 && Math.abs(labelCZ - 200) < 10) {
                    yOff += 100;
                }
                this._drawLabel(ctx, w2s, labelCX, labelCZ, zone.label, zone.labelColor, zone.fontSize, yOff);
            }
        }

        // 5. Realm labels (always visible unless filtered by minScale)
        for (const lbl of REALM_LABELS) {
            if (this.scale >= lbl.minScale) {
                this._drawLabel(ctx, w2s, lbl.wx, lbl.wz, lbl.text, lbl.color, lbl.fontSize, lbl.offsetY || 0);
            }
        }

        // 6. Dungeon markers (zoom-culled)
        const dungeonBeatPreview = this._buildDungeonBeatPreview();
        for (const dg of DUNGEON_MARKERS) {
            if (this.navigation && !this.navigation.filters.has('entrances')) continue;
            if (!this._tierVisible(dg.tier)) continue;
            const pos = w2s(dg.wx, dg.wz);
            const yOff = (dg.labelOffsetY || -15) * this.scale;
            const isActiveDungeon = dungeonBeatPreview && dungeonBeatPreview.dungeonName === dg.name;
            // Dot
            ctx.fillStyle = dg.dotColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y + (dg.labelOffsetY ? 0 : 0), 8, 0, Math.PI * 2);
            ctx.fill();
            // Gold ring
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = isActiveDungeon ? 3 : 2;
            ctx.stroke();
            // Label
            ctx.fillStyle = '#ffd700';
            ctx.font = `${this.mapFontSize(28)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(
                isActiveDungeon
                    ? `\u2605 ${dg.name} [${dungeonBeatPreview.objectiveLabel}${dungeonBeatPreview.objectiveCadenceLabel ? ` • ${dungeonBeatPreview.objectiveCadenceLabel}` : ''}]`
                    : `\u2605 ${dg.name}`,
                pos.x,
                pos.y + yOff
            );
            if (isActiveDungeon && (dungeonBeatPreview.nextLabel || dungeonBeatPreview.objectiveIsLiveBoss)) {
                ctx.strokeStyle = dungeonBeatPreview.objectiveIsLiveBoss
                    ? 'rgba(255, 110, 110, 0.6)'
                    : dungeonBeatPreview.previewColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 13, 0, Math.PI * 2);
                ctx.stroke();
                if (dungeonBeatPreview.nextLabel) {
                    ctx.fillStyle = dungeonBeatPreview.previewColor;
                    ctx.font = `${this.mapFontSize(18)}px Arial`;
                    ctx.fillText(`Next: ${dungeonBeatPreview.nextLabel}`, pos.x, pos.y + ((dg.labelOffsetY || 18) * this.scale));
                }
            }
        }

        // 6b. Town points of interest
        for (const poi of TOWN_POIS) {
            const category = this.navigation?.locations.find(p => p.name === poi.name)?.category;
            if (category && !this.navigation.filters.has(category)) continue;
            if (this.scale < (poi.minScale || 0)) continue;
            const pos = w2s(poi.wx, poi.wz);
            ctx.fillStyle = poi.dotColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            if (poi.strokeColor) {
                ctx.strokeStyle = poi.strokeColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = '#f2f2f2';
            ctx.font = `${this.mapFontSize(18)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(poi.name, pos.x, pos.y + ((poi.labelOffsetY || -16) * this.scale));
        }

        // 7. Fences
        for (const fence of FENCE_SEGMENTS) {
            ctx.strokeStyle = fence.color;
            ctx.lineWidth = fence.lineWidth;
            ctx.beginPath();
            for (const seg of fence.lines) {
                const start = w2s(seg[0], seg[1]);
                const end = w2s(seg[2], seg[3]);
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
            }
            ctx.stroke();
        }

        // 8. Entities (players, enemies, NPCs)
        if (this.gameEngine.chunkManager) {
            const activeEntities = this.gameEngine.chunkManager.getActiveEntities();
            activeEntities.forEach(entity => {
                if (entity === player) return;
                if (!this.navigation?.filters.has('party') && this.gameEngine.uiManager?.partyData?.members?.some(member => member.id === entity.id)) return;
                const cls = classifyEntity(entity);
                if (!cls) return;
                const pos = w2s(entity.position.x, entity.position.z);
                ctx.fillStyle = cls.color;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, cls.size, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // 9. Party members (global positions)
        if (this.gameEngine.uiManager?.partyData?.members && this.navigation?.filters.has('party')) {
            this.gameEngine.uiManager.partyData.members.forEach(member => {
                if (member.id === player.id || !isAtlasPartyMemberVisible(this.gameEngine, member)) return;
                if (member.x === undefined || member.z === undefined) return;
                const pos = w2s(member.x, member.z);
                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        }

        // 10. Local player (drawn last so it's on top)
        const pp = w2s(player.position.x, player.position.z);
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (isOverworldAtlas(this.gameEngine) && this.navigation) {
            for (const p of this.navigation.locations) {
                if (p.category !== 'passages' || !this.navigation.filters.has(p.category)) continue;
                const point = w2s(p.x, p.z);
                ctx.fillStyle = ATLAS_CATEGORIES.passages.color; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
                ctx.fillText('↔', point.x, point.y + 5);
            }
            const waypoint = this.navigation.waypoint;
            const guidance = getWaypointGuidance(this.gameEngine, waypoint);
            if (guidance) drawAtlasWaypoint(ctx, w2s(waypoint.x, waypoint.z), { x: cx, y: cy }, Math.max(1, Math.min(w, h) / 2 - 28), `${Math.round(guidance.distance)}m ${guidance.direction}`);
        }
    }
}
