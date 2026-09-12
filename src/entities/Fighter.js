import * as THREE from 'three';
import { Actor } from './Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { CONSTANTS } from '../core/Constants.js';
import { MeshFactory } from '../utils/MeshFactory.js';
import { spawnEffectSceneFallback } from './EffectSceneFallback.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';
import { clipDungeonEffectSegment } from '../skills/dungeonEffectGeometry.js';
import { getExecutionerSpinDamage } from '../skills/executionerSpin.js';
import { applyOfflineShieldSlam } from '../skills/offlineShieldSlam.js';
import { getFighterEffectDuration } from '../skills/fighterEffectDuration.js';
import { applyOfflineFighterDamageBuff, clearOfflineFighterDamageBuffs } from '../skills/offlineFighterDamageBuffs.js';
import { beginOfflineWhirlwind, advanceOfflineWhirlwind, cancelOfflineWhirlwind } from '../skills/offlineWhirlwind.js';
import { applyOfflineEarthshaker } from '../skills/offlineEarthshaker.js';
import { applyOfflineJuggernaut } from '../skills/offlineJuggernaut.js';
import { applyOfflineSweepingStrike } from '../skills/offlineFighterCone.js';
import { beginOfflineShatteringCharge, advanceOfflineShatteringCharge } from '../skills/offlineShatteringCharge.js';
import { beginOfflineCharge, advanceOfflineCharge, cancelOfflineCharge } from '../skills/offlineCharge.js';

const GUARDIAN_ROAR_FRIENDLY_ACTOR_TYPES = new Set([
    'Fighter',
    'Rogue',
    'Wizard',
    'Cleric',
    'AvengingSeraph',
    'DwarfSalesman',
    'QuestNPC',
    'DungeonNPC',
    'RespecNPC'
]);

function isGuardianRoarFriendlyActor(entity, gameEngine) {
    if (gameEngine?.isPlayerClassEntity?.(entity)) return true;
    return GUARDIAN_ROAR_FRIENDLY_ACTOR_TYPES.has(entity?.constructor?.name);
}

export class Fighter extends Actor {
    constructor(id) {
        super(id, CONSTANTS.ENTITIES.FIGHTER);
        this.scaleAnimSpeed = true;
        this.meshType = 'Fighter';

        this.abilityName = "Charge";
        this.abilityDescription = "Dash towards an enemy and deal damage.";
        this.abilityManaCost = 20;
        this.abilityMaxCooldown = 5.0;

        this.isCharging = false;
        this.ironFortressTimer = 0;
        this.ironFortressReduction = 0;
        this.chargeTarget = null;
    }

    useAbility(targetVector, gameEngine, skillNameOverride = null) {
        if (this.offlineCharge && !this.isCharging) cancelOfflineCharge(this);
        if (this.offlineCharge && !this.isRemote) return false;
        if (this.isCharging && this.isShatteringCharge && !this.isRemote) return false;
        if (!this.isCharging && this.isShatteringCharge) {
            // Scene recovery can clear the shared movement flag independently.
            this.isShatteringCharge = false;
            this.shatteringArmorDuration = 0;
            this.shatteringInstanceId = null;
        }
        const requestedSkill = skillNameOverride || this.abilityName;
        if (requestedSkill === 'Whirlwind' && (this.isRemote || !this.unlockedSkills.includes(requestedSkill))) return false;
        if (['Charge', 'Shattering Charge'].includes(requestedSkill) && (this.isRemote || !this.unlockedSkills.includes(requestedSkill) ||
            ![targetVector?.x, targetVector?.z].every(Number.isFinite))) return false;
        if (['Executioner Spin', 'Whirlwind'].includes(requestedSkill)) targetVector = this.position.clone();
        if (requestedSkill === 'Last Stand Rampage' && this.stats.hp / this.stats.maxHp >= 0.30) {
            gameEngine?.floatingTextManager?.spawn?.('HP too high!', this.position, '#888888');
            return false;
        }
        if (!super.useAbility(targetVector, gameEngine, skillNameOverride)) return;

        this.gameEngine = gameEngine;

        const skill = skillNameOverride || this.abilityName;

        // Multiplayer combat and movement are server-owned. The base Actor
        // already predicts mana/cooldown plus the cast presentation; running
        // the legacy offline handler as well used to apply a second, divergent
        // teleport/damage/status simulation until the next snapshot corrected it.
        if (this.isMultiplayer || gameEngine?.isMultiplayer) return true;

        const previousCast = this.lastOfflineFighterCast;
        const now = Date.now();
        const momentumStrike = skill === 'Whirlwind' && previousCast?.skill === 'Charge' &&
            now - previousCast.at >= 0 && now - previousCast.at <= 3000;
        this.lastOfflineFighterCast = { skill, at: now };

        if (skill === "Whirlwind") {
            console.log("Fighter used Whirlwind!");
            beginOfflineWhirlwind(this, gameEngine, isGuardianRoarFriendlyActor, momentumStrike);
            return;
        }

        if (skill === "Shield Slam") {
            if (!this.unlockedSkills.includes("Shield Slam")) return;
            console.log("Fighter used Shield Slam!");

            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);

            this.spawnVisualEffect(gameEngine, this.position.clone().add(forward), 0xffff00, "impact");

            applyOfflineShieldSlam(this, targetVector, gameEngine, isGuardianRoarFriendlyActor);
            return;
        }

        if (skill === "Iron Fortress") {
            if (!this.unlockedSkills.includes("Iron Fortress")) return;
            console.log("Fighter used Iron Fortress!");

            const baseDuration = this.skillRunes?.[skill] === 'ironfortress_extended' ? 45 : 30;
            this.ironFortressTimer = getFighterEffectDuration(this, baseDuration, skill);

            // Formula: 1% per Strength, max 75%
            this.ironFortressReduction = Math.min(0.75, this.stats.strength * 0.01);

            console.log(`Iron Fortress active: ${(this.ironFortressReduction * 100).toFixed(1)}% reduction for ${this.ironFortressTimer}s`);


            // Visual Effect
            gameEngine.floatingTextManager.spawn("Iron Fortress!", this.position, '#00ff00');
            this.spawnVisualEffect(gameEngine, this.position, 0x00ff00, "buff");
            return;
        }

        if (skill === "Guardian Roar") {
            if (!this.unlockedSkills.includes("Guardian Roar")) return;
            console.log("Fighter used Guardian Roar!");


            const radius = getAbilityAoeRadius('Fighter', skill, this);
            const buffDuration = getFighterEffectDuration(this, 10, skill);
            const entities = new Set([this, ...gameEngine.chunkManager.getActiveEntities()]);
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;

            // Visual
            gameEngine.floatingTextManager.spawn("ROAR!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "wave");

            entities.forEach(entity => {
                if (entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const dist = Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z);
                    if (dist <= radius + (entity.radius || 0)) {
                        const hostile = gameEngine.isHostileActorTarget?.(entity) ?? !isGuardianRoarFriendlyActor(entity, gameEngine);
                        if (!hostile && isGuardianRoarFriendlyActor(entity, gameEngine)) {
                            // Ally: Apply Buff
                            entity.guardianRoarTimer = buffDuration;
                            entity.guardianRoarReduction = 0.3; // 30%
                            console.log(`Applied Guardian Roar to ${entity.id}`);
                            gameEngine.floatingTextManager.spawn("Protected", entity.position, '#00ff00');
                        } else if (hostile && !clipDungeonEffectSegment(rects, this.position, entity.position).blocked) {
                            // Enemy: Taunt
                            gameEngine.floatingTextManager.spawn("Taunted!", entity.position, '#ff0000');
                        }
                    }
                }
            });
            return;
        }

        if (skill === "Sweeping Strike") {
            if (!this.unlockedSkills.includes("Sweeping Strike")) return;
            console.log("Fighter used Sweeping Strike!");


            applyOfflineSweepingStrike(this, targetVector, gameEngine, isGuardianRoarFriendlyActor);
            return;
        }

        if (skill === "Earthshaker") {
            if (!this.unlockedSkills.includes("Earthshaker")) return;
            console.log("Fighter used Earthshaker!");


            // Visual
            gameEngine.floatingTextManager.spawn("SMASH!", this.position, '#ff8800');
            applyOfflineEarthshaker(this, targetVector, gameEngine, isGuardianRoarFriendlyActor);
            return;
        }

        if (skill === "Unbreakable Grip") {
            console.log("Fighter used Unbreakable Grip!");


            // Single Target Pull
            // Use targetVector to find closest enemy near cursor
            let target = null;
            let minDst = 1000;
            const entities = gameEngine.chunkManager.getActiveEntities();

            // Find closest to cursor
            entities.forEach(entity => {
                if (entity !== this && entity.isActive && entity.state !== 'DEAD' && entity instanceof Actor) {
                    const d = entity.position.distanceTo(targetVector);
                    if (d < 3.0) { // Cursor tolerance
                        if (d < minDst) {
                            minDst = d;
                            target = entity;
                        }
                    }
                }
            });

            if (target) {
                // An immune target can still be selected, but neither pulled
                // nor rooted. Never push a target already within two units away.
                if (!target.ccImmune && !target.ironFortressImmovable) {
                    const offset = new THREE.Vector3().subVectors(target.position, this.position);
                    offset.y = 0;
                    const distance = offset.length();
                    if (distance > 2) {
                        offset.multiplyScalar(2 / distance);
                        target.position.x = this.position.x + offset.x;
                        target.position.z = this.position.z + offset.z;
                    }
                    gameEngine.floatingTextManager.spawn("Pulled!", target.position, '#ffffff');
                    this.spawnVisualEffect(gameEngine, target.position, 0xffffff, "impact");
                }

                // Grip roots movement; it does not silence attacks like a stun.
                if (target.rootTimer !== undefined && !target.ccImmune) {
                    target.rootTimer = getFighterEffectDuration(this, 1, skill);
                }
            } else {
                console.log("No target for Grip");
            }
            return;
        }

        if (skill === "Juggernaut Charge") {
            console.log("Fighter used Juggernaut Charge (Shockwave)!");


            gameEngine.floatingTextManager.spawn("SHOCKWAVE!", this.position, '#00ffff');
            applyOfflineJuggernaut(this, gameEngine, isGuardianRoarFriendlyActor);
            return;
        }

        if (skill === "Berserker Edge") {
            console.log("Fighter used Berserker Edge!");
            applyOfflineFighterDamageBuff(this, skill, gameEngine);

            gameEngine.floatingTextManager.spawn("Berserker Mode!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        if (skill === "Shattering Charge") {
            // Base Actor already admitted and paid for the cast, including
            // Technique cooldown reduction. Do not replace that cooldown.
            beginOfflineShatteringCharge(this, targetVector, gameEngine);
            return;
        }

        if (skill === "Executioner Spin") {
            // Base Actor owns the paid cast, cooldown and spin presentation.
            // Apply one strike at that cast point; never enable legacy ticks.
            const radius = getAbilityAoeRadius('Fighter', skill, this);
            const rects = gameEngine.currentInstanceId && gameEngine.currentInstanceType !== 'overworld'
                ? gameEngine.currentDungeonLayout?.walkRects : null;
            for (const entity of new Set(gameEngine.chunkManager.getActiveEntities())) {
                if (entity === this || !(entity instanceof Actor) || !entity.isActive || entity.state === 'DEAD') continue;
                const hostile = gameEngine.isHostileActorTarget?.(entity) ?? !isGuardianRoarFriendlyActor(entity, gameEngine);
                if (!hostile || Math.hypot(this.position.x - entity.position.x, this.position.z - entity.position.z) > radius + (entity.radius || 0)) continue;
                if (clipDungeonEffectSegment(rects, this.position, entity.position).blocked) continue;
                applyOfflineAbilityHit(this, entity, getExecutionerSpinDamage(this, entity), skill, gameEngine.floatingTextManager, '#ff8800');
            }
            return;
        }

        if (skill === "Last Stand Rampage") {
            console.log("Fighter used Last Stand Rampage!");

            // Check HP Requirement (< 30%)
            const hpPercent = this.stats.hp / this.stats.maxHp;
            if (hpPercent >= 0.30) {
                gameEngine.floatingTextManager.spawn("HP too high!", this.position, '#888888');
                return false; // Failed to cast
            }


            applyOfflineFighterDamageBuff(this, skill, gameEngine);

            gameEngine.floatingTextManager.spawn("RAMPAGE!", this.position, '#ff0000');
            this.spawnVisualEffect(gameEngine, this.position, 0xff0000, "buff");
            return;
        }

        if (skill === 'Charge') beginOfflineCharge(this, targetVector, gameEngine);
    }

    cancelAbilities() {
        cancelOfflineWhirlwind(this);
        this.lastOfflineFighterCast = null;
        clearOfflineFighterDamageBuffs(this);
        cancelOfflineCharge(this);
        this.runeArmorBuff = this.runeArmorBuffTimer = 0;
        this.isCharging = false;
        this.isWhirlwinding = false;
        this.isShatteringCharge = false;
        this.shatteringArmorDuration = 0;
        this.shatteringInstanceId = null;
        // Iron Fortress is a buff, usually persists? Or cancel on death?
        // Actor.die() calls cancelAbilities.
        this.ironFortressTimer = 0;
        this.berserkerEdgeTimer = 0;
        this.berserkerEdgeActive = false;
    }

    takeDamage(amount, attacker = null) {
        let finalAmount = amount;
        if (this.ironFortressTimer > 0) {
            finalAmount = amount * (1 - this.ironFortressReduction);
            // console.log(`Iron Fortress reduced damage from ${amount} to ${finalAmount}`);
        }
        super.takeDamage(finalAmount, attacker);
    }

    update(dt, collisionManager, player, chunkManager, floatingTextManager) {
        if (this.runeArmorBuffTimer > 0) {
            this.runeArmorBuffTimer = Math.max(0, this.runeArmorBuffTimer - dt);
            if (!this.runeArmorBuffTimer) this.runeArmorBuff = 0;
        }
        if (this.ironFortressTimer > 0) {
            this.ironFortressTimer -= dt;
            if (this.ironFortressTimer <= 0) {
                this.ironFortressTimer = 0;
                console.log("Iron Fortress expired.");
            }
        }

        if (this.offlineCharge) {
            // Advance ordinary timers once; the paid charge owns movement.
            super.update(dt, collisionManager);
            advanceOfflineCharge(this, dt, this.gameEngine, isGuardianRoarFriendlyActor);
            advanceOfflineWhirlwind(this, dt, this.gameEngine);
            return;
        }

        if (this.isCharging && this.isShatteringCharge) {
            // Recipient timers keep running during travel. ATTACKING and the
            // cleared movement target prevent ordinary walking from competing.
            super.update(dt, collisionManager);
            if (this.stunTimer <= 0 && this.isCharging && this.isShatteringCharge) {
                advanceOfflineShatteringCharge(this, dt, this.gameEngine, isGuardianRoarFriendlyActor);
            }
            advanceOfflineWhirlwind(this, dt, this.gameEngine);
            return;
        }

        if (this.isWhirlwinding) {
            // Spins must not pause ordinary buffs, cooldowns or regeneration.
            super.update(dt, collisionManager);
            advanceOfflineWhirlwind(this, dt, this.gameEngine);
            return;
        }

        super.update(dt, collisionManager);
    }

    spawnVisualEffect(gameEngine, position, color, type) {
        if (this.shouldSuppressLegacyCastVisual()) return;
        if (!gameEngine || (!gameEngine.effectScene && !gameEngine.scene && typeof gameEngine.spawnTransientEffect !== 'function')) return;
        if (typeof gameEngine.spawnTransientEffect === 'function' && gameEngine.spawnTransientEffect(type, position, color, { source: this })) {
            return;
        }

        spawnEffectSceneFallback(gameEngine, position, color, type);
    }
}
