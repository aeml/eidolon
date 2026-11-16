// Optional public lore is a read-only document, not a quest conversation. It
// sends no network command and never claims a reward or recorded-discovery bit.
export function openWorldReadingDialog(engine, entity) {
    document.getElementById('world-reading-dialog')?.__closeMenu?.();
    const opener = document.activeElement, ownerId = engine.player?.id;
    const dialog = document.createElement('dialog');
    dialog.id = 'world-reading-dialog'; dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'world-reading-title');
    dialog.style.cssText = 'box-sizing:border-box;width:min(92vw,600px);max-height:85dvh;overflow:hidden;flex-direction:column;gap:12px;padding:24px;color:#ece3d3;background:linear-gradient(150deg,#292a25,#11191d);border:1px solid #a9966b;border-radius:12px;box-shadow:0 25px 90px #000b;font:16px/1.65 system-ui,sans-serif;pointer-events:auto;';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;';
    const body = document.createElement('div'); body.className = 'world-reading-body';
    body.tabIndex = 0;
    body.setAttribute('role', 'region'); body.setAttribute('aria-labelledby', 'world-reading-title');
    body.style.cssText = 'overflow:auto;min-height:0;overscroll-behavior:contain;';
    dialog.append(header, body);
    const text = (tag, value, parent = body) => { const node = document.createElement(tag); node.textContent = value; parent.append(node); return node; };
    text('small', `${entity.name} · OPTIONAL LORE`, header).style.color = '#c9b888';
    const title = text('h2', entity.reading.reading.title); title.id = 'world-reading-title';
    title.style.cssText = 'font:600 27px/1.2 Georgia,serif;margin:12px 0;';
    text('p', entity.reading.reading.introduction).style.fontStyle = 'italic';
    for (const paragraph of entity.reading.reading.paragraphs) text('p', paragraph);
    text('small', 'Read freely · No quest, reward or saved discovery is required. This is not a safe zone.');
    const close = text('button', '×', header); close.type = 'button'; close.setAttribute('aria-label', 'Close reading');
    close.style.cssText = 'flex-shrink:0;width:44px;min-height:44px;border:1px solid #a9966b;border-radius:8px;background:#263027;color:#f5eddc;font:600 24px system-ui;cursor:pointer;';
    let closed = false;
    const cleanup = () => {
        if (closed) return;
        closed = true; dialog.remove();
        if (opener?.isConnected) opener.focus();
    };
    dialog.__closeMenu = cleanup;
    dialog.addEventListener('cancel', event => { event.preventDefault(); cleanup(); });
    dialog.addEventListener('close', cleanup);
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); cleanup(); }
        if (event.key === 'Tab') {
            event.preventDefault();
            (document.activeElement === close ? body : close).focus({ preventScroll: true });
        }
    });
    for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'wheel']) {
        dialog.addEventListener(type, event => event.stopPropagation());
    }
    close.onclick = cleanup;
    const update = () => {
        if (!closed && (engine.player?.id !== ownerId || !entity.canInteract(engine))) cleanup();
    };
    document.body.append(dialog); update();
    if (!closed) { dialog.showModal(); dialog.style.display = 'flex'; dialog.focus({ preventScroll: true }); }
    return { close: cleanup, update };
}
