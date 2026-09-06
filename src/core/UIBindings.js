const PROTECTED_INVENTORY_TYPES = new Set(['GEM', 'MATERIAL', 'RELIC']);
const PROTECTED_INVENTORY_SLOTS = new Set(['gem', 'material', 'relic']);

function isSellableEquipment(item) {
    if (!item?.slot) return false;

    const type = String(item.type || '').toUpperCase();
    const slot = String(item.slot).toLowerCase();
    return !PROTECTED_INVENTORY_TYPES.has(type) && !PROTECTED_INVENTORY_SLOTS.has(slot);
}

export class UIBindings {
    constructor(engine) {
        this.engine = engine;
    }

    bindConstructorCallbacks() {
        const engine = this.engine;
        const ui = engine.uiManager;

        ui.onGraphicsQualityChange = (quality) => {
            return engine.renderSystem.setGraphicsQuality(quality);
        };
        ui.onBrightnessChange = (level) => {
            engine.renderSystem.setBrightnessLevel(level);
        };
        ui.onCameraShakeChange = (enabled) => {
            engine.renderSystem.setCameraShakeEnabled(enabled);
        };

        engine.renderSystem.setGraphicsQuality(ui.getGraphicsQuality());
        engine.renderSystem.setBrightnessLevel(ui.getBrightnessLevel());
        engine.renderSystem.setCameraShakeEnabled(ui.getCameraShakeEnabled());

        ui.inventory.onBuyGamble = (slot) => {
            engine.network.send('buy_gamble', { slot });
        };
        ui.inventory.onSellItem = (index) => {
            const item = engine.player.inventory[index];
            if (!item) return;

            engine.network.send('sell', { itemId: item.id, slotIndex: index });
        };
        ui.inventory.onBuyback = (itemId) => {
            engine.network.send('buyback', { itemId });
        };
        ui.inventory.onSellAll = (rarityName) => {
            if (!engine.player) return;
            for (let i = engine.player.inventory.length - 1; i >= 0; i--) {
                const item = engine.player.inventory[i];
                if (item?.rarity?.name === rarityName && isSellableEquipment(item)) {
                    ui.inventory.onSellItem(i);
                }
            }
        };

        ui.social.onSocialOpen = () => {
            engine.network.send('social', {});
        };
        ui.social.onSocialStatusChange = (status) => {
            engine.network.send('social_status', { status });
            engine.network.send('social', {});
        };
        ui.trading.onTradingSearch = (filters) => {
			engine.network.send('trading_search', filters);
        };
        ui.trading.onTradingCreate = (slotIndex, bid, buyout, duration) => {
            engine.network.send('trading_create', { slotIndex, bid, buyout, duration });
        };
        ui.trading.onTradingMyAuctions = () => {
            engine.network.send('trading_my_auctions', {});
        };
        ui.trading.onTradingBuyout = (auctionId) => {
            engine.network.send('trading_buyout', { auctionId });
        };
        ui.trading.onTradingBid = (auctionId, amount) => {
            engine.network.send('trading_bid', { auctionId, amount });
        };
        ui.trading.onTradingCollect = (auctionId) => {
            engine.network.send('trading_collect', { auctionId });
        };
        ui.trading.onTradingCancel = (auctionId) => {
            engine.network.send('trading_cancel', { auctionId });
        };

        ui.onReportSubmit = (type, text) => {
            engine.network.send('report', { reportType: type, text });
        };
        ui.onResonanceSpend = (trait) => engine.network.send('endgame_spend', { trait });
        ui.social.onPartyInvite = (targetName) => {
            engine.socialController.sendPartyMessage('party_invite', { targetName });
        };
        ui.social.onPartyLeave = () => {
            engine.socialController.sendPartyMessage('party_leave', {});
        };
        ui.social.onPartyResponse = (inviterName, accepted) => {
            engine.socialController.sendPartyMessage('party_response', { inviterName, accepted });
        };
        ui.social.onPartyKick = (targetId) => {
            engine.socialController.kickPartyMember(targetId);
        };
        ui.social.onPartyPromote = (targetId) => {
            engine.socialController.promotePartyMember(targetId);
        };
		ui.social.onPartyReadyCheck = () => {
			engine.socialController.sendPartyMessage('party_ready_check', {});
		};
		ui.social.onPartyReady = (ready) => {
			engine.socialController.sendPartyMessage('party_ready', { ready });
		};
        ui.social.onPartyLootRule = (rule) => {
			engine.socialController.sendPartyMessage('party_loot_rule', { rule });
		};

        // Friends callbacks (0.38)
        ui.social.onFriendRequest = (username) => {
            engine.network.send('friend_request', { username });
        };
		ui.social.onTradeRequest = (targetName) => engine.network.send('trade_request', { targetName });
		ui.directTrade.onOffer = (tradeId, itemIds, gold) => engine.network.send('trade_offer', { tradeId, itemIds, gold });
		ui.directTrade.onConfirm = (tradeId) => engine.network.send('trade_confirm', { tradeId });
		ui.directTrade.onCancel = (tradeId) => engine.network.send('trade_cancel', { tradeId });
        ui.social.onFriendAccept = (username) => {
            engine.network.send('friend_accept', { username });
        };
        ui.social.onFriendDecline = (username) => {
            engine.network.send('friend_decline', { username });
        };
        ui.social.onFriendRemove = (username) => {
            engine.network.send('friend_remove', { username });
        };
        const guild = ui.social.guild;
        if (guild) {
            guild.onCreate = (name, tag) => engine.network.send('guild_create', { name, tag });
            guild.onInvite = (username) => engine.network.send('guild_invite', { username });
            guild.onRespond = (guildId, accept) => engine.network.send('guild_respond', { guildId, accept });
            guild.onLeave = () => engine.network.send('guild_leave', {});
            guild.onKick = (username) => engine.network.send('guild_kick', { username });
            guild.onSetRank = (playerId, rank) => engine.network.send('guild_set_rank', { playerId, rank });
            guild.onTransfer = (playerId) => engine.network.send('guild_transfer', { playerId });
            guild.onSetMOTD = (motd) => engine.network.send('guild_set_motd', { motd });
            guild.onDisband = () => engine.network.send('guild_disband', {});
            guild.onClaimLeadership = () => engine.network.send('guild_claim_leader', {});
            guild.onBankDeposit = (payload) => engine.network.send('guild_bank_deposit', payload);
            guild.onBankWithdraw = (payload) => engine.network.send('guild_bank_withdraw', payload);
            guild.onLeaderboard = (payload) => engine.network.send('guild_leaderboard', payload);
        }
        if (ui.pvp) {
            ui.pvp.onRefresh = () => engine.network.send('pvp_get', {});
            ui.pvp.onDuelRespond = (requesterId, accept) => engine.network.send('duel_respond', { requesterId, accept });
            ui.pvp.onQueue = (teamSize) => engine.network.send('arena_queue', { teamSize });
            ui.pvp.onLeave = () => engine.network.send('arena_leave', {});
            ui.pvp.onLeaderboard = () => engine.network.send('pvp_leaderboard', {});
            ui.pvp.onFlag = (enabled) => engine.network.send('pvp_flag', { enabled });
        }
        ui.social.onDuelRequest = (username) => engine.network.send('duel_request', { username });

        ui.skillTree.onSelectBranch = (branch) => {
            engine.network.send('selectBranch', { branch });
        };
        ui.skillTree.onUnlockSkill = (skillName) => {
            engine.network.send('unlockSkill', { skillName });
        };
        ui.skillTree.onUnlockTalent = (talentId) => {
            engine.network.send('unlockTalent', { talentId });
        };
        ui.skillTree.onResetTalents = () => {
            engine.network.send('resetTalents', {});
        };
        ui.skillTree.onSelectRune = (skill, runeId) => {
            engine.network.send('select_rune', { skill, runeId });
        };

        ui.inventory.onStashDeposit = (itemId) => {
            engine.network.send('stash_deposit', { itemId });
        };
        ui.inventory.onStashWithdraw = (itemId) => {
            engine.network.send('stash_withdraw', { itemId });
        };
        ui.inventory.onUnequipRequest = (slot) => {
            engine.network.send('unequip', { slot });
        };
        ui.inventory.onSortInventory = () => {
            engine.network.send('inventory_sort', {});
        };

        ui.forge.onForgeUpgrade = (slot, amount) => {
            engine.network.send('forge_upgrade', { slot, amount });
        };
        ui.forge.onForgePotency = (slot) => {
            engine.network.send('forge_potency', { slot });
        };
        ui.forge.onForgeSocket = (slot) => {
            engine.network.send('forge_socket', { slot });
        };
        ui.forge.onForgeInsertGem = (equipSlot, gemInvIndex, socketIndex) => {
            engine.network.send('forge_insert_gem', { equipSlot, gemInvIndex, socketIndex });
        };
        ui.forge.onForgeCombineGem = (gemIndices) => {
            engine.network.send('forge_combine_gem', { gemIndices });
        };
        ui.forge.onForgeRemoveGem = (equipSlot, socketIndex) => {
            engine.network.send('forge_remove_gem', { equipSlot, socketIndex });
        };

        ui.quest.onAcceptQuest = (questId) => {
            engine.network.send('accept_quest', { questId });
        };
        ui.quest.onCompleteQuest = (questId) => {
            engine.network.send('complete_quest', { questId });
        };
        ui.quest.onRequestQuests = () => {
            engine.network.send('request_quests', {});
        };

        ui.onMapToggle = () => engine.worldMap.toggle();
    }

    bindSessionCallbacks() {
        const engine = this.engine;
        const ui = engine.uiManager;

        ui.toggleChat(true);
        ui.onChatSend = (msg) => {
            engine.network.send('chat', { message: msg, sender: engine.username });
        };

        ui.showHUD();
        if (engine.isMobile) engine.renderSystem.updateCameraProjection();
        ui.onRecall = () => engine.requestTownRecall();
        ui.onRespawn = () => {
            if (!engine.player) return;

            const x = -1.25;
            const z = 200;
            if (engine.isMultiplayer) {
                engine.network.send('respawn', {});
            }

            engine.player.respawn(x, z);
            engine.player.timeSinceDeath = null;
            engine.player.targetPosition = null;
            engine.pendingInteraction = null;
            engine.abilityController.pendingAbilityTarget = null;
            engine.abilityController.pendingAbilitySkill = null;
            engine.chunkManager.updateEntityChunk(engine.player);
            engine.renderSystem.setCameraTarget(engine.player.position);
            engine.chunkManager.update(engine.player, 0, engine.collisionManager);
        };

        ui.onHotbarAssign = (slotIndex, skillName) => {
            if (engine.player) {
                if (!engine.player.hotbar) engine.player.hotbar = [null, null, null, null];
                engine.player.hotbar[slotIndex] = skillName;
            }
        };
        ui.onHotbarCast = (slotIndex) => {
            engine.abilityController.performHotbarAbility(slotIndex);
        };
    }
}
