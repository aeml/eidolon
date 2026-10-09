import { summarizePartyCPUProfile } from './e2e/party-cpu-summary.js';

const origin = 'http://127.0.0.1:4190';
const node = (id, name, source = '', children = []) => ({ id, callFrame: { functionName: name, url: source, lineNumber: 4 }, children });

test('recursive tree searches retain the real caller, with exact self-time rather than inflated inclusive samples', () => {
    const profile = { nodes: [node(1, '(root)', '', [2]), node(2, 'update', `${origin}/src/entities/Actor.js`, [3]),
        node(3, 'getObjectByName', `${origin}/vendor/three/build/three.core.js`, [4]),
        node(4, 'getObjectByProperty', `${origin}/vendor/three/build/three.core.js`, [5]),
        node(5, 'getObjectByProperty', `${origin}/vendor/three/build/three.core.js`)], samples: [5, 5, 2], timeDeltas: [100, 200, 20] };
    const result = summarizePartyCPUProfile(profile, origin);
    expect(result.summary[0]).toMatchObject({ name: 'getObjectByProperty', samples: 2, selfMicros: 300 });
    expect(result.callerChains[0].stack.map(f => f.name)).toEqual(['getObjectByProperty', 'getObjectByName', 'update', '(root)']);
    expect(result.callerChains.reduce((sum, chain) => sum + chain.selfMicros, 0)).toBe(320);
});

test('identical search functions keep separate callers instead of conflating actor and input cost', () => {
    const profile = { nodes: [node(1, 'update', `${origin}/src/entities/Actor.js`, [2]),
        node(2, 'getObjectByProperty'), node(3, 'handleInput', `${origin}/src/core/GameEngineMovement.js`, [4]),
        node(4, 'getObjectByProperty')], samples: [2, 4], timeDeltas: [50, 90] };
    const result = summarizePartyCPUProfile(profile, origin);
    expect(result.summary[0].selfMicros).toBe(140);
    expect(result.callerChains.map(c => [c.stack[1].name, c.selfMicros])).toEqual([['handleInput', 90], ['update', 50]]);
});

test('only local source paths survive; query/fragment/auth/foreign/extension URLs are not exported', () => {
    const profile = { nodes: [node(1, 'tick', `${origin}/src/core/RenderSystem.js?session=synthetic#private`),
        node(2, 'foreign', 'https://external.example/src/private.js'), node(3, 'extension', 'chrome-extension://synthetic/file.js'),
        node(4, 'account', `${origin}/account/synthetic`), node(5, 'data', 'data:text/javascript,synthetic')],
    samples: [1, 2, 3, 4, 5], timeDeltas: [100, 100, 100, 100, 100] };
    const result = summarizePartyCPUProfile(profile, origin), output = JSON.stringify(result);
    expect(result.summary).toEqual([{ source: '/src/core/RenderSystem.js', name: 'tick', line: 5, samples: 1, selfMicros: 100 }]);
    expect(output).not.toMatch(/session|synthetic|external|extension|private/);
});

test('empty, missing-sample, invalid-delta and cyclic profiles terminate with bounded output', () => {
    expect(summarizePartyCPUProfile({}, origin)).toEqual({ summary: [], callerChains: [] });
    const result = summarizePartyCPUProfile({ nodes: [node(1, 'a', '', [2]), node(2, 'b', '', [1])],
        samples: [1, 2, 999], timeDeltas: [-1, NaN, 100] }, origin);
    expect(result.summary.every(f => f.selfMicros === 0)).toBe(true);
    expect(result.callerChains.every(c => c.stack.length === 2)).toBe(true);
});
