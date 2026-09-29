import * as THREE from 'three';
import { Projectile } from '../src/entities/Projectile.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

const owner = { stats: { intelligence: 20, dexterity: 20, wisdom: 20 }, isMultiplayer: true };
const chunks = { getActiveEntities: () => [] };

test.each(['Fireball', 'Dagger', 'ArcaneMissile', 'DragonfireLance', 'FlameTornado'])('%s prediction and render interpolation retain altitude above slopes', type => {
    const start = new THREE.Vector3(-570, field.sample(-570, 410)+1.5, 410);
    const projectile = new Projectile('elevation-shot', owner, type, start, start.clone().add(new THREE.Vector3(20, 0, 3)));
    const engine = { terrainElevation: field, isMultiplayer: true };
    projectile.serverAuthoritativeLifetime = true;
    try {
        for (let i = 0; i < 16; i++) {
            projectile.capturePreviousTransform();
            projectile.update(.05, null, null, chunks, null, engine);
            expect(projectile.position.y - field.sample(projectile.position.x, projectile.position.z)).toBeCloseTo(1.5, 8);
            projectile.render(.4);
            expect(projectile.mesh.position.y - field.sample(projectile.mesh.position.x, projectile.mesh.position.z)).toBeCloseTo(1.5, 8);
        }
        expect(projectile.position.distanceTo(start)).toBeGreaterThan(5);
    } finally { projectile.dispose(); }
});

test('remote meteor prediction stops at the elevated floor, leaving removal to the server', () => {
    const ground = field.sample(-570, 410);
    const meteor = new Projectile('elevation-meteor', owner, 'Meteor', new THREE.Vector3(-570, ground+3, 410));
    meteor.velocity.set(0, -20, 0); meteor.serverAuthoritativeLifetime = true;
    try {
        meteor.update(.5, null, null, chunks, null, { terrainElevation: field, isMultiplayer: true });
        expect(meteor.position.y).toBe(ground);
        expect(meteor.isActive).toBe(true);
        expect(meteor.hasExploded).toBe(false);
    } finally { meteor.dispose(); }
});

test('inactive elevation and instance-owned projectile heights remain unchanged', () => {
    for (const engine of [{ isMultiplayer: true }, { isMultiplayer: true, terrainElevation: field, currentInstanceId: 'dungeon_test' }]) {
        const p = new Projectile('instance-shot', owner, 'Fireball', new THREE.Vector3(-570, 41.5, 410));
        try {
            p.velocity.set(20, 0, 0);
            p.update(.5, null, null, chunks, null, engine); p.render(1);
            expect(p.position.y).toBe(41.5); expect(p.mesh.position.y).toBe(41.5);
        } finally { p.dispose(); }
    }
});
