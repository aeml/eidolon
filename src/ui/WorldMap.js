// ============================================================================
// WorldMap — config-driven full-screen zone map
// ============================================================================
// All spatial data (realms, zones, dungeons, fences) lives in static config
// tables. The draw() method iterates configs instead of containing inline
// coordinates, making it easy to add new zones or adjust layout.
// ============================================================================

// ---------------------------------------------------------------------------
// Config tables
// ---------------------------------------------------------------------------

/** Realm background fills drawn first (large tinted rectangles). */
const REALM_BACKGROUNDS = [
    // Water/Snow realm
    { x: -1000, z: -2200, w: 2000, d: 1600, fill: 'rgba(200, 240, 255, 0.2)' },
    // Fire realm
    { x: -3000, z: -600, w: 2000, d: 1600, fill: 'rgba(255, 100, 0, 0.15)' },
    // Air realm
    { x: 1000, z: -600, w: 2000, d: 1600, fill: 'rgba(150, 200, 255, 0.15)' },
    // Town
    { x: -100, z: 100, w: 200, d: 200, fill: 'rgba(100, 100, 255, 0.3)', stroke: '#44f', lineWidth: 2 },
];

/**
 * Realm labels (large text drawn at every zoom level).
 * `minScale` controls the minimum zoom at which the label appears (0 = always).
 */
const REALM_LABELS = [
    { wx: 0, wz: -1400, text: 'The Abyssal Well (Water Realm)', color: '#fff', fontSize: 48, minScale: 0 },
    { wx: 0, wz: 200, text: 'The Iron Weald (Earth Realm)', color: '#fff', fontSize: 48, minScale: 0, offsetY: -100 },
    { wx: -2000, wz: 200, text: 'The Scorched Wastes (Fire Realm)', color: '#ff6600', fontSize: 48, minScale: 0 },
    { wx: 2000, wz: 200, text: 'The Skyward Peaks (Air Realm)', color: '#88ccff', fontSize: 48, minScale: 0 },
    { wx: 0, wz: 200, text: 'TOWN', color: '#fff', fontSize: 36, minScale: 0.8 },
];

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
    { wx: 800, wz: 200, name: 'Verdant Bastion', dotColor: '#00aa00', tier: 'zone' },
    { wx: 0, wz: -1400, name: 'Abyssal Well', dotColor: '#1aa3c8', tier: 'zone' },
    { wx: -2400, wz: 200, name: 'Molten Core', dotColor: '#ff4400', tier: 'zone', labelOffsetY: -40 },
    { wx: 2400, wz: 200, name: 'Tempest Spire', dotColor: '#4488ff', tier: 'zone', labelOffsetY: -40 },
];

/**
 * Fence segments (boundary walls).
 * Each entry is an array of line segments: [[x1,z1, x2,z2], ...].
 * Gaps are achieved by splitting a wall into separate line segments.
 */
const FENCE_SEGMENTS = [
    // Earth realm fence — rectangular with a gap on the north wall
    {
        color: '#8B4513', lineWidth: 3,
        lines: [
            // North wall left of gap
            [-1000, -600, -20, -600],
            // North wall right of gap
            [20, -600, 1000, -600],
            // East wall
            [1000, -600, 1000, 1000],
            // South wall
            [1000, 1000, -1000, 1000],
            // West wall
            [-1000, 1000, -1000, -600],
        ],
    },
    // Water realm fence (3 walls — open south connects to Earth)
    {
        color: '#8B4513', lineWidth: 3,
        lines: [
            [-1000, -600, -1000, -2200],
            [-1000, -2200, 1000, -2200],
            [1000, -2200, 1000, -600],
        ],
    },
    // Fire realm fence (3 walls — open east connects to Earth)
    {
        color: '#8B4513', lineWidth: 3,
        lines: [
            [-3000, -600, -1000, -600],
            [-3000, -600, -3000, 1000],
            [-3000, 1000, -1000, 1000],
        ],
    },
    // Air realm fence (3 walls — open west connects to Earth)
    {
        color: '#8B4513', lineWidth: 3,
        lines: [
            [1000, -600, 3000, -600],
            [3000, -600, 3000, 1000],
            [3000, 1000, 1000, 1000],
        ],
    },
];

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
        this.container = document.getElementById('world-map');
        this.canvas = document.getElementById('world-map-canvas');
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

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    // -----------------------------------------------------------------------
    // Interaction
    // -----------------------------------------------------------------------

    setupInteraction() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const zoomSpeed = 0.1;
            const delta = -Math.sign(e.deltaY);
            this.scale = Math.max(0.5, Math.min(10.0, this.scale + delta * zoomSpeed * this.scale));
            this._redrawIfVisible();
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            this.mapOffsetX += e.clientX - this.lastMouseX;
            this.mapOffsetY += e.clientY - this.lastMouseY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this._redrawIfVisible();
        });

        const stopDrag = () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        };
        this.canvas.addEventListener('mouseup', stopDrag);
        this.canvas.addEventListener('mouseleave', stopDrag);
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
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = Math.max(0, this.container.clientHeight - 40);
        this._redrawIfVisible();
    }

    toggle() {
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
        const cx = Math.floor(player.position.x / this.chunkSize);
        const cz = Math.floor(player.position.z / this.chunkSize);
        for (let x = cx - 1; x <= cx + 1; x++) {
            for (let z = cz - 1; z <= cz + 1; z++) {
                this.visitedChunks.add(`${x},${z}`);
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
        ctx.font = `${fontSize * (this.scale / 2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(text, pos.x, pos.y + (offsetY || 0) * this.scale);
    }

    // -----------------------------------------------------------------------
    // Main draw
    // -----------------------------------------------------------------------

    draw(player) {
        if (!player || !this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
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
        for (const dg of DUNGEON_MARKERS) {
            if (!this._tierVisible(dg.tier)) continue;
            const pos = w2s(dg.wx, dg.wz);
            const yOff = (dg.labelOffsetY || -15) * this.scale;
            // Dot
            ctx.fillStyle = dg.dotColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y + (dg.labelOffsetY ? 0 : 0), 8, 0, Math.PI * 2);
            ctx.fill();
            // Gold ring
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Label
            ctx.fillStyle = '#ffd700';
            ctx.font = `${28 * (this.scale / 2)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(`\u2605 ${dg.name}`, pos.x, pos.y + yOff);
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
        if (this.gameEngine.uiManager.partyData && this.gameEngine.uiManager.partyData.members) {
            this.gameEngine.uiManager.partyData.members.forEach(member => {
                if (member.id === player.id) return;
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
    }
}
