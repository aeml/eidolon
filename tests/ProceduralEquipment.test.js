import * as THREE from 'three';
import { BASE_ITEMS } from '../src/core/ItemSystem.js';
import {
    createProceduralFighter,
    createProceduralRogue,
    createProceduralWizard,
    createProceduralCleric
} from '../src/art/ProceduralHumanoid.js';
import {
    applyProceduralEquipment,
    clearProceduralEquipment,
    createProceduralEquipmentVisual,
    EQUIPMENT_RENDER_SLOTS,
    EQUIPMENT_VISUAL_DESCRIPTORS,
    equipmentVisualSignature,
    getProceduralEquipmentCacheMetrics,
    resolveEquipmentVisualDescriptor
} from '../src/art/ProceduralEquipment.js';

const SOURCE_SLOT_FOR_RENDER_SLOT = Object.freeze({
    ring1: 'ring',
    ring2: 'ring',
    trinket1: 'trinket',
    trinket2: 'trinket'
});

function item(baseName, slot, overrides = {}) {
    return {
        id: `${slot}-${baseName.toLowerCase().replaceAll(' ', '-')}`,
        name: overrides.name || baseName,
        baseName: overrides.baseName || baseName,
        slot: SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot,
        type: 'ARMOR',
        rarity: overrides.rarity || 'Rare',
        level: overrides.level || 42,
        potency: overrides.potency || 0,
        sockets: overrides.sockets || 0,
        gems: overrides.gems || [],
        setId: overrides.setId || '',
        uniqueEffect: overrides.uniqueEffect || '',
        statScaleVersion: overrides.statScaleVersion || 1
    };
}

function visualGroups(root) {
    const groups = [];
    root.traverse((child) => {
        if (child.userData?.equipmentVisual) groups.push(child);
    });
    return groups;
}

describe('rigid equipment batching', () => {
    test('an iron blade and guard share their equal surface state without losing their different colors', () => {
        const root = createProceduralEquipmentVisual(item('Iron Sword', 'mainHand'), { batch: true });
        const batch = root.children.find(part => part.userData.equipmentBatchSources?.includes('Gear_Blade') &&
            part.userData.equipmentBatchSources.includes('Gear_Guard'));
        expect(batch).toBeDefined();
        expect(batch.material.vertexColors).toBe(true);
        expect(batch.material.color.getHex()).toBe(0xffffff);
        let offset = 0;
        for (const name of batch.userData.equipmentBatchSources) {
            const source = root.getObjectByName(name), count = source.geometry.index?.count ?? source.geometry.attributes.position.count;
            expect(source.material.color.equals(batch.material.color)).toBe(false);
            for (let i = 0; i < count; i++) {
                expect(batch.geometry.attributes.color.getX(offset + i)).toBeCloseTo(source.material.color.r, 7);
                expect(batch.geometry.attributes.color.getY(offset + i)).toBeCloseTo(source.material.color.g, 7);
                expect(batch.geometry.attributes.color.getZ(offset + i)).toBeCloseTo(source.material.color.b, 7);
            }
            offset += count;
        }
        expect(offset).toBe(batch.geometry.attributes.color.count);
    });

    test.each(['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace', 'Wooden Shield', 'Spell Tome', 'Leather Gloves', 'Iron Gauntlets', 'Silk Gloves'])(
        '%s fits sockets and both identity markers to its actual support', baseName => {
            const visual = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
            const piece = createProceduralEquipmentVisual(item(baseName, visual.slot, { level: 1, sockets: 3,
                setId: 'warlord_fury', uniqueEffect: 'guardian' }));
            piece.updateMatrixWorld(true);
            const supports = ['Gear_Blade', 'Gear_BladeRune', 'Gear_Shaft', 'Gear_MaceHead', 'Gear_TomeCover',
                'Gear_ShieldFace', 'Gear_ShieldRim', 'Gear_ShieldSpine', 'Gear_Glove', 'Gear_GloveRim']
                .map(name => piece.getObjectByName(name)).filter(Boolean);
            for (const name of ['Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
                const part = piece.getObjectByName(name), point = part.getWorldPosition(new THREE.Vector3());
                const hit = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1))
                    .intersectObjects(supports)[0];
                expect(hit).toBeDefined();
                expect(point.z - hit.point.z).toBeGreaterThan(0);
                expect(point.z - hit.point.z).toBeLessThan(.004);
            }
            if (visual.family === 'blade') for (let index = 1; index <= 3; index++) {
                const front = piece.getObjectByName(`Gear_SocketMount${index}`);
                const back = piece.getObjectByName(`Gear_SocketMountBack${index}`);
                expect(back.scale.equals(front.scale)).toBe(true);
                expect(front.position.z + back.position.z).toBeCloseTo(.035);
                expect(front.position.y).toBe(back.position.y);
            }
        });

    test.each(['Leather Cap', 'Iron Helm', 'Silk Hood', 'Plate Mail', 'Leather Tunic', 'Robes'])(
        '%s seats all sockets and identity settings against its curved surface', baseName => {
            const visual = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
            for (const level of [1, 100]) {
                const piece = createProceduralEquipmentVisual(item(baseName, visual.slot, {
                    level, sockets: 3, setId: 'warlord_fury', uniqueEffect: 'guardian'
                }));
                piece.updateMatrixWorld(true);
                const supports = ['Gear_CapCrown', 'Gear_CapBand', 'Gear_Hood', 'Gear_Helm', 'Gear_HelmCrown', 'Gear_HelmBrow', 'Gear_Torso']
                    .map(name => piece.getObjectByName(name)).filter(Boolean);
                for (const name of ['Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
                    const point = piece.getObjectByName(name).getWorldPosition(new THREE.Vector3());
                    const hit = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1))
                        .intersectObjects(supports)[0];
                    expect(hit).toBeDefined();
                    const expectedGap = (visual.family === 'headwear' ? .004 * .65 : .009) * piece.scale.z;
                    expect(point.z - hit.point.z).toBeCloseTo(expectedGap, 5);
                }
            }
        });

    test.each(Object.entries(EQUIPMENT_VISUAL_DESCRIPTORS).filter(([, visual]) =>
        ['ring', 'waist', 'trinket', 'neckwear'].includes(visual.family)).map(([name]) => name))(
        '%s has surface-mounted, accessory-sized gem and identity settings', baseName => {
            const visual = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
            for (const level of [1, 100]) {
                const piece = createProceduralEquipmentVisual(item(baseName, visual.slot, {
                    level, sockets: 3, gems: [{ type: 'Ruby' }, { type: 'Emerald' }, { type: 'Sapphire' }],
                    setId: 'warlord_fury', uniqueEffect: 'guardian'
                }));
                piece.updateMatrixWorld(true);
                const supports = ['Gear_RingSetting', 'Gear_RingSeal', 'Gear_RingStone', 'Gear_Belt', 'Gear_Buckle', 'Gear_BeltMark',
                    'Gear_Orb', 'Gear_TrinketFocus', 'Gear_TrinketSetting', 'Gear_ChokerSeal', 'Gear_NeckFocus', 'Gear_NeckSetting']
                    .map(name => piece.getObjectByName(name)).filter(Boolean);
                for (const name of ['Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
                    const setting = piece.getObjectByName(name), point = setting.getWorldPosition(new THREE.Vector3());
                    const top = visual.family === 'ring' && name.startsWith('Gear_SocketMount');
                    const direction = top ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 0, -1);
                    const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, -2), direction);
                    const hit = ray.intersectObjects(supports)[0];
                    expect(hit).toBeDefined();
                    expect(point.distanceTo(hit.point)).toBeLessThan(.004);
                    expect(setting.scale.x).toBeLessThanOrEqual(.6);
                }
                for (let index = 1; index <= 3; index++) expect(piece.getObjectByName(`Gear_Socket${index}`).material.emissiveIntensity).toBe(.12);
            }
        });

    test.each(['Pendant', 'Necklace'])('%s has a continuous draped chain that meets its front-facing focus', baseName => {
        const first = createProceduralEquipmentVisual(item(baseName, 'neck', { level: 1 }));
        const second = createProceduralEquipmentVisual(item(baseName, 'neck', { level: 1 }));
        const chain = first.getObjectByName('Gear_NeckChain'), focus = first.getObjectByName('Gear_NeckFocus');
        expect(chain.geometry.type).toBe('TubeGeometry');
        expect(chain.geometry).toBe(second.getObjectByName('Gear_NeckChain').geometry);
        for (const attribute of Object.values(chain.geometry.attributes)) expect(attribute.array.every(Number.isFinite)).toBe(true);
        expect(chain.geometry.parameters.closed).toBe(true);
        expect(focus.rotation.x).toBe(0);
        first.updateMatrixWorld(true);
        const join = chain.geometry.parameters.path.getPoint(0).applyMatrix4(chain.matrixWorld);
        const vertices = focus.geometry.attributes.position, indices = focus.geometry.index;
        let distance = Infinity;
        for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) {
            const points = [0, 1, 2].map(offset => new THREE.Vector3()
                .fromBufferAttribute(vertices, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(focus.matrixWorld));
            distance = Math.min(distance, new THREE.Triangle(...points).closestPointToPoint(join, new THREE.Vector3()).distanceTo(join));
        }
        expect(distance).toBeLessThan(.018); // chain radius: actual touching surfaces, not just overlapping bounds
    });

    test.each([
        ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
        ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
    ])('%s neck focus clears every equipped chest family', (_name, factory) => {
        const actor = factory();
        for (const chest of ['Plate Mail', 'Leather Tunic', 'Robes']) for (const neck of ['Pendant', 'Necklace']) for (const [chestLevel, neckLevel] of [[1, 100], [100, 1]]) {
            const result = applyProceduralEquipment(actor, { chest: item(chest, 'chest', { level: chestLevel }), neck: item(neck, 'neck', { level: neckLevel }) });
            expect(result.items).toBe(2);
            actor.updateMatrixWorld(true);
            const focus = actor.getObjectByName('Gear_NeckFocus');
            const point = focus.getWorldPosition(new THREE.Vector3());
            const direction = new THREE.Vector3(0, 0, 1).transformDirection(actor.getObjectByName('Equipment_Neck').matrixWorld);
            const chestPieces = actor.getObjectByName('Equipment_Chest').children.filter(part => part.userData.equipmentVisual);
            expect(chestPieces).toHaveLength(1);
            const hits = new THREE.Raycaster(point.clone().addScaledVector(direction, 2), direction.clone().negate(), 0, 1.99)
                .intersectObjects(chestPieces, true).filter(hit => hit.object.visible);
            expect(hits.map(hit => `${chest}/${neck}:${hit.object.name}`)).toEqual([]);
        }
    });

    test('Rogue retains facial details when any headwear replaces the open default hood', () => {
        const actor = createProceduralRogue();
        const features = ['Rogue_Nose', 'Rogue_Lips', 'Rogue_BrowLeft', 'Rogue_BrowRight',
            'Rogue_HairLockLeft', 'Rogue_HairLockRight', 'Rogue_Braid'];
        const hood = actor.getObjectByName('Rogue_Hood');
        expect(hood.geometry.type).toBe('LatheGeometry');
        expect(hood.material.flatShading).toBe(false);
        actor.updateMatrixWorld(true);
        for (const name of ['Rogue_EyeGlow', 'Rogue_EyeGlowRight']) {
            const eye = actor.getObjectByName(name).getWorldPosition(new THREE.Vector3());
            const direction = new THREE.Vector3(0, .32, 1).normalize();
            expect(new THREE.Raycaster(eye.clone().addScaledVector(direction, 2), direction.clone().negate(), 0, 1.99)
                .intersectObject(hood)).toHaveLength(0);
        }
        for (const baseName of ['Iron Helm', 'Leather Cap', 'Silk Hood']) {
            applyProceduralEquipment(actor, { head: item(baseName, 'head') });
            expect(hood.visible).toBe(false);
            for (const name of features) expect(actor.getObjectByName(name).visible).toBe(true);
        }
        clearProceduralEquipment(actor);
        expect(hood.visible).toBe(true);
        for (const name of features) expect(actor.getObjectByName(name).visible).toBe(true);
    });

    test.each([
        ['Fighter', createProceduralFighter, .125], ['Rogue', createProceduralRogue, 0],
        ['Wizard', createProceduralWizard, .1], ['Cleric', createProceduralCleric, 0]
    ])('%s eyes remain clear through every headwear family and item tier', (type, factory, pairedOffset) => {
        const actor = factory();
        for (const baseName of ['Iron Helm', 'Leather Cap', 'Silk Hood']) for (const level of [1, 30, 100]) {
            applyProceduralEquipment(actor, { head: item(baseName, 'head', { level, sockets: 3, setId: 'warlord_fury', uniqueEffect: 'guardian' }) });
            actor.updateMatrixWorld(true);
            const head = actor.getObjectByName('Equipment_Head');
            const gear = head.children.filter(part => part.userData.equipmentVisual);
            expect(gear.length).toBeGreaterThan(0);
            for (const side of [-1, 1]) {
                const eye = actor.getObjectByName(`${type}_EyeGlow${pairedOffset || side === -1 ? '' : 'Right'}`);
                const point = eye.localToWorld(new THREE.Vector3(side * pairedOffset, 0, 0));
                for (const elevation of [0, .32]) {
                    const direction = new THREE.Vector3(0, elevation, 1).transformDirection(head.matrixWorld);
                    const hits = new THREE.Raycaster(point.clone().addScaledVector(direction, 2), direction.clone().negate(), 0, 1.99)
                        .intersectObjects(gear, true).filter(hit => hit.object.visible);
                    expect(hits.map(hit => `${baseName}:${level}:${hit.object.name}`)).toEqual([]);
                }
            }
        }
    });

    test.each(['Plate Greaves', 'Leather Pants', 'Silk Skirt'])('%s seats its knee mark, sockets and identity ornaments against the upper leg', baseName => {
        const piece = createProceduralEquipmentVisual(item(baseName, 'legs', {
            level: 1, sockets: 3, setId: 'warlord_fury', uniqueEffect: 'guardian'
        }));
        piece.updateMatrixWorld(true);
        const surface = piece.getObjectByName('Gear_ThighArmor');
        for (const name of ['Gear_KneeMark', 'Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
            const decoration = piece.getObjectByName(name);
            const hit = new THREE.Raycaster(new THREE.Vector3(decoration.position.x, decoration.position.y, 1),
                new THREE.Vector3(0, 0, -1)).intersectObject(surface)[0];
            expect(hit).toBeDefined();
            expect(decoration.position.z - hit.point.z).toBeCloseTo(.009, 5);
        }
    });

    test.each([
        ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
        ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
    ])('%s replaces both leg sections without leaving old shin armor or moving the feet', (type, factory) => {
        const actor = factory();
        const feet = ['Left', 'Right'].map(side => actor.getObjectByName(`Equipment_Foot${side}`));
        const footPositions = feet.map(foot => foot.position.clone());
        for (const baseName of ['Plate Greaves', 'Leather Pants', 'Silk Skirt']) {
            applyProceduralEquipment(actor, { legs: item(baseName, 'legs', { level: 1, sockets: 1, gems: [{ type: 'Ruby' }] }) });
            expect(visualGroups(actor)).toHaveLength(4);
            for (const side of ['Left', 'Right']) {
                const shin = actor.getObjectByName(`Rig_Shin${side}`);
                const anchor = actor.getObjectByName(`Equipment_Shin${side}`);
                const visual = anchor.children.find(part => part.userData.equipmentVisual);
                expect(anchor.parent).toBe(shin);
                expect(visual.userData.segment).toBe('shin');
                expect(visual.getObjectByName('Gear_ShinArmor')).toBeDefined();
                expect(visual.getObjectByName('Gear_Greave') !== undefined).toBe(baseName !== 'Silk Skirt');
                expect(visual.getObjectByName('Gear_Socket1')).toBeUndefined();
                expect(actor.getObjectByName(`${type}_Shin${side}`).visible).toBe(false);
                expect(feet.every(foot => foot.visible)).toBe(true);
                actor.updateMatrixWorld(true);
                const before = visual.getWorldPosition(new THREE.Vector3());
                const rotation = shin.rotation.x;
                // Position below the knee must move with the shin, not the thigh.
                const tipBefore = visual.localToWorld(new THREE.Vector3(0, -.6, 0));
                shin.rotation.x += .8;
                actor.updateMatrixWorld(true);
                expect(visual.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(.0001);
                expect(visual.localToWorld(new THREE.Vector3(0, -.6, 0)).distanceTo(tipBefore)).toBeGreaterThan(.3);
                shin.rotation.x = rotation;
            }
            clearProceduralEquipment(actor);
            expect(visualGroups(actor)).toHaveLength(0);
            for (const side of ['Left', 'Right']) expect(actor.getObjectByName(`${type}_Shin${side}`).visible).toBe(true);
        }
        feet.forEach((foot, index) => expect(foot.position.equals(footPositions[index])).toBe(true));
    });

    test.each([
        ['Fighter', createProceduralFighter, 'Pauldron'], ['Rogue', createProceduralRogue, 'ShoulderGuard'],
        ['Wizard', createProceduralWizard, 'Mantle'], ['Cleric', createProceduralCleric, 'ReliquaryPauldron']
    ])('%s preserves its fitted default shoulders through equip and removal', (type, factory, name) => {
        const root = factory(), other = factory(), parts = [];
        for (const side of ['Left', 'Right']) {
            const anchor = root.getObjectByName(`Equipment_Shoulder${side}`);
            for (const suffix of type === 'Wizard' ? ['', '_Hem'] : ['', '_Rim', '_Lame']) {
                const part = root.getObjectByName(`${type}_${name}${side}${suffix}`);
                expect(part.parent).toBe(anchor);
                expect(part.material.flatShading).toBe(false);
                expect(part.geometry).toBe(other.getObjectByName(part.name).geometry);
                expect(part.material).toBe(other.getObjectByName(part.name).material);
                if (type === 'Wizard') expect(part.material.side).toBe(THREE.DoubleSide);
                parts.push(part);
            }
        }
        applyProceduralEquipment(root, { shoulders: item('Velvet Mantle', 'shoulders') });
        for (const part of parts) expect(part.visible).toBe(false);
        clearProceduralEquipment(root);
        for (const part of parts) expect(part.visible).toBe(true);
    });

    test.each(['Steel Pauldrons', 'Reinforced Spaulders', 'Velvet Mantle'])('%s fits sockets and identity ornaments to both shoulder surfaces', baseName => {
        const data = item(baseName, 'shoulders', { level: 1, sockets: 3, setId: 'warlord_fury', uniqueEffect: 'guardian' });
        for (const side of [-1, 1]) {
            const piece = createProceduralEquipmentVisual(data, { side });
            piece.updateMatrixWorld(true);
            const cap = piece.getObjectByName('Gear_Shoulder');
            expect(cap.material.flatShading).toBe(false);
            for (const name of ['Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
                const decoration = piece.getObjectByName(name);
                const ray = new THREE.Raycaster(new THREE.Vector3(decoration.position.x, decoration.position.y, 1), new THREE.Vector3(0, 0, -1));
                const hit = ray.intersectObject(cap)[0];
                expect(hit).toBeDefined();
                expect(decoration.position.z - hit.point.z).toBeCloseTo(.009, 5);
            }
        }
    });

    test('rounded Fighter great helm leaves its paired eyes visible and restores after unequip', () => {
        const actor = createProceduralFighter();
        actor.updateMatrixWorld(true);
        const helm = actor.getObjectByName('Fighter_GreatHelm'), eyes = actor.getObjectByName('Fighter_EyeGlow');
        expect(helm.material.flatShading).toBe(false);
        for (const x of [-.125, .125]) {
            const point = eyes.localToWorld(new THREE.Vector3(x, 0, 0));
            const direction = new THREE.Vector3(0, .32, 1).transformDirection(eyes.matrixWorld);
            const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, 2), direction.clone().negate(), 0, 1.99);
            expect(ray.intersectObject(helm)).toHaveLength(0);
        }
        applyProceduralEquipment(actor, { head: item('Iron Helm', 'head') });
        expect(helm.visible).toBe(false);
        clearProceduralEquipment(actor);
        expect(helm.visible).toBe(true);
    });

    test.each([
        ['Fighter', createProceduralFighter, 'Gauntlet'], ['Rogue', createProceduralRogue, 'Bracer'],
        ['Wizard', createProceduralWizard, 'RuneBracer'], ['Cleric', createProceduralCleric, 'VotiveGauntlet']
    ])('%s restores fitted class footwear and cuffs after equipment removal', (type, factory, cuffName) => {
        const root = factory(), second = factory();
        const defaults = [], anchors = [];
        for (const side of ['Left', 'Right']) {
            for (const slot of ['Foot', 'Glove']) {
                const anchor = root.getObjectByName(`Equipment_${slot}${side}`);
                anchors.push([anchor, anchor.position.clone(), anchor.quaternion.clone()]);
            }
            for (const name of [`${type}_Boot${side}`, `${type}_Boot${side}_Sole`, `${type}_Boot${side}_Toe`,
                `${type}_${cuffName}${side}`, `${type}_${cuffName}${side}_Rim`]) {
                const part = root.getObjectByName(name);
                expect(part.material.flatShading).toBe(false);
                expect(part.geometry).toBe(second.getObjectByName(name).geometry);
                expect(part.material).toBe(second.getObjectByName(name).material);
                defaults.push([part, part.geometry, part.material]);
            }
        }
        applyProceduralEquipment(root, { feet: item('Iron Boots', 'feet'), gloves: item('Silk Gloves', 'gloves') });
        for (const [part] of defaults) expect(part.visible).toBe(false);
        clearProceduralEquipment(root);
        for (const [part, geometry, material] of defaults) {
            expect(part.visible).toBe(true); expect(part.geometry).toBe(geometry); expect(part.material).toBe(material);
        }
        for (const [anchor, position, rotation] of anchors) {
            expect(anchor.position.equals(position)).toBe(true); expect(anchor.quaternion.equals(rotation)).toBe(true);
        }
    });

    test.each(['Iron Boots', 'Leather Boots', 'Sandals'])('%s seats sockets and identity ornaments on the actual footwear', baseName => {
        const data = item(baseName, 'feet', { level: 1, sockets: 3, setId: 'warlord_fury', uniqueEffect: 'guardian' });
        const piece = createProceduralEquipmentVisual(data);
        piece.updateMatrixWorld(true);
        const support = ['Gear_Boot', 'Gear_BootCap', 'Gear_SandalStrap'].map(name => piece.getObjectByName(name)).filter(Boolean);
        for (const name of ['Gear_SocketMount1', 'Gear_SocketMount2', 'Gear_SocketMount3', 'Gear_SetRune', 'Gear_UniqueRune']) {
            const decoration = piece.getObjectByName(name);
            const ray = new THREE.Raycaster(new THREE.Vector3(decoration.position.x, decoration.position.y, 1), new THREE.Vector3(0, 0, -1));
            const hit = ray.intersectObjects(support)[0];
            expect(hit).toBeDefined();
            expect(Math.abs(hit.point.z - decoration.position.z)).toBeLessThan(.02);
        }
        if (baseName !== 'Sandals') {
            expect(piece.getObjectByName('Gear_Boot').material.flatShading).toBe(false);
            expect(piece.getObjectByName('Gear_BootSole')).toBeDefined();
        }
    });

    test.each(['Leather Gloves', 'Iron Gauntlets', 'Silk Gloves'])('%s exposes the grip beneath a shared fitted cuff', baseName => {
        const data = item(baseName, 'gloves', { level: 1, sockets: 3 });
        const first = createProceduralEquipmentVisual(data), second = createProceduralEquipmentVisual(data);
        const cuff = first.getObjectByName('Gear_Glove');
        expect(cuff.geometry.type).toBe('LatheGeometry');
        expect(cuff.geometry).toBe(second.getObjectByName('Gear_Glove').geometry);
        expect(cuff.material.flatShading).toBe(false);
        expect(first.getObjectByName('Gear_GloveRim')).toBeDefined();
        for (let index = 1; index <= 3; index++) {
            const mount = first.getObjectByName(`Gear_SocketMount${index}`);
            // The setting intersects the shell rather than floating over it.
            first.updateMatrixWorld(true);
            const ray = new THREE.Raycaster(new THREE.Vector3(mount.position.x, mount.position.y, 1), new THREE.Vector3(0, 0, -1));
            const hit = ray.intersectObject(cuff)[0];
            expect(hit).toBeDefined();
            expect(Math.abs(hit.point.z - mount.position.z)).toBeLessThan(.012);
        }
    });

    test.each([1, 30, 100])('leather cap clears Rogue eyes at the normal close-up angle at level %s', level => {
        const root = createProceduralRogue();
        applyProceduralEquipment(root, {head: item('Leather Cap', 'head', {level})});
        root.updateMatrixWorld(true);
        const pieces = root.getObjectByName('Equipment_Head').children.filter(part => part.userData.equipmentVisual);
        const direction = new THREE.Vector3(0, .32, 1).normalize();
        for (const name of ['Rogue_EyeGlow', 'Rogue_EyeGlowRight']) {
            const eye = root.getObjectByName(name);
            expect(eye.visible).toBe(true);
            const point = eye.getWorldPosition(new THREE.Vector3());
            const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, 2), direction.clone().negate(), 0, 2);
            expect(ray.intersectObjects(pieces, true).filter(hit => hit.object.visible)).toHaveLength(0);
        }
    });

    test.each(['Steel Pauldrons', 'Reinforced Spaulders'])('%s uses fitted layered shells and embedded sockets', (baseName) => {
        const data = item(baseName, 'shoulders', { level: 1, sockets: 3 });
        for (const side of [-1, 1]) {
            const piece = createProceduralEquipmentVisual(data, { side });
            const cap = piece.getObjectByName('Gear_Shoulder');
            const lame = piece.getObjectByName('Gear_ShoulderLame');
            const rim = piece.getObjectByName('Gear_ShoulderRidge');
            expect(cap.geometry.type).toBe('LatheGeometry');
            expect(cap.material.flatShading).toBe(false);
            expect(lame).toBeDefined();
            expect(rim.material).not.toBe(cap.material);
            const capBounds = new THREE.Box3().setFromObject(cap);
            const lameBounds = new THREE.Box3().setFromObject(lame);
            expect(capBounds.getSize(new THREE.Vector3()).x).toBeLessThan(.94);
            expect(lameBounds.max.y).toBeGreaterThan(capBounds.min.y);
            expect(lameBounds.min.y).toBeLessThan(capBounds.min.y);
            for (let index = 1; index <= 3; index++) {
                const mount = piece.getObjectByName(`Gear_SocketMount${index}`);
                expect(mount.position.z).toBeLessThan(capBounds.max.z + .015);
            }
            const duplicate = createProceduralEquipmentVisual(data, { side });
            expect(duplicate.getObjectByName('Gear_Shoulder').geometry).toBe(cap.geometry);
            expect(duplicate.getObjectByName('Gear_Shoulder').material).toBe(cap.material);
            const torso = createProceduralEquipmentVisual(item('Plate Mail', 'chest'));
            expect(torso.getObjectByName('Gear_Torso').material.flatShading).toBe(false);
            expect(torso.getObjectByName('Gear_ChestSigil').material.flatShading).toBe(true);
        }
    });

    test.each([
        ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
        ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
    ])('%s has a forward run lean and articulates equipped boots without changing clip timing', (type, factory) => {
        const root = factory();
        applyProceduralEquipment(root, { feet: item('Iron Boots', 'feet') });
        const clip = root.userData.animations.find(clip => clip.name === 'Run');
        const chest = clip.tracks.find(track => track.name === 'Rig_Chest.rotation[x]');
        expect([...chest.values].every(value => value > 0)).toBe(true);
        expect(chest.getInterpolation()).toBe(THREE.InterpolateSmooth);
        for (const side of ['Left', 'Right']) {
            const track = clip.tracks.find(track => track.name === `Equipment_Foot${side}.rotation[x]`);
            expect(track.times.at(-1)).toBeCloseTo(clip.duration);
            expect(track.values[0]).toBeCloseTo(track.values.at(-1));
            expect(root.getObjectByName(`Equipment_Foot${side}`).children.some(child => child.userData.equipmentVisual)).toBe(true);
        }
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(clip).play();
        mixer.update(clip.duration * .28);
        expect(root.getObjectByName('Rig_Chest').rotation.x).toBeGreaterThan(0);
        expect(Math.abs(root.getObjectByName('Equipment_FootLeft').rotation.x)).toBeGreaterThan(.01);
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
    });

    test.each([
        ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
        ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
    ])('%s keeps shared wrist grips visible when gloves are replaced', (type, factory) => {
        const root = factory();
        const second = factory();
        const hands = ['Left', 'Right'].map(side => root.getObjectByName(`${type}_Hand${side}`));
        for (const hand of hands) {
            expect(hand.isMesh).toBe(true);
            expect(hand.geometry).toBe(second.getObjectByName(hand.name).geometry);
            expect(hand.userData.equipmentBodyBase).toBe(true);
        }
        for (const baseName of ['Leather Gloves', 'Iron Gauntlets', 'Silk Gloves']) {
            applyProceduralEquipment(root, { gloves: item(baseName, 'gloves') });
            for (const hand of hands) expect(hand.visible).toBe(true);
        }
        clearProceduralEquipment(root);
        for (const hand of hands) expect(hand.visible).toBe(true);
    });

    test.each([
        ['Fighter', createProceduralFighter], ['Rogue', createProceduralRogue],
        ['Wizard', createProceduralWizard], ['Cleric', createProceduralCleric]
    ])('%s keeps a physical neck between fitted torso and head when a necklace replaces the collar', (type, factory) => {
        const root = factory();
        const neck = root.getObjectByName(`${type}_Neck`);
        expect(neck.userData.equipmentBodyBase).toBe(true);
        for (const baseName of ['Necklace', 'Pendant', 'Choker']) {
            applyProceduralEquipment(root, { neck: item(baseName, 'neck'), chest: item('Leather Tunic', 'chest') });
            expect(neck.visible).toBe(true);
            const neckBounds = new THREE.Box3().setFromObject(neck);
            const faceBounds = new THREE.Box3().setFromObject(root.getObjectByName(`${type}_Head`));
            const torsoBounds = new THREE.Box3().setFromObject(root.getObjectByName('Gear_Torso'));
            expect(neckBounds.max.y).toBeGreaterThan(faceBounds.min.y);
            expect(neckBounds.min.y).toBeLessThan(torsoBounds.max.y);
        }
        clearProceduralEquipment(root);
        expect(neck.visible).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s preserves every vertex, material and shadow while batching rigid pieces', (baseName) => {
        const data = item(baseName, EQUIPMENT_VISUAL_DESCRIPTORS[baseName].slot, {
            sockets: 3, gems: [{ type: 'Ruby', quality: 'Flawless' }], setId: 'bulwark_ages', uniqueEffect: 'guardian'
        });
        for (const side of [-1, 1]) {
            const root = createProceduralEquipmentVisual(data, { side, batch: true });
            const original = createProceduralEquipmentVisual(data, { side });
            let originalTriangles = 0;
            let batchedTriangles = 0;
            original.traverseVisible((part) => { if (part.isMesh) originalTriangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3; });
            root.traverseVisible((part) => { if (part.isMesh) batchedTriangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3; });
            expect(batchedTriangles).toBe(originalTriangles);
            for (const batch of root.children.filter((part) => part.userData.equipmentBatchSources)) {
                const source = batch.userData.equipmentBatchSources.map((name) => root.getObjectByName(name));
                const geometries = source.map((part) => {
                    expect(part.visible).toBe(false);
                    for (const property of ['roughness', 'metalness', 'side', 'flatShading', 'emissiveIntensity',
                        'map', 'roughnessMap', 'bumpMap', 'bumpScale', 'metalnessMap', 'normalMap', 'alphaMap',
                        'shadowSide', 'opacity', 'blending', 'depthWrite', 'depthTest', 'alphaTest']) {
                        expect(batch.material[property]).toBe(part.material[property]);
                    }
                    expect(batch.material.emissive.equals(part.material.emissive)).toBe(true);
                    if (!batch.material.vertexColors) expect(part.material).toBe(batch.material);
                    expect(part.castShadow).toBe(batch.castShadow);
                    expect(part.receiveShadow).toBe(batch.receiveShadow);
                    const geometry = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()).applyMatrix4(part.matrix);
                    if (batch.material.vertexColors) {
                        expect(batch.material.color.getHex()).toBe(0xffffff);
                        const colors = new Float32Array(geometry.attributes.position.count * 3);
                        for (let i = 0; i < colors.length; i += 3) part.material.color.toArray(colors, i);
                        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    }
                    return geometry;
                });
                for (const attribute of Object.keys(batch.geometry.attributes)) {
                    expect([...batch.geometry.attributes[attribute].array]).toEqual(geometries.flatMap((geometry) => [...geometry.attributes[attribute].array]));
                }
                geometries.forEach((geometry) => geometry.dispose());
            }
            const bounds = new THREE.Box3().setFromObject(root);
            const originalBounds = new THREE.Box3().setFromObject(original);
            expect(bounds.min.distanceTo(originalBounds.min)).toBeLessThan(0.00001);
            expect(bounds.max.distanceTo(originalBounds.max)).toBeLessThan(0.00001);
        }
    });

    test('repeated batches share only immutable geometry and keep mutable appearance state independent', () => {
        const data = item('Plate Mail', 'chest', { sockets: 3 });
        const a = createProceduralEquipmentVisual(data, { batch: true });
        const b = createProceduralEquipmentVisual(data, { batch: true });
        const batches = a.children.filter((part) => part.userData.equipmentBatchSources);
        expect(batches.length).toBeGreaterThan(0);
        for (const batch of batches) {
            const other = b.getObjectByName(batch.name);
            expect(other).not.toBe(batch);
            expect(other.geometry).toBe(batch.geometry);
            batch.position.x = 5;
            expect(other.position.x).toBe(0);
        }
        expect(a.children.filter((part) => part.visible).length).toBeLessThan(createProceduralEquipmentVisual(data).children.length);
    });
});

function finiteTransforms(root) {
    root.updateMatrixWorld(true);
    let finite = true;
    root.traverse((child) => {
        finite &&= child.matrixWorld.elements.every(Number.isFinite);
    });
    return finite;
}

describe('procedural equipment visual manifest', () => {
    test('silk skirts have long front and back cloth panels that share their geometry', () => {
        const root = createProceduralEquipmentVisual(item('Silk Skirt', 'legs', { level: 1 }));
        const front = root.getObjectByName('Gear_ThighArmor');
        const back = root.getObjectByName('Gear_SkirtBack');
        front.geometry.computeBoundingBox();
        expect(front.geometry.boundingBox.min.y).toBeLessThan(-1.3);
        expect(front.geometry.boundingBox.max.y).toBeGreaterThan(0);
        expect(back.geometry).toBe(front.geometry);
        expect(front.position.z).toBeGreaterThan(0);
        expect(back.position.z).toBeLessThan(0);
        expect(front.material.side).toBe(THREE.DoubleSide);
        expect(root.getObjectByName('Gear_SkirtBorder')).toBeTruthy();
    });

    test('uses inset gems and restrained identity marks, even at maximum potency', () => {
        const root = createProceduralEquipmentVisual(item('Plate Mail', 'chest', {
            rarity: 'Eidolic', potency: 100, sockets: 4,
            gems: [{ type: 'Ruby' }, { type: 'Emerald' }, { type: 'Sapphire' }, { type: 'Topaz' }],
            setId: 'warlord_fury', uniqueEffect: 'vampiric'
        }));
        for (let i = 1; i <= 3; i++) {
            const gem = root.getObjectByName(`Gear_Socket${i}`);
            const mount = root.getObjectByName(`Gear_SocketMount${i}`);
            expect(gem.geometry.parameters.radius).toBeLessThan(mount.geometry.parameters.radius);
            expect(gem.position.z).toBeGreaterThan(mount.position.z);
            expect(gem.material.emissiveIntensity).toBeLessThanOrEqual(0.12);
        }
        expect(root.getObjectByName('Gear_Socket4')).toBeUndefined();
        for (const name of ['Gear_SetRune', 'Gear_UniqueRune', 'Gear_ChestSigil']) {
            expect(root.getObjectByName(name).material.emissiveIntensity).toBeLessThanOrEqual(0.16);
        }
    });

    test('shield edging follows the actual shield perimeter and leaves the wood visible', () => {
        const root = createProceduralEquipmentVisual(item('Wooden Shield', 'offHand'));
        const face = root.getObjectByName('Gear_ShieldFace');
        const rim = root.getObjectByName('Gear_ShieldRim');
        expect(rim.geometry.parameters.shapes.holes).toHaveLength(1);
        expect(rim.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
        face.geometry.computeBoundingBox();
        rim.geometry.computeBoundingBox();
        expect(rim.geometry.boundingBox.max.y).toBeCloseTo(face.geometry.boundingBox.max.y, 1);
        expect(rim.geometry.boundingBox.min.y).toBeCloseTo(face.geometry.boundingBox.min.y, 1);
        expect(root.getObjectByName('Gear_ShieldGrip')).toBeTruthy();
    });

    test.each(['Iron Helm', 'Silk Hood', 'Leather Cap'])('%s covers the Cleric crown instead of being buried inside her head', (baseName) => {
        const root = createProceduralCleric();
        applyProceduralEquipment(root, { head: item(baseName, 'head', { level: 1 }) });
        root.updateMatrixWorld(true);
        const head = root.getObjectByName('Cleric_Head');
        const gear = root.getObjectByName('EquippedVisual_head');
        const headBounds = new THREE.Box3().setFromObject(head);
        const gearBounds = new THREE.Box3().setFromObject(gear);
        expect(gearBounds.max.y).toBeGreaterThan(headBounds.max.y);
        expect(gearBounds.max.x).toBeGreaterThan(headBounds.max.x);
        expect(gearBounds.min.x).toBeLessThan(headBounds.min.x);
    });

    test('defines every equippable base item and excludes inventory-only materials', () => {
        const equippable = BASE_ITEMS.filter((entry) => !['material', 'relic'].includes(entry.slot));
        const inventoryOnly = BASE_ITEMS.filter((entry) => ['material', 'relic'].includes(entry.slot));

        expect(equippable).toHaveLength(36);
        expect(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).sort())
            .toEqual(equippable.map((entry) => entry.name).sort());
        equippable.forEach((entry) => {
            expect(EQUIPMENT_VISUAL_DESCRIPTORS[entry.name]).toEqual(expect.objectContaining({
                slot: entry.slot,
                family: expect.any(String),
                variant: expect.any(String),
                primary: expect.any(Number),
                secondary: expect.any(Number)
            }));
        });
        inventoryOnly.forEach((entry) => {
            expect(EQUIPMENT_VISUAL_DESCRIPTORS[entry.name]).toBeUndefined();
        });
    });

    test('resolves affixed server item names to an intentional family without fallback geometry', () => {
        expect(resolveEquipmentVisualDescriptor({
            id: 'affixed',
            name: 'Brilliant Iron Sword of the Bear',
            slot: 'mainHand'
        })).toEqual(expect.objectContaining({ baseName: 'Iron Sword', family: 'blade', variant: 'longsword' }));
        expect(resolveEquipmentVisualDescriptor({ name: 'Unknown Future Helmet', slot: 'head' })).toBeNull();
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s renders through its declared Fighter anchor', (baseName) => {
        const root = createProceduralFighter();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                name: `Hearty ${baseName} of the Whale`,
                baseName: null,
                rarity: 'Legendary',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Ruby', quality: 'Flawless' }],
                setId: 'warlord_fury',
                uniqueEffect: 'vampiric'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups.length).toBe(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                family: descriptor.family,
                rarity: 'Legendary',
                tier: 3,
                potency: 5,
                sockets: 2,
                setId: 'warlord_fury',
                uniqueEffect: 'vampiric',
                statScaleVersion: 1
            }));
            if (group.userData.segment === 'shin') {
                // Identity and sockets remain on the upper section, not duplicated per bone.
                expect(group.getObjectByName('Gear_SetRune')).toBeUndefined();
                expect(group.getObjectByName('Gear_UniqueRune')).toBeUndefined();
            } else {
                expect(group.getObjectByName('Gear_SetRune')).toBeTruthy();
                expect(group.getObjectByName('Gear_UniqueRune')).toBeTruthy();
            }
        });
        expect(result.parts).toBeGreaterThan(groups.length);
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Rogue anchor', (baseName) => {
        const root = createProceduralRogue();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Emerald', quality: 'Flawless' }],
                setId: 'shadow_embrace',
                uniqueEffect: 'swift'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Wizard anchor', (baseName) => {
        const root = createProceduralWizard();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Sapphire', quality: 'Flawless' }],
                setId: 'archmage_regalia',
                uniqueEffect: 'arcane'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test.each(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS))('%s fits its declared Cleric anchor', (baseName) => {
        const root = createProceduralCleric();
        const descriptor = EQUIPMENT_VISUAL_DESCRIPTORS[baseName];
        const renderSlot = descriptor.slot === 'ring' ? 'ring1' : descriptor.slot === 'trinket' ? 'trinket1' : descriptor.slot;
        const result = applyProceduralEquipment(root, {
            [renderSlot]: item(baseName, renderSlot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 2,
                gems: [{ type: 'Topaz', quality: 'Flawless' }],
                setId: 'divine_light',
                uniqueEffect: 'guardian'
            })
        });
        const groups = visualGroups(root);

        expect(result).toEqual(expect.objectContaining({ supported: true, changed: true, items: 1, missing: [] }));
        expect(groups).toHaveLength(root.userData.equipmentAnchors[renderSlot].length);
        groups.forEach((group) => {
            expect(group.userData).toEqual(expect.objectContaining({
                slot: renderSlot,
                baseName,
                fitScale: root.userData.equipmentScaleBySlot[renderSlot]
            }));
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(finiteTransforms(root)).toBe(true);
    });

    test('renders all fourteen equipped positions as eighteen independently attached regions', () => {
        const root = createProceduralFighter();
        const face = root.getObjectByName('Fighter_Head');
        const eyes = root.getObjectByName('Fighter_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: slot.endsWith('2') ? 'Legendary' : 'Rare',
                sockets: 1,
                gems: [{ type: slot.endsWith('2') ? 'Emerald' : 'Sapphire', quality: 'Perfect' }]
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(20);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(finiteTransforms(root)).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Rogue without hiding face identity', () => {
        const root = createProceduralRogue();
        const face = root.getObjectByName('Rogue_Head');
        const eyes = root.getObjectByName('Rogue_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Legendary',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Emerald' : 'Onyx', quality: 'Perfect' }],
                setId: 'shadow_embrace',
                uniqueEffect: 'swift'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(20);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Rogue_EyeGlowRight').visible).toBe(true);
        expect(root.getObjectByName('Rogue_HairCap').visible).toBe(false);
        expect(root.getObjectByName('Rogue_MainhandFang').visible).toBe(false);
        expect(root.getObjectByName('Rogue_OffhandFang').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Rogue_MainhandFang').visible).toBe(true);
        expect(root.getObjectByName('Rogue_OffhandFang').visible).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Wizard and restores both arcane tools', () => {
        const root = createProceduralWizard();
        const face = root.getObjectByName('Wizard_Head');
        const eyes = root.getObjectByName('Wizard_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Sapphire' : 'Amethyst', quality: 'Perfect' }],
                setId: 'archmage_regalia',
                uniqueEffect: 'arcane'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(20);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Wizard_Stormstaff').visible).toBe(false);
        expect(root.getObjectByName('Rig_Focus').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Wizard_Stormstaff').visible).toBe(true);
        expect(root.getObjectByName('Rig_Focus').visible).toBe(true);
    });

    test('fits the complete fourteen-slot armory to the procedural Cleric and restores both sacred tools', () => {
        const root = createProceduralCleric();
        const face = root.getObjectByName('Cleric_Head');
        const eyes = root.getObjectByName('Cleric_EyeGlow');
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((slot, index) => {
            const sourceSlot = SOURCE_SLOT_FOR_RENDER_SLOT[slot] || slot;
            const baseName = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS)
                .find((name) => EQUIPMENT_VISUAL_DESCRIPTORS[name].slot === sourceSlot);
            equipment[slot] = item(baseName, slot, {
                rarity: 'Eidolic',
                level: 100,
                potency: 5,
                sockets: 1,
                gems: [{ type: index % 2 === 0 ? 'Topaz' : 'Emerald', quality: 'Perfect' }],
                setId: 'divine_light',
                uniqueEffect: 'guardian'
            });
        });

        const result = applyProceduralEquipment(root, equipment);

        expect(result).toEqual(expect.objectContaining({
            supported: true,
            changed: true,
            items: EQUIPMENT_RENDER_SLOTS.length,
            missing: []
        }));
        expect(visualGroups(root)).toHaveLength(20);
        expect(result.parts).toBeGreaterThanOrEqual(45);
        visualGroups(root).forEach((group) => {
            expect(group.userData.fitScale).toBe(root.userData.equipmentScaleBySlot[group.userData.slot]);
            expect(group.scale.x).toBeLessThan(1);
        });
        expect(face.visible).toBe(true);
        expect(eyes.visible).toBe(true);
        expect(root.getObjectByName('Cleric_EyeGlowRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BrowLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BrowRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_Nose').visible).toBe(true);
        expect(root.getObjectByName('Cleric_Lips').visible).toBe(true);
        expect(root.getObjectByName('Cleric_TempleLockLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_TempleLockRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BraidLeft').visible).toBe(true);
        expect(root.getObjectByName('Cleric_BraidRight').visible).toBe(true);
        expect(root.getObjectByName('Cleric_HairCap').visible).toBe(false);
        expect(root.getObjectByName('Cleric_Oathmace').visible).toBe(false);
        expect(root.getObjectByName('Rig_Censer').visible).toBe(false);
        expect(finiteTransforms(root)).toBe(true);

        clearProceduralEquipment(root);
        expect(root.getObjectByName('Cleric_Oathmace').visible).toBe(true);
        expect(root.getObjectByName('Rig_Censer').visible).toBe(true);
    });

    test('diffs appearance state, reuses cached render resources, and restores the default kit on clear', () => {
        const root = createProceduralFighter();
        const equipment = {
            mainHand: item('Steel Dagger', 'mainHand', { potency: 3 }),
            offHand: item('Spell Tome', 'offHand')
        };
        const defaultSword = root.getObjectByName('Fighter_Oathblade');
        const defaultShield = root.getObjectByName('Fighter_KiteShield');

        const first = applyProceduralEquipment(root, equipment);
        const firstBlade = root.getObjectByName('Gear_Blade');
        const cacheAfterFirst = getProceduralEquipmentCacheMetrics();
        const unchanged = applyProceduralEquipment(root, equipment);
        const signatureBefore = equipmentVisualSignature(equipment);

        expect(first.changed).toBe(true);
        expect(defaultSword.visible).toBe(false);
        expect(defaultShield.visible).toBe(false);
        expect(unchanged.changed).toBe(false);
        expect(visualGroups(root)).toHaveLength(2);

        equipment.mainHand = { ...equipment.mainHand, potency: 4 };
        expect(equipmentVisualSignature(equipment)).not.toBe(signatureBefore);
        const replaced = applyProceduralEquipment(root, equipment);
        const secondBlade = root.getObjectByName('Gear_Blade');
        expect(replaced.changed).toBe(true);
        expect(secondBlade).not.toBe(firstBlade);
        expect(secondBlade.geometry).toBe(firstBlade.geometry);
        expect(getProceduralEquipmentCacheMetrics().geometries).toBe(cacheAfterFirst.geometries);

        const potencySignature = equipmentVisualSignature(equipment);
        equipment.mainHand = {
            ...equipment.mainHand,
            setId: 'bulwark_ages',
            uniqueEffect: 'guardian',
            statScaleVersion: 2
        };
        expect(equipmentVisualSignature(equipment)).not.toBe(potencySignature);
        const identified = applyProceduralEquipment(root, equipment);
        expect(identified.changed).toBe(true);
        expect(root.getObjectByName('Gear_SetRune')).toBeTruthy();
        expect(root.getObjectByName('Gear_UniqueRune')).toBeTruthy();

        expect(clearProceduralEquipment(root)).toBe(true);
        expect(visualGroups(root)).toHaveLength(0);
        expect(defaultSword.visible).toBe(true);
        expect(defaultShield.visible).toBe(true);
        expect(root.userData.equipmentVisualItemCount).toBe(0);
    });

    test('reports missing visual definitions instead of hiding them behind a generic fallback', () => {
        const root = createProceduralFighter();
        const result = applyProceduralEquipment(root, {
            head: item('Unknown Future Helmet', 'head')
        });

        expect(result.items).toBe(0);
        expect(result.missing).toEqual(['Unknown Future Helmet']);
        expect(visualGroups(root)).toHaveLength(0);
    });

    test('does not mutate model-backed actors that have not joined the procedural rig migration', () => {
        const legacy = new THREE.Group();
        const result = applyProceduralEquipment(legacy, { mainHand: item('Iron Sword', 'mainHand') });

        expect(result).toEqual({ supported: false, changed: false, items: 0, parts: 0, missing: [] });
        expect(legacy.children).toHaveLength(0);
    });
});
