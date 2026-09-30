// Persistent DOM/global listeners belong to one UI instance. Do not register
// listeners on transient rows here: their removed DOM already owns their
// lifetime, and keeping every row until logout would create another leak.
const scopes = new WeakMap();

export function ownedEvent(owner, target, type, handler, options) {
    if (!target?.addEventListener) return;
    let scope = scopes.get(owner);
    if (!scope) scopes.set(owner, scope = { listeners: [], disposed: false });
    if (scope.disposed) return;
    target.addEventListener(type, handler, options);
    scope.listeners.push({ target, type, handler, capture: typeof options === 'boolean' ? options : Boolean(options?.capture) });
}

export function disposeOwnedEvents(owner) {
    let scope = scopes.get(owner);
    if (!scope) scopes.set(owner, scope = { listeners: [], disposed: false });
    if (scope.disposed) return;
    scope.disposed = true;
    for (const { target, type, handler, capture } of scope.listeners) target.removeEventListener(type, handler, capture);
    scope.listeners.length = 0;
}
