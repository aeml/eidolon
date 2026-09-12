// Explicit class ownership keeps new status families from silently losing
// their native High/Low, local/remote gallery coverage.
export const STATUS_GALLERY_CLASS_BY_FAMILY = Object.freeze({
    fighter: 'Fighter',
    rogue: 'Rogue',
    wizard: 'Wizard',
    cleric: 'Cleric',
    relic: 'Fighter',
    control: 'Fighter',
    affliction: 'Fighter',
    sanctuary: 'Fighter',
    protection: 'Wizard'
});
