// Browser preferences are optional. Blocking persistence must not prevent a
// login, HUD construction or an in-session setting change. Never store account
// authority here; character state and resume tokens have separate lifetimes.
export function readPreference(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

export function writePreference(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
}
