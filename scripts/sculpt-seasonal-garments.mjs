import * as THREE from 'three';

// Each registered celebration owns a deliberate silhouette. These ornaments
// join the supplied clothing's skin; no actor, source gear or motion is edited.
export const SEASONAL_GARMENT_IDS = ['hollow-court-v1', 'rosebound-vow-v1', 'lantern-envoy-v1',
    'springbloom-jubilee-v1', 'solstice-pyre-v1', 'gilded-harvest-v1', 'midnight-masque-v1'];

export function sculptSeasonalGarment({ design, quality, material, gold, steel, shoulders,
    scale, headAnchor, chestAnchor, place, panel }) {
    const high = quality === 'high';
    const plate = (points, depth = .008) => panel(points.map(([x, y]) => [x * scale, y * scale]), depth * scale);
    const offset = (anchor, x, y, z = 0) => anchor.clone().add(new THREE.Vector3(x * scale, y * scale, z * scale));
    const shoulder = sign => new THREE.Vector3(sign * shoulders.max.x * .85, shoulders.max.y - .025 * scale, .025 * scale);
    const leaf = (width = .035, height = .09) => plate([[0, 0], [-width, height * .45], [0, height], [width, height * .45]]);
    const jewel = (anchor, name, color, radius = .028) => {
        const stone = new THREE.OctahedronGeometry(radius * scale); stone.scale(.8, 1, .45);
        place(stone, offset(anchor, 0, 0, .018), name, color, 'chest');
    };
    const enamel = material('Festival enamel', design.secondary, .15, .45);
    if (design.id === 'hollow-court-v1') {
        const bat = [[-.15, 0], [-.12, .085], [-.055, .035], [-.025, .07], [0, .045], [.025, .07], [.055, .035], [.12, .085], [.15, 0], [.09, .025], [.055, -.005], [0, .015], [-.055, -.005], [-.09, .025]];
        place(plate(bat), headAnchor, 'Hollow bat diadem', gold, 'head');
        for (const sign of [-1, 1]) {
            const wing = plate([[0, 0], [sign * .07, .1], [sign * .18, .16], [sign * .15, .04], [sign * .105, .055], [sign * .08, .005], [sign * .045, .025]], .012);
            wing.rotateY(-sign * .35); place(wing, shoulder(sign), `Hollow scalloped collar ${sign}`, steel, 'shoulders');
        }
        const amber = material('Carved amber gourd', 0xd68d40, .05, .6);
        const dark = material('Gourd carved recess', 0x25222c, 0, .9);
        const gourd = new THREE.SphereGeometry(.055 * scale, high ? 16 : 8, high ? 10 : 6); gourd.scale(1, .86, .3);
        place(gourd, chestAnchor, 'Harvest moon gourd medallion', amber, 'chest');
        for (const sign of [-1, 1]) place(plate([[-.01, 0], [.01, 0], [0, .018]], .002), offset(chestAnchor, sign * .02, .008, .018), `Gourd eye ${sign}`, dark, 'chest');
        place(plate([[-.025, 0], [0, -.012], [.025, 0], [0, -.02]], .002), offset(chestAnchor, 0, -.012, .018), 'Gourd carved smile', dark, 'chest');
        place(plate([[-.009, 0], [-.005, .025], [.01, .03], [.005, 0]]), offset(chestAnchor, 0, .045), 'Gourd stem', gold, 'chest');
    } else if (design.id === 'rosebound-vow-v1') {
        const shape = new THREE.Shape(); shape.moveTo(0, -.055 * scale);
        shape.bezierCurveTo(-.16 * scale, .04 * scale, -.09 * scale, .15 * scale, 0, .075 * scale);
        shape.bezierCurveTo(.09 * scale, .15 * scale, .16 * scale, .04 * scale, 0, -.055 * scale);
        const hole = new THREE.Path(); hole.moveTo(0, -.028 * scale);
        hole.bezierCurveTo(.115 * scale, .043 * scale, .07 * scale, .116 * scale, 0, .052 * scale);
        hole.bezierCurveTo(-.07 * scale, .116 * scale, -.115 * scale, .043 * scale, 0, -.028 * scale); shape.holes.push(hole);
        const heart = new THREE.ExtrudeGeometry(shape, { depth: .008 * scale, bevelEnabled: false, curveSegments: high ? 10 : 4, steps: 1 });
        place(heart, offset(headAnchor, 0, .015), 'Open heart coronet', gold, 'head');
        const rose = material('Rose petal enamel', 0xbd617c, .1, .65);
        for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
            const frond = leaf(); frond.rotateZ(-sign * (.35 + i * .4)); frond.rotateY(-sign * .3);
            place(frond, offset(shoulder(sign), sign * .03 * i, 0), `Rose shoulder leaf ${sign} ${i}`, gold, 'shoulders');
        }
        for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 5; i++) {
            const petal = leaf(ring ? .024 : .035, ring ? .04 : .065); petal.rotateZ(i * Math.PI * .4 + ring * .5);
            place(petal, offset(chestAnchor, 0, 0, ring * .008), `Layered rose petal ${ring} ${i}`, rose, 'chest');
        }
        jewel(chestAnchor, 'Rose heart stone', enamel, .02);
    } else if (design.id === 'lantern-envoy-v1') {
        for (const sign of [-1, 1]) {
            const horn = plate([[0, 0], [sign * .025, .08], [sign * .075, .16], [sign * .13, .17], [sign * .085, .12], [sign * .055, .04]], .018);
            place(horn, offset(headAnchor, sign * .055, 0, -.035), `Dragon crest horn ${sign}`, gold, 'head');
            for (let i = 0; i < 3; i++) {
                const dragonScale = plate([[-.04, .035], [0, .07], [.04, .035], [0, -.035]], .012); dragonScale.rotateY(sign * .35);
                place(dragonScale, offset(shoulder(sign), sign * .035 * i, -.015 * i, .008 * i), `Dragon shoulder scale ${sign} ${i}`, gold, 'shoulders');
            }
        }
        const red = material('Red lantern silk', 0xe07455, 0, .85);
        const lantern = new THREE.SphereGeometry(.05 * scale, high ? 12 : 8, high ? 8 : 6); lantern.scale(1, 1.3, .5);
        place(lantern, chestAnchor, 'Caged red lantern', red, 'chest');
        for (const sign of [-1, 1]) {
            const rim = new THREE.CylinderGeometry(.036 * scale, .036 * scale, .009 * scale, high ? 12 : 8);
            place(rim, offset(chestAnchor, 0, sign * .055, .004), `Lantern gilded rim ${sign}`, gold, 'chest');
            place(plate([[-.005, -.05], [.005, -.05], [.009, .05], [-.009, .05]], .004), offset(chestAnchor, sign * .025, 0, .025), `Lantern cage rib ${sign}`, gold, 'chest');
        }
        place(plate([[-.006, 0], [-.018, -.055], [0, -.04], [.018, -.055], [.006, 0]], .005), offset(chestAnchor, 0, -.06), 'Lantern hanging tassel', gold, 'chest');
    } else if (design.id === 'springbloom-jubilee-v1') {
        const petalColor = material('Spring ivory petals', 0xf0dfc2, 0, .82);
        const green = material('Spring leaf enamel', 0x6c9770, .15, .65);
        for (let i = 0; i < 7; i++) {
            const petal = leaf(.028, .09); petal.rotateZ(-(i - 3) * .3);
            // Fan outward and separate the overlapping bases in depth. Inward
            // coplanar petals collapse into a flickering patch on the hood.
            place(petal, offset(headAnchor, (i - 3) * .025, 0, Math.abs(i - 3) * .003), `Spring petal crown ${i}`, i % 2 ? green : petalColor, 'head');
        }
        for (const sign of [-1, 1]) for (let i = 0; i < 5; i++) {
            const petal = leaf(.028, .07); petal.rotateZ(i * Math.PI * .4); petal.rotateX(-.55);
            place(petal, shoulder(sign), `Open blossom shoulder ${sign} ${i}`, petalColor, 'shoulders');
        }
        for (let i = 0; i < 5; i++) { const petal = leaf(.025, .065); petal.rotateZ(i * Math.PI * .4); place(petal, chestAnchor, `Spring flower clasp ${i}`, petalColor, 'chest'); }
        jewel(chestAnchor, 'Spring pollen stone', enamel, .022);
    } else if (design.id === 'solstice-pyre-v1') {
        const fire = material('Solstice copper fire', 0xe59147, .65, .4);
        const flame = (height, width) => plate([[0, 0], [-width, height * .35], [-width * .4, height * .7], [width * .25, height], [width * .15, height * .55], [width, height * .4], [width * .65, height * .1]], .012);
        for (let i = -1; i <= 1; i++) place(flame(i ? .13 : .2, .035), offset(headAnchor, i * .065, 0), `Triple flame crest ${i}`, fire, 'head');
        for (const sign of [-1, 1]) for (let i = 0; i < 2; i++) {
            const plume = flame(.12 - i * .02, .04); plume.rotateZ(-sign * .5); plume.rotateY(-sign * .4);
            place(plume, offset(shoulder(sign), sign * .055 * i, -.01 * i), `Curled fire shoulder ${sign} ${i}`, fire, 'shoulders');
        }
        const sun = plate(Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12, r = i % 2 ? .04 : .065; return [Math.cos(a) * r, Math.sin(a) * r]; }));
        place(sun, chestAnchor, 'Solstice ember sun seal', gold, 'chest'); jewel(chestAnchor, 'Solstice ember stone', fire);
    } else if (design.id === 'gilded-harvest-v1') {
        const grain = (anchor, count, name, slot, angle = 0) => {
            const stem = plate([[-.004, 0], [.004, 0], [.004, .14], [-.004, .14]], .004); stem.rotateZ(angle); place(stem, anchor, `${name} stem`, gold, slot);
            for (let i = 0; i < count; i++) for (const sign of [-1, 1]) {
                const seed = leaf(.012, .035); seed.rotateZ(angle + sign * .65);
                const x = -Math.sin(angle) * (.025 + i * .028), y = Math.cos(angle) * (.025 + i * .028);
                place(seed, offset(anchor, x, y), `${name} grain ${i} ${sign}`, enamel, slot);
            }
        };
        for (let i = -1; i <= 1; i++) grain(offset(headAnchor, i * .04, 0), 3, `Wheat diadem ${i}`, 'head', -i * .4);
        for (const sign of [-1, 1]) grain(shoulder(sign), 3, `Harvest shoulder ${sign}`, 'shoulders', -sign * .75);
        grain(offset(chestAnchor, 0, -.06), 3, 'Bound harvest sheaf', 'chest');
        place(plate([[-.03, -.007], [.03, -.007], [.03, .007], [-.03, .007]], .012), chestAnchor, 'Harvest sheaf binding', steel, 'chest');
    } else if (design.id === 'midnight-masque-v1') {
        const shape = new THREE.Shape([[-.14, 0], [-.115, .065], [-.045, .05], [0, .075], [.045, .05], [.115, .065], [.14, 0], [.065, -.035], [0, -.01], [-.065, -.035]].map(([x, y]) => new THREE.Vector2(x * scale, y * scale)));
        for (const sign of [-1, 1]) {
            // Explicit closed polygons avoid a nearly duplicated ellipse endpoint
            // collapsing to zero-area side faces after Float32 export.
            const samples = high ? 16 : 8;
            const eye = new THREE.Path(Array.from({ length: samples }, (_, i) => {
                const angle = -i * Math.PI * 2 / samples;
                return new THREE.Vector2((sign * .067 + Math.cos(angle) * .03) * scale, (.012 + Math.sin(angle) * .014) * scale);
            }));
            eye.closePath(); shape.holes.push(eye);
        }
        const mask = new THREE.ExtrudeGeometry(shape, { depth: .009 * scale, bevelEnabled: false, curveSegments: high ? 8 : 3, steps: 1 });
        place(mask, headAnchor, 'Pierced masquerade diadem', gold, 'head');
        for (let i = 0; i < 5; i++) {
            const feather = plate([[0, 0], [-.018, .08], [.015, .19], [.045, .14], [.035, .035]], .007); feather.rotateZ(-.2 - i * .23); feather.rotateY(-.25);
            place(feather, offset(shoulder(1), .015 * i, -.012 * i), `Asymmetric feather fan ${i}`, i % 2 ? gold : steel, 'shoulders');
        }
        place(plate([[0, .07], [.055, 0], [0, -.07], [-.055, 0]], .015), chestAnchor, 'Theatre diamond clasp', gold, 'chest'); jewel(chestAnchor, 'Midnight theatre stone', enamel);
    } else throw Error('Unregistered seasonal garment');
}
