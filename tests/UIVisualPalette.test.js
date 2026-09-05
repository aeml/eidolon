import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/variables.css', 'utf8');
const color = (name) => css.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})`, 'i'))?.[1];
const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
};

test('small white HUD labels remain legible over both ends of the health and mana fills', () => {
    for (const resource of ['health', 'mana']) {
        for (const end of ['start', 'end']) {
            expect(contrast('#ffffff', color(`color-${resource}-${end}`))).toBeGreaterThanOrEqual(4.5);
        }
    }
});

test('secondary text and brass emphasis retain contrast against the ink panel base', () => {
    for (const name of ['color-text-muted', 'color-text-dim', 'color-gold']) {
        expect(contrast(color(name), '#111720')).toBeGreaterThanOrEqual(4.5);
    }
});
