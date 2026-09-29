import { placeMinimapLabels } from '../src/ui/MinimapLabels.js';

const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const marker = (id, x, y, priority = 0) => ({ id, text: id, x, y, width: 48, distance: 50, priority });

test('crowded radar labels stay inside the circle and clear all icons and the player', () => {
    const markers = [marker('north', 90, 16), marker('east', 182, 100), marker('south', 118, 183),
        marker('west', 13, 100), marker('cluster', 90, 28), marker('near', 54, 73)];
    const original = JSON.stringify(markers), labels = placeMinimapLabels(markers, 100);
    expect(labels.length).toBeGreaterThan(1);
    for (const label of labels) {
        for (const x of [label.x, label.x + label.width]) for (const y of [label.y, label.y + label.height]) {
            expect(Math.hypot(x - 100, y - 100)).toBeLessThanOrEqual(91);
        }
        expect(overlap(label, { x: 90, y: 90, width: 20, height: 20 })).toBe(false);
        for (const m of markers) expect(overlap(label, { x: m.x - 8, y: m.y - 8, width: 16, height: 16 })).toBe(false);
        for (const other of labels) if (other !== label) expect(overlap(label, other)).toBe(false);
    }
    expect(placeMinimapLabels([...markers].reverse(), 100)).toEqual(labels);
    expect(JSON.stringify(markers)).toBe(original);
});
test('ready quests receive the first available label space without hiding markers', () => {
    const rows = [marker('service', 30, 100), marker('ready-quest', 30, 100, 2)];
    const labels = placeMinimapLabels(rows, 100);
    expect(labels[0].id).toBe('ready-quest');
    expect(rows).toHaveLength(2);
});
test('unplaceable and invalid labels are omitted, not truncated onto other markers', () => {
    expect(placeMinimapLabels([{ ...marker('long', 10, 100), width: 300 }, marker('invalid', NaN, 3)], 100)).toEqual([]);
});
