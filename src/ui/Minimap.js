// ============================================================================
// Minimap — player-centered radar with realm coloring & tactical emphasis
// ============================================================================

/** Player class names. */
const PLAYER_CLASSES = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];

/**
 * Realm background colors for minimap quadrant tinting.
 * Keyed by realm name matching RenderSystem.getRealmForPosition() output.
 */
const REALM_COLORS = {
    earth: 'rgba(60, 80, 40, 0.35)',
    town:  'rgba(80, 80, 120, 0.35)',
    water: 'rgba(40, 60, 100, 0.35)',
    fire:  'rgba(100, 40, 20, 0.35)',
    air:   'rgba(50, 70, 110, 0.35)',
};

/**
 * Determine which realm a world position falls in.
 * Mirrors RenderSystem.getRealmForPosition() logic.
 */
function getRealmForPosition(x, z) {
    // Town: 120-radius circle around (0, 200)
    const dx = x - 0;
    const dz = z - 200;
    if (dx * dx + dz * dz < 120 * 120) return 'town';
    if (z < -600) return 'water';
    if (x < -1000) return 'fire';
    if (x > 1000) return 'air';
    return 'earth';
}

/** Classify an entity for minimap display. Returns { color, size, ring } or null. */
function classifyEntity(entity) {
    const type = entity.constructor.name;
    const meshType = entity.meshType;

    // Players
    if (PLAYER_CLASSES.includes(type) || PLAYER_CLASSES.includes(meshType)) {
        return { color: '#00ffff', size: 4, ring: false };
    }

    // NPCs
    if (type === 'DwarfSalesman' || meshType === 'DwarfSalesman' ||
        type === 'RespecNPC' || meshType === 'RespecNPC') {
        return { color: '#00ff00', size: 3, ring: false };
    }

    // Elites / bosses get a bright ring
    if (entity.isElite) {
        return { color: '#ffffff', size: 5, ring: true };
    }

    // Default enemy — red
    return { color: '#ff0000', size: 3, ring: false };
}

export class Minimap {
    constructor(size = 200) {
        this.baseSize = size;
        this.scale = 4; // Pixels per world unit
        this.dungeonDebugOverlayEnabled = false;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'minimap-canvas';
        this.canvas.width = size;
        this.canvas.height = size;

        // Default inline styles (CSS can override)
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '20px';
        this.canvas.style.right = '20px';
        this.canvas.style.border = '2px solid #444';
        this.canvas.style.borderRadius = '50%';
        this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.canvas.style.zIndex = '100';

        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Animation tick counter for pulsing effects
        this._tick = 0;
    }

    update(player, entities) {
        if (!player) return;
        if (!entities) entities = [];
        this._tick++;

        const ctx = this.ctx;
        const size = this.canvas.width;
        const half = size / 2;
        const scale = this.scale;

        // Rotation (45 degrees to match isometric camera)
        const cos = 0.70710678;
        const sin = 0.70710678;

        // World → minimap coords (relative to player, rotated)
        const toMap = (wx, wz) => {
            const dx = wx - player.position.x;
            const dz = wz - player.position.z;
            return {
                x: half + (dx * cos - dz * sin) * scale,
                y: half + (dx * sin + dz * cos) * scale,
            };
        };

        // ---- Clear + clip to circle ----
        ctx.save();
        ctx.clearRect(0, 0, size, size);
        ctx.beginPath();
        ctx.arc(half, half, half, 0, Math.PI * 2);
        ctx.clip();

        // ---- Realm-tinted background ----
        const playerRealm = getRealmForPosition(player.position.x, player.position.z);
        ctx.fillStyle = REALM_COLORS[playerRealm] || REALM_COLORS.earth;
        ctx.fillRect(0, 0, size, size);

        // ---- Realm boundary hints ----
        // Draw faint boundary lines for nearby realm edges so the player
        // can see when they're approaching a transition.
        this._drawRealmBoundaries(ctx, toMap, half);

        // ---- Dungeon room overlays ----
        if (this.gameEngine?.getDungeonRoomSummary) {
            this._drawDungeonRoomStates(ctx, toMap, player, half, scale);
            this._drawDungeonDebugOverlay(ctx, toMap, scale);
        }

        // ---- Entities ----
        const partyIds = this._getPartyMemberIds();

        entities.forEach(entity => {
            if (entity === player) return;

            const cls = classifyEntity(entity);
            if (!cls) return;

            const pos = toMap(entity.position.x, entity.position.z);

            // Skip if outside circle radius (with small margin)
            const dx = pos.x - half;
            const dy = pos.y - half;
            if (dx * dx + dy * dy > (half + 4) * (half + 4)) return;

            // Check if this is a party member (override color)
            const isParty = partyIds.has(entity.id);

            ctx.fillStyle = isParty ? '#00ff00' : cls.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, isParty ? 5 : cls.size, 0, Math.PI * 2);
            ctx.fill();

            // Party member ring
            if (isParty) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // Elite/boss pulsing ring
            if (cls.ring) {
                const pulse = 0.5 + 0.5 * Math.sin(this._tick * 0.1);
                ctx.strokeStyle = `rgba(255, 255, 100, ${0.4 + pulse * 0.6})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, cls.size + 2 + pulse * 2, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // ---- Party members from partyData (global positions, may not be in entities list) ----
        if (this.gameEngine) {
            this._drawGlobalPartyMembers(ctx, toMap, half, player);
        }

        // ---- Player dot (center) ----
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(half, half, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // ---- Cardinal directions ----
        this._drawCardinals(ctx, half);

        ctx.restore();
    }

    /** Inject gameEngine ref so we can read partyData. Called from GameEngine constructor. */
    setGameEngine(ge) {
        this.gameEngine = ge;
    }

    setDungeonDebugOverlayEnabled(enabled) {
        this.dungeonDebugOverlayEnabled = !!enabled;
    }

    toggleDungeonDebugOverlay() {
        this.dungeonDebugOverlayEnabled = !this.dungeonDebugOverlayEnabled;
        return this.dungeonDebugOverlayEnabled;
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /** Get a Set of party member IDs (excluding self). Cached per-frame. */
    _getPartyMemberIds() {
        const members = this.gameEngine && this.gameEngine.uiManager &&
            this.gameEngine.uiManager.partyData &&
            this.gameEngine.uiManager.partyData.members;
        if (!members) {
            if (this._partyIdCache) this._partyIdCache.clear();
            else this._partyIdCache = new Set();
            return this._partyIdCache;
        }
        if (!this._partyIdCache) this._partyIdCache = new Set();
        else this._partyIdCache.clear();
        for (const m of members) {
            this._partyIdCache.add(m.id);
        }
        return this._partyIdCache;
    }

    /** Draw global party members that may be out of chunk range. */
    _drawGlobalPartyMembers(ctx, toMap, half, player) {
        const pd = this.gameEngine.uiManager && this.gameEngine.uiManager.partyData;
        if (!pd || !pd.members) return;
        for (const member of pd.members) {
            if (member.id === player.id) continue;
            if (member.x === undefined || member.z === undefined) continue;
            const pos = toMap(member.x, member.z);
            const dx = pos.x - half;
            const dy = pos.y - half;

            // If outside the circle, clamp to edge with an arrow indicator
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > half - 6) {
                const angle = Math.atan2(dy, dx);
                const edgeX = half + Math.cos(angle) * (half - 6);
                const edgeY = half + Math.sin(angle) * (half - 6);
                // Small triangle pointing outward
                ctx.fillStyle = '#00ff00';
                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(5, 0);
                ctx.lineTo(-3, -3);
                ctx.lineTo(-3, 3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }

    _drawDungeonRoomStates(ctx, toMap, player, half, scale) {
        const summary = this.gameEngine?.getDungeonRoomSummary?.();
        if (!summary || !Array.isArray(summary.rooms) || summary.rooms.length === 0) {
            return;
        }

        summary.rooms.forEach((room) => {
            const center = toMap(room.x, room.z);
            const roomWidth = Math.max(6, room.width * scale * 0.5);
            const roomHeight = Math.max(6, room.height * scale * 0.5);
            const left = center.x - roomWidth / 2;
            const top = center.y - roomHeight / 2;

            let fill = 'rgba(255, 255, 255, 0.08)';
            if (room.cleared && room.type === 'elite') {
                fill = 'rgba(255, 190, 90, 0.18)';
            } else if (room.cleared) {
                fill = 'rgba(120, 255, 160, 0.22)';
            } else if (room.explored && room.type === 'elite') {
                fill = 'rgba(255, 190, 90, 0.12)';
            } else if (room.explored) {
                fill = 'rgba(90, 160, 255, 0.18)';
            }
            ctx.fillStyle = fill;
            ctx.fillRect(left, top, roomWidth, roomHeight);

            if (room.index === summary.currentRoomIndex) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(left, top);
                ctx.lineTo(left + roomWidth, top);
                ctx.lineTo(left + roomWidth, top + roomHeight);
                ctx.lineTo(left, top + roomHeight);
                ctx.lineTo(left, top);
                ctx.stroke();
            }

            if (room.index === summary.objectiveRoomIndex) {
                const isBossObjective = room.type === 'boss';
                const isEliteObjective = room.type === 'elite';
                const objectiveStroke = isBossObjective
                    ? 'rgba(255, 110, 110, 0.95)'
                    : isEliteObjective
                        ? 'rgba(255, 190, 90, 0.95)'
                        : 'rgba(255, 215, 90, 0.95)';
                ctx.strokeStyle = objectiveStroke;
                ctx.lineWidth = isBossObjective ? 2.5 : 2;
                ctx.beginPath();
                ctx.arc(center.x, center.y, Math.max(roomWidth, roomHeight) * 0.35, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = objectiveStroke;
                ctx.fillText(isBossObjective ? 'Boss' : isEliteObjective ? 'Elite' : 'Objective', center.x, center.y - Math.max(8, roomHeight * 0.5));
            }
        });

        if (summary.objectiveRoomIndex < 0) {
            const exitRoom = summary.rooms.find((room) => room && room.type === 'start');
            if (!exitRoom) {
                return;
            }
            const center = toMap(exitRoom.x, exitRoom.z);
            const radius = Math.max(8, Math.min(18, Math.max(exitRoom.width, exitRoom.height) * scale * 0.25));
            ctx.strokeStyle = 'rgba(120, 220, 255, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(120, 220, 255, 0.95)';
            ctx.fillText('Exit', center.x, center.y - radius - 4);
        }
    }

    _getDungeonDebugRiskSegments(overlay) {
        const rooms = Array.isArray(overlay?.rooms) ? overlay.rooms : [];
        const corridors = Array.isArray(overlay?.corridors) ? overlay.corridors : [];
        const walkRects = Array.isArray(overlay?.walkRects) ? overlay.walkRects : [];
        const riskSegments = [];

        corridors.forEach((corridor) => {
            const targetRoom = rooms[corridor?.toRoomIndex];
            if (!targetRoom || targetRoom.type !== 'boss') {
                return;
            }

            const walkRectIndices = Array.isArray(corridor.walkRectIndices) ? corridor.walkRectIndices : [];
            const corridorRects = walkRectIndices
                .map((rectIndex) => ({ rectIndex, rect: walkRects[rectIndex] }))
                .filter(({ rect }) => rect && rect.kind === 'corridor');
            if (corridorRects.length === 0) {
                return;
            }

            const finalSegment = corridorRects[corridorRects.length - 1];
            const corridorWidth = Number.isFinite(corridor.width) && corridor.width > 0
                ? corridor.width
                : Math.min(finalSegment.rect.width, finalSegment.rect.height);
            const widthDelta = Math.abs(finalSegment.rect.width - corridorWidth);
            const heightDelta = Math.abs(finalSegment.rect.height - corridorWidth);
            const finalLength = widthDelta <= heightDelta
                ? finalSegment.rect.height
                : finalSegment.rect.width;
            if (!(finalLength < corridorWidth / 2)) {
                return;
            }

            riskSegments.push({
                corridor,
                rectIndex: finalSegment.rectIndex,
                rect: finalSegment.rect,
                joinOrdinal: Math.max(1, corridorRects.length - 1),
                finalLength,
                corridorWidth
            });
        });

        return riskSegments;
    }

    _drawDungeonDebugOverlay(ctx, toMap, scale) {
        if (!this.dungeonDebugOverlayEnabled) {
            return;
        }

        const overlay = this.gameEngine?.getDungeonDebugOverlayData?.();
        if (!overlay || !Array.isArray(overlay.walkRects) || overlay.walkRects.length === 0) {
            return;
        }

        const riskSegments = this._getDungeonDebugRiskSegments(overlay);
        ctx.save();
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        overlay.walkRects.forEach((rect, rectIndex) => {
            const center = toMap(rect.x, rect.z);
            const width = Math.max(4, rect.width * scale * 0.5);
            const height = Math.max(4, rect.height * scale * 0.5);
            const left = center.x - width / 2;
            const top = center.y - height / 2;
            const isCorridor = rect.kind === 'corridor';
            const isRiskRect = riskSegments.some((segment) => segment.rectIndex === rectIndex);

            ctx.strokeStyle = isRiskRect
                ? 'rgba(255, 90, 90, 0.95)'
                : (isCorridor ? 'rgba(255, 180, 90, 0.82)' : 'rgba(120, 220, 255, 0.72)');
            ctx.lineWidth = isRiskRect ? 2.25 : (isCorridor ? 1.5 : 1.25);
            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(left + width, top);
            ctx.lineTo(left + width, top + height);
            ctx.lineTo(left, top + height);
            ctx.lineTo(left, top);
            ctx.stroke();
        });

        const corridors = Array.isArray(overlay.corridors) ? overlay.corridors : [];
        corridors.forEach((corridor, index) => {
            const walkRectIndices = Array.isArray(corridor.walkRectIndices) ? corridor.walkRectIndices : [];
            for (let i = 0; i < walkRectIndices.length - 1; i++) {
                const current = overlay.walkRects[walkRectIndices[i]];
                const next = overlay.walkRects[walkRectIndices[i + 1]];
                if (!current || !next) continue;

                const dx = next.x - current.x;
                const dz = next.z - current.z;
                const joinX = Math.abs(dx) >= Math.abs(dz) ? (current.x + next.x) / 2 : current.x;
                const joinZ = Math.abs(dz) >= Math.abs(dx) ? (current.z + next.z) / 2 : current.z;
                const join = toMap(joinX, joinZ);
                const isRiskJoin = riskSegments.some((segment) => segment.joinOrdinal === i + 1 && segment.corridor === corridor);

                ctx.strokeStyle = isRiskJoin ? 'rgba(255, 90, 90, 0.95)' : 'rgba(255, 180, 90, 0.82)';
                ctx.lineWidth = isRiskJoin ? 2.5 : 2;
                ctx.beginPath();
                ctx.arc(join.x, join.y, isRiskJoin ? 4.5 : 3.5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = isRiskJoin ? 'rgba(255, 200, 200, 0.98)' : 'rgba(255, 235, 180, 0.96)';
                ctx.fillText(`J${i + 1}`, join.x, join.y - 9);
            }

            const corridorRects = walkRectIndices
                .map((rectIndex) => overlay.walkRects[rectIndex])
                .filter((rect) => rect && rect.kind === 'corridor');
            if (corridorRects.length > 0) {
                const firstRect = corridorRects[0];
                const labelPoint = toMap(firstRect.x, firstRect.z);
                ctx.fillStyle = 'rgba(120, 220, 255, 0.96)';
                ctx.fillText(index === 0 ? 'DBG WALK' : `DBG WALK ${index + 1}`, labelPoint.x, labelPoint.y - 16);
            }
        });

        riskSegments.forEach((segment) => {
            const point = toMap(segment.rect.x, segment.rect.z);
            ctx.fillStyle = 'rgba(255, 120, 120, 0.98)';
            ctx.fillText('RISK', point.x, point.y + 14);
        });

        ctx.restore();
    }

    /** Draw faint realm boundary lines. */
    _drawRealmBoundaries(ctx, toMap, half) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;

        // Key boundaries: z=-600 (water/earth), x=-1000 (fire/earth), x=1000 (earth/air)
        const boundaries = Minimap._REALM_BOUNDARIES;

        for (const [x1, z1, x2, z2] of boundaries) {
            const start = toMap(x1, z1);
            const end = toMap(x2, z2);
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    }

    /** Draw N/E/S/W labels at edge of circle. */
    _drawCardinals(ctx, half) {
        // Rotate cardinal directions by 45 degrees to match the isometric rotation
        const cos = 0.70710678;
        const sin = 0.70710678;

        const cardinals = [
            { label: 'N', dx: 0, dz: -1 },  // World north = -Z
            { label: 'S', dx: 0, dz: 1 },
            { label: 'E', dx: 1, dz: 0 },
            { label: 'W', dx: -1, dz: 0 },
        ];

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const r = half - 10;
        for (const c of cardinals) {
            // Rotate direction vector
            const rx = c.dx * cos - c.dz * sin;
            const ry = c.dx * sin + c.dz * cos;
            ctx.fillText(c.label, half + rx * r, half + ry * r);
        }
    }
}

/** Pre-allocated realm boundary line segments [x1, z1, x2, z2]. */
Minimap._REALM_BOUNDARIES = Object.freeze([
    [-3000, -600, 3000, -600],   // Water ↔ Earth/Fire/Air
    [-1000, -2200, -1000, 1000], // Fire ↔ Earth/Water
    [1000, -2200, 1000, 1000],   // Earth/Water ↔ Air
]);
