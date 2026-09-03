import {
    PROCEDURAL_STATUS_EFFECT_DEFINITIONS,
    createProceduralStatusEffect,
    releaseProceduralStatusEffect,
    updateProceduralStatusEffect
} from '../art/ProceduralStatusEffects.js';

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

export class AttachedStatusEffect {
    constructor(scene, owner, statusKey, options = {}) {
        if (!scene || !owner || !PROCEDURAL_STATUS_EFFECT_DEFINITIONS[statusKey]) {
            throw new Error(`Cannot create attached status effect: ${statusKey}`);
        }
        this.scene = scene;
        this.owner = owner;
        this.statusKey = statusKey;
        this.quality = options.quality === 'low' ? 'low' : 'high';
        this.elapsed = 0;
        this.isActive = true;
        this.disposed = false;
        this.group = createProceduralStatusEffect(statusKey, { quality: this.quality });
        this.group.name = `AttachedStatusEffect:${statusKey}:${owner.id || 'actor'}`;
        this.group.userData.ownerId = owner.id || null;
        this.scene.add(this.group);
        this.update(0);
    }

    update(dt) {
        if (!this.isActive || this.disposed) return;
        if (this.group.parent !== this.scene) this.scene.add(this.group);
        const step = Math.max(0, Number(dt) || 0);
        this.elapsed += step;
        const sourcePosition = this.owner.mesh?.position || this.owner.position;
        if (sourcePosition) this.group.position.copy(sourcePosition);
        updateProceduralStatusEffect(this.group, this.elapsed, step);
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
        releaseProceduralStatusEffect(this.group);
    }
}

export function getStatusVisualDefinition(statusKey) {
    return PROCEDURAL_STATUS_EFFECT_DEFINITIONS[statusKey] || null;
}
