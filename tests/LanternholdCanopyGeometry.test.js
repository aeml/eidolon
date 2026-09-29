import { createLanternholdCanopy } from '../src/art/LanternholdCanopyGeometry.js';

test('fabric folds and scalloped hems stay inside the existing market roof envelope', () => {
    const geometry = createLanternholdCanopy();
    const { position, normal, uv, color } = geometry.attributes;
    expect(geometry.boundingBox.min.x).toBeCloseTo(-5.325);
    expect(geometry.boundingBox.max.x).toBeCloseTo(5.325);
    expect(geometry.boundingBox.min.z).toBeCloseTo(-3.825);
    expect(geometry.boundingBox.max.z).toBeCloseTo(3.825);
    expect(geometry.boundingBox.min.y).toBeGreaterThan(4.9);
    expect(geometry.boundingBox.max.y).toBeCloseTo(7);
    expect(geometry.index.count / 3).toBe(1408);
    expect(geometry.groups).toHaveLength(0);
    for (let i = 0; i < position.count; i++) {
        for (const attr of [position, normal, uv, color])
            for (let channel = 0; channel < attr.itemSize; channel++)
                if (!Number.isFinite(attr.array[i * attr.itemSize + channel])) throw new Error('invalid canopy vertex');
        expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5);
    }
    // Roof halves must face upward; the opposite hems are intentionally vertical.
    // Derive the bound from maximum slope + sag/fold derivatives, rather than
    // assuming that every folded fabric normal is within 36 degrees of up.
    const maximumZGradient = (1.45 + Math.PI * .42 + .13 + Math.PI * .035) / 3.825;
    const maximumXGradient = (.13 * Math.PI + .035 * Math.PI * 16) / 10.65;
    const minimumUp = 1 / Math.hypot(1, maximumZGradient, maximumXGradient);
    for (const start of [0, (9 + 4) * 33]) for (let i = start; i < start + 9 * 33; i++)
        expect(normal.getY(i)).toBeGreaterThan(minimumUp - 1e-6);
    geometry.dispose();
});
