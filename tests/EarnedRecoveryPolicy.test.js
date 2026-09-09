import { readFileSync } from 'node:fs';
import { earnedRestResources, earnedTownRecoveryEnabled } from './earnedRecoveryPolicy.js';
import { collectionRestReason } from './collectionRestPolicy.js';

test('ordinary progression uses town recovery; diagnostics explicitly opt out', () => {
    expect(earnedTownRecoveryEnabled({})).toBe(true);
    expect(earnedTownRecoveryEnabled({ EIDOLON_E2E_REST_RECOVERY: '1' })).toBe(true);
    expect(earnedTownRecoveryEnabled({ EIDOLON_E2E_REST_RECOVERY: '0' })).toBe(false);
});
test.each(['true', '', 'off'])('malformed recovery flag %j fails before gameplay', flag => {
    expect(() => earnedTownRecoveryEnabled({ EIDOLON_E2E_REST_RECOVERY: flag })).toThrow('0 or 1');
});

const player = (className, abilityName) => ({ constructor: { name: className }, abilityName,
    stats: { hp: 75, maxHp: 110, mana: 12, maxMana: 120 }, talentRanks: {},
    state: 'IDLE', wellRestedSeconds: 12.345, safeZoneId: '', level: 5 });

test.each([
    ['Fighter', 'Charge', 20], ['Rogue', 'Piercing Throw', 15],
    ['Wizard', 'Fireball', 30], ['Cleric', 'Spirit Guardians', 40]
])('%s recovery uses its actual primary cost without mutating resources', (className, skill, castCost) => {
    const p = player(className, skill), before = JSON.stringify(p);
    expect(earnedRestResources(p)).toEqual({ className, hp: 75, maxHP: 110,
        mana: 12, maxMana: 120, castCost, dead: false, bank: 12.345, zone: '', level: 5 });
    expect(JSON.stringify(p)).toBe(before);
});
test('trained/equipment-modified costs follow ordinary casting arithmetic', () => {
    const p = player('Wizard', 'Fireball');
    p.stats.manaCostReduction = .25;
    expect(earnedRestResources(p).castCost).toBe(22);
});
test('a selected alternative ability uses its own configured cost', () => {
    expect(earnedRestResources(player('Wizard', 'Meteor')).castCost).toBe(60);
});
test('an unlisted primary uses the same class default fallback as casting', () => {
    expect(earnedRestResources(player('Rogue', 'unlisted')).castCost).toBe(15);
});
test('dead characters remain dead observations, never uncounted recovery', () => {
    const p = player('Cleric', 'Spirit Guardians');
    p.state = 'DEAD'; p.stats.hp = 0;
    const observation = earnedRestResources(p);
    expect(observation.dead).toBe(true);
    expect(collectionRestReason(observation)).toBeNull();
});
test('zero-cost builds still recover health but do not need imaginary mana', () => {
    const p = player('Fighter', 'Berserker Edge');
    p.stats.mana = 0;
    expect(earnedRestResources(p).castCost).toBe(0);
    expect(collectionRestReason(earnedRestResources(p))).toBe('health');
    p.stats.hp = p.stats.maxHp;
    expect(collectionRestReason(earnedRestResources(p))).toBeNull();
});
test('unknown classes are not silently treated as Wizards', () => {
    expect(() => earnedRestResources(player('Unknown', 'Fireball'))).toThrow('Unsupported recovery class');
});
test('the full progression path uses the shared policy and passes ordinary departure to later hunts', () => {
    const collection = readFileSync('tests/e2e/fresh-collection-route.js', 'utf8');
    const opening = readFileSync('tests/e2e/fresh-opening-gameplay.spec.js', 'utf8');
    const script = readFileSync('scripts/run-isolated-character-qa.sh', 'utf8');
    expect(collection).toContain('if (earnedTownRecoveryEnabled())');
    expect(collection).toContain("'chronicle_earth_walking_ink', { leaveTown }");
    expect(collection).toContain("'chronicle_earth_borrowed_oath', { leaveTown }");
    expect(opening.indexOf('earnedTownRecoveryEnabled();')).toBeGreaterThan(-1);
    expect(opening.indexOf('earnedTownRecoveryEnabled();')).toBeLessThan(opening.indexOf('await loginAndEnterWorld('));
    expect(script).toContain('&&\n    run_qa_stage forge-guide run_forge_guide &&\n    run_qa_stage fresh-collection run_fresh_collection &&\n    run_qa_stage talent-economy run_talent_economy');
    expect(script.match(/fresh-collection-no-rest\)[\s\S]*?;;/)[0]).toContain('EIDOLON_E2E_REST_RECOVERY=0');
});
