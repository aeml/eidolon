// Retain source identities and callers, never raw CDP profiles, URL queries,
// arguments, account data or browser-extension metadata.
export function summarizePartyCPUProfile(profile, origin) {
    const nodes = new Map(), parents = new Map(), functions = new Map(), chains = new Map();
    for (const node of profile.nodes || []) {
        let source = '';
        if (node.callFrame?.url) {
            try {
                const url = new URL(node.callFrame.url);
                if (url.origin !== origin || !/^\/(?:src|vendor)\//.test(url.pathname)) continue;
                source = url.pathname;
            } catch { continue; }
        }
        nodes.set(node.id, { source, name: node.callFrame?.functionName || '<anonymous>', line: (node.callFrame?.lineNumber ?? -1) + 1 });
    }
    for (const node of profile.nodes || []) for (const child of node.children || []) parents.set(child, node.id);
    const identity = frame => JSON.stringify([frame.source, frame.name, frame.line]);
    for (const [index, id] of (profile.samples || []).entries()) {
        const frame = nodes.get(id);
        if (!frame) continue;
        const delta = profile.timeDeltas?.[index];
        const micros = Number.isFinite(delta) && delta >= 0 ? delta : 0;
        const key = identity(frame), entry = functions.get(key) || { ...frame, samples: 0, selfMicros: 0 };
        entry.samples++; entry.selfMicros += micros; functions.set(key, entry);
        const stack = [], visited = new Set();
        let current = id, previous;
        // Deep recursive tree searches collapse to one function entry, keeping
        // the actual outer caller. A broken/cyclic synthetic profile terminates.
        while (current !== undefined && !visited.has(current)) {
            visited.add(current);
            const caller = nodes.get(current);
            if (!caller) break;
            const callerKey = identity(caller);
            if (callerKey !== previous) stack.push(caller);
            previous = callerKey; current = parents.get(current);
        }
        const bounded = stack.slice(0, 12), chainKey = JSON.stringify(bounded);
        const chain = chains.get(chainKey) || { stack: bounded, samples: 0, selfMicros: 0 };
        chain.samples++; chain.selfMicros += micros; chains.set(chainKey, chain);
    }
    const descending = (a, b) => b.selfMicros - a.selfMicros;
    return { summary: [...functions.values()].sort(descending).slice(0, 24),
        callerChains: [...chains.values()].sort(descending).slice(0, 16) };
}
