import { ATLAS_CATEGORIES } from './AtlasNavigation.js';

function overlaps(a, b, padding = 4) {
    return a.x < b.x + b.w + padding && a.x + a.w + padding > b.x && a.y < b.y + b.h + padding && a.y + a.h + padding > b.y;
}

export function drawAtlasLocations(ctx, locations, { project, width, height, scale, selectedId, filters, reservedLabels = [], clusterTown = true }) {
    const marks = [], labels = [...reservedLabels];
    const priority = p => p.id === selectedId ? 0 : p.id === 'lanternhold' ? 1 : p.category === 'entrances' ? 2 : p.category === 'quests' ? 3 : 4;
    const ordered = locations.filter(p => filters.has(p.category)).sort((a, b) => priority(a) - priority(b));
    for (const p of ordered) {
        // Town collapses into one selectable settlement at overview scale.
        // At street scale the actual service markers replace that cluster.
        if (clusterTown && p.id === 'lanternhold' && scale >= .4) continue;
        if (clusterTown && scale < .4 && p.id !== 'lanternhold' && p.x >= -100 && p.x <= 100 && p.z >= 100 && p.z <= 300 && p.id !== selectedId) continue;
        const pos = project(p.x, p.z);
        if (pos.x < 12 || pos.x > width - 12 || pos.y < 44 || pos.y > height - 30) continue;
        if (marks.some(mark => Math.hypot(mark.screen.x - pos.x, mark.screen.y - pos.y) < 15)) continue;
        const category = ATLAS_CATEGORIES[p.category];
        ctx.save(); ctx.fillStyle = '#121b20'; ctx.strokeStyle = category.color; ctx.lineWidth = p.id === selectedId ? 2.5 : 1.5;
        ctx.beginPath();
        if (p.category === 'entrances') {
            ctx.moveTo(pos.x, pos.y - 8); ctx.lineTo(pos.x + 8, pos.y); ctx.lineTo(pos.x, pos.y + 8); ctx.lineTo(pos.x - 8, pos.y); ctx.closePath();
        } else if (p.category === 'services') {
            ctx.moveTo(pos.x - 6, pos.y - 6); ctx.lineTo(pos.x + 6, pos.y - 6); ctx.lineTo(pos.x + 6, pos.y + 6); ctx.lineTo(pos.x - 6, pos.y + 6); ctx.closePath();
        } else ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = category.color; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
        if (!['services', 'entrances'].includes(p.category)) ctx.fillText(category.symbol, pos.x, pos.y + 4);
        marks.push({ ...p, screen: pos });
        ctx.font = p.id === selectedId ? 'bold 13px system-ui' : '12px system-ui';
        let name = p.name;
        const maxWidth = Math.min(190, width - 40);
        while (ctx.measureText(name).width > maxWidth && name.length > 4) name = `${name.replace(/…$/, '').slice(0, -2)}…`;
        const textWidth = ctx.measureText(name).width;
        const boxWidth = textWidth + 12;
        const candidates = [
            { x: pos.x + 12, y: pos.y - 10, w: boxWidth, h: 20 },
            { x: pos.x - boxWidth - 12, y: pos.y - 10, w: boxWidth, h: 20 },
            { x: pos.x - boxWidth / 2, y: pos.y + 13, w: boxWidth, h: 20 }
        ];
        const label = candidates.find(box => box.x >= 4 && box.x + box.w <= width - 4 && box.y >= 40 && box.y + box.h <= height - 24 &&
            !labels.some(other => overlaps(box, other)) && !marks.some(mark => overlaps(box, { x: mark.screen.x - 8, y: mark.screen.y - 8, w: 16, h: 16 })));
        if (label) {
            ctx.fillStyle = 'rgba(12, 20, 24, .9)'; ctx.fillRect(label.x, label.y, label.w, label.h);
            ctx.fillStyle = p.id === selectedId ? '#fff0c4' : '#e5dbc3'; ctx.textAlign = 'left';
            ctx.fillText(name, label.x + 6, label.y + 14); labels.push(label);
        }
        ctx.restore();
    }
    return marks;
}

export function drawAtlasFrame(ctx, width, height, scale) {
    ctx.save(); ctx.strokeStyle = '#7b745c'; ctx.fillStyle = '#e5d8b9'; ctx.lineWidth = 1;
    const cx = width - 30, cy = 27;
    ctx.beginPath(); ctx.moveTo(cx - 11, cy + 11); ctx.lineTo(cx + 11, cy - 11);
    ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.stroke();
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('N', cx + 15, cy - 12);
    // The map projection is isometric in orientation, but preserves distances.
    const desired = 70 / scale, power = 10 ** Math.floor(Math.log10(desired));
    const metres = [5, 2, 1].map(n => n * power).find(n => n <= desired) || power;
    const pixels = metres * scale;
    ctx.beginPath(); ctx.moveTo(16, height - 21); ctx.lineTo(16, height - 16);
    ctx.lineTo(16 + pixels, height - 16); ctx.lineTo(16 + pixels, height - 21); ctx.stroke();
    ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(`${metres}m`, 16, height - 25);
    ctx.restore();
}
