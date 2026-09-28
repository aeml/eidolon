import { WORLD_REGIONS } from '../data/worldGeography.js';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../data/worldFoliage.js';

const INKS = Object.freeze({
    earth: ['#26352d', '#687260', '#b0ac7c'],
    water: ['#273c49', '#66818c', '#bad5d2'],
    fire: ['#48312b', '#966647', '#d8af79'],
    air: ['#33394c', '#777f9a', '#c6c3d9'],
    town: ['#3e4139', '#8f8e70', '#ddd3a6']
});

// Original code-rendered ink texture, not fabricated terrain heights or paths.
// Foliage glyphs use the exact same deterministic placement source as the world.
export class AtlasCartography {
    constructor({ mobile = false, createCanvas = () => document.createElement('canvas') } = {}) {
        this.resolution = mobile ? 512 : 1024;
        this.createCanvas = createCanvas;
        this.tiles = new Map();
        this.buildCount = 0;
    }

    tile(id) {
        if (this.tiles.has(id)) return this.tiles.get(id);
        const region = WORLD_REGIONS[id], ink = INKS[id];
        const canvas = this.createCanvas();
        canvas.width = id === 'town' ? 512 : this.resolution;
        canvas.height = Math.round(canvas.width * (region.maxZ - region.minZ) / (region.maxX - region.minX));
        // Bake static ink on a CPU-backed canvas, then reuse it as a drawImage
        // source. Chrome's accelerated path can silently discard this dense
        // one-shot command batch at 1024px without reporting context loss.
        // CPU backing also avoids retaining a GPU surface for each cached tile.
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.fillStyle = ink[0]; ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Fine deterministic engraved grain. These marks are surface texture,
        // deliberately too small to resemble roads, cliffs or walkable bridges.
        let seed = 31 + id.charCodeAt(0);
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < canvas.width * 5; i++) {
            const x = random() * canvas.width, y = random() * canvas.height;
            ctx.globalAlpha = .05 + random() * .13; ctx.fillStyle = i % 2 ? ink[1] : ink[2];
            ctx.fillRect(x, y, 1 + random() * 6, 1);
        }
        ctx.globalAlpha = 1;
        const sx = canvas.width / (region.maxX - region.minX), sz = canvas.height / (region.maxZ - region.minZ);
        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(r => r.region === id)) {
            for (const p of createProceduralFoliagePlacements(recipe)) {
                const x = (p.x - region.minX) * sx, y = (p.z - region.minZ) * sz;
                const size = Math.max(1.5, 6 * p.scale * sx);
                ctx.fillStyle = ink[1]; ctx.strokeStyle = ink[2]; ctx.lineWidth = .6;
                ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .7, y + size * .5);
                ctx.lineTo(x - size * .7, y + size * .5); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }
        // Do not outline each tile: a solid rectangle would falsely seal the
        // real gates. Only the separate canonical wall layer draws boundaries.
        this.tiles.set(id, canvas); this.buildCount++;
        return canvas;
    }

    draw(ctx, w2s, width, height) {
        ctx.fillStyle = '#111c24'; ctx.fillRect(0, 0, width, height);
        for (const id of ['earth', 'water', 'fire', 'air', 'town']) {
            const r = WORLD_REGIONS[id];
            const a = w2s(r.minX, r.minZ), b = w2s(r.maxX, r.minZ), c = w2s(r.minX, r.maxZ), d = w2s(r.maxX, r.maxZ);
            if (Math.max(a.x, b.x, c.x, d.x) < 0 || Math.min(a.x, b.x, c.x, d.x) > width ||
                Math.max(a.y, b.y, c.y, d.y) < 0 || Math.min(a.y, b.y, c.y, d.y) > height) continue;
            const tile = this.tile(id);
            if (!tile) continue;
            ctx.save();
            ctx.transform((b.x - a.x) / tile.width, (b.y - a.y) / tile.width,
                (c.x - a.x) / tile.height, (c.y - a.y) / tile.height, a.x, a.y);
            ctx.drawImage(tile, 0, 0); ctx.restore();
        }
    }

    dispose() {
        for (const tile of this.tiles.values()) { tile.width = 0; tile.height = 0; }
        this.tiles.clear();
    }
}
