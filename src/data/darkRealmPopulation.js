import { DARK_REALM_WITNESSES } from './darkRealmWitnesses.js';

// Public meeting places around existing people, not new quests or vendors.
// Positions derive from the canonical witness roster; their record unlocks and
// conversations remain owned by the Chronicle. No optional lore is duplicated.
export const DARK_REALM_COURTS = Object.freeze([
    ['dark-witness-elin', 'Ferry Landing Court', 'shore', 'Meet Captain Elin beside the existing ferry records.'],
    ['dark-witness-oss', 'Open Register Court', 'archive', 'Speak with Clerk Oss outside the royal archive records.'],
    ['dark-witness-vara', 'The Unfinished Shift', 'foundry', 'Find Furnace Tender Vara by the existing foundry account.'],
    ['dark-witness-oren', 'The Extra Loaf Court', 'city', 'Meet Baker Oren beside the existing bakery ledger.']
].map(([witnessId, name, recipe, purpose]) => {
    const witness = DARK_REALM_WITNESSES.find(person => person.id === witnessId);
    if (!witness) throw new Error(`Missing Dark Realm witness: ${witnessId}`);
    return Object.freeze({ id: `court-${recipe}`, witnessId, name, recipe, x: witness.x, z: witness.z,
        arrivalX: witness.x, arrivalZ: witness.z + 4,
        purpose: `${purpose} Read-only conversation; not a merchant, new quest giver or safe zone.` });
}));

// Common, open court layout leaves the witness, existing record building behind
// them and the south approach untouched. Dimensions are full extents.
export const DARK_REALM_COURT_SOLIDS = Object.freeze(DARK_REALM_COURTS.flatMap(site =>
    [-1, 1].flatMap(side => [
        { siteId: site.id, x: site.x + side * 12, z: site.z + 5, width: 4, depth: 2.5, height: 2.5, kind: 'workbench', recipe: site.recipe },
        { siteId: site.id, x: site.x + side * 12, z: site.z - 9, width: 2, depth: 2, height: 6, kind: 'standard', recipe: site.recipe }
    ].map(Object.freeze))));

// Worn public streets, not auto-navigation or safe routes. The foundry road
// bends around the existing delivery-seal record. Nexus ends at its threshold
// records; actual private dungeon/raid entry remains with Lanternhold's Guide.
export const DARK_REALM_PATHS = Object.freeze([
    ['foothold-shore', [[40000,40775],[40000,40400]]],
    ['shore-archive', [[40000,40400],[39300,40400]]],
    ['archive-foundry', [[39300,40400],[39300,39700]]],
    ['foundry-city', [[39300,39700],[39450,39760],[39525,39760],[39540,39700],[40000,39700]]],
    ['city-shore', [[40000,39700],[40000,40400]]],
    ['elin-approach', [[40000,40600],[39900,40600],[39900,40552]]],
    ['oss-approach', [[39300,40400],[39300,40600],[39200,40600],[39200,40552]]],
    ['vara-approach', [[39300,39700],[39180,39700],[39180,39572]]],
    ['oren-approach', [[40000,39900],[40130,39900],[40130,39842]]],
    ['nexus-threshold-approach', [[40000,39700],[40000,39490]]]
].map(([id, points]) => Object.freeze({id, width: 6, points: Object.freeze(points.map(Object.freeze))})));
