import { createWoodlandUnderstoryGeometry } from '../src/art/WoodlandUnderstoryGeometry.js';
import { createHash } from 'node:crypto';

test.each([['bracken', 'high'], ['bracken', 'low'], ['sedge', 'high'], ['sedge', 'low']])(
    '%s %s leaf fields stay continuous across ribbon faces and terminate at the midrib', (kind, quality) => {
        const geometry = createWoodlandUnderstoryGeometry(kind, { quality });
        try {
            const { uv, position } = geometry.attributes;
            expect(uv.itemSize).toBe(2); expect(uv.count).toBe(position.count);
            expect([...uv.array].every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
            const sections = quality === 'low' ? 2 : 3;
            const stride = kind === 'bracken' ? (quality === 'low' ? 177 : 183) : (quality === 'low' ? 9 : 15);
            for (let start = 0; start < position.count; start += stride) {
                for (let section = 0; section < sections - 1; section++) {
                    // A shared left/right edge has exactly the same coordinates
                    // on both triangles and on the following ribbon section.
                    for (const [a, b] of [[2, 5], [2, 6], [4, 7]]) {
                        const ia = start + section * 6 + a, ib = start + section * 6 + b;
                        expect([position.getX(ia), position.getY(ia), position.getZ(ia)])
                            .toEqual([position.getX(ib), position.getY(ib), position.getZ(ib)]);
                        expect([uv.getX(ia), uv.getY(ia)]).toEqual([uv.getX(ib), uv.getY(ib)]);
                    }
                }
                const tip = start + (sections - 1) * 6 + 2;
                expect([uv.getX(tip), uv.getY(tip)]).toEqual([.5, 1]);
            }
        } finally { geometry.dispose(); }
    });

test.each([
    ['bracken', ['4c8030f5bc78bc441dfe72a78ea761b5aeefec4a7530145edc7d240311a63622',
        '99742c3399c4e9bd06b7d4994629f952bfa9aa5751fb72311692295059a460e8',
        '6db68955f1ea07cd86f47622ed135798a89bba762040d028f907f42cb385d45a']],
    ['sedge', ['6003d7c03d0cca012fbb05c44b075f16efd0ab318b685e0959a9e6b247b4043f',
        '716973847a69be12e23be3828a32c3ebe4a3cf71703414017b13e8ec76ac0e7f',
        'e2f3abd273a90b5fd39a47971b5109d2aae56ad5c88b9dba8dcf04da95dd7c69']]
])('%s High buffers retain the qualified silhouette and continuous leaf shading', (kind, hashes) => {
    const geometry = createWoodlandUnderstoryGeometry(kind, { quality: 'high' });
    try {
        expect(['position', 'color', 'normal'].map(name => {
            const array = geometry.attributes[name].array;
            return createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
        })).toEqual(hashes);
    } finally { geometry.dispose(); }
});

test.each([['bracken', 7, 183, 177, 413], ['sedge', 16, 15, 9, 48]])(
    '%s Low retains every leaf root, tip and fern leaflet with fewer ribbon faces', (kind, blades, highStride, lowStride, triangles) => {
    const high = createWoodlandUnderstoryGeometry(kind), low = createWoodlandUnderstoryGeometry(kind, { quality: 'low' });
    try {
        expect(low.attributes.position.count / 3).toBe(triangles);
        expect(low.attributes.position.count).toBe(blades * lowStride);
        for (const name of ['position', 'color']) {
            const old = high.attributes[name].array, current = low.attributes[name].array;
            for (let blade = 0; blade < blades; blade++) {
                for (const [h, l] of [[0, 0], [1, 1], [14, 8]]) {
                    expect(current.slice((blade * lowStride + l) * 3, (blade * lowStride + l + 1) * 3))
                        .toEqual(old.slice((blade * highStride + h) * 3, (blade * highStride + h + 1) * 3));
                }
            }
        }
        if (kind === 'bracken') for (const name of ['position', 'color', 'normal']) {
            const old = high.attributes[name].array, current = low.attributes[name].array;
            for (let blade = 0; blade < blades; blade++) {
                expect(current.slice((blade * lowStride + 9) * 3, (blade + 1) * lowStride * 3))
                    .toEqual(old.slice((blade * highStride + 15) * 3, (blade + 1) * highStride * 3));
            }
        }
        const normals = low.attributes.normal;
        for (let i = 0; i < normals.count; i++) expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5);
        expect(low.boundingBox.min.y).toBeGreaterThanOrEqual(0);
        expect(low.boundingBox.max.y).toBeLessThan(.75);
    } finally { high.dispose(); low.dispose(); }
});

test.each(['bracken', 'sedge'])('%s has a low spreading silhouette, deterministic colors and a bounded instance cost', kind => {
    const geometry = createWoodlandUnderstoryGeometry(kind);
    const copy = createWoodlandUnderstoryGeometry(kind);
    expect(geometry.attributes.position.array).toEqual(copy.attributes.position.array);
    expect(geometry.attributes.color.array).toEqual(copy.attributes.color.array);
    const { position, color, normal } = geometry.attributes;
    expect(position.count).toBe(color.count); expect(position.count).toBe(normal.count);
    expect(position.count / 3).toBeLessThanOrEqual(450);
    const bounds = geometry.boundingBox;
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    expect(bounds.max.y * 1.4).toBeLessThan(1.05);
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(1.4);
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1.4);
    for (let i = 0; i < position.count; i++) {
        expect(Math.hypot(position.getX(i), position.getZ(i)) * 1.4).toBeLessThan(2.2);
        expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5);
    }
    geometry.dispose(); copy.dispose();
});

test('unknown vegetation does not silently become a generic plant', () => {
    expect(() => createWoodlandUnderstoryGeometry('missing')).toThrow('Unknown woodland cover');
});

test.each(['bracken', 'sedge'])('%s ribbon seams share smooth unit normals without welding separate leaves', kind => {
    const geometry = createWoodlandUnderstoryGeometry(kind);
    try {
        const { position: p, normal: n } = geometry.attributes;
        const stride = kind === 'sedge' ? 15 : 183;
        for (let start = 0; start < p.count; start += stride) {
            for (const offsets of [[2, 5, 6], [4, 7, 9], [8, 11, 12]]) {
                const [a, ...others] = offsets.map(i => start + i);
                for (const b of others) {
                    expect([p.getX(a), p.getY(a), p.getZ(a)]).toEqual([p.getX(b), p.getY(b), p.getZ(b)]);
                    expect([n.getX(a), n.getY(a), n.getZ(a)]).toEqual([n.getX(b), n.getY(b), n.getZ(b)]);
                }
            }
        }
        // Tips/root still have different analytic surface directions; do not
        // replace the bent ribbon with one flat normal or smooth every plant.
        expect([n.getX(0), n.getY(0), n.getZ(0)]).not.toEqual([n.getX(14), n.getY(14), n.getZ(14)]);
    } finally { geometry.dispose(); }
});

test('sedge forms varied curved leaf clusters at the existing eighty-triangle cost', () => {
    const geometry = createWoodlandUnderstoryGeometry('sedge');
    try {
        const p = geometry.attributes.position;
        expect(p.count / 3).toBe(80);
        let projectedArea = 0;
        const widths = [];
        let rolledSections = 0;
        for (let i = 0; i < p.count; i += 3) {
            projectedArea += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i))
                - (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
        }
        for (let blade = 0; blade < 16; blade++) {
            // Three bent sections, five triangles per blade; its broadest
            // section is at t=1/3, not a wide triangular base at the soil.
            const section = blade * 15 + 6;
            widths.push(Math.hypot(p.getX(section + 1) - p.getX(section), p.getZ(section + 1) - p.getZ(section)));
            if (Math.abs(p.getY(section + 1) - p.getY(section)) > .01) rolledSections++;
            expect(p.getY(blade * 15)).toBe(0);
            const tip = blade * 15 + 14;
            expect(p.getY(tip)).toBeLessThan(.1);
        }
        expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.7);
        expect(rolledSections).toBeGreaterThanOrEqual(12);
        // Sum includes overlapping leaves. Not a screen-coverage assertion.
        expect(projectedArea).toBeGreaterThan(.9);
    } finally { geometry.dispose(); }
});


test.each(['high', 'low'])('fern folds have continuous unit normals and colors without welding separate leaflets (%s)', quality => {
    const geometry = createWoodlandUnderstoryGeometry('bracken', { quality });
    try {
        const { position: p, normal: n, color: c } = geometry.attributes;
        const stride = quality === 'high' ? 183 : 177, ribbon = quality === 'high' ? 15 : 9;
        let folds = 0;
        for (let blade = 0; blade < 7; blade++) for (let pinna = 0; pinna < 14; pinna++) {
            const start = blade * stride + ribbon + pinna * 12;
            for (const [a, b] of [[start, start + 3], [start, start + 6], [start, start + 9], [start + 2, start + 4], [start + 5, start + 7], [start + 8, start + 10]]) {
                for (const attribute of [p, n, c]) {
                    expect([attribute.getX(a), attribute.getY(a), attribute.getZ(a)])
                        .toEqual([attribute.getX(b), attribute.getY(b), attribute.getZ(b)]);
                }
                expect(Math.hypot(n.getX(a), n.getY(a), n.getZ(a))).toBeCloseTo(1, 5);
            }
            // Preserve the bend: the two outer edges keep distinct normals.
            const left = start + 1, right = start + 11;
            expect([n.getX(left), n.getY(left), n.getZ(left)])
                .not.toEqual([n.getX(right), n.getY(right), n.getZ(right)]);
            folds++;
        }
        expect(folds).toBe(98);
    } finally { geometry.dispose(); }
});
