import * as THREE from 'three';

const GOLD = 0xffd75a;
const BOOSTED_GOLD = 0xffffff;
const VENGEFUL_GOLD = 0xffb52e;
const SANCTUARY_GOLD = 0xbfffd8;

function disposeMaterial(material) {
    if (Array.isArray(material)) {
        material.forEach((entry) => entry?.dispose?.());
        return;
    }
    material?.dispose?.();
}

function getRuneId(source) {
    return source?.skillRunes?.['Spirit Guardians'] || null;
}

/**
 * Persistent, world-space presentation for Spirit Guardians.
 *
 * Keeping the group outside the scaled/rotating GLB hierarchy makes the
 * gameplay radius legible and prevents facing changes from snapping the
 * orbit. The authoritative actor state still owns activation and duration.
 */
export class SpiritGuardiansEffect {
    constructor(scene, source, options = {}) {
        if (!scene?.add || !source?.position) {
            throw new Error('SpiritGuardiansEffect requires a scene and positioned source actor.');
        }

        this.scene = scene;
        this.source = source;
        this.group = new THREE.Group();
        this.group.name = `SpiritGuardians:${source.id || 'unknown'}`;
        this.group.userData.effectType = 'spirit_guardians';
        this.group.userData.ownerId = source.id || null;
        this.guardians = [];
        this.resources = new Set();
        this.elapsed = 0;
        this.isActive = true;
        this.quality = options.quality === 'low' ? 'low' : 'high';
        this.boosted = false;
        this.runeId = null;
        this.orbitRadius = 0;
        this.pulseRing = null;

        this.setVariant({
            boosted: Boolean(options.boosted),
            runeId: options.runeId ?? getRuneId(source)
        }, { rebuild: true });
        this.scene.add(this.group);
        this.update(0);
    }

    getGuardianCount() {
        return this.boosted ? 5 : 3;
    }

    getOrbitRadius() {
        if (this.boosted) return 4.5;
        if (this.runeId === 'spirits_expanded') return 4.2;
        return 2.8;
    }

    getColor() {
        if (this.runeId === 'spirits_vengeful') return VENGEFUL_GOLD;
        if (this.runeId === 'spirits_sanctuary') return SANCTUARY_GOLD;
        return this.boosted ? BOOSTED_GOLD : GOLD;
    }

    setVariant({ boosted = this.boosted, runeId = this.runeId } = {}, options = {}) {
        const nextBoosted = Boolean(boosted);
        const nextRuneId = runeId || null;
        const changed = nextBoosted !== this.boosted || nextRuneId !== this.runeId;

        this.boosted = nextBoosted;
        this.runeId = nextRuneId;
        this.orbitRadius = this.getOrbitRadius();
        this.group.userData.boosted = this.boosted;
        this.group.userData.runeId = this.runeId;
        this.group.userData.orbitRadius = this.orbitRadius;

        if (options.rebuild || changed) {
            this.rebuild();
        }
    }

    track(resource) {
        if (resource) this.resources.add(resource);
        return resource;
    }

    createGuardian(index, count, color) {
        const guardian = new THREE.Group();
        guardian.name = `GuardianSpirit:${index + 1}`;

        const bodyGeometry = this.track(new THREE.ConeGeometry(0.38, 1.15, this.quality === 'low' ? 7 : 12));
        const bodyMaterial = this.track(new THREE.MeshStandardMaterial({
            color,
            emissive: new THREE.Color(color),
            emissiveIntensity: this.boosted ? 1.35 : 0.9,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            roughness: 0.35,
            metalness: 0.05,
            blending: THREE.AdditiveBlending
        }));
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI;
        body.position.y = 0.25;
        guardian.add(body);

        const headGeometry = this.track(new THREE.SphereGeometry(0.25, this.quality === 'low' ? 7 : 12, this.quality === 'low' ? 5 : 9));
        const headMaterial = this.track(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.95;
        guardian.add(head);

        const haloGeometry = this.track(new THREE.TorusGeometry(0.34, 0.035, 6, this.quality === 'low' ? 12 : 20));
        const haloMaterial = this.track(new THREE.MeshBasicMaterial({
            color: this.boosted ? 0xffffff : 0xfff4a8,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        const halo = new THREE.Mesh(haloGeometry, haloMaterial);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 1.23;
        guardian.add(halo);

        guardian.userData.bodyMaterial = bodyMaterial;
        guardian.userData.headMaterial = headMaterial;
        guardian.userData.haloMaterial = haloMaterial;
        guardian.userData.phase = (index / count) * Math.PI * 2;
        return guardian;
    }

    rebuild() {
        for (const child of this.group.children.slice()) {
            this.group.remove(child);
        }
        for (const resource of this.resources) {
            if (resource?.isMaterial) disposeMaterial(resource);
            else resource?.dispose?.();
        }
        this.resources.clear();
        this.guardians = [];

        const color = this.getColor();
        const count = this.getGuardianCount();
        for (let index = 0; index < count; index += 1) {
            const guardian = this.createGuardian(index, count, color);
            this.guardians.push(guardian);
            this.group.add(guardian);
        }

        const ringGeometry = this.track(new THREE.RingGeometry(
            Math.max(0.2, this.orbitRadius - 0.22),
            this.orbitRadius + 0.22,
            this.quality === 'low' ? 32 : 64
        ));
        const ringMaterial = this.track(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.24,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this.pulseRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.pulseRing.name = 'SpiritGuardiansAura';
        this.pulseRing.rotation.x = -Math.PI / 2;
        this.pulseRing.position.y = 0.08;
        this.group.add(this.pulseRing);

        this.group.userData.guardianCount = count;
        this.group.userData.orbitRadius = this.orbitRadius;
    }

    update(dt) {
        if (!this.isActive) return;
        this.elapsed += Math.max(0, Number(dt) || 0);

        if (!this.group.parent && this.scene?.add) {
            this.scene.add(this.group);
        }

        this.group.position.copy(this.source.position);
        this.group.position.y += 0.12;
        this.group.quaternion.identity();
        this.group.visible = this.source.state !== 'DEAD' && this.source.mesh?.visible !== false;

        const speed = this.boosted ? 1.7 : 1.25;
        const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * Math.PI * 2);
        const count = Math.max(1, this.guardians.length);

        this.guardians.forEach((guardian, index) => {
            const angle = this.elapsed * speed + (index / count) * Math.PI * 2;
            const bob = Math.sin(this.elapsed * 3.1 + guardian.userData.phase) * 0.22;
            guardian.position.set(
                Math.cos(angle) * this.orbitRadius,
                1.35 + bob,
                Math.sin(angle) * this.orbitRadius
            );
            guardian.rotation.y = -angle + Math.PI / 2;
            const scale = (this.boosted ? 1.12 : 1.0) * (0.96 + pulse * 0.08);
            guardian.scale.setScalar(scale);
            guardian.userData.bodyMaterial.opacity = 0.6 + pulse * 0.18;
            guardian.userData.headMaterial.opacity = 0.76 + pulse * 0.2;
            guardian.userData.haloMaterial.opacity = 0.68 + pulse * 0.25;
        });

        if (this.pulseRing) {
            const ringPulse = 0.985 + pulse * 0.03;
            this.pulseRing.scale.setScalar(ringPulse);
            this.pulseRing.material.opacity = 0.14 + pulse * (this.boosted ? 0.22 : 0.14);
            this.pulseRing.rotation.z = this.elapsed * 0.12;
        }
    }

    getMetrics() {
        return {
            active: this.isActive,
            guardianCount: this.guardians.length,
            orbitRadius: this.orbitRadius,
            boosted: this.boosted,
            runeId: this.runeId,
            color: this.getColor(),
            attached: this.group.parent === this.scene,
            resourceCount: this.resources.size
        };
    }

    dispose() {
        if (!this.isActive) return;
        this.isActive = false;
        this.group.parent?.remove?.(this.group);
        for (const child of this.group.children.slice()) {
            this.group.remove(child);
        }
        for (const resource of this.resources) {
            if (resource?.isMaterial) disposeMaterial(resource);
            else resource?.dispose?.();
        }
        this.resources.clear();
        this.guardians = [];
        this.pulseRing = null;
    }
}
