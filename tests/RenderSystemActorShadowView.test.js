import { RenderSystem } from '../src/core/RenderSystem.js';

test('the actual renderer keeps the shadow policy disabled until explicitly installed', () => {
    const render = new RenderSystem(false);
    const original = render.renderer.shadowMap.render;
    try {
        expect(render.actorShadowView).toBeNull();
        render.setActorShadowViewEnabled(true);
        const owner = render.actorShadowView;
        expect(owner.instances).toBe(render.actorInstances);
        expect(render.renderer.shadowMap.render).toBe(owner.wrapper);
        render.setActorShadowViewEnabled(true);
        expect(render.actorShadowView).toBe(owner);
        render.setActorShadowViewEnabled(false);
        expect(owner.disposed).toBe(true);
        expect(render.actorShadowView).toBeNull();
        expect(render.renderer.shadowMap.render).toBe(original);
    } finally { render.dispose(); }
});

test.each(['clearInstanceScene', 'disableInstances', 'dispose'])('%s releases its shadow wrapper before replacing or disposing actor batches', action => {
    const render = new RenderSystem(false), original = render.renderer.shadowMap.render;
    render.setActorShadowViewEnabled(true);
    const owner = render.actorShadowView;
    try {
        if (action === 'disableInstances') render.setActorInstancesEnabled(false);
        else render[action]();
        expect(owner.disposed).toBe(true);
        expect(render.actorShadowView).toBeNull();
        expect(render.renderer.shadowMap.render).toBe(original);
        if (action === 'dispose') {
            render.setActorShadowViewEnabled(true);
            expect(render.actorShadowView).toBeNull();
        } else {
            render.setActorInstancesEnabled(true);
            render.setActorShadowViewEnabled(true);
            expect(render.actorShadowView.instances).toBe(render.actorInstances);
        }
    } finally { render.dispose(); }
});
