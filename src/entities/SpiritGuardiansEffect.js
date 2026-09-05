import * as THREE from 'three';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';
import { createCherubArt, createProceduralCherub } from '../art/ProceduralCherub.js';

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
        this.effectRadius = 0;
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
        // Keep the figures inside the damage edge so their bodies do not imply
        // hits beyond the authoritative boundary. The ground ring itself is
        // rendered at the exact effect radius.
        return this.effectRadius * 0.75;
    }

    getEffectRadius() {
        const skillName = this.boosted ? 'Spirit Guardians Boost' : 'Spirit Guardians';
        return getAbilityAoeRadius('Cleric', skillName, {
            skillRunes: { 'Spirit Guardians': this.runeId }
        });
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
        this.effectRadius = this.getEffectRadius();
        this.orbitRadius = this.getOrbitRadius();
        this.group.userData.boosted = this.boosted;
        this.group.userData.runeId = this.runeId;
        this.group.userData.effectRadius = this.effectRadius;
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
        this.cherubArt ||= createCherubArt((resource) => this.track(resource), this.quality, color, this.boosted);
        return createProceduralCherub(this.cherubArt, index, count);
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
        this.cherubArt = null;
        this.guardians = [];

        const color = this.getColor();
        const count = this.getGuardianCount();
        for (let index = 0; index < count; index += 1) {
            const guardian = this.createGuardian(index, count, color);
            this.guardians.push(guardian);
            this.group.add(guardian);
        }

        const ringGeometry = this.track(new THREE.RingGeometry(
            Math.max(0.2, this.effectRadius - 0.35),
            this.effectRadius,
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
        this.group.userData.effectRadius = this.effectRadius;
        this.group.userData.orbitRadius = this.orbitRadius;
    }

    update(dt) {
        if (!this.isActive) return;
        this.elapsed += Math.max(0, Number(dt) || 0);

        if (!this.group.parent && this.scene?.add) {
            this.scene.add(this.group);
        }

        this.syncToSource(false);
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
            guardian.userData.wings.forEach((wing) => {
                wing.rotation.y = wing.userData.side * (0.2 + Math.sin(this.elapsed * 7 + guardian.userData.phase) * 0.3);
            });
        });

        if (this.pulseRing) {
            // Pulse outward from the authoritative edge; never shrink the
            // visible boundary inside the actual damage radius.
            const ringPulse = 1 + pulse * 0.015;
            this.pulseRing.scale.setScalar(ringPulse);
            this.pulseRing.material.opacity = 0.14 + pulse * (this.boosted ? 0.22 : 0.14);
            this.pulseRing.rotation.z = this.elapsed * 0.12;
        }
    }

    syncToSource(useRenderedPosition = false) {
        if (!this.isActive || !this.group || !this.source?.position) return;
        const visiblePosition = useRenderedPosition && this.source.mesh?.position
            ? this.source.mesh.position
            : this.source.position;
        this.group.position.copy(visiblePosition);
        this.group.position.y += 0.12;
    }

    getMetrics() {
        return {
            active: this.isActive,
            guardianCount: this.guardians.length,
            effectRadius: this.effectRadius,
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
