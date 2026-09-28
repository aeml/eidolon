import { PORTAL_DIRECTIONS } from '../data/worldLocations.js';
import { getResonancePortalState, PORTAL_CRYSTALS } from '../core/ResonancePortalState.js';

export function openResonancePortalDialog(engine, portal) {
    document.getElementById('resonance-portal-dialog')?.__closeMenu?.();
    const opener = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'resonance-portal-dialog';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'resonance-portal-title');
    dialog.style.cssText = 'box-sizing:border-box;width:min(92vw,520px);max-height:85dvh;overflow:auto;padding:24px;color:#ece3d3;background:linear-gradient(155deg,#242332,#0e121b);border:1px solid #b59b64;border-radius:16px;box-shadow:0 25px 90px #000b;font:16px/1.5 system-ui,sans-serif;pointer-events:auto;';
    const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; dialog.append(node); return node; };
    text('small', 'LANTERNHOLD · THE FOURFOLD COVENANT').style.color = '#c8b585';
    const heading = text('h2', 'Fourfold Resonance Portal'); heading.id = 'resonance-portal-title';
    heading.style.cssText = 'font:600 26px/1.2 Georgia,serif;margin:12px 0;';
    const status = text('p', ''); status.setAttribute('role', 'status');
    const list = document.createElement('ul'); dialog.append(list);
    list.style.cssText = 'list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;';
    text('p', 'Each traveler needs level 100. Defend Maelin in all four raid Vigils and claim each repair with Ilyra; your party leader cannot unlock this passage for you.');
    text('p', 'Arrive at the safe Resonant Foothold and speak with Ilyra’s projection. To come back, choose Return to Lanternhold in the game menu (B). Recorded discoveries stay saved.');
    const lore = document.createElement('details'); dialog.append(lore);
    const summary = document.createElement('summary'); summary.textContent = 'Ilyra’s covenant · About this place'; lore.append(summary);
    for (const value of ['“These facets carry the voices of the four distant sanctums. No crystal leaves its people unprotected. When their freely given notes agree, they hold a road through the silence.” — Ilyra', PORTAL_DIRECTIONS + ' The Dungeon Guide also offers passage.']) {
        const paragraph = document.createElement('p'); paragraph.textContent = value; lore.append(paragraph);
    }
    const cross = text('button', 'Enter the Dark Realm');
    cross.id = 'btn-cross-resonance-portal'; cross.type = 'button'; cross.className = 'menu-btn';
    cross.style.cssText = 'width:100%;min-height:48px;white-space:normal;margin-top:18px;border:1px solid #b59b64;border-radius:8px;background:linear-gradient(#564c6d,#30283f);color:#fff0d1;font:600 16px system-ui;cursor:pointer;';
    const close = text('button', 'Stay in Lanternhold'); close.type = 'button'; close.className = 'menu-btn';
    close.style.cssText = 'width:100%;min-height:48px;margin-top:10px;white-space:normal;border:1px solid #716573;border-radius:8px;background:#171a24;color:#ded8cb;font:16px system-ui;cursor:pointer;';
    let closed = false, signature = '';
    const cleanup = () => {
        if (closed) return;
        closed = true; dialog.remove();
        if (opener?.isConnected) opener.focus();
    };
    dialog.__closeMenu = cleanup;
    dialog.addEventListener('cancel', event => { event.preventDefault(); cleanup(); });
    dialog.addEventListener('close', cleanup);
    // Modal keys must never bubble into movement, abilities, chat or Escape UI.
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Tab') {
            const controls = [...dialog.querySelectorAll('summary, button:not(:disabled)')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        }
    });
    close.onclick = cleanup;
    cross.onclick = () => {
        if (!portal.canInteract(engine) || !getResonancePortalState(engine.player).eligible) { update(); return; }
        engine.network?.send?.('enter_dark_realm', {});
        cleanup();
    };
    const playerID = engine.player?.id;
    const update = () => {
        if (closed) return;
        if (engine.player?.id !== playerID || !portal.canInteract(engine)) { cleanup(); return; }
        const state = getResonancePortalState(engine.player);
        const next = JSON.stringify(state);
        if (next === signature) return;
        signature = next;
        status.textContent = state.eligible ? 'Active · The road to the Resonant Foothold is open to you.'
            : state.stage === 'ready' ? 'Resonance ready · Reach level 100 to cross.' : 'Dormant · Restore and claim all four crystal Vigils.';
        list.replaceChildren(...PORTAL_CRYSTALS.map((crystal, index) => {
            const item = document.createElement('li');
            item.textContent = `${crystal.name}: ${state.restored[index] ? 'restored' : state.legacy ? 'veteran passage preserved' : 'Vigil not yet claimed'}`;
            item.style.cssText = `padding:10px;border:1px solid #${crystal.color.toString(16)}66;border-radius:8px;background:#ffffff06;font-size:14px;`;
            return item;
        }));
        cross.disabled = !state.eligible;
        cross.style.opacity = state.eligible ? '1' : '.45';
    };
    document.body.append(dialog); update();
    if (!closed) { dialog.showModal(); dialog.focus({ preventScroll: true }); dialog.scrollTop = 0; }
    return { update, close: cleanup };
}
