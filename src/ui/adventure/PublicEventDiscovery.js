const PHASES = Object.freeze({ announced: 'Gather at the ward', defending: 'Defend the ward',
    champion: 'Defeat the Fracturekeeper', complete: 'Road restored' });

export function publicEventTime(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'Time unavailable';
}

// Use published server windows; reaching a local deadline cannot start an event.
// Stable occurrence identities let a scheduled waypoint remain the same site
// when that occurrence becomes current, instead of following the next realm.
export function getPublicEventLocations(event) {
    if (!event) return [];
    const windows = [...(PHASES[event.phase] ? [{ ...event, current: true }] : []),
        ...(Array.isArray(event.upcoming) ? event.upcoming.slice(0, 3) : [])];
    const seen = new Set(), locations = [];
    for (const window of windows) {
        const site = window?.site;
        if (!site || !Number.isFinite(site.x) || !Number.isFinite(site.z)) continue;
        const id = window.id ? `public-event-${window.id}` : window.current ? 'public-event' : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const phase = window.current ? PHASES[event.phase] : 'Scheduled';
        locations.push({ id, name: site.title || 'World event', category: 'events', instanceId: '',
            symbol: window.current ? '✦' : '◷', x: site.x, z: site.z,
            purpose: `${site.objective || 'Cooperate at the ward.'} ${site.lore || ''} Normal enemy loot and nearby party XP; completion calms nearby hazards, with no Gold purse or reward claim.`,
            availability: `${phase} · ${site.realm || 'elemental'} realm · recommended level ${site.level || '?'} · Begins ${publicEventTime(window.startsAt)} · Ends ${publicEventTime(window.endsAt)}. Scheduled windows need nearby adventurers to activate; empty events expire. Anyone may help.` });
    }
    return locations;
}
