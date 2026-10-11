import { EARTH_OUTCROP_COLLISIONS, EARTH_OUTCROP_PROFILE } from '../data/earthOutcrops.js';

const LIGHT_INK = [209, 200, 155], DARK_INK = [7, 25, 16];

// Use the rendered/server triangle diagonal, not a second smooth height model.
function visitTriangles(field, visit) {
    for (let row = 0; row < field.rows; row++) for (let column = 0; column < field.columns; column++) {
        const x = field.minX + column * field.stepX, z = field.minZ + row * field.stepZ;
        const a = [x, z, field.vertexHeight(column, row)];
        const b = [x + field.stepX, z, field.vertexHeight(column + 1, row)];
        const c = [x, z + field.stepZ, field.vertexHeight(column, row + 1)];
        const d = [x + field.stepX, z + field.stepZ, field.vertexHeight(column + 1, row + 1)];
        visit([a, b, c]); visit([d, c, b]);
    }
}

export function getAtlasContourSegments(field) {
    const segments = [];
    visitTriangles(field, vertices => {
        const low = Math.min(...vertices.map(v => v[2])), high = Math.max(...vertices.map(v => v[2]));
        for (let elevation = (Math.floor(low / 3) + 1) * 3; elevation <= high; elevation += 3) {
            const intersections = [];
            for (let i = 0; i < 3; i++) {
                const a = vertices[i], b = vertices[(i + 1) % 3];
                if (a[2] === b[2] || elevation < Math.min(a[2], b[2]) || elevation > Math.max(a[2], b[2])) continue;
                const t = (elevation - a[2]) / (b[2] - a[2]);
                const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
                if (!intersections.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-8)) intersections.push(point);
            }
            if (intersections.length === 2) segments.push({ elevation, points: intersections });
        }
    });
    return segments;
}

export function drawAtlasTerrainRelief(ctx, region, width, height, field, profile) {
    if (!field || region.id !== 'earth') return;
    const sx = width / (region.maxX - region.minX), sz = height / (region.maxZ - region.minZ);
    const project = ([x, z]) => [(x - region.minX) * sx, (z - region.minZ) * sz];
    const polygon = vertices => {
        ctx.beginPath();
        vertices.forEach((v, i) => { const p = project(v); if (i) ctx.lineTo(...p); else ctx.moveTo(...p); });
        ctx.closePath(); ctx.fill();
    };
    // Soft directional engraving. Neither the height field nor its flat town
    // and approach pads are altered; these are static map pixels only. Blend
    // the sampled slopes per pixel to avoid faceted/checkerboard map shading.
    const image = ctx.getImageData(0, 0, width, height), pixels = image.data;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const x = region.minX + (px + .5) / sx, z = region.minZ + (py + .5) / sz;
        const elevation = field.sample(x, z);
        if (!elevation) continue;
        const dx = (field.sample(x + field.stepX / 2, z) - field.sample(x - field.stepX / 2, z)) / field.stepX;
        const dz = (field.sample(x, z + field.stepZ / 2) - field.sample(x, z - field.stepZ / 2)) / field.stepZ;
        const shade = (-dx + dz) / Math.SQRT2;
        const tint = shade >= 0 ? LIGHT_INK : DARK_INK;
        const alpha = Math.min(.38, Math.min(1, elevation / 3) * .035 + Math.abs(shade) * 1.5);
        const offset = (py * width + px) * 4;
        for (let channel = 0; channel < 3; channel++) pixels[offset + channel] =
            Math.round(pixels[offset + channel] * (1 - alpha) + tint[channel] * alpha);
    }
    ctx.putImageData(image, 0, 0);
    ctx.save();
    ctx.globalAlpha = .3; ctx.strokeStyle = '#b4b083'; ctx.lineWidth = .65;
    ctx.beginPath();
    for (const { points } of getAtlasContourSegments(field)) {
        ctx.moveTo(...project(points[0])); ctx.lineTo(...project(points[1]));
    }
    ctx.stroke();
    if (profile === EARTH_OUTCROP_PROFILE) {
        // Exact registered solid footprints, including the smaller heel/toe
        // rocks. Do not draw these on elevation-only or ordinary flat maps.
        ctx.globalAlpha = .85; ctx.fillStyle = '#192923'; ctx.strokeStyle = '#b4b083'; ctx.lineWidth = .8;
        for (const rock of EARTH_OUTCROP_COLLISIONS) { polygon(rock.outline); ctx.stroke(); }
    }
    ctx.restore();
}
