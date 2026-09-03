import { readFileSync } from 'node:fs';

const worldSource = readFileSync('server/internal/game/world.go', 'utf8');
const helperSource = readFileSync('server/internal/game/ability_helpers.go', 'utf8');
const abilitySources = [
    'ability_fighter.go', 'ability_rogue.go', 'ability_wizard.go', 'ability_cleric.go'
].map((name) => readFileSync(`server/internal/game/${name}`, 'utf8')).join('\n');
const mainSource = readFileSync('server/main.go', 'utf8');

describe('combat feedback protocol coverage', () => {
    test('every direct world damage and heal event declares semantic kind and instance context', () => {
        const damageLiterals = [...worldSource.matchAll(/(?<!Hazard)DamageEvent\{([^}]+)\}/g)].map((match) => match[1]);
        const healLiterals = [...worldSource.matchAll(/HealEvent\{([^}]+)\}/g)].map((match) => match[1]);
        expect(damageLiterals.length).toBeGreaterThan(10);
        expect(healLiterals.length).toBeGreaterThan(2);
        [...damageLiterals, ...healLiterals].forEach((body) => {
            expect(body).toContain('Kind:');
            expect(body).toContain('InstanceID:');
        });
    });

    test('every class helper call supplies kind and the authoritative player instance', () => {
        const calls = abilitySources.split('\n').filter((line) =>
            line.includes('fireDamageEvent(') || line.includes('fireHealEvent(')
        );
        expect(calls.length).toBeGreaterThan(20);
        calls.forEach((line) => {
            expect(line).toContain('player.InstanceID');
            expect(line).toMatch(/, "[a-z_]+", player\.InstanceID\)/);
        });
    });

    test('damage and heal payloads retain context and broadcasts stay instance-scoped', () => {
        expect(helperSource).toContain('Kind: kind, InstanceID: instanceID');
        expect(mainSource).toContain('Kind: evt.Kind, InstanceID: evt.InstanceID');
        expect(mainSource).toContain('BroadcastMessage{Type: MsgDamage, Data: dataBytes, InstanceID: evt.InstanceID}');
        expect(mainSource).toContain('BroadcastMessage{Type: MsgHeal, Data: dataBytes, InstanceID: evt.InstanceID}');
        expect(mainSource).toMatch(/Kind:\s+string\(evt\.HazardType\)/);
    });
});
