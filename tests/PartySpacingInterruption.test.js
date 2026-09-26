import { partySpacingActorInterruption } from './partyRangedSpacing.js';
import { partyPathAvoidsActors } from './partyDungeonControls.js';
import { GroundMovementFailedError, movementFailure } from './groundInputFailure.js';
import { tryDungeonGroundStep } from './dungeonNavigationInput.js';

function recordedSpacing() {
    // Actual waterraid0920a path and crossing FrostGuardian coordinates.
    // New capture fields identify the corresponding instance/collision receipt.
    const plan = {
        instanceId: 'test-raid', blockedStops: 2,
        origin: { x: 90012.19298640543, z: 19579.770774301098, radius: 1.25 },
        step: { dx: -0.7614140493242303, dz: -2.223555779957678 },
        bodies: [{ id: 'crossing-guardian', state: 'MOVING',
            x: 90009.48327552684, z: 19574.85290806396, radius: 1.25 }]
    };
    const observation = {
        before: { ...plan.origin, instanceId: plan.instanceId },
        player: { instanceId: plan.instanceId, state: 'IDLE', health: 2753 },
        movement: { blockedStops: 3, blockedTarget: { x: 90011.37947246045, z: 19577.54304679375 } },
        attempts: [{ mode: 'move-only-walk', clickProbe: { result: true, dom: 'CANVAS' } }],
        actors: [{ id: 'crossing-guardian', x: 90011.2109375, z: 19576.94140625, radius: 1.25 }]
    };
    return { plan, observation };
}

test('a witnessed crossing body invalidates optional spacing, not the movement-success assertion', async () => {
    const { plan, observation } = recordedSpacing();
    expect(partyPathAvoidsActors(plan.origin, plan.step, plan.bodies)).toBe(true);
    expect(partyPathAvoidsActors(plan.origin, plan.step, observation.actors)).toBe(false);
    expect(partySpacingActorInterruption(plan, observation)).toBe('crossing-guardian');
    const error = movementFailure('stopped before arrival', true, false, observation.attempts, observation);
    expect(error).toBeInstanceOf(GroundMovementFailedError);
    expect(error.observation).toBe(observation);
    // Ordinary traversal still propagates this error; only the optional combat
    // spacing caller may consume a proven obstruction and replan its next step.
    await expect(tryDungeonGroundStep(async () => { throw error; })).rejects.toBe(error);
});

test.each([
    ['no collision increment', o => { o.movement.blockedStops = 2; }],
    ['missing collision receipt', o => { delete o.movement.blockedTarget; }],
    ['different blocked target', o => { o.movement.blockedTarget.x += 1; }],
    ['instance changed', o => { o.player.instanceId = 'elsewhere'; }],
    ['different input origin', o => { o.before.x += 1; }],
    ['death', o => { o.player.state = 'DEAD'; }],
    ['zero health', o => { o.player.health = 0; }],
    ['still moving', o => { o.player.state = 'MOVING'; }],
    ['unobserved input', o => { o.attempts[0].clickProbe.result = false; }],
    ['UI interception', o => { o.attempts[0].clickProbe.dom = 'BUTTON'; }],
    ['different input mode', o => { o.attempts[0].mode = 'jump'; }],
    ['multiple inputs', o => { o.attempts.push(o.attempts[0]); }],
    ['missing body', o => { o.actors = []; }],
    ['unknown body', o => { o.actors[0].id = 'unobserved'; }],
    ['still-clear path', o => { o.actors[0].x -= 10; }],
    ['invalid geometry', o => { o.actors[0].x = NaN; }]
])('%s must remain an unexplained input failure', (_label, mutate) => {
    const { plan, observation } = recordedSpacing();
    mutate(observation);
    expect(partySpacingActorInterruption(plan, observation)).toBeNull();
});

test('a stationary or already obstructing body does not excuse a failed plan', () => {
    const { plan, observation } = recordedSpacing();
    plan.bodies = observation.actors.map(actor => ({ ...actor }));
    expect(partySpacingActorInterruption(plan, observation)).toBeNull();
    plan.bodies[0].x -= .4;
    expect(partySpacingActorInterruption(plan, observation)).toBeNull();
    expect(partySpacingActorInterruption(null, observation)).toBeNull();
    expect(partySpacingActorInterruption(plan, null)).toBeNull();
});

test('recorded Water golem crossing remains evidenced after it leaves the blocked path', () => {
    const plan = { instanceId: 'water-vigil', blockedStops: 10,
        origin: { x: 90050.09751597785, z: 19240.99045287158, radius: 1.25 },
        step: { dx: 3.5531993275071727, dz: -3.6450443540597917 },
        bodies: [{ id: 'golem', x: 90041.35140960531, z: 19237.476103033256, radius: 1.5 }] };
    const observation = { before: { ...plan.origin, instanceId: plan.instanceId },
        player: { instanceId: plan.instanceId, state: 'IDLE', health: 3025 },
        movement: { blockedStops: 11, blockedTarget: { x: 90053.58991337626, z: 19237.293931327935 } },
        attempts: [{ mode: 'move-only-walk', clickProbe: { result: true, dom: 'CANVAS',
            after: { id: 'golem', active: true, state: 'ATTACKING', position: { x: 90050.640625, z: 19240.529296875 } } } }],
        actors: [{ id: 'golem', x: 90056.359375, z: 19243.02734375, radius: 1.5 }] };
    expect(partyPathAvoidsActors(plan.origin, plan.step, plan.bodies)).toBe(true);
    expect(partyPathAvoidsActors(plan.origin, plan.step, observation.actors)).toBe(true);
    expect(partySpacingActorInterruption(plan, observation)).toBe('golem');
    for (const change of [{ active: false }, { state: 'DEAD' }, { id: 'unknown' },
        { position: { x: NaN, z: 0 } }, { position: plan.bodies[0] }]) {
        const attempt = observation.attempts[0];
        const invalid = { ...observation, attempts: [{ ...attempt, clickProbe: { ...attempt.clickProbe,
            after: { ...attempt.clickProbe.after, ...change } } }] };
        expect(partySpacingActorInterruption(plan, invalid)).toBeNull();
    }
    observation.movement.blockedStops = 10;
    expect(partySpacingActorInterruption(plan, observation)).toBeNull();
});
