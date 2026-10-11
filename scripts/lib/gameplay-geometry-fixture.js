/* global document, window */
// Actual supplied class rigs and14-slot equipment; no account/server mutation.
export async function gameplayGeometryFixture({ quality }) {
    const phone = quality === 'low', engineModule = '/src/core/GameEngine.js';
            const { GameEngine } = await import(engineModule);
            const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
            document.getElementById('start-screen').style.display = 'none';
            const game = new GameEngine('Fighter', phone, true, '', 'geometry-generation-only', null, 'flat-v1');
            const render = game.renderSystem;
            render.setGraphicsQuality(quality); game.worldGenerator.graphicsQuality = quality;
            game.uiManager.showHUD();
            const outfits = {
                Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
                Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
                Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield'],
                Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome']
            };
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            const actors = [];
            for (const type of Object.keys(outfits)) {
                const actor = game.createRemotePlayer('Player', `geometry-${type}`, type); actor.gameEngine = game;
                await actor.ensureMesh();
                // Initial class appearances are real startup inputs too. Drain
                // them before equipping so a changed coverage mask cannot retire
                // the unequipped body's generation before it is recorded.
                render.add(actor.mesh);
                const delivery = render.actorGameplayGeometry.delivery, deadline = performance.now() + 60000;
                while (delivery.jobs.size || delivery.active) {
                    if (delivery.failed || performance.now() > deadline) throw Error('Initial class geometry did not drain');
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                // Capture stable boundaries, never timing-dependent intermediate masks.
                delivery.untrack(actor.mesh);
                actor.syncEquipmentVisuals(Object.fromEntries([...outfits[type], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, index) => {
                    const slot = slots[index], base = BASE_ITEMS.find(item => item.name === name);
                    return [slot, { ...base, name, baseName: name, id: `geometry-${type}-${slot}`,
                        slot: index === 8 && type === 'Rogue' ? 'mainHand' : slot, rarity: 'Rare', stats: {}, gems: [], sockets: 0 }];
                })));
                await actor.mesh.userData.equipmentReady;
                render.actorGameplayGeometry.track(actor.mesh);
                const equippedDeadline = performance.now() + 60000;
                while (delivery.jobs.size || delivery.active) {
                    if (delivery.failed || performance.now() > equippedDeadline) throw Error('Equipped class geometry did not drain');
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                actor.playAnimation('Run', true, true); actors.push(actor);
            }

    window.__geometryGeneration = { game, render, actors };
}
