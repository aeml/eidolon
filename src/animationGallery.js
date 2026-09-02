import * as THREE from 'three';
import { Fighter } from './entities/Fighter.js';
import { Rogue } from './entities/Rogue.js';
import { Wizard } from './entities/Wizard.js';
import { Cleric } from './entities/Cleric.js';
import { AvengingSeraph } from './entities/AvengingSeraph.js';
import { Actor } from './entities/Actor.js';
import { AreaOfEffect } from './entities/AreaOfEffect.js';
import { Projectile } from './entities/Projectile.js';
import { createTransientEffect } from './core/TransientEffects.js';
import { CONSTANTS } from './core/Constants.js';
import { MeshFactory } from './utils/MeshFactory.js';
import {
    PLAYER_ABILITY_VISUALS,
    getAbilityRuneVariants,
    getAbilityPresentation,
    listPlayerAbilityPresentationVariants,
    listPlayerAbilityPresentations
} from './skills/abilityVisualManifest.js';
import { ACTOR_ANIMATION_MANIFEST, listActorAnimationEntries } from './entities/actorAnimationManifest.js';
import { BASE_ITEMS } from './core/ItemSystem.js';
import {
    EQUIPMENT_RENDER_SLOTS,
    EQUIPMENT_VISUAL_DESCRIPTORS
} from './art/ProceduralEquipment.js';

const PLAYER_TYPES = Object.freeze({ Fighter, Rogue, Wizard, Cleric });
const PLAYER_TYPE_NAMES = Object.freeze(Object.keys(PLAYER_TYPES));
const TARGET_POSITION = new THREE.Vector3(0, 0, 5.5);
const EQUIPPABLE_BASE_ITEMS = Object.freeze(BASE_ITEMS.filter((item) => EQUIPMENT_VISUAL_DESCRIPTORS[item.name]));
const FIGHTER_SHOWCASE_LOADOUT = Object.freeze({
    head: 'Iron Helm',
    shoulders: 'Steel Pauldrons',
    chest: 'Plate Mail',
    gloves: 'Iron Gauntlets',
    belt: 'Plated Girdle',
    legs: 'Plate Greaves',
    feet: 'Iron Boots',
    neck: 'Necklace',
    ring1: 'Ruby Ring',
    ring2: 'Silver Ring',
    trinket1: 'Amulet of Power',
    trinket2: 'Orb of Mana',
    mainHand: 'Iron Sword',
    offHand: 'Wooden Shield'
});
const SET_EQUIPMENT_SLOTS = new Set(['head', 'shoulders', 'chest', 'gloves', 'legs', 'feet']);
const UNIQUE_EFFECT_IDS = Object.freeze([
    'vampiric', 'efficient', 'lucky', 'explosive', 'swift',
    'thorns', 'berserker', 'guardian', 'executioner', 'regenerative'
]);

const PERSISTENT_STATE_APPLIERS = Object.freeze({
    iron_fortress: (actor) => { actor.ironFortressTimer = 8; },
    guardian_roar: (actor) => { actor.guardianRoarTimer = 8; },
    berserker_edge: (actor) => { actor.berserkerEdgeActive = true; actor.berserkerEdgeTimer = 8; },
    last_stand: (actor) => { actor.lastStandTimer = 8; },
    weak_point_mark: (_actor, target) => { target.weakPointMarkTimer = 8; },
    serrated_edges: (actor) => { actor.serratedEdgesActive = true; actor.serratedEdgesTimer = 8; },
    poison_coating: (actor) => { actor.poisonCoatingActive = true; actor.poisonCoatingTimer = 8; },
    stealth: (actor) => { actor.stealthTimer = 8; },
    spell_focus: (actor) => { actor.spellFocusActive = true; actor.spellFocusTimer = 8; },
    arcane_shield: (actor) => {
        actor.arcaneShieldActive = true;
        actor.arcaneShieldTimer = 8;
        actor.shieldHP = 100;
    },
    time_warp: (actor) => { actor.hasteTimer = 8; actor.hasteFactor = 0.5; },
    guardian_embrace: (actor) => { actor.guardianEmbraceActive = true; actor.guardianEmbraceTimer = 8; },
    divine_intervention: (_actor, target) => {
        target.divineInterventionActive = true;
        target.divineInterventionTimer = 8;
    },
    blessing_resolve: (actor) => { actor.blessingResolveTimer = 8; },
    blessing_zeal: (actor) => { actor.blessingZealTimer = 8; actor.blessingZealFactor = 0.35; },
    mark_weakness: (_actor, target) => { target.markWeaknessTimer = 8; },
    heavens_trumpet: (_actor, target) => { target.stunTimer = 5; target.markWeaknessTimer = 5; }
});

function countSceneMetrics(root) {
    let nodes = 0;
    let visibleMeshes = 0;
    let nonFiniteTransforms = 0;
    root?.traverse?.((child) => {
        nodes++;
        if (child.isMesh && child.visible) visibleMeshes++;
        const values = [
            child.position?.x, child.position?.y, child.position?.z,
            child.scale?.x, child.scale?.y, child.scale?.z,
            child.quaternion?.x, child.quaternion?.y, child.quaternion?.z, child.quaternion?.w
        ].filter((value) => value !== undefined);
        if (values.some((value) => !Number.isFinite(value))) nonFiniteTransforms++;
    });
    return { nodes, visibleMeshes, nonFiniteTransforms };
}

function countEquipmentIdentityRegions(root, identityField) {
    let count = 0;
    root?.traverse?.((child) => {
        if (child.userData?.equipmentVisual && child.userData[identityField]) count++;
    });
    return count;
}

function makeActor(type, id) {
    const PlayerClass = PLAYER_TYPES[type];
    if (PlayerClass) return new PlayerClass(id);
    const actor = new Actor(id, CONSTANTS.ENTITIES.FIGHTER);
    actor.meshType = type;
    actor.isRunning = false;
    return actor;
}

function clearActorStatusState(actor) {
    if (!actor) return;
    actor.ironFortressTimer = 0;
    actor.berserkerEdgeActive = false;
    actor.berserkerEdgeTimer = 0;
    actor.lastStandTimer = 0;
    actor.weakPointMarkTimer = 0;
    actor.serratedEdgesActive = false;
    actor.serratedEdgesTimer = 0;
    actor.poisonCoatingActive = false;
    actor.poisonCoatingTimer = 0;
    actor.stealthTimer = 0;
    actor.spellFocusActive = false;
    actor.spellFocusTimer = 0;
    actor.arcaneShieldActive = false;
    actor.arcaneShieldTimer = 0;
    actor.shieldHP = 0;
    actor.hasteTimer = 0;
    actor.hasteFactor = 0;
    actor.guardianEmbraceActive = false;
    actor.guardianEmbraceTimer = 0;
    actor.divineInterventionActive = false;
    actor.divineInterventionTimer = 0;
    actor.blessingResolveTimer = 0;
    actor.blessingZealTimer = 0;
    actor.markWeaknessTimer = 0;
    actor.stunTimer = 0;
    actor.spiritsActive = false;
    actor.spiritDuration = 0;
    actor.clearSpiritMeshes?.();
    actor.clearAttachedStatusEffects?.();
}

export class AnimationGallery {
    constructor(renderSystem, controls, setReadout) {
        this.renderSystem = renderSystem;
        this.controls = controls;
        this.setReadout = setReadout;
        this.group = new THREE.Group();
        this.group.name = 'AnimationGallery';
        this.renderSystem.scene.add(this.group);
        this.effects = [];
        this.persistentEntities = [];
        this.actor = null;
        this.remoteActor = null;
        this.targetActor = null;
        this.currentClass = 'Cleric';
        this.currentAbility = 'Spirit Guardians';
        this.currentActorType = 'Cleric';
        this.currentState = 'Idle';
        this.currentRuneId = null;
        this.phase = 'ready';
        this.jumpElapsed = 0;
        this.jumpDuration = 0;
        this.loadSequence = 0;
        this.presentationSequence = 0;
        this.auditRunning = false;
        this.auditResults = [];
        this.equipmentAuditResults = [];
        this.equipmentAuditRunning = false;
        this.currentEquipmentName = EQUIPPABLE_BASE_ITEMS[0]?.name || '';
        this.framingMode = null;
        this.lastError = null;
        this.createdEffects = 0;
        this.disposedEffects = 0;
        this.bindElements();
        this.populateControls();
        this.bindEvents();
    }

    bindElements() {
        this.panel = document.getElementById('animation-gallery');
        this.classSelect = document.getElementById('gallery-class');
        this.abilitySelect = document.getElementById('gallery-ability');
        this.runeSelect = document.getElementById('gallery-rune');
        this.actorSelect = document.getElementById('gallery-actor');
        this.stateSelect = document.getElementById('gallery-state');
        this.qualitySelect = document.getElementById('gallery-quality');
        this.remoteCheckbox = document.getElementById('gallery-remote');
        this.status = document.getElementById('gallery-status');
        this.coverage = document.getElementById('gallery-coverage');
        this.castButton = document.getElementById('gallery-cast');
        this.persistButton = document.getElementById('gallery-persist');
        this.cleanupButton = document.getElementById('gallery-cleanup');
        this.nextButton = document.getElementById('gallery-next');
        this.playStateButton = document.getElementById('gallery-play-state');
        this.runAllButton = document.getElementById('gallery-run-all');
        this.equipmentSelect = document.getElementById('gallery-equipment');
        this.equipButton = document.getElementById('gallery-equip');
        this.equipAllButton = document.getElementById('gallery-equip-all');
        this.runEquipmentButton = document.getElementById('gallery-run-equipment');
    }

    populateControls() {
        PLAYER_TYPE_NAMES.forEach((className) => this.classSelect.add(new Option(className, className)));
        listActorAnimationEntries().forEach(({ type, category }) => {
            this.actorSelect.add(new Option(`${type} · ${category}`, type));
        });
        ['Idle', 'Walk', 'Run', 'Attack', 'Jump', 'Death'].forEach((state) => {
            this.stateSelect.add(new Option(state, state));
        });
        EQUIPPABLE_BASE_ITEMS.forEach((item) => {
            const visual = EQUIPMENT_VISUAL_DESCRIPTORS[item.name];
            this.equipmentSelect.add(new Option(`${item.name} · ${visual.slot}`, item.name));
        });
        this.classSelect.value = this.currentClass;
        this.actorSelect.value = this.currentActorType;
        this.refreshAbilityOptions();
        this.refreshRuneOptions();
        this.updateCoverageLabel();
    }

    refreshAbilityOptions() {
        this.abilitySelect.replaceChildren();
        Object.keys(PLAYER_ABILITY_VISUALS[this.currentClass]).forEach((skillName) => {
            this.abilitySelect.add(new Option(skillName, skillName));
        });
        if (!PLAYER_ABILITY_VISUALS[this.currentClass][this.currentAbility]) {
            this.currentAbility = this.abilitySelect.options[0]?.value || '';
        }
        this.abilitySelect.value = this.currentAbility;
    }

    refreshRuneOptions() {
        this.runeSelect.replaceChildren(new Option('Base / no rune', ''));
        getAbilityRuneVariants(this.currentClass, this.currentAbility).forEach((rune) => {
            this.runeSelect.add(new Option(`${rune.name} · ${rune.id}`, rune.id));
        });
        if (![...this.runeSelect.options].some((option) => option.value === this.currentRuneId)) {
            this.currentRuneId = null;
        }
        this.runeSelect.value = this.currentRuneId || '';
    }

    bindEvents() {
        this.classSelect.addEventListener('change', async () => {
            this.currentClass = this.classSelect.value;
            this.currentAbility = Object.keys(PLAYER_ABILITY_VISUALS[this.currentClass])[0];
            this.currentActorType = this.currentClass;
            this.actorSelect.value = this.currentClass;
            this.refreshAbilityOptions();
            this.currentRuneId = null;
            this.refreshRuneOptions();
            await this.loadActors(this.currentClass);
            this.presentAbility('cast');
        });
        this.abilitySelect.addEventListener('change', () => {
            this.currentAbility = this.abilitySelect.value;
            this.currentRuneId = null;
            this.refreshRuneOptions();
            this.presentAbility('cast');
        });
        this.runeSelect.addEventListener('change', () => {
            this.currentRuneId = this.runeSelect.value || null;
            this.presentAbility(this.phase === 'persistent' ? 'persistent' : 'cast');
        });
        this.actorSelect.addEventListener('change', async () => {
            this.currentActorType = this.actorSelect.value;
            await this.loadActors(this.currentActorType);
            this.playActorState(this.currentState);
        });
        this.stateSelect.addEventListener('change', () => {
            this.currentState = this.stateSelect.value;
            this.playActorState(this.currentState);
        });
        this.qualitySelect.addEventListener('change', () => {
            this.renderSystem.setGraphicsQuality(this.qualitySelect.value);
            this.presentAbility(this.phase === 'persistent' ? 'persistent' : 'cast');
        });
        this.remoteCheckbox.addEventListener('change', async () => {
            await this.loadActors(this.currentActorType);
            this.presentAbility('cast');
        });
        this.castButton.addEventListener('click', () => this.presentAbility('cast'));
        this.persistButton.addEventListener('click', () => this.presentAbility('persistent'));
        this.cleanupButton.addEventListener('click', () => this.cleanupPresentation());
        this.nextButton.addEventListener('click', () => this.nextAbility());
        this.playStateButton.addEventListener('click', () => this.playActorState(this.stateSelect.value));
        this.runAllButton.addEventListener('click', () => this.runAbilityAudit());
        this.equipmentSelect.addEventListener('change', async () => {
            this.currentEquipmentName = this.equipmentSelect.value;
            await this.ensureFighterEquipmentActors();
            this.presentEquipment(this.currentEquipmentName);
        });
        this.equipButton.addEventListener('click', async () => {
            await this.ensureFighterEquipmentActors();
            this.presentEquipment(this.equipmentSelect.value);
        });
        this.equipAllButton.addEventListener('click', async () => {
            await this.ensureFighterEquipmentActors();
            this.presentEquipmentLoadout();
        });
        this.runEquipmentButton.addEventListener('click', () => this.runEquipmentAudit());
    }

    makePreviewEngine() {
        return {
            renderSystem: this.renderSystem,
            effectScene: this.renderSystem.effectGroup,
            scene: this.renderSystem.scene,
            uiManager: { getGraphicsQuality: () => this.renderSystem.graphicsQuality },
            spawnTransientEffect: (type, position, color, options = {}) => {
                const effect = createTransientEffect(
                    this.renderSystem.effectGroup,
                    type,
                    position,
                    color,
                    { ...options, quality: this.renderSystem.graphicsQuality }
                );
                if (!effect) return false;
                this.effects.push(effect);
                this.createdEffects++;
                return true;
            },
            addEntity: (entity) => {
                entity.gameEngine = this.makePreviewEngine();
                this.persistentEntities.push(entity);
                if (entity.mesh) this.group.add(entity.mesh);
            },
            getUniqueId: () => `gallery-${crypto.randomUUID()}`,
            chunkManager: { getActiveEntities: () => [this.actor, this.remoteActor, this.targetActor].filter(Boolean) },
            floatingTextManager: { spawn: () => {} },
            isMultiplayer: false
        };
    }

    async loadActors(type = this.currentActorType) {
        const sequence = ++this.loadSequence;
        this.cleanupPresentation();
        [this.actor, this.remoteActor, this.targetActor].forEach((actor) => actor?.dispose?.());
        this.actor = null;
        this.remoteActor = null;
        this.targetActor = null;
        this.setStatus(`Loading ${type} production mesh…`, 'loading');

        try {
            const actor = makeActor(type, `gallery-${type}-local`);
            actor.gameEngine = this.makePreviewEngine();
            const mesh = await MeshFactory.createMeshForType(type);
            if (sequence !== this.loadSequence) {
                MeshFactory.releaseMesh(type, mesh);
                return false;
            }
            actor.setMesh(mesh);
            actor.position.set(-2.8, 0, 0);
            actor.render(1);
            this.group.add(actor.mesh);
            this.actor = actor;

            const target = makeActor(type, `gallery-${type}-target`);
            target.gameEngine = this.makePreviewEngine();
            const targetMesh = await MeshFactory.createMeshForType(type);
            target.setMesh(targetMesh);
            target.position.copy(TARGET_POSITION);
            target.render(1);
            target.mesh.scale.multiplyScalar(0.82);
            this.group.add(target.mesh);
            this.targetActor = target;

            if (this.remoteCheckbox.checked) {
                const remote = makeActor(type, `gallery-${type}-remote`);
                remote.gameEngine = this.makePreviewEngine();
                remote.isRemote = true;
                const remoteMesh = await MeshFactory.createMeshForType(type);
                remote.setMesh(remoteMesh);
                remote.position.set(2.8, 0, 0);
                remote.render(1);
                this.group.add(remote.mesh);
                this.remoteActor = remote;
            }

            this.framingMode = null;
            this.framePresentation(false);
            this.setStatus(`${type} loaded`, 'ready');
            this.updateMetrics();
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error);
            this.setStatus(`FAILED: ${this.lastError}`, 'failed');
            return false;
        }
    }

    async ensureFighterEquipmentActors() {
        if (this.currentActorType === 'Fighter' && this.actor?.mesh?.userData?.proceduralHumanoid) return true;
        this.currentActorType = 'Fighter';
        this.actorSelect.value = 'Fighter';
        return this.loadActors('Fighter');
    }

    framePresentation(equipment = false) {
        const mode = equipment ? 'equipment' : 'presentation';
        if (this.targetActor?.mesh) this.targetActor.mesh.visible = !equipment;
        if (equipment) {
            const centerX = this.remoteActor ? 2 : 0;
            this.actor?.position.set(0, 0, 0);
            this.remoteActor?.position.set(4, 0, 0);
            this.controls.target.set(centerX, 1.7, 0);
            this.renderSystem.camera.position.set(centerX, 9, 9);
            if (this.framingMode !== mode) this.renderSystem.setZoom(7);
        } else {
            this.actor?.position.set(-2.8, 0, 0);
            this.remoteActor?.position.set(2.8, 0, 0);
            this.controls.target.set(0, 1.2, 1.8);
            this.renderSystem.camera.position.set(13, 11, 18);
            if (this.framingMode !== mode) this.renderSystem.setZoom(CONSTANTS.CAMERA.ZOOM);
        }
        this.framingMode = mode;
        this.controls.update();
    }

    createGalleryEquipmentItem(baseItem, renderSlot, index = 0) {
        const rarities = ['Common', 'Uncommon', 'Rare', 'Legendary'];
        const gemTypes = ['Ruby', 'Sapphire', 'Emerald', 'Topaz', 'Diamond', 'Onyx', 'Opal'];
        return {
            id: `gallery-${renderSlot}-${baseItem.name.toLowerCase().replaceAll(' ', '-')}`,
            name: baseItem.name,
            baseName: baseItem.name,
            type: baseItem.type,
            slot: baseItem.slot,
            rarity: rarities[index % rarities.length],
            level: 1 + index * 9,
            potency: index % 6,
            sockets: index % 3,
            gems: index % 3 > 0
                ? [{ type: gemTypes[index % gemTypes.length], quality: 'Flawless' }]
                : [],
            setId: SET_EQUIPMENT_SLOTS.has(renderSlot)
                ? (index % 2 === 0 ? 'warlord_fury' : 'bulwark_ages')
                : '',
            uniqueEffect: UNIQUE_EFFECT_IDS[index % UNIQUE_EFFECT_IDS.length],
            statScaleVersion: 1
        };
    }

    getRenderSlot(baseItem, occurrence = 0) {
        if (baseItem.slot === 'ring') return occurrence % 2 === 0 ? 'ring1' : 'ring2';
        if (baseItem.slot === 'trinket') return occurrence % 2 === 0 ? 'trinket1' : 'trinket2';
        return baseItem.slot;
    }

    presentEquipment(baseName = this.currentEquipmentName) {
        if (!this.actor?.mesh?.userData?.proceduralHumanoid) return false;
        const baseItem = EQUIPPABLE_BASE_ITEMS.find((item) => item.name === baseName);
        if (!baseItem) return false;
        const renderSlot = this.getRenderSlot(baseItem);
        const item = this.createGalleryEquipmentItem(baseItem, renderSlot, EQUIPPABLE_BASE_ITEMS.indexOf(baseItem));
        this.currentEquipmentName = baseItem.name;
        this.equipmentSelect.value = baseItem.name;
        this.actor.syncEquipmentVisuals({ [renderSlot]: item }, { force: true });
        this.remoteActor?.syncEquipmentVisuals({
            [renderSlot]: { ...item, id: `${item.id}-remote` }
        }, { force: true });
        this.targetActor?.syncEquipmentVisuals({}, { force: true });
        this.framePresentation(true);
        this.phase = `equipment:${baseItem.name}`;
        this.setStatus(`${baseItem.name} · ${renderSlot} · local + replicated`, 'playing');
        this.updateMetrics();
        return true;
    }

    presentEquipmentLoadout() {
        if (!this.actor?.mesh?.userData?.proceduralHumanoid) return false;
        const equipment = {};
        EQUIPMENT_RENDER_SLOTS.forEach((renderSlot, index) => {
            const baseItem = EQUIPPABLE_BASE_ITEMS.find((item) => item.name === FIGHTER_SHOWCASE_LOADOUT[renderSlot]);
            equipment[renderSlot] = this.createGalleryEquipmentItem(baseItem, renderSlot, index + 1);
        });
        this.actor.syncEquipmentVisuals(equipment, { force: true });
        this.remoteActor?.syncEquipmentVisuals(Object.fromEntries(
            Object.entries(equipment).map(([slot, item]) => [slot, { ...item, id: `${item.id}-remote` }])
        ), { force: true });
        this.targetActor?.syncEquipmentVisuals({}, { force: true });
        this.framePresentation(true);
        this.currentEquipmentName = 'Full 14-slot loadout';
        this.phase = 'equipment:full-loadout';
        this.setStatus('Full 14-slot Fighter loadout · local + replicated', 'playing');
        this.updateMetrics();
        return true;
    }

    async runEquipmentAudit() {
        if (this.equipmentAuditRunning) return;
        this.equipmentAuditRunning = true;
        this.equipmentAuditResults = [];
        this.runEquipmentButton.disabled = true;
        await this.ensureFighterEquipmentActors();
        for (let index = 0; index < EQUIPPABLE_BASE_ITEMS.length; index++) {
            const baseItem = EQUIPPABLE_BASE_ITEMS[index];
            const rendered = this.presentEquipment(baseItem.name);
            await new Promise((resolve) => setTimeout(resolve, 45));
            const metrics = this.updateMetrics();
            const passed = Boolean(
                rendered &&
                metrics.equipmentLocalItems === 1 &&
                (!this.remoteActor || metrics.equipmentRemoteItems === 1) &&
                metrics.equipmentLocalParts > 0 &&
                metrics.nonFiniteTransforms === 0
            );
            this.equipmentAuditResults.push({ baseName: baseItem.name, passed, metrics });
            this.coverage.textContent = `Equipment audit ${index + 1}/${EQUIPPABLE_BASE_ITEMS.length}`;
        }
        this.equipmentAuditRunning = false;
        this.runEquipmentButton.disabled = false;
        const passed = this.equipmentAuditResults.filter((entry) => entry.passed).length;
        if (passed === EQUIPPABLE_BASE_ITEMS.length) this.presentEquipmentLoadout();
        this.coverage.textContent = `${passed}/${EQUIPPABLE_BASE_ITEMS.length} equipment families passed`;
        this.setStatus(
            passed === EQUIPPABLE_BASE_ITEMS.length
                ? 'All equipment families passed · full loadout shown'
                : `${EQUIPPABLE_BASE_ITEMS.length - passed} equipment families failed`,
            passed === EQUIPPABLE_BASE_ITEMS.length ? 'passed' : 'failed'
        );
        this.updateMetrics();
    }

    clearEffects() {
        this.effects.forEach((effect) => {
            if (effect.isActive || effect.meshes?.length) {
                effect.dispose();
                this.disposedEffects++;
            }
            effect.isActive = false;
        });
        this.effects.length = 0;
        this.persistentEntities.forEach((entity) => {
            entity.isActive = false;
            entity.dispose?.();
            entity.mesh?.parent?.remove?.(entity.mesh);
        });
        this.persistentEntities.length = 0;
    }

    async activatePersistentPresentation(actor, target, presentation, sequence) {
        const stateKey = presentation?.persistentState;
        if (!stateKey) return;
        if (stateKey === 'spirit_guardians' || stateKey === 'spirit_guardians_boost') {
            actor.spiritsActive = true;
            actor.spiritBoosted = stateKey.endsWith('_boost');
            actor.spiritDuration = 8;
            actor.createSpirits?.(actor.gameEngine);
            return;
        }

        if (stateKey === 'avenging_seraph') {
            const seraph = new AvengingSeraph(`gallery-seraph-${crypto.randomUUID()}`);
            seraph.gameEngine = actor.gameEngine;
            const mesh = await MeshFactory.createMeshForType('AvengingSeraph');
            if (sequence !== this.presentationSequence) {
                MeshFactory.releaseMesh('AvengingSeraph', mesh);
                seraph.isActive = false;
                return;
            }
            seraph.setMesh(mesh);
            seraph.position.copy(actor.position).add(new THREE.Vector3(0, 0, 2.6));
            seraph.state = 'IDLE';
            seraph.playAnimation('Idle', true, true);
            actor.gameEngine.addEntity(seraph);
            return;
        }

        const applyState = PERSISTENT_STATE_APPLIERS[stateKey];
        applyState?.(actor, target);
        actor.syncAttachedStatusEffects?.(0);
        target?.syncAttachedStatusEffects?.(0);

        const engine = actor.gameEngine;
        if (stateKey === 'inferno_cataclysm') {
            engine.addEntity(new Projectile('gallery-inferno-zone', actor, 'ZoneDamage', TARGET_POSITION, TARGET_POSITION));
        } else if (stateKey === 'consecrated_ground') {
            engine.addEntity(new Projectile('gallery-holy-zone', actor, 'ZoneHoly', TARGET_POSITION, TARGET_POSITION));
        } else if (stateKey === 'tripwire') {
            engine.addEntity(new Projectile('gallery-tripwire', actor, 'Tripwire', TARGET_POSITION, TARGET_POSITION));
        } else if (stateKey === 'gravity_well' || stateKey === 'smoke_bomb') {
            engine.addEntity(new AreaOfEffect(engine, actor, TARGET_POSITION, {
                radius: stateKey === 'gravity_well' ? 5 : 4,
                duration: 8,
                color: stateKey === 'gravity_well' ? 0x5a2790 : 0x4f5663,
                visualType: stateKey === 'gravity_well' ? 'ring' : 'sphere',
                damage: 0,
                isHostile: false
            }));
        }
    }

    async presentAbility(phase = 'cast') {
        if (!this.actor || !PLAYER_TYPE_NAMES.includes(this.currentClass)) return false;
        this.framePresentation(false);
        const sequence = ++this.presentationSequence;
        this.clearEffects();
        clearActorStatusState(this.actor);
        clearActorStatusState(this.remoteActor);
        clearActorStatusState(this.targetActor);
        const presentation = getAbilityPresentation(this.currentClass, this.currentAbility);
        if (!presentation) {
            this.setStatus(`FAILED: unclassified ${this.currentClass}/${this.currentAbility}`, 'failed');
            return false;
        }

        this.phase = phase;
        [this.actor, this.remoteActor].filter(Boolean).forEach((actor) => {
            actor.skillRunes ||= {};
            if (this.currentRuneId) actor.skillRunes[this.currentAbility] = this.currentRuneId;
            else delete actor.skillRunes[this.currentAbility];
        });
        this.actor.state = 'IDLE';
        this.actor.playAbilityAnimation(this.currentAbility);
        this.actor.spawnAbilityPresentation(this.actor.gameEngine, this.currentAbility, TARGET_POSITION);
        if (this.remoteActor) {
            this.remoteActor.state = 'IDLE';
            this.remoteActor.playAbilityAnimation(this.currentAbility);
            this.remoteActor.spawnAbilityPresentation(this.remoteActor.gameEngine, this.currentAbility, TARGET_POSITION);
        }
        if (phase === 'persistent' || presentation.persistentState) {
            const activations = [this.activatePersistentPresentation(this.actor, this.targetActor, presentation, sequence)];
            if (this.remoteActor) {
                activations.push(this.activatePersistentPresentation(this.remoteActor, this.targetActor, presentation, sequence));
            }
            await Promise.all(activations);
            this.phase = 'persistent';
        }
        this.setStatus(`${this.currentClass} · ${this.currentAbility} · ${this.phase}`, 'playing');
        this.updateMetrics();
        return true;
    }

    cleanupPresentation() {
        this.presentationSequence++;
        this.clearEffects();
        clearActorStatusState(this.actor);
        clearActorStatusState(this.remoteActor);
        clearActorStatusState(this.targetActor);
        [this.actor, this.remoteActor, this.targetActor].forEach((actor) => {
            if (!actor || actor.state === 'DEAD') return;
            actor.state = 'IDLE';
            actor.restoreAnimationForState?.(true);
        });
        this.phase = 'cleanup';
        this.setStatus('Presentation cleaned up', 'ready');
        this.updateMetrics();
    }

    nextAbility() {
        const names = Object.keys(PLAYER_ABILITY_VISUALS[this.currentClass]);
        const index = names.indexOf(this.currentAbility);
        this.currentAbility = names[(index + 1) % names.length];
        this.currentRuneId = null;
        this.abilitySelect.value = this.currentAbility;
        this.refreshRuneOptions();
        this.presentAbility('cast');
    }

    playActorState(state) {
        if (!this.actor) return false;
        this.framePresentation(false);
        this.cleanupPresentation();
        this.currentState = state;
        const declared = ACTOR_ANIMATION_MANIFEST[this.currentActorType];
        if (state !== 'Jump' && !declared?.states.includes(state)) {
            this.setStatus(`${this.currentActorType}: ${state} intentionally unavailable`, 'limited');
            return false;
        }
        if (state === 'Jump') {
            if (declared?.jump === 'not-used') {
                this.setStatus(`${this.currentActorType}: jump not used`, 'limited');
                return false;
            }
            this.actor.state = 'JUMPING';
            this.jumpElapsed = 0;
            this.jumpDuration = 1.0;
            this.actor.playJumpAnimation({ duration: this.jumpDuration, progress: 0 });
        } else {
            this.actor.state = state === 'Death' ? 'DEAD' : (state === 'Idle' ? 'IDLE' : (state === 'Attack' ? 'ATTACKING' : 'MOVING'));
            this.actor.isRunning = state === 'Run';
            this.actor.playAnimation(state, !['Attack', 'Death'].includes(state), true);
        }
        this.phase = `state:${state.toLowerCase()}`;
        this.setStatus(`${this.currentActorType} · ${state}`, 'playing');
        this.updateMetrics();
        return true;
    }

    async runAbilityAudit() {
        if (this.auditRunning) return;
        this.auditRunning = true;
        this.auditResults = [];
        this.runAllButton.disabled = true;
        const inventory = listPlayerAbilityPresentationVariants();
        for (let index = 0; index < inventory.length; index++) {
            const entry = inventory[index];
            if (entry.className !== this.currentClass || this.currentActorType !== entry.className) {
                this.currentClass = entry.className;
                this.currentActorType = entry.className;
                this.classSelect.value = entry.className;
                this.actorSelect.value = entry.className;
                this.refreshAbilityOptions();
                await this.loadActors(entry.className);
            }
            this.currentAbility = entry.skillName;
            this.currentRuneId = entry.runeId;
            this.abilitySelect.value = entry.skillName;
            this.refreshRuneOptions();
            const played = await this.presentAbility(entry.persistentState ? 'persistent' : 'cast');
            await new Promise((resolve) => setTimeout(resolve, 110));
            const metrics = this.updateMetrics();
            const passed = Boolean(
                played &&
                metrics.actorVisibleMeshes > 0 &&
                metrics.effectVisibleMeshes > 0 &&
                metrics.nonFiniteTransforms === 0 &&
                metrics.clipNames.includes(this.actor.currentAnimationName)
            );
            this.auditResults.push({
                className: entry.className,
                skillName: entry.skillName,
                runeId: entry.runeId,
                runeName: entry.runeName,
                persistent: Boolean(entry.persistentState),
                passed,
                metrics
            });
            this.coverage.textContent = `Ability audit ${index + 1}/${inventory.length}`;
            this.cleanupPresentation();
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        this.auditRunning = false;
        this.runAllButton.disabled = false;
        const passed = this.auditResults.filter((entry) => entry.passed).length;
        this.coverage.textContent = `${passed}/${inventory.length} ability presentations passed`;
        this.setStatus(
            passed === inventory.length ? 'All ability presentations passed' : `${inventory.length - passed} presentations failed`,
            passed === inventory.length ? 'passed' : 'failed'
        );
        this.updateMetrics();
    }

    setStatus(text, state) {
        if (!this.status) return;
        this.status.textContent = text;
        this.status.dataset.state = state;
        this.setReadout?.(`Animation gallery\n${text}`);
    }

    updateMetrics() {
        const actorMetrics = countSceneMetrics(this.actor?.mesh);
        const remoteMetrics = countSceneMetrics(this.remoteActor?.mesh);
        const targetMetrics = countSceneMetrics(this.targetActor?.mesh);
        const effectMetrics = countSceneMetrics(this.renderSystem.effectGroup);
        const persistentMetrics = this.persistentEntities.reduce((total, entity) => {
            const metrics = countSceneMetrics(entity.mesh);
            total.nodes += metrics.nodes;
            total.visibleMeshes += metrics.visibleMeshes;
            total.nonFiniteTransforms += metrics.nonFiniteTransforms;
            return total;
        }, { nodes: 0, visibleMeshes: 0, nonFiniteTransforms: 0 });
        const metrics = {
            ready: Boolean(this.actor?.mesh),
            className: this.currentClass,
            abilityName: this.currentAbility,
            runeId: this.currentRuneId,
            actorType: this.currentActorType,
            actorState: this.currentState,
            phase: this.phase,
            quality: this.renderSystem.graphicsQuality,
            remote: Boolean(this.remoteActor),
            clipNames: Object.keys(this.actor?.animations || {}),
            currentAnimation: this.actor?.currentAnimationName || null,
            proceduralHumanoid: Boolean(this.actor?.mesh?.userData?.proceduralHumanoid),
            proceduralClass: this.actor?.mesh?.userData?.proceduralClass || null,
            equipmentAnchorCount: Object.values(this.actor?.mesh?.userData?.equipmentAnchors || {})
                .reduce((count, names) => count + names.length, 0),
            equipmentName: this.currentEquipmentName,
            equipmentLocalItems: this.actor?.mesh?.userData?.equipmentVisualItemCount || 0,
            equipmentLocalParts: this.actor?.mesh?.userData?.equipmentVisualPartCount || 0,
            equipmentRemoteItems: this.remoteActor?.mesh?.userData?.equipmentVisualItemCount || 0,
            equipmentRemoteParts: this.remoteActor?.mesh?.userData?.equipmentVisualPartCount || 0,
            equipmentLocalSetRegions: countEquipmentIdentityRegions(this.actor?.mesh, 'setId'),
            equipmentRemoteSetRegions: countEquipmentIdentityRegions(this.remoteActor?.mesh, 'setId'),
            equipmentLocalUniqueRegions: countEquipmentIdentityRegions(this.actor?.mesh, 'uniqueEffect'),
            equipmentRemoteUniqueRegions: countEquipmentIdentityRegions(this.remoteActor?.mesh, 'uniqueEffect'),
            actorVisibleMeshes: actorMetrics.visibleMeshes,
            remoteVisibleMeshes: remoteMetrics.visibleMeshes,
            targetVisibleMeshes: targetMetrics.visibleMeshes,
            effectVisibleMeshes: effectMetrics.visibleMeshes + persistentMetrics.visibleMeshes,
            effectNodes: effectMetrics.nodes + persistentMetrics.nodes,
            nonFiniteTransforms: actorMetrics.nonFiniteTransforms + remoteMetrics.nonFiniteTransforms +
                targetMetrics.nonFiniteTransforms + effectMetrics.nonFiniteTransforms + persistentMetrics.nonFiniteTransforms,
            activeTransientEffects: this.effects.filter((effect) => effect.isActive).length,
            persistentEntities: this.persistentEntities.length,
            attachedEffects: (this.actor?.attachedStatusEffects?.size || 0) +
                (this.remoteActor?.attachedStatusEffects?.size || 0) +
                (this.targetActor?.attachedStatusEffects?.size || 0),
            spiritGuardians: (this.actor?.spiritEffect?.guardians?.length || 0) +
                (this.remoteActor?.spiritEffect?.guardians?.length || 0),
            spiritVariants: [this.actor, this.remoteActor]
                .filter((actor) => actor?.spiritEffect?.isActive)
                .map((actor) => actor.spiritEffect.getMetrics()),
            createdEffects: this.createdEffects,
            disposedEffects: this.disposedEffects,
            auditCompleted: this.auditResults.length,
            auditPassed: this.auditResults.filter((entry) => entry.passed).length,
            auditRunning: this.auditRunning,
            equipmentAuditCompleted: this.equipmentAuditResults.length,
            equipmentAuditPassed: this.equipmentAuditResults.filter((entry) => entry.passed).length,
            equipmentAuditRunning: this.equipmentAuditRunning,
            error: this.lastError
        };
        window.__eidolonAnimationGallery = metrics;
        return metrics;
    }

    update(dt) {
        this.effects.forEach((effect) => effect.update(dt));
        const inactive = this.effects.filter((effect) => !effect.isActive);
        this.disposedEffects += inactive.length;
        this.effects = this.effects.filter((effect) => effect.isActive);
        this.persistentEntities.forEach((entity) => {
            entity.update?.(dt, null, null, { getActiveEntities: () => [] }, null, entity.gameEngine);
            entity.render?.(1);
        });
        [this.actor, this.remoteActor, this.targetActor].forEach((actor) => {
            if (!actor) return;
            actor.mixer?.update?.(dt);
            actor.syncAttachedStatusEffects?.(dt);
            if (actor.spiritEffect?.isActive) actor.spiritEffect.update(dt);
            actor.render?.(1);
        });
        if (this.jumpDuration > 0 && this.actor) {
            this.jumpElapsed = Math.min(this.jumpDuration, this.jumpElapsed + dt);
            const progress = this.jumpElapsed / this.jumpDuration;
            this.actor.mesh.position.y = Math.sin(progress * Math.PI) * 2.4;
            this.actor.syncJumpAnimationToVisualState({ duration: this.jumpDuration, progress });
            if (progress >= 1) {
                this.jumpDuration = 0;
                this.actor.state = 'IDLE';
                this.actor.clearJumpAnimation();
                this.actor.restoreAnimationForState(true);
            }
        }
        this.updateMetrics();
    }

    async initialize() {
        this.panel.hidden = false;
        await this.loadActors(this.currentActorType);
        await this.presentAbility('persistent');
        this.updateCoverageLabel();
    }

    updateCoverageLabel() {
        const abilities = listPlayerAbilityPresentations().length;
        const variants = listPlayerAbilityPresentationVariants().length;
        const actors = listActorAnimationEntries().length;
        this.coverage.textContent = `${abilities} abilities · ${variants} base/rune variants · ${actors} actor archetypes · ${EQUIPPABLE_BASE_ITEMS.length} equipment families`;
        this.runAllButton.textContent = `Audit all ${variants}`;
        this.runEquipmentButton.textContent = `Audit ${EQUIPPABLE_BASE_ITEMS.length} gear`;
    }
}
