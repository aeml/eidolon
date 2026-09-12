import { PROCEDURAL_STATUS_EFFECT_DEFINITIONS } from '../src/art/ProceduralStatusEffects.js';
import { STATUS_GALLERY_CLASS_BY_FAMILY } from './statusGalleryCoverage.js';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { AnimationGallery } from '../src/animationGallery.js';
import { Wizard } from '../src/entities/Wizard.js';

test.each(Object.entries(PROCEDURAL_STATUS_EFFECT_DEFINITIONS))(
    '%s has an explicit playable class for native status coverage', (_key, definition) => {
        expect(['Fighter', 'Rogue', 'Wizard', 'Cleric'])
            .toContain(STATUS_GALLERY_CLASS_BY_FAMILY[definition.family]);
    });

test.each(['local', 'remote'])('%s protection preview activates and cleans up real actor state', role => {
    const actor = new Wizard('gallery-local'), remoteActor = new Wizard('gallery-remote');
    const scene = new THREE.Group();
    for (const value of [actor, remoteActor]) value.gameEngine = {
        renderSystem: { effectGroup: scene, graphicsQuality: 'high' }
    };
    const gallery = Object.assign(Object.create(AnimationGallery.prototype), {
        actor, remoteActor, targetActor: null, presentationSequence: 0,
        clearEffects: jest.fn(), setStatus: jest.fn(), updateMetrics: jest.fn()
    });
    const owner = role === 'local' ? actor : remoteActor;
    try {
        expect(gallery.presentStatus('invulnerable', role)).toBe(true);
        expect(owner.attachedStatusEffects.has('invulnerable')).toBe(true);
        expect(owner.invulnerabilityTimer).toBeGreaterThan(0);
        expect(gallery.presentStatus('swift', role)).toBe(true);
        expect(owner.invulnerabilityTimer).toBe(0);
        expect(owner.invulnerableActive).toBe(false);
        expect(owner.attachedStatusEffects.has('invulnerable')).toBe(false);
        expect([...owner.attachedStatusEffects.keys()]).toEqual(['swift']);
    } finally { actor.dispose(); remoteActor.dispose(); }
});
