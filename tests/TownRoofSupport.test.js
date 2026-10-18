import { Vector3, Ray, Plane, Box3, Matrix4, Object3D, Quaternion } from 'three';
import { TownRoofField } from '../src/core/TownRoofs.js';
import { TOWN_ROOFS } from '../src/data/townRoofs.generated.js';
import { intersectEngineGround, getGroundedActorHeight, getActorCombatDistance } from '../src/core/WorldGrounding.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';

class MovementHarness {}
installGameEngineMovement(MovementHarness);

const field = new TownRoofField();

test.each(TOWN_ROOFS.placements)('$id follows an actual pitched roof and ray selection chooses its visible surface', p => {
    const roof = field.sample(p.x, p.z, p.id);
    expect(roof?.id).toBe(p.id);
    expect(roof.y).toBeGreaterThan(4);
    const engine = { townRoofField: field }, target = new Vector3();
    const ray = new Ray(new Vector3(p.x, 50, p.z), new Vector3(0, -1, 0));
    expect(intersectEngineGround(engine, ray, target, new Plane(new Vector3(0, 1, 0), 0))).toBe(target);
    expect(target.y).toBeCloseTo(roof.y, 4);
    const actor = { position: target.clone(), supportSurface: p.id, state: 'IDLE', gameEngine: engine };
    engine.player = actor;
    expect(getGroundedActorHeight(actor)).toBeCloseTo(roof.y, 6);
    expect(getGroundedActorHeight(actor, new Vector3(200, roof.y, 400))).toBeNull();
    const movement = Object.assign(new MovementHarness(), { townRoofField: field, currentInstanceId: '', terrainElevation: { sample: () => 0 } });
    const start = new Vector3(p.x - 32, 0, p.z), end = new Vector3(p.x, 99999, p.z);
    expect(movement.resolveRoofJumpLanding(end, start)).toBe(true);
    expect(end.y).toBeCloseTo(roof.y, 6);
    expect(movement.getJumpBasePositionAtProgress({ start, end }, .5).y).toBeCloseTo(roof.y / 2, 6);
    expect(movement.getJumpBasePositionAtProgress({ start: end, end: start }, .5).y).toBeCloseTo(roof.y / 2, 6);
});

test('authored roof slopes are not replaced by flat bounding-box tops', () => {
    const p = TOWN_ROOFS.placements[0];
    const ridge = field.sample(p.x, p.z, p.id);
    const eave = field.sample(p.x + Math.sin(p.rotation) * 3, p.z + Math.cos(p.rotation) * 3, p.id);
    expect(ridge.y - eave.y).toBeGreaterThan(.5);
});

test('roof walking clears its own wall collider while ground walking still collides', () => {
    const p = TOWN_ROOFS.placements[0], roof = field.sample(p.x, p.z, p.id);
    const collision = new CollisionManager(); collision.roofField = field;
    const matrix = new Matrix4().makeTranslation(p.x, 0, p.z);
    collision.addOrientedCollider({ roofSupport: p.id, box: new Box3(new Vector3(-4, -2, -4), new Vector3(4, 30, 4)), matrix, inverse: matrix.clone().invert() });
    expect(collision.checkCollision(new Vector3(p.x, roof.y, p.z), 1.25)).toBeNull();
    expect(collision.checkCollision(new Vector3(p.x, 0, p.z), 1.25)).not.toBeNull();
});

test('ground versus roof melee uses vertical strike separation', () => {
    const a = { constructor: { name: 'Fighter' }, position: new Vector3(-74, 8, 130), supportSurface: 'town-home-0', scale: 1 };
    const b = { position: new Vector3(-74, 0, 130), scale: 1 };
    expect(getActorCombatDistance({}, a, b)).toBe(8);
    b.scale = .5;
    expect(getActorCombatDistance({}, a, b)).toBe(8);
    expect(field.sample(500, 500)).toBeNull();
});

test.each([false, true])('roof takeoff and rendered jump keep their floor with raised terrain %s', raised => {
    const p = TOWN_ROOFS.placements[0], roof = field.sample(p.x, p.z, p.id);
    const player = { position: new Vector3(p.x, roof.y, p.z), supportSurface: p.id,
        state: 'IDLE', mesh: new Object3D(), rotation: new Quaternion() };
    player.mesh.position.copy(player.position);
    const movement = Object.assign(new MovementHarness(), { townRoofField: field,
        currentInstanceId: '', terrainElevation: raised ? { sample: () => 0 } : null,
        player, abilityController: {}, playAudioCue: () => {} });
    player.gameEngine = movement;
    const end = new Vector3(p.x - 32, 0, p.z);
    expect(movement.startPlayerJump(end)).toBe(true);
    const jump = movement.playerJumpState;
    expect(jump.start.y).toBeCloseTo(roof.y, 6);
    jump.elapsed = jump.duration / 2;
    jump.visualProgress = .5;
    jump.visualHeight = jump.height;
    player.position.copy(movement.getJumpBasePositionAtProgress(jump, .5));
    movement.applyEntityJumpVisuals(player, jump);
    expect(player.mesh.position.y).toBeCloseTo(roof.y / 2 + jump.height, 6);
    player.position.set(p.x, roof.y, p.z);
    movement.playerJumpState = null;
    movement.applyEntityJumpVisuals(player, { progress: 1, visualHeight: 0,
        landingVisual: { positionFrom: player.position.clone(), elapsed: 90, duration: 180, impact: .85 } });
    expect(player.mesh.position.y).toBeCloseTo(roof.y, 6);
});
