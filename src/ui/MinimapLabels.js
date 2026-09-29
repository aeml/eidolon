const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

// The radar is tiny: retain every marker, but only draw names that fit without
// covering icons, the player or one another. Full names remain on the atlas.
export function placeMinimapLabels(markers, half) {
    const reserved = markers.map(m => ({ x: m.x - 8, y: m.y - 8, width: 16, height: 16 }));
    reserved.push({ x: half - 10, y: half - 10, width: 20, height: 20 });
    const labels = [], radius = half - 9;
    const ordered = [...markers].sort((a, b) => (b.priority || 0) - (a.priority || 0) ||
        a.distance - b.distance || String(a.id).localeCompare(String(b.id)));
    for (const marker of ordered) {
        const width = Math.ceil(marker.width) + 8, height = 16;
        if (![marker.x, marker.y, width].every(Number.isFinite) || width <= 8) continue;
        const above = [marker.x - width / 2, marker.y - height - 10];
        const below = [marker.x - width / 2, marker.y + 10];
        const left = [marker.x - width - 10, marker.y - height / 2];
        const right = [marker.x + 10, marker.y - height / 2];
        // Try inward first for clipped edge markers, then alternatives. No
        // displacement of the marker itself or invented navigation position.
        const dx = marker.x - half, dy = marker.y - half;
        const inward = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? left : right) : (dy > 0 ? above : below);
        const diagonals = [[marker.x + 10, marker.y + 10], [marker.x - width - 10, marker.y + 10],
            [marker.x + 10, marker.y - height - 10], [marker.x - width - 10, marker.y - height - 10]];
        for (const [x, y] of [inward, above, below, left, right, ...diagonals]) {
            const box = { x, y, width, height };
            const inside = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
                .every(([px, py]) => Math.hypot(px - half, py - half) <= radius);
            if (!inside || reserved.some(other => overlaps(box, other))) continue;
            labels.push({ ...box, id: marker.id, text: marker.text, markerX: marker.x, markerY: marker.y });
            reserved.push({ x: x - 2, y: y - 2, width: width + 4, height: height + 4 });
            break;
        }
    }
    return labels;
}
