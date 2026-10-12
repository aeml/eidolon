export async function setupLanternholdCutaway(quality) {
    const THREE = await import('three');
    const { GameEngine } = await import('/src/core/GameEngine.js');
    const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
    document.getElementById('start-screen').style.display = 'none';
    const game = new GameEngine('Fighter', quality === 'low', true, '', 'dark-cutaway-review', null, 'flat-v1');
    const render = game.renderSystem;
    render.setGraphicsQuality(quality); await render.preloadEnvironment();
    game.player = game.createRemotePlayer('Player', 'cutaway-reader', 'Fighter'); game.player.gameEngine = game;
    await game.player.ensureMesh();
    game.worldGenerator.graphicsQuality = quality;
    await game.worldGenerator.loadTrees(0, 200); await game.worldGenerator.createTownBase(0, 200, 100);
    await game.worldGenerator.loadBuildings(0, 200);
    game.uiManager.showHUD();
    const outfits = {
        Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
        Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
        Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield'],
        Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome']
    };
    const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'], actors = [];
    for (const [type, names] of Object.entries(outfits)) {
        const actor = type === 'Fighter' ? game.player : game.createRemotePlayer('Player', `cutaway-${type}`, type);
        actor.gameEngine = game; await actor.ensureMesh();
        actor.syncEquipmentVisuals(Object.fromEntries([...names, 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, i) => {
            const base = BASE_ITEMS.find(item => item.name === name), slot = slots[i]; if (!base) throw Error(name);
            return [slot, { ...base, name, baseName: name, id: `cutaway-${type}-${slot}`, slot: i === 8 && type === 'Rogue' ? 'mainHand' : slot, rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
        })));
        await actor.mesh.userData.equipmentReady; render.add(actor.mesh); actor.playAnimation('Run', true, true); actors.push(actor);
    }
    const root = render.instanceEnvironmentGroup.getObjectByName('Lanternhold residential wards');
    const views = [{ name: 'south-home', x: -26, z: 269 }, { name: 'west-home', x: -82, z: 147 }];
    const frame = async (view, animate = false) => {
        const focus = new THREE.Vector3(view.x, 0, view.z);
        actors.forEach((actor, i) => { actor.position.set(focus.x - i * 2.3, 0, focus.z - i * 1.3); actor.mesh.position.copy(actor.position); if (animate) actor.updateAnimationMixer(1 / 60); });
        render.setZoom(15); render.setCameraTarget(focus); render.updateEnvironmentLighting(focus, animate ? 1 / 60 : 0);
        if (render.renderer.shadowMap.enabled) render.updateShadowFocus(focus);
        game.render(1); return new Promise(requestAnimationFrame);
    };
    window.__lanternholdCutaway = { THREE, game, render, actors, root, views, frame };
    for (let i = 0; i < 180; i++) await frame(views[0], true);
    const gl = render.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), outfits: actors.map(actor => ({ type: actor.type, count: actor.mesh.userData.equipmentVisualItemCount, missing: actor.mesh.userData.equipmentVisualMissing || [], fallback: actor.mesh.userData.equipmentVisualFallbacks || [] })), pendingGeometry: render.actorGameplayGeometry.delivery.jobs.size };
}
