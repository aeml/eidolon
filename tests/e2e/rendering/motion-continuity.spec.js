import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.use({ video: 'on' });

for (const quality of ['high', 'low']) test(`${quality} supplied class jumps and rested auras keep a continuous rendered pose`, async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        document.getElementById('start-screen').style.display = 'none';
        const samples = [];
        const errors = [];
        const originalError = console.error;
        console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
        try {
            for (const className of ['Fighter', 'Rogue', 'Cleric', 'Wizard']) {
                const socket = { readyState: WebSocket.OPEN, send() {}, close() {} };
                const game = new GameEngine(className, false, true, '', '', socket);
                try {
                    game.renderSystem.setGraphicsQuality(quality);
                    game.player = game.createRemotePlayer('Player', `motion-fixture-${className}`, className);
                    const actor = game.player;
                    actor.gameEngine = game;
                    await actor.ensureMesh();
                    if (actor.mesh.userData.authoredClass !== className) throw Error(`Missing supplied ${className}`);
                    game.chunkManager.addEntity(actor);
                    game.renderSystem.add(actor.mesh);
                    actor.position.set(0, 0, 0);
                    actor.mesh.position.copy(actor.position);
                    actor.wellRestedSeconds = 100;
                    actor.syncAttachedStatusEffects(0);
                    game.cameraLocked = true;
                    game.isDestroyed = true; // Drive the real loop once per native RAF.
                    game.lastTime = 0; game.accumulator = 0;
                    game.chunkManager.update(actor, 0, game.collisionManager, game.floatingTextManager, game);
                    if (!game.chunkManager.getActiveEntities().includes(actor)) throw Error('Fixture actor is outside active chunks');
                    game.render(1);
                    // Render frames between simulation ticks, including a correction
                    // and airborne height. The aura must share the final pose exactly.
                    let maxAuraError = 0;
                    for (const x of [.03, .06, .09, .12]) {
                        actor.position.set(x, .2, x * .5);
                        game.render(.5);
                        maxAuraError = Math.max(maxAuraError, actor.attachedStatusEffects.get('well_rested').group.position.distanceTo(actor.mesh.position));
                    }
                    actor.position.set(0, 0, 0); actor.mesh.position.copy(actor.position);
                    let animationStarts = 0;
                    const playJump = actor.playJumpAnimation.bind(actor);
                    actor.playJumpAnimation = state => { animationStarts++; return playJump(state); };
                    game.startPlayerJump(new THREE.Vector3(27, 0, 0));
                    const { duration, height } = game.playerJumpState;
                    const positions = [0];
                    let pendingPacket = null, landingPending = false;
                    const update = game.update.bind(game);
                    game.update = (...args) => {
                        // Match production: loop advances the flight clock before
                        // update drains network messages in the same render frame.
                        if (pendingPacket) {
                            game.syncAuthoritativeJumpState(actor, pendingPacket);
                            pendingPacket = null;
                        }
                        if (landingPending) {
                            actor.state = 'IDLE'; game.clearAuthoritativeJumpState(actor);
                            landingPending = false;
                        }
                        return update(...args);
                    };
                    let maxClipPhaseError = 0, contactAngle = null, contactScaleError = null;
                    for (let frame = 1; frame <= 90; frame++) {
                        await new Promise(resolve => requestAnimationFrame(resolve));
                        if (frame % 6 === 0 && frame < 72) {
                            const progress = Math.max(0, (frame - 4) / 78);
                            const packet = { state: 'JUMPING', x: 27 * progress, y: Math.sin(progress * Math.PI) * height, z: 0,
                                jumpStartX: 0, jumpStartY: 0, jumpStartZ: 0, jumpTargetX: 27, jumpTargetY: 0, jumpTargetZ: 0,
                                jumpDuration: duration, jumpHeight: height, jumpProgress: progress };
                            pendingPacket = frame % 12 === 0
                                ? { state: packet.state, x: packet.x, y: packet.y, z: packet.z, jumpProgress: packet.jumpProgress } : packet;
                        }
                        if (frame === 72) landingPending = true;
                        game.loop(frame * 1000 / 60);
                        positions.push(actor.mesh.position.x);
                        maxAuraError = Math.max(maxAuraError, actor.attachedStatusEffects.get('well_rested').group.position.distanceTo(actor.mesh.position));
                        if (game.playerJumpState) {
                            const expected = actor.currentAction.getClip().duration * game.getJumpVisualProgress(game.playerJumpState);
                            maxClipPhaseError = Math.max(maxClipPhaseError, Math.abs(actor.currentAction.time - expected));
                        }
                        if (frame === 78) {
                            contactAngle = actor.mesh.quaternion.angleTo(actor.rotation);
                            contactScaleError = actor.mesh.scale.distanceTo(actor.mesh.userData.baseScale);
                        }
                    }
                    const steps = positions.slice(1, 72).map((x, i) => x - positions[i]);
                    samples.push({ className, supplied: actor.mesh.userData.authoredClass, animationStarts, maxAuraError, maxClipPhaseError,
                        flightStepSpread: Math.max(...steps) - Math.min(...steps), contactAngle, contactScaleError,
                        endpointError: actor.mesh.position.distanceTo(new THREE.Vector3(27, 0, 0)), stillJumping: Boolean(game.playerJumpState) });
                } finally { game.isDestroyed = false; game.destroy(); }
            }
            return { quality, samples, errors };
        } finally { console.error = originalError; }
    }, quality);
    await writeFile(testInfo.outputPath('motion-continuity.json'), JSON.stringify(result, null, 2));
    await testInfo.attach('motion-continuity', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.errors).toEqual([]);
    for (const sample of result.samples) {
        expect(sample.supplied).toBe(sample.className);
        expect(sample.animationStarts).toBe(1);
        expect(sample.maxAuraError).toBeLessThan(1e-6);
        expect(sample.maxClipPhaseError).toBeLessThan(1e-6);
        expect(sample.flightStepSpread).toBeLessThan(.001);
        expect(sample.contactAngle).toBeLessThan(.001);
        expect(sample.contactScaleError).toBeLessThan(.001);
        expect(sample.endpointError).toBeLessThan(.001);
        expect(sample.stillJumping).toBe(false);
    }
});
