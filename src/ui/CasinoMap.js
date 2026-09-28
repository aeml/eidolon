import { CASINO_INTERIOR_LAYOUT } from '../data/casinoInteriorLayout.js';

const GAMES = Object.freeze({
    slots: { label: 'Slots', symbol: 'S', color: '#bf9de0' },
    blackjack: { label: 'Blackjack', symbol: 'BJ', color: '#d8b875' },
    poker: { label: 'Hold’em', symbol: 'H', color: '#8fcbaf' },
    roulette: { label: 'Roulette', symbol: 'R', color: '#ed9292' },
    baccarat: { label: 'Baccarat', symbol: 'B', color: '#8ebcde' }
});

export function isCasinoMapGuestVisible(engine, guest) {
    return Number.isFinite(guest?.position?.x) && Number.isFinite(guest?.position?.z)
        && Number.isFinite(guest?.position?.y)
        && (guest.position.y >= 7.5) === (engine?.casino?.floor === 'vip')
        && (!guest.instanceId || guest.instanceId === engine.currentInstanceId);
}

export function getCasinoMapLandmarks(engine) {
    const floor = engine?.casino?.floor === 'vip' ? 'vip' : 'public';
    return floor === 'vip' ? [
        { x: 0, z: CASINO_INTERIOR_LAYOUT.stairsZ, label: 'Return downstairs', shortLabel: 'Downstairs', color: '#e8c980', ring: true }
    ] : [
        { x: 0, z: CASINO_INTERIOR_LAYOUT.guardZ,
            label: engine?.casino?.vipActive ? 'VIP Guard · Upstairs access' : 'VIP Guard · VIP required',
            shortLabel: 'VIP Guard', color: '#e8c980', ring: true },
        { x: 0, z: CASINO_INTERIOR_LAYOUT.exitZ, label: 'Exit to Lanternhold', shortLabel: 'Exit', color: '#78e08f', ring: true }
    ];
}

export function getCasinoMapState(engine) {
    const floor = engine?.casino?.floor === 'vip' ? 'vip' : 'public';
    const landmarks = getCasinoMapLandmarks(engine);
    const tables = (engine?.casino?.data?.tables || [])
        .filter(table => (table.floor || 'public') === floor && GAMES[table.game]
            && Number.isFinite(table.x) && Number.isFinite(table.z))
        .map(table => ({ id: table.id, x: table.x, z: table.z, ...GAMES[table.game] }));
    const guests = [...(engine?.remotePlayers?.values() || [])].filter(guest => isCasinoMapGuestVisible(engine, guest));
    return { floor, landmarks, tables, guests };
}

export function drawCasinoWorldMap(ctx, width, height, engine, player) {
    const { floor, landmarks, tables, guests } = getCasinoMapState(engine);
    const layout = CASINO_INTERIOR_LAYOUT;
    const scale = Math.max(.01, Math.min((width - 40) / layout.width, (height - 110) / layout.depth));
    const cx = width / 2, cy = height / 2 - 8;
    const point = (x, z) => [cx + x * scale, cy + (z - layout.centerZ) * scale];
    ctx.save();
    ctx.fillStyle = '#101923'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = floor === 'vip' ? '#342943' : '#263644';
    const bounds = [cx - layout.width * scale / 2, cy - layout.depth * scale / 2,
        layout.width * scale, layout.depth * scale];
    ctx.fillRect(...bounds);
    ctx.strokeStyle = '#c6a366'; ctx.lineWidth = 2; ctx.strokeRect(...bounds);
    ctx.fillStyle = '#d8bf88'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`Lanternhold Casino · ${floor === 'vip' ? 'VIP / EP' : 'Public / Gold'}`, cx, 20);
    ctx.font = '10px system-ui';
    for (const table of tables) {
        const [x, y] = point(table.x, table.z);
        ctx.fillStyle = table.color; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101923'; ctx.fillText(table.symbol, x, y + 3);
    }
    ctx.font = '12px system-ui';
    for (const landmark of landmarks) {
        const [x, y] = point(landmark.x, landmark.z);
        ctx.fillStyle = landmark.color; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(landmark.label, x, landmark.z < layout.centerZ
            ? cy - layout.depth * scale / 2 - 10 : y + 17);
    }
    for (const guest of guests) {
        const [x, y] = point(guest.position.x, guest.position.z);
        ctx.fillStyle = '#65d7e8'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const [px, py] = point(player.position.x, player.position.z);
    ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('You', px, py - 9);
    ctx.fillStyle = '#ddd5c8'; ctx.font = '12px system-ui';
    ctx.fillText('S Slots · BJ Blackjack · H Hold’em', cx, height - 25);
    ctx.fillText('R Roulette · B Baccarat', cx, height - 9);
    ctx.restore();
}
