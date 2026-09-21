import { darkRealmChapters } from '../data/chronicleCatalog.js';
import { getRecordedChronicleDiscoveries } from '../core/ChronicleInvestigation.js';

const districtNames = ['Resonant Foothold', 'Unwritten Shore', 'Tithe of Names', 'Stillwater Foundry', 'City Without Tomorrow'];

export function darkRealmObjectiveSites(quests) {
    return darkRealmChapters.flatMap(chapter => {
        const quest = quests?.find(q => q.id === chapter.id && q.accepted && !q.completed);
        if (!quest || !chapter.sites) return [];
        const recorded = new Set(getRecordedChronicleDiscoveries(quest).map(site => site.id));
        return chapter.sites.filter(site => !recorded.has(site.id) && (!site.requires || recorded.has(site.requires)));
    });
}

// Both maps use the server's actual floor rectangles, not overworld coordinates
// or dungeon completion overlays. Looking at the map never reveals journal text.
export function drawDarkRealmFloors(ctx, layout, toMap) {
    ctx.fillStyle = '#39384e';
    for (const rect of layout?.walkRects || []) {
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) =>
            toMap(rect.x + x * rect.width / 2, rect.z + z * rect.height / 2));
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
        ctx.closePath(); ctx.fill();
    }
}

export function drawDarkRealmWorldMap(ctx, width, height, engine, player) {
    const layout = engine.currentDungeonLayout;
    ctx.fillStyle = '#10121f'; ctx.fillRect(0, 0, width, height);
    if (!layout?.walkRects?.length) return;
    const rects = layout.walkRects;
    const minX = Math.min(...rects.map(r => r.x - r.width / 2)), maxX = Math.max(...rects.map(r => r.x + r.width / 2));
    const minZ = Math.min(...rects.map(r => r.z - r.height / 2)), maxZ = Math.max(...rects.map(r => r.z + r.height / 2));
    const scale = Math.min((width - 36) / (maxX - minX), (height - 110) / (maxZ - minZ));
    const point = (x, z) => ({ x: width / 2 + (x - (minX + maxX) / 2) * scale, y: height / 2 + (z - (minZ + maxZ) / 2) * scale });
    drawDarkRealmFloors(ctx, layout, point);
    ctx.textAlign = 'center'; ctx.font = '14px system-ui';
    ctx.fillStyle = '#e8d9f5'; ctx.fillText('Dark Realm · Level 100', width / 2, 24);
    for (const [index, room] of (layout.rooms || []).entries()) {
        const p = point(room.x, room.z);
        ctx.fillStyle = index === 0 ? '#9edbd1' : '#d4c4e3';
        ctx.fillText(districtNames[index] || 'Dark Realm', p.x, p.y - 12, Math.max(70, room.width * scale - 8));
    }
    const marker = (x, z, color, radius) => {
        const p = point(x, z); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
    };
    for (const site of darkRealmObjectiveSites(player.quests)) marker(site.x, site.z, '#ffd56a', 4);
    for (const guest of engine.remotePlayers?.values() || []) marker(guest.position.x, guest.position.z, '#77cbd6', 3);
    marker(player.position.x, player.position.z, '#ffffff', 5);
    ctx.fillStyle = '#d4c4e3'; ctx.font = '12px system-ui';
    ctx.fillText('Gold: your discoveries · White: you', width / 2, height - 34);
    ctx.fillText('Ilyra and recovery: Resonant Foothold', width / 2, height - 16);
}
