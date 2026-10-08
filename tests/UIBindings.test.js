import { jest } from '@jest/globals';
import { UIBindings } from '../src/core/UIBindings.js';
import { ReportUI } from '../src/ui/ReportUI.js';

describe('UIBindings', () => {
    test.each([false, true])('password Settings binds only the current online engine (phone=%s)', phone => {
        document.body.innerHTML = '<section class="support-window__body--settings"></section>';
        const engine = createEngine(); engine.isMultiplayer = true; window.game = engine;
        const parent = document.querySelector('section');
        engine.uiManager.settingsScreen = document.body;
        if (phone) engine.uiManager.phoneSettings = { sections: new Map([['device', parent]]) };
        engine.network.send.mockReturnValue(true);
        new UIBindings(engine).bindConstructorCallbacks();
        const password = engine.uiManager.passwordChange;
        try {
            expect(password.parent).toBe(parent);
            password.current.value = 'oldpass'; password.next.value = password.confirm.value = 'A unique updated phrase';
            password.submit(); expect(engine.network.send).toHaveBeenCalledWith('change_password', expect.any(Object));
            expect(password.pending).not.toBeNull();
            window.game = {}; password.handleResult({ requestId: password.pending.requestId, success: true });
            expect(password.pending).not.toBeNull();
            password.dispose();
            window.game = engine; engine.isMultiplayer = false;
            new UIBindings(engine).bindConstructorCallbacks();
            const offline = engine.uiManager.passwordChange;
            expect(offline.button.disabled).toBe(true); offline.submit();
            expect(engine.network.send).toHaveBeenCalledTimes(1); offline.dispose();
        } finally { password.dispose(); delete window.game; }
    });
    test('party consent carries the current invitation identity and meeting maps never teleport', () => {
        const engine = createEngine();
        engine.uiManager.social.toggleSocial = jest.fn();
        engine.worldMap.isVisible = jest.fn(() => false);
        engine.worldMap.navigation = { refresh: jest.fn(), select: jest.fn() };
        new UIBindings(engine).bindConstructorCallbacks();
        engine.uiManager.social.onPartyResponse('Ayla', true, 'invite-current');
        expect(engine.socialController.sendPartyMessage).toHaveBeenCalledWith('party_response', {
            inviterName: 'Ayla', accepted: true, invitationId: 'invite-current' });
        engine.uiManager.social.onGroupMeetingPoint('dungeon-guide');
        expect(engine.worldMap.toggle).toHaveBeenCalledTimes(1);
        expect(engine.worldMap.navigation.select).toHaveBeenCalledWith('dungeon-guide');
        engine.currentInstanceId = 'another-party-dungeon';
        engine.uiManager.social.onGroupMeetingPoint('story-wizard');
        expect(engine.worldMap.toggle).toHaveBeenCalledTimes(1);
        expect(engine.worldMap.navigation.select).toHaveBeenCalledTimes(1);
    });
    test('friend whisper closes the social overlay and focuses the selected private recipient', () => {
        const engine = createEngine();
        engine.uiManager.chat = { beginWhisper: jest.fn() };
        engine.uiManager.social.toggleSocial = jest.fn();
        new UIBindings(engine).bindConstructorCallbacks();
        engine.uiManager.social.onFriendWhisper('Ayla');
        expect(engine.uiManager.social.toggleSocial).toHaveBeenCalledWith(false);
        expect(engine.uiManager.chat.beginWhisper).toHaveBeenCalledWith('Ayla');
    });
    test('saved graphics preference and subsequent changes reach current and future world builders', () => {
        const engine = createEngine();
        engine.worldGenerator = { graphicsQuality: 'high' };
        engine.activeWorldGenerator = { graphicsQuality: 'high' };
        engine.uiManager.getGraphicsQuality.mockReturnValue('low');
        engine.renderSystem.setGraphicsQuality.mockReturnValue({ changed: true, reloadRequired: false });
        new UIBindings(engine).bindConstructorCallbacks();
        expect(engine.worldGenerator.graphicsQuality).toBe('low');
        expect(engine.activeWorldGenerator.graphicsQuality).toBe('low');
        expect(engine.uiManager.onGraphicsQualityChange('medium')).toEqual({ changed: true, reloadRequired: false });
        expect(engine.worldGenerator.graphicsQuality).toBe('medium');
        expect(engine.activeWorldGenerator.graphicsQuality).toBe('medium');
    });

    test.each([
        ['desktop High to Low', false, 'high', 'low', true],
        ['desktop Low to High', false, 'low', 'high', true],
        ['desktop Medium retains High', false, 'high', 'medium', false],
        ['desktop Low retains Low', false, 'low', 'low', false],
        ['mobile High retains Low', true, 'low', 'high', false]
    ])('%s preserves owned actors and requests reload only for a body-detail mismatch', (_, isMobile, authoredQuality, quality, reloadRequired) => {
        const engine = createEngine();
        const part = { userData: { authoredClass: 'Fighter', authoredQuality } };
        engine.renderSystem.isMobile = isMobile;
        engine.renderSystem.entityGroup = { traverse: visitor => visitor(part) };
        engine.renderSystem.setGraphicsQuality.mockReturnValue({ changed: true, reloadRequired: false });
        new UIBindings(engine).bindConstructorCallbacks();
        expect(engine.uiManager.onGraphicsQualityChange(quality)).toEqual({ changed: true, reloadRequired });
        expect(part.userData.authoredQuality).toBe(authoredQuality);
    });

    test.each([
        ['molten_core', 'high', 'low', true],
        ['tempest_spire', 'low', 'high', true],
        ['abyssal_well', 'high', 'medium', false],
        ['umbral_nexus', 'low', 'low', false],
        ['verdant_bastion_catacombs', 'high', 'low', false]
    ])('%s requests reload for a surface-detail mismatch without rebuilding its dungeon', (dungeonType, surfaceQuality, quality, reloadRequired) => {
        const engine = createEngine();
        const kit = Object.freeze({ dungeonType, surfaceQuality });
        engine.activeWorldGenerator = { dungeonInteriorKit: kit };
        engine.renderSystem.setGraphicsQuality.mockReturnValue({ changed: true, reloadRequired: false });
        new UIBindings(engine).bindConstructorCallbacks();
        expect(engine.uiManager.onGraphicsQualityChange(quality)).toEqual({ changed: true, reloadRequired });
        expect(engine.activeWorldGenerator.dungeonInteriorKit).toBe(kit);
    });

    test('procedural actors do not request a body reload or suppress an existing renderer reload', () => {
        const engine = createEngine();
        engine.renderSystem.entityGroup = { traverse: visitor => visitor({ userData: {} }) };
        engine.renderSystem.setGraphicsQuality.mockReturnValue({ changed: true, reloadRequired: false });
        new UIBindings(engine).bindConstructorCallbacks();
        expect(engine.uiManager.onGraphicsQualityChange('low')).toEqual({ changed: true, reloadRequired: false });
        engine.renderSystem.setGraphicsQuality.mockReturnValue({ changed: true, reloadRequired: true });
        expect(engine.uiManager.onGraphicsQualityChange('high')).toEqual({ changed: true, reloadRequired: true });
    });

    function createEngine() {
        return {
            player: {
                inventory: [{ id: 'item-1', name: 'Test Blade', rarity: { name: 'Rare' } }, null],
                hotbar: [null, null, null, null],
                respawn: jest.fn(),
                timeSinceDeath: 3,
                targetPosition: { x: 1, z: 2 }
            },
            username: 'tester',
            requestTownRecall: jest.fn(),
            isMultiplayer: true,
            pendingInteraction: { id: 'enemy-1' },
            collisionManager: {},
            network: { send: jest.fn(), socket: { readyState: WebSocket.OPEN } },
            renderSystem: {
                setGraphicsQuality: jest.fn(),
                setBrightnessLevel: jest.fn(),
                setCameraShakeEnabled: jest.fn(),
                setCameraTarget: jest.fn()
            },
            chunkManager: {
                updateEntityChunk: jest.fn(),
                update: jest.fn()
            },
            abilityController: {
                performHotbarAbility: jest.fn(),
                pendingAbilityTarget: { id: 'enemy-2' },
                pendingAbilitySkill: 'Fireball'
            },
            worldMap: { toggle: jest.fn() },
            socialController: {
                sendPartyMessage: jest.fn(),
                kickPartyMember: jest.fn(),
                promotePartyMember: jest.fn(),
            },
            uiManager: {
                getGraphicsQuality: jest.fn(() => 'medium'),
                getBrightnessLevel: jest.fn(() => 0.75),
                getCameraShakeEnabled: jest.fn(() => false),
                inventory: {
                    updateInventory: jest.fn()
                },
                social: {},
                directTrade: {},
                trading: {},
                skillTree: {},
                forge: {},
                quest: {},
                toggleChat: jest.fn(),
                showHUD: jest.fn(),
                reportScreen: { style: { display: 'none' } }
            }
        };
    }

    test('Forge bindings preserve the displayed quote on the wire', () => {
        const engine = createEngine();
        new UIBindings(engine).bindConstructorCallbacks();
        const expected = { itemId: 'staff', level: 30, potency: 0 };
        engine.uiManager.forge.onForgeUpgrade('mainHand', 10, expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_upgrade', { slot: 'mainHand', amount: 10, expected });
        engine.uiManager.forge.onForgePotency('mainHand', expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_potency', { slot: 'mainHand', expected });
        engine.uiManager.forge.onForgeSocket('mainHand', expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_socket', { slot: 'mainHand', expected });
        engine.uiManager.forge.onForgeInsertGem('mainHand', 2, 0, expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_insert_gem', { equipSlot: 'mainHand', gemInvIndex: 2, socketIndex: 0, expected });
        engine.uiManager.forge.onForgeCombineGem([0, 1, 2], expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_combine_gem', { gemIndices: [0, 1, 2], expected });
        engine.uiManager.forge.onForgeRemoveGem('mainHand', 0, expected);
        expect(engine.network.send).toHaveBeenLastCalledWith('forge_remove_gem', { equipSlot: 'mainHand', socketIndex: 0, expected });
    });

    test('playtest sampling exposes bounded progression context without identities or sending observations', () => {
        const engine = createEngine();
        new UIBindings(engine).bindConstructorCallbacks();
        engine.player.level = 12;
        engine.player.meshType = 'Wizard';
        expect(engine.uiManager.getPlaytestContext()).toEqual({ connected: true, level: 12, className: 'Wizard', partySize: 1 });
        engine.network.socket.readyState = WebSocket.CLOSED;
        expect(engine.uiManager.getPlaytestContext()).toEqual({ connected: false, level: 12, className: 'Wizard', partySize: 1 });
        engine.network.socket.readyState = WebSocket.OPEN;
        engine.isMultiplayer = false;
        expect(engine.uiManager.getPlaytestContext().connected).toBe(false);
        expect(engine.network.send).not.toHaveBeenCalled();
    });

    test('bindConstructorCallbacks wires representative UI actions to engine behavior', () => {
        const engine = createEngine();
        const bindings = new UIBindings(engine);

        bindings.bindConstructorCallbacks();

        expect(engine.renderSystem.setGraphicsQuality).toHaveBeenCalledWith('medium');
        expect(engine.renderSystem.setBrightnessLevel).toHaveBeenCalledWith(0.75);
        expect(engine.renderSystem.setCameraShakeEnabled).toHaveBeenCalledWith(false);

        const originalItem = engine.player.inventory[0];
        engine.uiManager.inventory.onSellItem(0);
        expect(engine.network.send).toHaveBeenCalledWith('sell', { itemId: 'item-1', slotIndex: 0 });
        expect(engine.player.inventory[0]).toBe(originalItem);
        expect(engine.uiManager.inventory.updateInventory).not.toHaveBeenCalledWith(engine.player);

        engine.uiManager.social.onPartyInvite('alice');
        expect(engine.socialController.sendPartyMessage).toHaveBeenCalledWith('party_invite', { targetName: 'alice' });

        engine.uiManager.social.onSocialStatusChange('looking_party');
        expect(engine.network.send).toHaveBeenCalledWith('social_status', { status: 'looking_party' });
        expect(engine.network.send).toHaveBeenCalledWith('social', {});

        engine.uiManager.quest.onRequestQuests();
        expect(engine.network.send).toHaveBeenCalledWith('request_quests', {});

        engine.uiManager.onMapToggle();
        expect(engine.worldMap.toggle).toHaveBeenCalled();
    });

    test('listing forwards the frozen selection, not the current inventory slot', () => {
        const engine = createEngine();
        new UIBindings(engine).bindConstructorCallbacks();
        engine.player.inventory[0] = { id: 'replacement', stack: 9 };
        engine.uiManager.trading.onTradingCreate(0, 100, 500, 24, 'selected-earlier', 3);
        expect(engine.network.send).toHaveBeenCalledWith('trading_create', {
            slotIndex: 0, bid: 100, buyout: 500, duration: 24,
            expectedItemId: 'selected-earlier', expectedStack: 3
        });
    });

    test('Sell All submits all 25 bag slots once with their original item identities', () => {
        const engine = createEngine();
        engine.player.inventory = Array.from({ length: 25 }, (_, index) => ({ id: `bag-${index}`, type: 'ARMOR', slot: 'head', rarity: { name: 'Common' } }));
        new UIBindings(engine).bindConstructorCallbacks();
        engine.uiManager.inventory.onSellAll('Common');
        expect(engine.network.send).toHaveBeenCalledTimes(25);
        expect(engine.network.send.mock.calls).toEqual(Array.from({ length: 25 }, (_, index) => ['sell', { itemId: `bag-${24 - index}`, slotIndex: 24 - index }]));
    });

    test('sell-all only forwards merchant equipment slots of the requested rarity and skips gems/materials/relics', () => {
        const engine = createEngine();
        engine.player.inventory = [
            { id: 'weapon-main', name: 'Rusty Sword', type: 'WEAPON', slot: 'mainHand', rarity: { name: 'Common' } },
            { id: 'weapon-off', name: 'Wooden Shield', type: 'ARMOR', slot: 'offHand', rarity: { name: 'Common' } },
            { id: 'helm', name: 'Leather Cap', type: 'ARMOR', slot: 'head', rarity: { name: 'Common' } },
            { id: 'chest', name: 'Leather Tunic', type: 'ARMOR', slot: 'chest', rarity: { name: 'Common' } },
            { id: 'legs', name: 'Leather Pants', type: 'ARMOR', slot: 'legs', rarity: { name: 'Common' } },
            { id: 'boots', name: 'Leather Boots', type: 'ARMOR', slot: 'feet', rarity: { name: 'Common' } },
            { id: 'gloves', name: 'Leather Gloves', type: 'GLOVES', slot: 'gloves', rarity: { name: 'Common' } },
            { id: 'shoulders', name: 'Reinforced Spaulders', type: 'ARMOR', slot: 'shoulders', rarity: { name: 'Common' } },
            { id: 'belt', name: 'Studded Belt', type: 'ARMOR', slot: 'belt', rarity: { name: 'Common' } },
            { id: 'ring', name: 'Gold Ring', type: 'ACCESSORY', slot: 'ring', rarity: { name: 'Common' } },
            { id: 'neck', name: 'Silver Necklace', type: 'NECK', slot: 'neck', rarity: { name: 'Common' } },
            { id: 'trinket', name: 'Amulet of Power', type: 'ACCESSORY', slot: 'trinket', rarity: { name: 'Common' } },
            { id: 'gem-common', name: 'Flawed Ruby', type: 'GEM', slot: 'gem', rarity: { name: 'Common' } },
            { id: 'mat-common', name: 'Eidolon Shard', type: 'MATERIAL', slot: 'material', rarity: { name: 'Common' } },
            { id: 'relic-common', name: 'Eidolon Heart', type: 'RELIC', slot: 'relic', rarity: { name: 'Common' } },
            { id: 'gear-rare', name: 'Knight Blade', type: 'WEAPON', slot: 'mainHand', rarity: { name: 'Rare' } }
        ];
        const bindings = new UIBindings(engine);

        bindings.bindConstructorCallbacks();

        engine.uiManager.inventory.onSellAll('Common');

        expect(engine.network.send).toHaveBeenCalledTimes(12);
        const soldItemIds = engine.network.send.mock.calls
            .filter(([type]) => type === 'sell')
            .map(([, payload]) => payload.itemId)
            .sort();
        expect(soldItemIds).toEqual([
            'belt',
            'boots',
            'chest',
            'gloves',
            'helm',
            'legs',
            'neck',
            'ring',
            'shoulders',
            'trinket',
            'weapon-main',
            'weapon-off'
        ].sort());
        const soldSlots = engine.network.send.mock.calls
            .filter(([type]) => type === 'sell')
            .map(([, payload]) => engine.player.inventory[payload.slotIndex].slot)
            .sort();
        expect(soldSlots).toEqual([
            'head',
            'chest',
            'legs',
            'feet',
            'gloves',
            'shoulders',
            'belt',
            'ring',
            'neck',
            'trinket',
            'mainHand',
            'offHand'
        ].sort());
    });

    test('social safety uses persisted commands and reports require explicit submission', () => {
        const engine = createEngine();
        const ui = engine.uiManager;
        ui.reportScreen = document.createElement('div');
        ui.reportScreen.innerHTML = '<textarea></textarea><select><option>Player Report</option></select><button>Submit</button><input id="report-diagnostics" type="checkbox"><p id="report-guidance"></p><pre id="report-context"></pre><p id="report-status"></p><output id="report-count"></output>';
        ui.reportText = ui.reportScreen.querySelector('textarea');
        ui.reportType = ui.reportScreen.querySelector('select');
        ui.btnSubmitReport = ui.reportScreen.querySelector('button');
        ui.report = new ReportUI(ui);
        ui.reportText.value = 'Existing draft';
        ui.toggleReport = jest.fn();
        new UIBindings(engine).bindConstructorCallbacks();
        engine.network.send.mockClear();
        ui.social.onSafety('block', 'Bob');
        expect(engine.network.send).toHaveBeenCalledWith('chat', { message: '/block Bob' });
        engine.network.send.mockClear();
        ui.social.onSafety('block', 'Bob\n/other');
        ui.social.onSafety('report', 'Bob', 'Group listing');
        expect(engine.network.send).not.toHaveBeenCalled();
        expect(ui.reportText.value).toContain('Existing draft');
        expect(ui.reportText.value).toContain('Player: Bob');
        expect(ui.reportType.value).toBe('Player Report');
        expect(ui.toggleReport).toHaveBeenCalledTimes(1);
        ui.onReportSubmit(ui.reportType.value, ui.reportText.value);
        expect(engine.network.send).toHaveBeenCalledWith('report', expect.objectContaining({ reportType: 'Player Report' }));
        engine.network.send.mockClear();
        expect(ui.onModerationNoticeLookup('notice-request-000001')).toBe(true);
        expect(engine.network.send).toHaveBeenCalledWith('moderation_notice', { requestId: 'notice-request-000001' });
        engine.network.send.mockClear(); engine.isMultiplayer = false;
        expect(ui.onModerationNoticeLookup('notice-request-000002')).toBe(false);
        expect(engine.network.send).not.toHaveBeenCalled();
        ui.report.dispose();
    });

    test('bindSessionCallbacks wires chat, respawn, and hotbar actions', () => {
        const engine = createEngine();
        const bindings = new UIBindings(engine);

        bindings.bindSessionCallbacks();

        engine.uiManager.onChatSend('hello');
        expect(engine.network.send).toHaveBeenCalledWith('chat', { message: 'hello', sender: 'tester' });
        engine.uiManager.onRecall();
        expect(engine.requestTownRecall).toHaveBeenCalledTimes(1);

        engine.uiManager.onHotbarAssign(2, 'Meteor Drop');
        expect(engine.player.hotbar[2]).toBe('Meteor Drop');

        engine.uiManager.onHotbarCast(1);
        expect(engine.abilityController.performHotbarAbility).toHaveBeenCalledWith(1);

        engine.uiManager.onRespawn();
        expect(engine.network.send).toHaveBeenCalledWith('respawn', { movementContext: expect.any(String) });
        expect(engine.player.respawn).toHaveBeenCalledWith(-1.25, 200);
        expect(engine.pendingInteraction).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.pendingAbilitySkill).toBeNull();
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.chunkManager.update).toHaveBeenCalledWith(engine.player, 0, engine.collisionManager);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });

    test('opening Social refreshes persisted friends as well as online presence', () => {
        const engine = createEngine(); new UIBindings(engine).bindConstructorCallbacks();
        engine.network.send.mockClear(); engine.uiManager.social.onSocialOpen();
        expect(engine.network.send.mock.calls).toEqual([['social', {}], ['friend_list', {}]]);
    });
});
