// Small, font-independent HUD symbols. Keep this module independent of the
// equipment/ability model builders so the minimap adds no geometry dependency.
const symbols = new Map(Object.entries({
    well_rested: '<circle cx="20" cy="20" r="6"/><path d="M20 5v4m0 22v4M5 20h4m22 0h4M9 9l3 3m16 16 3 3M9 31l3-3M28 12l3-3"/>',
    iron_fortress: '<path d="M8 10h24v13L20 34 8 23Z"/><path d="M13 16h14m-14 5h14m-7-5v13"/>',
    guardian_roar: '<path d="m20 7 13 5-3 15-10 7-10-7-3-15Z"/><path d="m14 22 6-9 6 9m-12 0 6 5 6-5"/>',
    blessing_resolve: '<path d="M16 7h8v9h9v8h-9v9h-8v-9H7v-8h9Z"/>',
    divine_intervention: '<path d="M20 11v23m0-12C10 20 5 13 7 7l13 8L33 7c2 6-3 13-13 15M10 17l4 10 6 3 6-3 4-10"/>',
    blessing_zeal: '<path d="m20 5 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z"/>',
    spell_focus: '<circle cx="20" cy="17" r="10"/><path d="M13 32h14m-12-7v7m10-7v7m-5-21v12m-6-6h12"/>',
    time_warp: '<path d="M10 7h20m-20 26h20M12 7c0 8 6 9 8 13-2 4-8 5-8 13M28 7c0 8-6 9-8 13 2 4 8 5 8 13m-13-2 5-6 5 6"/>',
    invulnerable: '<path d="m20 5 13 7-3 16-10 7-10-7-3-16Z"/><path d="m14 20 4 4 9-10"/>',
    arcane_shield: '<path d="m20 5 13 8-4 16-9 6-9-6-4-16Z"/><path d="m20 12 7 8-7 9-7-9Z"/>',
    vanish: '<path d="M7 12h19M5 20h13M7 28h19m-3-20 11 12-11 12"/>',
    last_stand: '<path d="M13 31C2 21 17 20 17 7c9 6 5 13 11 9 8 10 4 19-8 19-5 0-8-6-2-12 0 4 5 4 4 9"/>',
    berserker_edge: '<path d="M9 31 30 8m-2 15 5-17-17 6M7 23l10 10m-6-7-5 9"/>',
    swift: '<path d="m22 5-13 18h10l-1 12 13-18H21Z"/>',
    weak_point: '<circle cx="20" cy="20" r="10"/><circle cx="20" cy="20" r="4"/><path d="M20 4v9m0 14v9M4 20h9m14 0h9"/>',
    mark_weakness: '<path d="m20 6 14 14-14 14L6 20Z"/><path d="m14 14 12 12m0-12L14 26"/>',
    bleed: '<path d="M20 6C17 13 9 18 9 25a11 11 0 0 0 22 0c0-7-8-12-11-19Z"/><path d="M15 24c-1 4 1 6 4 6"/>',
    poison: '<path d="M12 8h16m-13 0v10L8 29q-2 5 4 5h16q6 0 4-5l-7-11V8M12 25h16m-12 4h1m6 0h1"/>',
    root: '<path d="M20 6v17m0-8-7-5m7 8 8-5M6 24h28m-14 0-7 11m7-11 7 11m-7-7-9 2m9-2 9 2"/>',
    slow: '<circle cx="20" cy="20" r="13"/><path d="M20 10v11l-7 5m-6-4h4m18 0h4"/>',
    spirit_guardians: '<path d="M11 32V16a9 9 0 0 1 18 0v16l-5-4-4 5-4-5Z"/><path d="M16 16v4m8-4v4"/>',
    frozen: '<path d="M20 5v30M7 12l26 16M7 28l26-16M16 8l4 4 4-4m-8 24 4-4 4 4M8 17l6-1-1-6m19 13-6 1 1 6M8 23l6 1-1 6m19-13-6-1 1-6"/>',
    stunned: '<path d="m20 5 3 8 9-2-5 8 7 6-9 1-2 9-5-8-9 4 3-9-7-5 9-3Z"/>',
    guardian_embrace: '<path d="M8 12v12l12 10 12-10V12M12 20l8 7 8-7"/><circle cx="20" cy="13" r="6"/>',
    serrated_edges: '<path d="m9 32 3-11 5 1-1-6 6 1-1-5 12-5-5 12-5-1 1 6-6-1-5 9Zm-1-6 6 6"/>',
    poison_coating: '<path d="M8 32 29 7l4 4-21 25m-6-9 9 7M18 9c-6 8-4 11 0 11s6-3 0-11Z"/>',
    stealth: '<path d="M7 29V18L20 5l13 13v11l-13 6Z"/><path d="m12 24 4-3 4 4 4-4 4 3"/>',
    sanctuary: '<path d="m20 6 13 7-3 14-10 8-10-8-3-14Z"/><path d="M20 13v15m-7-8h14"/>',
    positive: '<path d="m20 6 14 14-14 14L6 20Z"/><path d="M20 13v14m-7-7h14"/>',
    negative: '<path d="M14 6h12l8 8v12l-8 8H14l-8-8V14Z"/><path d="M12 20h16"/>'
}));
const applied = new WeakMap();

export function statusEffectIconSvg(buff = {}) {
    const body = symbols.get(buff.id) || symbols.get(buff.isDebuff ? 'negative' : 'positive');
    const color = buff.isDebuff ? '#efa092' : '#dbc18a';
    return `<svg class="status-effect-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

export function applyStatusEffectIcon(element, buff) {
    const svg = statusEffectIconSvg(buff);
    if (applied.get(element) === svg) return;
    element.innerHTML = svg; // Only the fixed shapes/colors above enter markup.
    applied.set(element, svg);
}
