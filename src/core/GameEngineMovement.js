import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';
import { AUDIO_CUES } from '../audio/AudioManager.js';
import { Actor } from '../entities/Actor.js';
import { DwarfSalesman } from '../entities/DwarfSalesman.js';
import { Forge } from '../entities/Forge.js';
import { LootDrop } from '../entities/LootDrop.js';
import { TradingHouse } from '../entities/TradingHouse.js';
import {
    horizontalDistance,
    LOCAL_SERVER_ADJUSTMENT_TOLERANCE,
    shortestAngleDelta
} from './MovementSmoothing.js';
import {
    LOCAL_POSITION_CORRECTION_DISTANCE,
    POINTER_RAYCAST_INTERVAL
} from './GameEngineRuntimeConstants.js';
import { installPrototypeMethods } from './PrototypeInstaller.js';

class GameEngineMovementMethods {
    handlePrimaryClick(event = null) {
        if (!this.player) return false;
        if (this.uiManager.isEscMenuOpen || this.uiManager.isPatchNotesOpen || this.uiManager.reportScreen.style.display === 'block') return false;

        this.performRaycast();

        const jumpModifierHeld = Boolean(
            event?.ctrlKey
            || event?.metaKey
            || this.inputManager?.keys?.control
            || this.inputManager?.keys?.meta
        );
        if (jumpModifierHeld) {
            const point = this.inputManager?.getGroundIntersectionFromEvent
                ? this.inputManager.getGroundIntersectionFromEvent(event)
                : this.inputManager.getGroundIntersection();
            if (!point) return false;
            return this.requestPlayerJump(point);
        }

        if (this.isMobile) {
            if (event) {
                const hit = this.hoveredEntity;
                let selected = this.isHostileActorTarget(hit) ? hit : null;
                if (selected) {
                    // Overlapping silhouettes remain deliberately selectable:
                    // subsequent taps cycle the actual hit stack in stable id
                    // order, not by rapidly changing distance from the camera.
                    const candidates = (this.raycastHitEntities || [hit])
                        .filter(entity => this.isHostileActorTarget(entity))
                        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
                    const previousIndex = candidates.indexOf(this.getMobileCombatTarget());
                    if (candidates.length > 1 && previousIndex >= 0) {
                        selected = candidates[(previousIndex + 1) % candidates.length];
                    }
                }
                this.setMobileCombatTarget(selected);
                if (hit instanceof LootDrop || this.isInteractableEntity(hit)) this.moveToAndInteract(hit);
                return true;
            }
            const target = this.getMobileCombatTarget();
            if (target) this.moveToAndInteract(target);
            else this.showReadabilityFeedback?.('mobile-select-target', {
                title: 'Select an enemy', tone: 'support',
                subtitle: 'Tap an enemy, then Attack or use a skill. Tap empty ground to cancel.'
            }, 700);
            return true;
        }

        if (this.hoveredEntity && this.hoveredEntity !== this.player) {
            this.moveToAndInteract(this.hoveredEntity);
            return true;
        }

        const point = this.inputManager.getGroundIntersection();
        if (!point) return false;

        let nearestLoot = null;
        let minLootDist = 3.0;
        const activeEntities = this.chunkManager.getActiveEntities();
        for (const entity of activeEntities) {
            if (entity instanceof LootDrop && entity.isActive) {
                const d = new THREE.Vector2(point.x, point.z).distanceTo(new THREE.Vector2(entity.position.x, entity.position.z));
                if (d < minLootDist) {
                    minLootDist = d;
                    nearestLoot = entity;
                }
            }
        }

        if (nearestLoot) {
            this.moveToAndInteract(nearestLoot);
        } else {
            this.pendingInteraction = null;
            this.abilityController.pendingAbilityTarget = null;
            this.abilityController.pendingAbilitySkill = null;
            this.player.move(point);
        }

        return true;
    }

    requestPlayerJump(destination) {
        if (!this.player || !destination) return false;

        const end = destination.clone();
        end.y = this.player.position.y;

        if (this.collisionManager?.constrainToDungeonWalkableArea) {
            this.collisionManager.constrainToDungeonWalkableArea(end, this.player.radius || 0);
        }

        if (this.playerJumpState) {
            this.playerQueuedJump = true;
            if (this.inputManager) {
                this.inputManager.isMouseDown = false;
            }
            return true;
        }

        this.playerQueuedJump = false;
        this.player.targetPosition = null;
        this.pendingInteraction = null;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        if (this.inputManager) {
            this.inputManager.isMouseDown = false;
            this.inputManager.isRightMouseDown = false;
        }
        this.clearCombatIntentState?.();

        if (this.isMultiplayer && this.network?.send) {
            this.startPlayerJump(end);
            this.network.send('jump', {
                x: end.x,
                y: end.y,
                z: end.z
            });
            return true;
        }

        return this.startPlayerJump(end);
    }

    startPlayerJump(destination) {
        if (!this.player || !destination) return false;

        const start = this.player.position.clone();
        const end = destination.clone();
        end.y = start.y;

        if (this.collisionManager?.constrainToDungeonWalkableArea) {
            this.collisionManager.constrainToDungeonWalkableArea(end, this.player.radius || 0);
        }

        const travelDistance = start.distanceTo(end);
        const duration = this.getJumpTravelDuration(travelDistance);
        const height = this.getJumpArcHeight(travelDistance);

        this.player.targetPosition = null;
        this.pendingInteraction = null;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;
        this.clearCombatIntentState?.();
        this.player.state = 'JUMPING';
        if (this.inputManager) {
            this.inputManager.isMouseDown = false;
            this.inputManager.isRightMouseDown = false;
        }

        this.player.playJumpAnimation?.({
            duration,
            height,
            serverDriven: false
        });

        if (this.player.mesh) {
            this.player.mesh.lookAt(new THREE.Vector3(end.x, this.player.position.y, end.z));
            this.player.rotation.copy(this.player.mesh.quaternion);
        }

        this.playerJumpState = {
            start,
            end,
            elapsed: 0,
            duration,
            height,
            serverDriven: false
        };
        this.playerJumpLandingVisual = null;
        this.playerJumpVisualHeight = 0;
        this.playAudioCue(AUDIO_CUES.jumpStart, { pitch: Math.max(0.85, Math.min(1.25, travelDistance / 18)) });
        this.chunkManager?.updateEntityChunk?.(this.player);
        this.renderSystem?.setCameraTarget?.(this.player.position);
        this.normalizeJumpVisualState(this.playerJumpState);
        return true;
    }

    normalizeJumpVisualState(jumpState, fallbackPosition = null) {
        if (!jumpState) return null;

        const duration = Math.max(0.001, Number.isFinite(jumpState.duration) ? jumpState.duration : 0.001);
        jumpState.duration = duration;

        const progressFromElapsed = Number.isFinite(jumpState.elapsed)
            ? jumpState.elapsed / duration
            : undefined;
        const visualProgress = Number.isFinite(jumpState.visualProgress)
            ? jumpState.visualProgress
            : (Number.isFinite(jumpState.progress) ? jumpState.progress : progressFromElapsed);
        const clampedProgress = Math.max(0, Math.min(1, visualProgress ?? 0));

        jumpState.visualProgress = clampedProgress;
        jumpState.progress = clampedProgress;
        jumpState.elapsed = clampedProgress * duration;
        jumpState.visualHeight = Math.max(0, Math.sin(clampedProgress * Math.PI) * (jumpState.height || 0));

        if (!jumpState.displayPosition) {
            jumpState.displayPosition = fallbackPosition?.clone?.()
                || jumpState.start?.clone?.()
                || new THREE.Vector3();
        }

        return jumpState;
    }

    advanceJumpVisualState(jumpState, dt) {
        if (!jumpState || !(jumpState.duration > 0)) return null;

        this.normalizeJumpVisualState(jumpState);
        const elapsed = Math.min(jumpState.duration, Math.max(0, jumpState.elapsed || 0) + dt);
        const progress = jumpState.duration > 0 ? elapsed / jumpState.duration : 1;

        jumpState.elapsed = elapsed;
        jumpState.visualProgress = Math.max(0, Math.min(1, progress));
        jumpState.progress = jumpState.visualProgress;
        jumpState.visualHeight = Math.max(0, Math.sin(jumpState.visualProgress * Math.PI) * (jumpState.height || 0));

        return jumpState;
    }

    isSameAuthoritativeJump(existingJump, start, end, duration) {
        if (!existingJump?.serverDriven || !existingJump.start || !existingJump.end) return false;

        const positionTolerance = 0.35;
        const durationTolerance = 0.075;
        const existingDuration = Number.isFinite(existingJump.duration) ? existingJump.duration : duration;
        return existingJump.start.distanceTo(start) <= positionTolerance
            && existingJump.end.distanceTo(end) <= positionTolerance
            && Math.abs(existingDuration - duration) <= durationTolerance;
    }

    shouldPreservePredictedPlayerAttack(nextState) {
        if (!this.player?.attackTimer || this.player.state !== 'ATTACKING') return false;
        return nextState !== 'ATTACKING' && nextState !== 'JUMPING' && nextState !== 'DEAD';
    }

    syncAuthoritativeJumpState(entity, pData) {
        if (!entity || pData?.state !== 'JUMPING') return false;

        const existingJump = entity === this.player ? this.playerJumpState : entity.jumpVisualState;
        const hasOwnJumpField = (key) => Object.prototype.hasOwnProperty.call(pData, key);
        const hasJumpMetadata = hasOwnJumpField('jumpStartX')
            || hasOwnJumpField('jumpTargetX')
            || hasOwnJumpField('jumpHeight')
            || hasOwnJumpField('jumpDuration')
            || hasOwnJumpField('jumpProgress');
        const hasJumpTrajectoryMetadata = hasOwnJumpField('jumpStartX')
            || hasOwnJumpField('jumpStartY')
            || hasOwnJumpField('jumpStartZ')
            || hasOwnJumpField('jumpTargetX')
            || hasOwnJumpField('jumpTargetY')
            || hasOwnJumpField('jumpTargetZ');
        const getJumpScalarField = (key, fallback) => {
            if (hasOwnJumpField(key)) return pData[key];
            return fallback;
        };
        const getJumpTrajectoryField = (key, fallback) => {
            if (hasOwnJumpField(key)) return pData[key];
            if (hasJumpTrajectoryMetadata && pData[key] !== undefined) return pData[key];
            return fallback;
        };
        const previousPosition = pData._previousPosition?.clone?.() || entity.position.clone();
        const currentPosition = new THREE.Vector3(
            pData.x ?? entity.position.x,
            pData.y ?? entity.position.y,
            pData.z ?? entity.position.z
        );

        let start = new THREE.Vector3(
            getJumpTrajectoryField('jumpStartX', existingJump?.start?.x ?? previousPosition.x),
            getJumpTrajectoryField('jumpStartY', existingJump?.start?.y ?? previousPosition.y),
            getJumpTrajectoryField('jumpStartZ', existingJump?.start?.z ?? previousPosition.z)
        );
        let end = new THREE.Vector3(
            getJumpTrajectoryField('jumpTargetX', existingJump?.end?.x ?? currentPosition.x),
            getJumpTrajectoryField('jumpTargetY', existingJump?.end?.y ?? start.y),
            getJumpTrajectoryField('jumpTargetZ', existingJump?.end?.z ?? currentPosition.z)
        );

        const horizontalTravel = new THREE.Vector3(currentPosition.x - start.x, 0, currentPosition.z - start.z);
        if (!hasJumpTrajectoryMetadata && (!existingJump?.end || currentPosition.distanceTo(start) > end.distanceTo(start))) {
            end = currentPosition.clone();
            end.y = start.y;
        }
        if (!hasJumpMetadata && (!existingJump?.end || start.distanceTo(end) < 0.01) && horizontalTravel.lengthSq() > 0.0001) {
            const inferredTotalDistance = horizontalTravel.length() / 0.2;
            end = start.clone().add(horizontalTravel.clone().normalize().multiplyScalar(inferredTotalDistance));
            end.y = start.y;
        }

        const travelDistance = start.distanceTo(end);
        const duration = Math.max(0.001, getJumpScalarField('jumpDuration', existingJump?.duration ?? this.getJumpTravelDuration(travelDistance || 0)));
        const isSameJump = this.isSameAuthoritativeJump(existingJump, start, end, duration)
            || (!hasJumpTrajectoryMetadata && !!existingJump?.serverDriven);
        const jumpVector = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
        const jumpDistanceSq = jumpVector.lengthSq();
        const projectedProgress = jumpDistanceSq > 0.0001
            ? Math.max(0, Math.min(1, new THREE.Vector3(currentPosition.x - start.x, 0, currentPosition.z - start.z).dot(jumpVector) / jumpDistanceSq))
            : undefined;
        const fallbackProgress = projectedProgress ?? (typeof existingJump?.progress === 'number'
            ? existingJump.progress
            : (typeof existingJump?.elapsed === 'number' ? (existingJump.elapsed / duration) : 0));
        const packetProgress = Math.max(0, Math.min(1, getJumpScalarField('jumpProgress', fallbackProgress)));
        const previousProgress = typeof existingJump?.progress === 'number'
            ? existingJump.progress
            : (typeof existingJump?.elapsed === 'number' && existingJump.duration > 0 ? existingJump.elapsed / existingJump.duration : 0);
        const authoritativeProgress = isSameJump
            ? Math.max(0, Math.min(1, Math.max(previousProgress, packetProgress)))
            : packetProgress;
        const previousVisualProgress = typeof existingJump?.visualProgress === 'number'
            ? existingJump.visualProgress
            : previousProgress;
        const progress = entity !== this.player
            ? (isSameJump ? previousVisualProgress : 0)
            : authoritativeProgress;
        const inferredHeight = this.getJumpArcHeight(travelDistance);
        const height = getJumpScalarField('jumpHeight', existingJump?.height ?? inferredHeight);
        const baseY = THREE.MathUtils.lerp(start.y, end.y, entity === this.player ? progress : authoritativeProgress);
        const computedArcHeight = Math.sin(progress * Math.PI) * height;
        const replicatedArcHeight = Math.max(0, (pData.y ?? currentPosition.y) - baseY);
        const visualHeight = entity === this.player
            ? Math.max(computedArcHeight, replicatedArcHeight)
            : computedArcHeight;
        const previousDisplayPosition = existingJump?.displayPosition?.clone?.()
            || entity.mesh?.position?.clone?.()
            || previousPosition.clone();
        const displayPosition = new THREE.Vector3(previousDisplayPosition.x, baseY, previousDisplayPosition.z);

        entity.position.x = currentPosition.x;
        entity.position.y = baseY;
        entity.position.z = currentPosition.z;

        if (entity === this.player) {
            this.playerJumpState = {
                start,
                end,
                progress,
                visualProgress: progress,
                elapsed: progress * duration,
                duration,
                height,
                serverDriven: true,
                visualHeight,
                hasAuthoritativeTrajectory: hasJumpTrajectoryMetadata,
                displayPosition
            };
            this.normalizeJumpVisualState(this.playerJumpState, displayPosition);
            this.playerJumpState.visualHeight = visualHeight;
            if (!isSameJump) {
                this.player.playJumpAnimation?.(this.playerJumpState);
            }
            this.playerJumpVisualHeight = this.playerJumpState.visualHeight || 0;
            this.player.targetPosition = null;
        } else {
            const nextJumpState = {
                start,
                end,
                progress,
                visualProgress: progress,
                elapsed: progress * duration,
                duration,
                height,
                visualHeight,
                authoritativeProgress,
                serverDriven: true,
                hasAuthoritativeTrajectory: hasJumpTrajectoryMetadata,
                displayPosition,
                landingVisual: entity.jumpLandingVisual || null
            };
            this.normalizeJumpVisualState(nextJumpState, displayPosition);
            nextJumpState.visualHeight = visualHeight;
            entity.jumpVisualState = nextJumpState;
            if (!isSameJump) {
                entity.playJumpAnimation?.(nextJumpState);
            }
        }

        return true;
    }

    finishRemoteJumpVisual(entity, impact = 0.85) {
        if (!entity?.jumpVisualState) return;

        const landingEnd = entity.jumpVisualState.end?.clone?.() || entity.position?.clone?.();

        entity.jumpLandingVisual = {
            startTime: Date.now(),
            duration: 180,
            impact
        };
        entity.clearJumpAnimation?.();
        this.applyJumpImpactEffect(entity, impact, landingEnd);
        entity.jumpVisualState = null;
    }

    clearAuthoritativeJumpState(entity) {
        if (!entity) return;
        if (entity === this.player) {
            if (this.playerJumpState?.serverDriven) {
                const landingEnd = this.playerJumpState.end?.clone() || this.player.position.clone();
                const shouldConsumeQueuedJump = !!this.playerQueuedJump
                    && !!(this.inputManager?.keys?.control || this.inputManager?.keys?.meta)
                    && !!this.inputManager?.primaryMouseButtonDown;
                this.player.position.copy(landingEnd);
                this.player.position.y = landingEnd.y;
                this.playerJumpState = null;
                this.player.clearJumpAnimation?.();
                this.player.restoreAnimationForState?.(true);
                this.playerJumpVisualHeight = 0;
                this.player.targetPosition = null;
                this.chunkManager?.updateEntityChunk?.(this.player);
                this.renderSystem?.setCameraTarget?.(this.player.position);
                this.playerJumpLandingVisual = {
                    startTime: Date.now(),
                    duration: 180,
                    impact: 0.85
                };
                this.applyJumpImpactEffect(entity, 0.85);
                this.playAudioCue(AUDIO_CUES.jumpLand, { impact: 0.85 });
                if (shouldConsumeQueuedJump) {
                    this.playerQueuedJump = false;
                    const queuedDestination = this.inputManager.getGroundIntersection?.();
                    if (queuedDestination) {
                        this.requestPlayerJump(queuedDestination);
                        return;
                    }
                }
                this.playerQueuedJump = false;
            }
            return;
        }
        if (entity.jumpVisualState) {
            const visualProgress = this.getJumpVisualProgress(entity.jumpVisualState);
            if (visualProgress < 0.98) {
                entity.jumpVisualState.landingPending = true;
                return;
            }
            this.finishRemoteJumpVisual(entity, 0.85);
        }
    }

    updateRemoteJumpVisuals(dt) {
        const entities = new Set();
        const activeEntities = this.activeEntitiesCache || this.chunkManager?.getActiveEntities?.() || [];
        for (const entity of activeEntities) {
            if (entity && entity !== this.player) {
                entities.add(entity);
            }
        }
        if (this.remotePlayers?.values) {
            for (const entity of this.remotePlayers.values()) {
                if (entity && entity !== this.player) {
                    entities.add(entity);
                }
            }
        }

        for (const entity of entities) {
            const jump = entity !== this.player ? entity?.jumpVisualState : null;
            if (!jump?.serverDriven || !(jump.duration > 0)) continue;

            this.advanceJumpVisualState(jump, dt);
            if (jump.landingPending && this.getJumpVisualProgress(jump) >= 1) {
                this.finishRemoteJumpVisual(entity, 0.85);
                continue;
            }
            if (jump.displayPosition) {
                if (jump.hasAuthoritativeTrajectory) {
                    const trajectoryDisplayPosition = this.getJumpBasePositionAtProgress(jump);
                    if (trajectoryDisplayPosition) {
                        jump.displayPosition.copy(trajectoryDisplayPosition);
                    }
                } else {
                    // Bug 2 fix: do NOT lerp displayPosition here; applyEntityJumpVisuals
                    // is the single lerp site per frame.  Only keep Y in sync with baseY.
                    jump.displayPosition.y = entity.position.y;
                }
            }
        }
    }

    updatePlayerJump(dt) {
        if (!this.playerJumpState || !this.player) return false;

        const jump = this.playerJumpState;
        if (jump.serverDriven) {
            this.advanceJumpVisualState(jump, dt);
            if (!jump.displayPosition) {
                jump.displayPosition = this.player.position.clone();
            }
            const displayTarget = this.getAuthoritativeJumpDisplayTarget(this.player, jump) || this.player.position;
            jump.displayPosition.lerp(displayTarget, 0.35);
            jump.displayPosition.y = this.player.position.y;
            this.playerJumpVisualHeight = jump.visualHeight || 0;
            this.renderSystem?.setCameraTarget?.(jump.displayPosition);
            return true;
        }
        if ((this.inputManager?.keys?.control || this.inputManager?.keys?.meta) && this.inputManager?.primaryMouseButtonDown) {
            this.playerQueuedJump = true;
        }

        this.advanceJumpVisualState(jump, dt);
        const progress = jump.visualProgress ?? this.getJumpVisualProgress(jump);

        this.player.position.lerpVectors(jump.start, jump.end, progress);
        this.player.position.y = jump.start.y;
        this.playerJumpVisualHeight = jump.visualHeight || 0;
        this.chunkManager?.updateEntityChunk?.(this.player);
        this.renderSystem?.setCameraTarget?.(this.player.position);

        if (progress >= 1) {
            this.player.position.copy(jump.end);
            this.player.position.y = jump.end.y;
            this.playerJumpState = null;
            this.player.clearJumpAnimation?.();
            this.playerJumpVisualHeight = 0;
            this.playerJumpLandingVisual = {
                startTime: Date.now(),
                duration: 180,
                impact: 0.9
            };
            this.applyJumpImpactEffect(this.player, 0.9);
            this.playAudioCue(AUDIO_CUES.jumpLand, { impact: 0.9 });
            this.player.state = 'IDLE';
            this.player.playAnimation?.('Idle');

            if (this.playerQueuedJump && (this.inputManager?.keys?.control || this.inputManager?.keys?.meta) && this.inputManager?.primaryMouseButtonDown) {
                this.playerQueuedJump = false;
                const queuedDestination = this.inputManager.getGroundIntersection?.();
                if (queuedDestination) {
                    return this.requestPlayerJump(queuedDestination);
                }
            }

            this.playerQueuedJump = false;
        }

        return true;
    }

    getJumpStyleProfile(entity) {
        const className = entity?.constructor?.name || '';
        const baseProfile = {
            flip: Math.PI * 2,
            roll: 0.12,
            anticipation: 0.12,
            squash: 0.14,
            stretch: 0.1,
            tuck: 0.18,
            untuck: 0.14,
            landingLean: 0.16
        };

        if (className === 'Wizard') {
            return { ...baseProfile, flip: Math.PI * 1.78, roll: 0.18, anticipation: 0.09, squash: 0.1, stretch: 0.16, tuck: 0.14, untuck: 0.12, landingLean: 0.14 };
        }
        if (className === 'Rogue') {
            return { ...baseProfile, flip: Math.PI * 2.2, roll: 0.16, anticipation: 0.1, squash: 0.12, stretch: 0.14, tuck: 0.22, untuck: 0.15, landingLean: 0.18 };
        }
        if (className === 'Cleric') {
            return { ...baseProfile, flip: Math.PI * 1.9, roll: 0.14, anticipation: 0.08, squash: 0.11, stretch: 0.14, tuck: 0.16, untuck: 0.13, landingLean: 0.15 };
        }
        if (className === 'Fighter') {
            return { ...baseProfile, flip: Math.PI * 2.08, roll: 0.08, anticipation: 0.15, squash: 0.17, stretch: 0.1, tuck: 0.24, untuck: 0.18, landingLean: 0.2 };
        }

        return baseProfile;
    }

    getJumpTravelDuration(distance = 0) {
        const safeDistance = Math.max(0, Number(distance) || 0);
        return Math.max(0.46, Math.min(1.28, safeDistance / 13.5));
    }

    getJumpArcHeight(distance = 0) {
        const safeDistance = Math.max(0, Number(distance) || 0);
        return Math.max(6.5, Math.min(16.5, safeDistance * 0.38 + 4.2));
    }

    getJumpVisualProgress(jumpState) {
        if (!jumpState) return 0;
        if (typeof jumpState.visualProgress === 'number') {
            return Math.max(0, Math.min(1, jumpState.visualProgress));
        }
        if (typeof jumpState.progress === 'number') {
            return Math.max(0, Math.min(1, jumpState.progress));
        }
        if (jumpState.serverDriven && typeof jumpState.visualHeight === 'number' && jumpState.height > 0) {
            const normalizedHeight = Math.max(0, Math.min(1, jumpState.visualHeight / jumpState.height));
            return Math.asin(normalizedHeight) / Math.PI;
        }
        if (typeof jumpState.elapsed === 'number' && typeof jumpState.duration === 'number' && jumpState.duration > 0) {
            return Math.max(0, Math.min(1, jumpState.elapsed / jumpState.duration));
        }
        return 0;
    }

    getJumpBasePositionAtProgress(jumpState, progress = this.getJumpVisualProgress(jumpState)) {
        if (!jumpState?.start || !jumpState?.end) {
            return null;
        }

        const clampedProgress = Math.max(0, Math.min(1, progress));
        return new THREE.Vector3().lerpVectors(jumpState.start, jumpState.end, clampedProgress);
    }

    applyJumpImpactEffect(entity, impact = 0.9, positionOverride = null) {
        if (!entity?.position || !this.spawnTransientEffect) return;
        const className = entity?.constructor?.name || 'Unknown';
        const impactPosition = positionOverride?.clone?.() || entity.position.clone();
        this.spawnTransientEffect('jump_land', impactPosition, 0xd8d2c4, {
            impact,
            className
        });
        this.renderSystem?.applyCameraPunch?.({
            intensity: 0.9 * impact,
            duration: 0.18,
            vertical: 1.1,
            horizontal: 0.5
        });
    }

    applyJumpVisualScale(entity, jumpState, progress, styleProfile) {
        const mesh = entity?.mesh;
        if (!mesh?.scale) return;

        if (!mesh.userData.baseScale) {
            mesh.userData.baseScale = mesh.scale.clone();
        }

        mesh.scale.copy(mesh.userData.baseScale);

        const anticipationWindow = 0.12;
        if (progress <= anticipationWindow) {
            const anticipationT = 1 - (progress / anticipationWindow);
            const anticipation = anticipationT * styleProfile.anticipation;
            mesh.scale.x *= 1 + anticipation * 0.55;
            mesh.scale.z *= 1 + anticipation * 0.55;
            mesh.scale.y *= 1 - anticipation;
            return;
        }

        const airborneLift = Math.sin(progress * Math.PI) * styleProfile.stretch;
        const tuckWindow = Math.max(0, Math.sin(progress * Math.PI));
        const tuckStrength = progress < 0.5
            ? THREE.MathUtils.smoothstep(progress, 0.12, 0.36) * styleProfile.tuck
            : (1 - THREE.MathUtils.smoothstep(progress, 0.56, 0.88)) * styleProfile.untuck;
        mesh.scale.x *= 1 - airborneLift * 0.2;
        mesh.scale.z *= 1 + tuckStrength * 1.2 + airborneLift * 0.08;
        mesh.scale.y *= 1 + airborneLift * 0.55 - tuckWindow * tuckStrength * 1.25;

        const landingVisual = jumpState?.landingVisual;
        if (landingVisual) {
            const elapsed = Date.now() - landingVisual.startTime;
            const landingT = Math.max(0, Math.min(1, elapsed / landingVisual.duration));
            if (landingT >= 1) {
                if (entity === this.player) {
                    this.playerJumpLandingVisual = null;
                } else {
                    entity.jumpLandingVisual = null;
                }
                mesh.scale.copy(mesh.userData.baseScale);
                return;
            }

            const impact = (1 - landingT) * landingVisual.impact;
            const squash = styleProfile.squash * impact;
            mesh.scale.x *= 1 + squash * 0.85;
            mesh.scale.z *= 1 + squash * 0.85;
            mesh.scale.y *= 1 - squash;
        }
    }

    getAuthoritativeJumpDisplayTarget(entity, jumpState) {
        const currentDisplayPosition = jumpState?.displayPosition?.clone?.() || entity?.position?.clone?.();
        const targetPosition = entity?.position?.clone?.();
        if (!currentDisplayPosition || !targetPosition) return targetPosition || currentDisplayPosition || null;

        currentDisplayPosition.y = targetPosition.y;
        if (!jumpState?.serverDriven) {
            return targetPosition;
        }

        if (jumpState.hasAuthoritativeTrajectory && entity !== this.player) {
            return this.getJumpBasePositionAtProgress(jumpState) || targetPosition;
        }

        const jumpVector = jumpState?.start && jumpState?.end
            ? new THREE.Vector3(jumpState.end.x - jumpState.start.x, 0, jumpState.end.z - jumpState.start.z)
            : new THREE.Vector3();
        if (jumpVector.lengthSq() <= 0.0001) {
            return targetPosition;
        }

        const jumpDirection = jumpVector.normalize();
        const horizontalDelta = new THREE.Vector3(
            targetPosition.x - currentDisplayPosition.x,
            0,
            targetPosition.z - currentDisplayPosition.z
        );
        const forwardDelta = horizontalDelta.dot(jumpDirection);
        const lateralDelta = horizontalDelta.clone().sub(jumpDirection.clone().multiplyScalar(forwardDelta));
        const microCorrectionTolerance = 0.08;

        if (forwardDelta < 0 && Math.abs(forwardDelta) <= microCorrectionTolerance) {
            targetPosition.x -= jumpDirection.x * forwardDelta;
            targetPosition.z -= jumpDirection.z * forwardDelta;
        }
        if (lateralDelta.lengthSq() <= microCorrectionTolerance * microCorrectionTolerance) {
            targetPosition.x -= lateralDelta.x;
            targetPosition.z -= lateralDelta.z;
        }

        return targetPosition;
    }

    applyEntityJumpVisuals(entity, jumpState, options = {}) {
        if (!entity?.mesh) return;

        if (jumpState?.serverDriven) {
            if (!jumpState.displayPosition) {
                jumpState.displayPosition = entity.position.clone();
            }
            if (jumpState.hasAuthoritativeTrajectory && entity !== this.player) {
                const trajectoryDisplayPosition = this.getJumpBasePositionAtProgress(jumpState);
                if (trajectoryDisplayPosition) {
                    jumpState.displayPosition.copy(trajectoryDisplayPosition);
                }
            }
            const shouldSmoothDisplayPosition = entity !== this.player && options.smoothDisplayPosition !== false;
            if (shouldSmoothDisplayPosition && !(jumpState.hasAuthoritativeTrajectory && entity !== this.player)) {
                const displayTarget = this.getAuthoritativeJumpDisplayTarget(entity, jumpState) || entity.position;
                displayTarget.y = entity.position.y;
                jumpState.displayPosition.lerp(displayTarget, 0.35);
                jumpState.displayPosition.y = entity.position.y;
            }
            entity.mesh.position.copy(jumpState.displayPosition);
        } else {
            entity.mesh.position.copy(entity.position);
        }
        entity.mesh.quaternion.copy(entity.rotation);

        if (!jumpState) {
            if (entity.mesh.scale && entity.mesh.userData?.baseScale) {
                entity.mesh.scale.copy(entity.mesh.userData.baseScale);
            }
            return;
        }

        const visualHeight = jumpState.visualHeight ?? 0;
        entity.mesh.position.y += visualHeight;

        const progress = this.getJumpVisualProgress(jumpState);
        const styleProfile = this.getJumpStyleProfile(entity);
        const flipAmount = progress * styleProfile.flip;
        const rollAmount = Math.sin(progress * Math.PI * 2) * styleProfile.roll;
        const tuckPitch = progress < 0.45
            ? THREE.MathUtils.smoothstep(progress, 0.06, 0.3) * styleProfile.tuck
            : -THREE.MathUtils.smoothstep(progress, 0.72, 0.9)
                * (1 - THREE.MathUtils.smoothstep(progress, 0.9, 1.0))
                * styleProfile.landingLean;
        let landingPitch = 0;
        if (jumpState?.landingVisual) {
            const landingElapsed = Date.now() - jumpState.landingVisual.startTime;
            const landingT = Math.max(0, Math.min(1, landingElapsed / jumpState.landingVisual.duration));
            landingPitch = -Math.sin((1 - landingT) * Math.PI * 0.5) * styleProfile.landingLean * jumpState.landingVisual.impact;
        }
        const flipQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), flipAmount + tuckPitch + landingPitch);
        const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollAmount);
        entity.mesh.quaternion.multiply(flipQuaternion).multiply(rollQuaternion);
        this.applyJumpVisualScale(entity, jumpState, progress, styleProfile);
    }

    applyRemoteJumpVisuals(options = {}) {
        const activeEntities = this.chunkManager?.getActiveEntities?.() || this.activeEntitiesCache || [];
        for (const entity of activeEntities) {
            if (entity !== this.player && entity?.jumpVisualState) {
                this.applyEntityJumpVisuals(entity, entity.jumpVisualState, options);
            }
        }
    }

    applyPlayerJumpVisuals() {
        if (!this.player?.mesh) return;
        const jumpState = this.playerJumpState
            ? {
                ...this.playerJumpState,
                progress: this.getJumpVisualProgress(this.playerJumpState),
                visualHeight: this.playerJumpState.visualHeight ?? this.playerJumpVisualHeight ?? 0,
                landingVisual: this.playerJumpLandingVisual || null
            }
            : (this.playerJumpLandingVisual
                ? {
                    progress: 1,
                    visualHeight: 0,
                    landingVisual: this.playerJumpLandingVisual
                }
                : null);
        this.applyEntityJumpVisuals(this.player, jumpState);
    }

    beginPlayerCorrectionVisual(previousPosition, nextPosition) {
        if (!previousPosition || !nextPosition) return;

        const horizontalDistance = new THREE.Vector2(previousPosition.x, previousPosition.z)
            .distanceTo(new THREE.Vector2(nextPosition.x, nextPosition.z));
        if (!Number.isFinite(horizontalDistance) || horizontalDistance < LOCAL_SERVER_ADJUSTMENT_TOLERANCE) {
            this.playerCorrectionVisualState = null;
            return;
        }

        this.playerCorrectionVisualState = {
            from: previousPosition.clone(),
            to: nextPosition.clone(),
            displayPosition: previousPosition.clone(),
            elapsed: 0,
            duration: Math.max(0.08, Math.min(0.18, horizontalDistance / 240))
        };
    }

    ensureMovementNetworkState() {
        if (!this.movementTelemetry) {
            this.movementTelemetry = {
                packetsSent: 0,
                idleHeartbeats: 0,
                acknowledged: 0,
                staleAcknowledgements: 0,
                duplicateAcknowledgements: 0,
                serverAdjustments: 0,
                hardCorrections: 0,
                maxServerAdjustment: 0
            };
        }
        const playerId = this.player?.id || null;
        if (this.movementNetworkState?.playerId === playerId) return this.movementNetworkState;
        this.movementNetworkState = {
            playerId,
            clock: 0,
            lastSentAt: -Infinity,
            nextSequence: 1,
            lastAcknowledgedSequence: 0,
            lastAcknowledgedServerPosition: null,
            authoritativeChargeActive: false,
            lastPacket: null,
            sentHistory: new Map()
        };
        return this.movementNetworkState;
    }

    sendPlayerMovementIfNeeded(dt) {
        if (!this.isMultiplayer || !this.player || !this.network?.send ||
            this.player.state === 'DEAD' || this.player.state === 'JUMPING') return false;

        const movement = this.ensureMovementNetworkState();
        movement.clock += Math.max(0, Math.min(0.25, Number(dt) || 0));
        const euler = new THREE.Euler().setFromQuaternion(this.player.rotation);
        const packet = {
            x: this.player.position.x,
            y: this.player.position.y,
            z: this.player.position.z,
            rotation: euler.y,
            state: this.player.state
        };
        const previous = movement.lastPacket;
        const positionChanged = !previous || horizontalDistance(previous, packet) > 0.0025 ||
            Math.abs((previous?.y ?? packet.y) - packet.y) > 0.0025;
        const rotationChanged = !previous || Math.abs(shortestAngleDelta(previous.rotation, packet.rotation)) > 0.01;
        const stateChanged = !previous || previous.state !== packet.state;
        const elapsed = movement.clock - movement.lastSentAt;
        // Fixed-step sums land a few ulps either side of exact cadence
        // boundaries. The tiny epsilon prevents a nominal two-frame 30 Hz
        // interval from occasionally stretching to three frames (20 Hz).
        const heartbeat = elapsed + 1e-9 >= 1;
        const cadenceReady = elapsed + 1e-9 >= (1 / 30);
        if (!stateChanged && !heartbeat && (!(positionChanged || rotationChanged) || !cadenceReady)) {
            return false;
        }

        const sequence = movement.nextSequence++;
        const payload = { ...packet, sequence };
        this.network.send('move', payload);
        movement.lastSentAt = movement.clock;
        movement.lastPacket = packet;
        movement.sentHistory.set(sequence, { ...packet });
        while (movement.sentHistory.size > 180) {
            movement.sentHistory.delete(movement.sentHistory.keys().next().value);
        }
        this.movementTelemetry.packetsSent += 1;
        if (heartbeat && !positionChanged && !rotationChanged && !stateChanged) {
            this.movementTelemetry.idleHeartbeats += 1;
        }
        return true;
    }

    getLocalPositionCorrectionReason(pData, serverPosition, currentDistance) {
        if (pData?.state === 'JUMPING') return 'authoritative jump';

        const movement = this.ensureMovementNetworkState();
        const acknowledgedSequence = Number(pData?.moveSequence || 0);
        // Charge is simulated by the server, not accepted client movement.
        // Reconcile each short step and its final landing even within the
        // normal three-unit prediction deadband. Keep processing sequence
        // acknowledgements so normal movement resumes without stale pullback.
        let chargeCorrection = null;
        if (pData?.isCharging === true) {
            movement.authoritativeChargeActive = true;
            chargeCorrection = 'authoritative charge';
        } else if (pData?.isCharging === false && movement.authoritativeChargeActive) {
            movement.authoritativeChargeActive = false;
            chargeCorrection = 'authoritative charge landing';
        }
        if (acknowledgedSequence > 0) {
            // A newly constructed browser engine may resume a server-side
            // entity whose counter survived the transport disconnect. Rebase
            // before sending the next sample so the server does not reject an
            // entire restarted 1..N sequence as stale.
            movement.nextSequence = Math.max(movement.nextSequence, acknowledgedSequence + 1);
            if (acknowledgedSequence < movement.lastAcknowledgedSequence) {
                this.movementTelemetry.staleAcknowledgements += 1;
                return null;
            }

            if (acknowledgedSequence === movement.lastAcknowledgedSequence &&
                movement.lastAcknowledgedServerPosition &&
                horizontalDistance(movement.lastAcknowledgedServerPosition, serverPosition) <=
                    LOCAL_SERVER_ADJUSTMENT_TOLERANCE) {
                // The owning entity is included in every server snapshot, so
                // the same acknowledgement is commonly repeated while a newer
                // client prediction is in flight. At high movement speed that
                // old accepted position can be more than the discontinuity
                // threshold behind the local actor. It is still an ordinary
                // duplicate, not a teleport, and must never stop the path.
                this.movementTelemetry.duplicateAcknowledgements += 1;
                return chargeCorrection;
            }

            const sent = movement.sentHistory.get(acknowledgedSequence);
            movement.lastAcknowledgedSequence = acknowledgedSequence;
            movement.lastAcknowledgedServerPosition = {
                x: serverPosition.x,
                y: serverPosition.y,
                z: serverPosition.z
            };
            this.movementTelemetry.acknowledged += 1;
            for (const sequence of movement.sentHistory.keys()) {
                if (sequence <= acknowledgedSequence) movement.sentHistory.delete(sequence);
            }

            if (sent) {
                const adjustment = horizontalDistance(sent, serverPosition);
                this.movementTelemetry.maxServerAdjustment = Math.max(
                    this.movementTelemetry.maxServerAdjustment,
                    Number.isFinite(adjustment) ? adjustment : 0
                );
                if (adjustment > LOCAL_SERVER_ADJUSTMENT_TOLERANCE) {
                    this.movementTelemetry.serverAdjustments += 1;
                    return chargeCorrection || 'acknowledged server adjustment';
                }
                // The server accepted this prediction. Its snapshot may be a
                // frame or two behind the current local path, so never pull the
                // player backward toward an already-accepted sample.
                return chargeCorrection;
            }
        }

        if (chargeCorrection) return chargeCorrection;
        if (currentDistance > LOCAL_POSITION_CORRECTION_DISTANCE) {
            this.movementTelemetry.hardCorrections += 1;
            return 'authoritative discontinuity';
        }
        return null;
    }

    shouldPreservePredictedPlayerMovement(serverState) {
        if (this.player?.state !== 'MOVING' || !this.player?.targetPosition) return false;

        // IDLE snapshots can trail a newly sent click-to-move packet. Let the
        // active local path finish instead of inserting a one-frame stop that
        // is immediately undone by the next acknowledged MOVING snapshot.
        if (serverState === 'IDLE') return true;

        // Ordinary casts are presentation-only and must not interrupt their
        // active path. Server-owned actions (including Charge) do not create a
        // local ability-animation lock and therefore remain authoritative.
        return serverState === 'ATTACKING' && Boolean(this.player.currentAbilityAnimation);
    }

    getMovementMetrics() {
        const movement = this.ensureMovementNetworkState();
        const remote = {};
        for (const [id, entity] of this.remotePlayers || []) {
            if (entity?.remoteTransformBuffer) {
                remote[id] = entity.remoteTransformBuffer.getMetrics();
            }
        }
        return {
            local: {
                ...this.movementTelemetry,
                pendingAcknowledgements: movement.sentHistory.size,
                lastAcknowledgedSequence: movement.lastAcknowledgedSequence,
                lastSentSequence: movement.nextSequence - 1,
                actor: { ...(this.player?.movementMetrics || {}) }
            },
            remote
        };
    }

    updatePlayerCorrectionVisual(dt) {
        const correction = this.playerCorrectionVisualState;
        if (!correction || !this.player) return null;

        correction.elapsed = Math.min(correction.duration, correction.elapsed + dt);
        const progress = correction.duration > 0 ? correction.elapsed / correction.duration : 1;
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        correction.displayPosition.lerpVectors(correction.from, correction.to, easedProgress);

        if (progress >= 1) {
            this.playerCorrectionVisualState = null;
            return null;
        }

        return correction.displayPosition;
    }

    applyPlayerCorrectionVisuals() {
        if (!this.player?.mesh || !this.playerCorrectionVisualState || this.playerJumpState) return;

        this.player.mesh.position.copy(this.playerCorrectionVisualState.displayPosition);
        this.player.mesh.quaternion.copy(this.player.rotation);
    }

    moveToAndInteract(entity) {
        if (!entity) return;
        this.pendingInteraction = entity;
        this.abilityController.pendingAbilityTarget = null;
        this.abilityController.pendingAbilitySkill = null;

        // Check if already in range to avoid unnecessary movement start
        const dist = new THREE.Vector2(this.player.position.x, this.player.position.z)
            .distanceTo(new THREE.Vector2(entity.position.x, entity.position.z));

        const range = this.getInteractionRangeForEntity(entity);

        if (dist > range) {
            const label = this.getInteractableEntityLabel(entity) || entity.name || 'target';
            const tone = this.isHostileActorTarget(entity) ? 'warning' : 'support';
            const title = this.isHostileActorTarget(entity) ? 'Move into range' : 'Move closer';
            const subtitle = this.isHostileActorTarget(entity)
                ? `Basic attacks need ${range.toFixed(1)}m. Closing on ${label}.`
                : `${label} is ${dist.toFixed(1)}m away. Moving into interaction range.`;
            this.showReadabilityFeedback(
                `interact-range-${this.isHostileActorTarget(entity) ? 'hostile' : label}`,
                {
                    title,
                    tone,
                    metaText: `${dist.toFixed(1)}m away`,
                    subtitle
                },
                900
            );
            // Flatten move target
            const target = entity.position.clone();
            target.y = this.player.position.y;
            this.player.move(target);
        } else if (this.isMultiplayer && this.isHostileActorTarget(entity)) {
            // A direct in-range click should not wait for the next animation
            // frame before reaching the server. Slow renderers still retain
            // the pending interaction for normal cooldown-driven auto-attacks.
            const now = Date.now();
            const cooldownMs = (this.player.stats?.attackSpeed || 1) * 1000;
            if (now - (this.player.lastAttackTime || 0) >= cooldownMs) {
                this.player.lastAttackTime = now;
                this.abilityController.performAttack(entity);
            }
        }
    }

    getRaycastEntityPriority(entity) {
        if (entity instanceof LootDrop) return 0;
        if (this.isHostileActorTarget(entity)) return 1;
        if (this.isInteractableEntity(entity)) return 2;
        if (entity instanceof Actor) return 3;
        return 4;
    }

    sortRaycastEntities(entities) {
        return [...new Set(entities)].sort((a, b) =>
            this.getRaycastEntityPriority(a) - this.getRaycastEntityPriority(b)
        );
    }

    getRaycastMeshForEntity(entity) {
        if (!entity?.mesh) return null;
        return entity.mesh.getObjectByName?.('ActorInteractionHitbox') || entity.mesh;
    }

    handlePointerRaycast(mouse) {
        this.mousePosition.copy(mouse);

        // Sample the camera and interaction proxies in the same input turn as
        // the pointer coordinate whenever the hover budget is available.
        // Always deferring to the game loop lets camera reconciliation or a
        // moving actor invalidate an otherwise exact click before the ray is
        // built. Retaining the 20 Hz budget avoids scaling raycasts to raw
        // mouse polling rates, and the update loop handles the deferred sample.
        this.needsRaycast = true;
        if (!this.inputManager?.pointerOverCanvas) {
            this.needsRaycast = false;
            return false;
        }
        if (this.raycastTimer < POINTER_RAYCAST_INTERVAL) return false;
        this.performRaycast();
        this.raycastTimer = 0;
        this.needsRaycast = false;
        return true;
    }

    performRaycast() {
        this.raycastHitEntities = [];
        const meshes = this.activeEntitiesCache
            .filter(e => e.mesh && e.isActive && e !== this.player)
            .map(e => this.getRaycastMeshForEntity(e))
            .filter(Boolean);

        // Add Dungeon Entrance to raycast list
        const dungeonEntrances = [];
        this.renderSystem.environmentGroup.traverse(obj => {
            if (obj.name === 'DungeonEntrance') {
                dungeonEntrances.push(obj);
            }
        });
        if (dungeonEntrances.length > 0) {
            meshes.push(...dungeonEntrances);
        }

        // Use inputManager.mouse directly to ensure we use the latest cursor position
        this.inputManager.raycaster.setFromCamera(this.inputManager.mouse, this.renderSystem.camera);
        const intersects = this.inputManager.raycaster.intersectObjects(meshes, true);

        if (intersects.length > 0) {
            let hitEntities = [];
            for (const hit of intersects) {
                let obj = hit.object;

                // Check for Dungeon Entrance
                let current = obj;
                while (current) {
                    if (current.name === 'DungeonEntrance') {
                        // Create a proxy entity for interaction
                        const proxy = {
                            name: 'DungeonEntrance',
                            position: current.position,
                            userData: current.userData,
                            mesh: current,
                            isActive: true // Required to prevent immediate cancellation in update loop
                        };
                        this.hoveredEntity = proxy;
                        document.body.style.cursor = 'pointer';
                        this.refreshDungeonEntranceHint();
                        this.refreshCombatIntentState();
                        return; // Prioritize entrance
                    }
                    current = current.parent;
                }

                while (obj.parent && !obj.userData.entityId) {
                    obj = obj.parent;
                }
                if (obj.userData.entityId) {
                    const entity = this.activeEntitiesCache.find(e => e.id === obj.userData.entityId);
                    if (entity) hitEntities.push(entity);
                }
            }

            hitEntities = this.sortRaycastEntities(
                hitEntities.filter(e => e.state !== 'DEAD' || e instanceof LootDrop)
            );
            this.raycastHitEntities = hitEntities;

            if (hitEntities.length > 0) {
                this.hoveredEntity = hitEntities[0];

                if (this.hoveredEntity instanceof LootDrop) {
                    document.body.style.cursor = 'grab';
                } else if (this.hoveredEntity instanceof Forge || this.hoveredEntity instanceof TradingHouse) {
                    document.body.style.cursor = 'pointer';
                } else if (this.hoveredEntity && this.hoveredEntity.state !== 'DEAD') {
                    document.body.style.cursor = 'crosshair';
                } else {
                    document.body.style.cursor = 'default';
                }
            } else {
                this.hoveredEntity = null;
                document.body.style.cursor = 'default';
            }
        } else {
            this.hoveredEntity = null;
            document.body.style.cursor = 'default';
        }

        this.refreshDungeonEntranceHint();
        this.refreshCombatIntentState();
    }

    getInteractionRangeForEntity(entity) {
        let range = 5.0;

        if (entity instanceof DwarfSalesman || entity instanceof Forge) {
            return 4.0;
        }

        if (entity instanceof TradingHouse) {
            return 20.0;
        }

        if (entity && entity.userData && entity.userData.interactionRadius) {
            return entity.userData.interactionRadius + 10.0;
        }

        if (this.isHostileActorTarget(entity)) {
            return this.getBasicAttackRangeForEntity(entity);
        }

        if (entity instanceof Actor && entity !== this.player) {
            if (entity.scale && entity.scale > 1.0) {
                range += (entity.scale - 1.0) * 1.5;
            }
        }

        return range;
    }

    getBasicAttackRangeForEntity(entity) {
        const className = this.player?.constructor?.name || this.player?.subType || '';
        let range = CONSTANTS.BASIC_ATTACK_RANGES[className] ?? 4.0;
        const attackerScale = Number(this.player?.scale) || 1;
        const targetScale = Number(entity?.scale) || 1;
        if (attackerScale > 1) range += (attackerScale - 1) * 1.5;
        if (targetScale > 1) range += (targetScale - 1) * 1.5;
        return range;
    }

}

export function installGameEngineMovement(targetClass) {
    installPrototypeMethods(targetClass, GameEngineMovementMethods);
}
