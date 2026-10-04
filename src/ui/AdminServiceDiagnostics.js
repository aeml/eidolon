const count = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : 'Unavailable';
const releaseText = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : 'Unavailable';

// Fixed rows only. Never render unknown provider/environment/player fields or
// infer zero from a missing measurement. The view is one explicit observation,
// not a historical graph, capacity promise or independent-monitor status.
export function renderAdminServiceDiagnostics(list, service) {
    list.replaceChildren();
    const health = service?.health;
    if (!health || typeof health !== 'object') return false;
    const row = (label, value) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const detail = document.createElement('span');
        title.textContent = label; detail.textContent = value;
        item.append(title, detail); list.append(item);
    };
    const date = typeof service.sampledAt === 'string' && service.sampledAt.length <= 40 ? new Date(service.sampledAt) : null;
    row('Observed at', date && Number.isFinite(date.getTime()) ? date.toISOString() : 'Unavailable');
    row('Service readiness', health.status === 'ok' ? 'Ready' : health.status === 'unavailable' ? 'Unavailable' : 'Unknown');
    row('Database readiness', health.database === 'ready' ? 'Ready' : health.database === 'unavailable' ? 'Unavailable' : 'Unknown');
    row('Release', `${releaseText(health.version, /^Alpha [0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/)} · ${releaseText(health.commit, /^[a-zA-Z0-9._-]{7,80}$/)}`);
    row('Goroutines', count(health.goroutines));
    row('Heap allocation', Number.isSafeInteger(health.heapAllocBytes) && health.heapAllocBytes >= 0 ? `${(health.heapAllocBytes / 1048576).toFixed(2)} MiB` : 'Unavailable');
    row('Heap objects', count(health.heapObjects));
    const queue = health.broadcastQueues;
    row('Transient broadcasts queued', `${count(queue?.queued)} / ${count(queue?.capacity)}`);
    row('Encounter broadcasts queued', `${count(queue?.encounterQueued)} / ${count(queue?.encounterCapacity)}`);
    row('Broadcast drops since startup', `Transient: ${count(queue?.dropped)} · Encounter: ${count(queue?.encounterDropped)} · Invalid: ${count(queue?.invalidDropped)}`);
    for (const [key, label] of [
        ['characterJournal', 'Character journal writes'], ['characterCommit', 'Character database commits'],
        ['characterCleanup', 'Character journal cleanup'], ['characterRecovery', 'Character recovery passes'],
        ['casinoGold', 'Casino Gold transfer calls'], ['casinoEP', 'Casino EP transfer calls']
    ]) {
        const outcome = health.operational?.[key];
        row(label, `Completed calls: ${count(outcome?.completed)} · Returned errors: ${count(outcome?.failed)}`);
    }
    return true;
}
