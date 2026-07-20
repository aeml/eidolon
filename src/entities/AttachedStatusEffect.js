import * as THREE from 'three';

const STATUS_VISUALS = Object.freeze({
    iron_fortress: { style: 'barrier', color: 0xa8d8ff, accent: 0xffffff, radius: 1.75 },
    guardian_roar: { style: 'shields', color: 0x54d6ff, accent: 0xffffff, radius: 1.9 },
    berserker_edge: { style: 'rage', color: 0xff3131, accent: 0xffb05c, radius: 1.55 },
    last_stand: { style: 'rage', color: 0xff1414, accent: 0xffdf57, radius: 2.05 },
    serrated_edges: { style: 'blades', color: 0xcf2946, accent: 0xf4dbe0, radius: 1.45 },
    poison_coating: { style: 'orbit', color: 0x42ff72, accent: 0xc7ffd3, radius: 1.45 },
    stealth: { style: 'shadow', color: 0x34253f, accent: 0x9d78b5, radius: 1.7 },
    spell_focus: { style: 'crystals', color: 0xa949ff, accent: 0xf0c7ff, radius: 1.65 },
    arcane_shield: { style: 'barrier', color: 0x3b9dff, accent: 0xc9edff, radius: 1.85 },
    time_warp: { style: 'clock', color: 0xffd858, accent: 0xfff5bc, radius: 1.9 },
    swift: { style: 'haste', color: 0x64f3ff, accent: 0xe0fdff, radius: 1.5 },
    guardian_embrace: { style: 'holy', color: 0xffe56d, accent: 0xffffff, radius: 2.0 },
    blessing_resolve: { style: 'shields', color: 0x68a9ff, accent: 0xd9eaff, radius: 1.8 },
    divine_intervention: { style: 'holy', color: 0xffcf4a, accent: 0xffffff, radius: 1.75 },
    blessing_zeal: { style: 'rage', color: 0xff7257, accent: 0xffdb8c, radius: 1.6 },
    weak_point_mark: { style: 'mark', color: 0xff3c3c, accent: 0xffffff, radius: 1.25 },
    mark_weakness: { style: 'mark', color: 0xa04cff, accent: 0xf1d9ff, radius: 1.35 },
    stunned: { style: 'stars', color: 0xffdf4d, accent: 0xffffff, radius: 1.3 },
    rooted: { style: 'roots', color: 0x69a83f, accent: 0xbce77e, radius: 1.35 },
    slowed: { style: 'slow', color: 0x72cfff, accent: 0xd7f4ff, radius: 1.35 },
    frozen: { style: 'crystals', color: 0x55e8ff, accent: 0xe5fdff, radius: 1.5 },
    bleeding: { style: 'drops', color: 0xc71935, accent: 0xff7586, radius: 1.15 },
    poisoned: { style: 'orbit', color: 0x65cf36, accent: 0xd2ff8f, radius: 1.25 }
});

export const ACTOR_STATUS_VISUAL_STATES = Object.freeze({
    iron_fortress: (actor) => actor.ironFortressTimer > 0,
    guardian_roar: (actor) => actor.guardianRoarTimer > 0,
    berserker_edge: (actor) => actor.berserkerEdgeActive && actor.berserkerEdgeTimer > 0,
    last_stand: (actor) => actor.lastStandTimer > 0,
    serrated_edges: (actor) => actor.serratedEdgesActive && actor.serratedEdgesTimer > 0,
    poison_coating: (actor) => actor.poisonCoatingActive && actor.poisonCoatingTimer > 0,
    stealth: (actor) => actor.stealthTimer > 0,
    spell_focus: (actor) => actor.spellFocusActive && actor.spellFocusTimer > 0,
    arcane_shield: (actor) => Boolean(actor.arcaneShieldActive) && actor.shieldHP > 0,
    time_warp: (actor) => actor.hasteTimer > 0,
    swift: (actor) => actor.swiftBuffTimer > 0,
    guardian_embrace: (actor) => actor.guardianEmbraceActive && actor.guardianEmbraceTimer > 0,
    blessing_resolve: (actor) => actor.blessingResolveTimer > 0,
    divine_intervention: (actor) => Boolean(actor.divineInterventionActive) && actor.divineInterventionTimer > 0,
    blessing_zeal: (actor) => Math.max(actor.blessingZealTimer || 0, actor.zealTimer || 0) > 0,
    weak_point_mark: (actor) => actor.weakPointMarkTimer > 0,
    mark_weakness: (actor) => actor.markWeaknessTimer > 0,
    stunned: (actor) => actor.stunTimer > 0,
    rooted: (actor) => actor.rootTimer > 0,
    slowed: (actor) => actor.slowTimer > 0,
    frozen: (actor) => actor.frozenTimer > 0,
    bleeding: (actor) => actor.bleedTimer > 0,
    poisoned: (actor) => actor.poisonTimer > 0
});

function makeMaterial(color, opacity = 0.72) {
    return new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
}

function addRing(group, radius, color, y = 0.08, opacity = 0.68) {
    const mesh = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.78, radius, 32),
        makeMaterial(color, opacity)
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.userData.statusPart = 'ring';
    group.add(mesh);
    return mesh;
}

function addOrbiters(group, config, shape = 'orb', count = 4, height = 1.15) {
    const orbiters = [];
    for (let i = 0; i < count; i++) {
        let geometry;
        if (shape === 'shield') geometry = new THREE.BoxGeometry(0.18, 0.65, 0.72);
        else if (shape === 'blade') geometry = new THREE.ConeGeometry(0.14, 0.9, 5);
        else if (shape === 'crystal') geometry = new THREE.OctahedronGeometry(0.28, 0);
        else if (shape === 'drop') geometry = new THREE.ConeGeometry(0.16, 0.5, 8);
        else geometry = new THREE.SphereGeometry(0.18, 8, 6);
        const mesh = new THREE.Mesh(geometry, makeMaterial(i % 2 ? config.accent : config.color, 0.78));
        mesh.userData.statusPart = 'orbiter';
        mesh.userData.orbitIndex = i;
        mesh.userData.orbitCount = count;
        mesh.userData.orbitHeight = height + (i % 2) * 0.35;
        group.add(mesh);
        orbiters.push(mesh);
    }
    return orbiters;
}

function buildVisual(group, config) {
    const { style, color, accent, radius } = config;
    addRing(group, radius, color);

    if (style === 'barrier') {
        const shell = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 20, 14),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.18,
                wireframe: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        shell.position.y = 1.35;
        shell.scale.y = 1.25;
        shell.userData.statusPart = 'shell';
        group.add(shell);
        addRing(group, radius * 0.72, accent, 2.7, 0.42).rotation.x = Math.PI / 2;
    } else if (style === 'holy') {
        addRing(group, radius * 0.55, accent, 2.85, 0.75).rotation.x = Math.PI / 2;
        addOrbiters(group, config, 'orb', 4, 1.3);
    } else if (style === 'shields') {
        addOrbiters(group, config, 'shield', 4, 1.15);
    } else if (style === 'rage') {
        addOrbiters(group, config, 'blade', 6, 0.9);
    } else if (style === 'blades') {
        addOrbiters(group, config, 'blade', 5, 1.25);
    } else if (style === 'crystals') {
        addOrbiters(group, config, 'crystal', 5, 1.05);
    } else if (style === 'drops') {
        addOrbiters(group, config, 'drop', 4, 1.5);
    } else if (style === 'mark') {
        const reticle = addRing(group, radius * 0.62, accent, 2.65, 0.82);
        reticle.rotation.x = 0;
        addOrbiters(group, config, 'crystal', 3, 2.65);
    } else if (style === 'roots') {
        addOrbiters(group, config, 'blade', 7, 0.35);
    } else if (style === 'stars') {
        addOrbiters(group, config, 'crystal', 5, 2.7);
    } else if (style === 'clock') {
        addOrbiters(group, config, 'blade', 6, 0.9);
        addRing(group, radius * 0.62, accent, 0.12, 0.7);
    } else if (style === 'haste') {
        addOrbiters(group, config, 'blade', 3, 0.7);
    } else if (style === 'slow') {
        addOrbiters(group, config, 'crystal', 4, 0.55);
    } else if (style === 'shadow') {
        addOrbiters(group, config, 'orb', 7, 0.75);
    } else {
        addOrbiters(group, config, 'orb', 5, 1.0);
    }
}

export class AttachedStatusEffect {
    constructor(scene, owner, statusKey, options = {}) {
        const config = STATUS_VISUALS[statusKey];
        if (!scene || !owner || !config) {
            throw new Error(`Cannot create attached status effect: ${statusKey}`);
        }
        this.scene = scene;
        this.owner = owner;
        this.statusKey = statusKey;
        this.quality = options.quality || 'high';
        this.elapsed = 0;
        this.isActive = true;
        this.disposed = false;
        this.group = new THREE.Group();
        this.group.name = `AttachedStatusEffect:${statusKey}:${owner.id || 'actor'}`;
        this.group.userData.statusKey = statusKey;
        this.group.userData.ownerId = owner.id || null;
        buildVisual(this.group, config);
        if (this.quality === 'low') {
            this.group.children
                .filter((child) => child.userData.statusPart === 'orbiter')
                .slice(Math.ceil(this.group.children.length / 2))
                .forEach((child) => { child.visible = false; });
        }
        this.scene.add(this.group);
        this.update(0);
    }

    update(dt) {
        if (!this.isActive || this.disposed) return;
        if (this.group.parent !== this.scene) this.scene.add(this.group);
        this.elapsed += Math.max(0, Number(dt) || 0);
        const sourcePosition = this.owner.mesh?.position || this.owner.position;
        if (sourcePosition) this.group.position.copy(sourcePosition);
        const config = STATUS_VISUALS[this.statusKey];
        const pulse = 0.92 + Math.sin(this.elapsed * 4.2) * 0.08;
        this.group.children.forEach((child) => {
            const part = child.userData.statusPart;
            if (part === 'ring') {
                child.rotation.z += dt * (this.statusKey === 'time_warp' ? 2.4 : 0.55);
                child.scale.setScalar(pulse);
            } else if (part === 'shell') {
                child.rotation.y += dt * 0.45;
                child.material.opacity = 0.14 + Math.sin(this.elapsed * 3.4) * 0.04;
            } else if (part === 'orbiter') {
                const index = child.userData.orbitIndex;
                const count = child.userData.orbitCount;
                const direction = this.statusKey === 'slowed' ? -1 : 1;
                const angle = (index / count) * Math.PI * 2 + this.elapsed * direction * 1.65;
                child.position.set(
                    Math.cos(angle) * config.radius * 0.72,
                    child.userData.orbitHeight + Math.sin(this.elapsed * 3 + index) * 0.12,
                    Math.sin(angle) * config.radius * 0.72
                );
                child.rotation.y = -angle;
                child.rotation.z += dt * 1.4;
            }
        });
    }

    getMetrics() {
        let meshes = 0;
        const geometries = new Set();
        const materials = new Set();
        this.group.traverse((child) => {
            if (!child.isMesh) return;
            meshes++;
            if (child.geometry) geometries.add(child.geometry);
            if (Array.isArray(child.material)) child.material.forEach((entry) => materials.add(entry));
            else if (child.material) materials.add(child.material);
        });
        return { meshes, geometries: geometries.size, materials: materials.size };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.isActive = false;
        this.group.parent?.remove(this.group);
        const geometries = new Set();
        const materials = new Set();
        this.group.traverse((child) => {
            if (child.geometry) geometries.add(child.geometry);
            if (Array.isArray(child.material)) child.material.forEach((entry) => materials.add(entry));
            else if (child.material) materials.add(child.material);
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        this.group.clear();
    }
}

export function getStatusVisualDefinition(statusKey) {
    return STATUS_VISUALS[statusKey] || null;
}
