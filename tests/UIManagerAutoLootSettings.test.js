import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="player-hud"></div>
        <div id="player-hp-bar"></div>
        <div id="player-hp-text"></div>
        <div id="player-mana-bar"></div>
        <div id="player-mana-text"></div>
        <div id="ui-layer"></div>
        <div id="game-timer"></div>
        <div id="combat-intent-panel" style="display:none"></div>
        <div id="combat-intent-name"></div>
        <div id="combat-intent-meta"></div>
        <div id="combat-intent-status"></div>
        <div id="combat-intent-preview-basic"></div>
        <div id="combat-intent-preview-ability"></div>
        <div id="combat-intent-preview-ability-label"></div>
        <div id="xp-bar-fill"></div>
        <div id="xp-text"></div>
        <div id="character-sheet"></div>
        <div id="stats-content"></div>
        <div id="quest-window"></div>
        <div id="quest-list"></div>
        <div id="quest-journal"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
        <div id="esc-menu"></div>
        <div id="help-screen"></div>
        <div id="settings-screen"></div>
        <div id="patch-notes-screen"></div>
        <button id="btn-resume"></button>
        <button id="btn-help"></button>
        <button id="btn-settings"></button>
        <button id="btn-patch-notes"></button>
        <button id="btn-report"></button>
        <button id="btn-menu"></button>
        <button id="btn-close-help"></button>
        <button id="btn-close-settings"></button>
        <button id="btn-close-patch-notes"></button>
        <button id="btn-respawn"></button>
        <div id="abilities-menu"></div>
        <div id="abilities-content"></div>
        <button id="btn-close-abilities"></button>
        <div id="hotbar-container"></div>
        <div class="hotbar-slot"></div>
        <div id="report-screen"></div>
        <button id="btn-cancel-report"></button>
        <button id="btn-submit-report"></button>
        <select id="report-type"></select>
        <textarea id="report-text"></textarea>
        <select id="graphics-quality"></select>
        <input id="graphics-brightness" />
        <div id="graphics-brightness-value"></div>
        <input id="ui-scale" />
        <div id="ui-scale-value"></div>
        <select id="control-hint-level"><option value="standard">Standard controls</option><option value="detailed">Detailed keyboard reference</option></select>
        <div id="help-keyboard-reference" style="display:none"></div>
        <input id="auto-loot-enabled" type="checkbox" />
        <input id="audio-enabled" type="checkbox" />
        <input id="audio-volume" />
        <div id="audio-volume-value"></div>
        <select id="audio-detail-level"><option value="full">Full cues</option><option value="reduced">Reduced UI cues</option></select>
        <input id="camera-shake-enabled" type="checkbox" />
        <input id="fullscreen-enabled" type="checkbox" />
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <button id="btn-close-shop"></button>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
        <div id="shop-grid"></div>
        <div id="stash-screen"></div>
        <div id="stash-grid"></div>
        <div id="buyback-grid"></div>
        <div id="split-stack-window"></div>
        <button id="btn-close-split"></button>
        <div id="split-item-name"></div>
        <input id="split-amount-range" />
        <input id="split-amount-input" />
        <button id="btn-confirm-split"></button>
        <button id="btn-cancel-split"></button>
        <div id="forge-screen"></div>
        <div id="forge-potency-info"></div>
        <div id="forge-potency-item-name"></div>
        <div id="forge-potency-stats"></div>
        <div id="forge-potency-cost-value"></div>
        <button id="btn-forge-potency"></button>
        <div id="forge-socket-info"></div>
        <div id="forge-socket-item-name"></div>
        <div id="forge-socket-stats"></div>
        <div id="forge-socket-cost-hearts"></div>
        <div id="forge-socket-cost-shards"></div>
        <button id="btn-forge-socket"></button>
        <div id="trading-house-screen"></div>
        <div id="trading-inventory-grid"></div>
        <div id="trading-search-results"></div>
        <div id="trading-my-auctions"></div>
        <button id="btn-trading-search"></button>
        <button id="btn-trading-create"></button>
        <button id="btn-trading-my-auctions"></button>
        <button id="btn-close-trading"></button>
        <input id="trading-search-name" />
        <select id="trading-search-rarity"></select>
        <input id="trading-create-price" />
        <input id="trading-create-duration" />
        <div id="social-window"></div>
        <div id="party-panel"></div>
        <div id="skill-tree-window"></div>
        <div id="menu-bar"></div>
        <button id="btn-menu-map"></button>
        <button id="btn-menu-social"></button>
        <button id="btn-menu-inventory"></button>
        <button id="btn-menu-character"></button>
        <button id="btn-menu-quest"></button>
        <button id="btn-menu-skills"></button>
        <div id="ability-container"></div>
        <div id="ability-icon"></div>
        <div id="ability-cooldown"></div>
        <div id="ability-tooltip"></div>
        <div id="ability-name"></div>
        <div id="ability-desc"></div>
        <div id="ability-cost"></div>
        <div id="stat-tooltip"></div>
        <div id="stat-tooltip-title"></div>
        <div id="stat-tooltip-desc"></div>
        <div id="compare-tooltip"></div>
        <div id="compare-tooltip-title"></div>
        <div id="compare-tooltip-desc"></div>
        <div id="chat-box"></div>
        <div id="chat-messages"></div>
        <input id="chat-input" />
        <div id="death-screen"></div>
        <div id="xp-bar-container"></div>
    `;
}

describe('UIManager settings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('reads auto-loot setting from localStorage', () => {
        localStorage.setItem('eidolon.autoLootEnabled', 'true');
        buildDom();

        const ui = new UIManager(false);

        expect(ui.getAutoLootEnabled()).toBe(true);
        expect(document.getElementById('auto-loot-enabled').checked).toBe(true);
    });

    test('setAutoLootEnabled persists and invokes callback', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onAutoLootChange = jest.fn();

        ui.setAutoLootEnabled(true);

        expect(localStorage.getItem('eidolon.autoLootEnabled')).toBe('true');
        expect(ui.getAutoLootEnabled()).toBe(true);
        expect(document.getElementById('auto-loot-enabled').checked).toBe(true);
        expect(ui.onAutoLootChange).toHaveBeenCalledWith(true);
    });

    test('checkbox change updates setting', () => {
        buildDom();
        const ui = new UIManager(false);
        const checkbox = document.getElementById('auto-loot-enabled');

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(ui.getAutoLootEnabled()).toBe(true);
        expect(localStorage.getItem('eidolon.autoLootEnabled')).toBe('true');
    });

    test('Enter respects focused menu controls and still opens chat from gameplay', () => {
        buildDom();
        const ui = new UIManager(false);
        const button = document.getElementById('btn-respawn');
        button.focus();
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        button.dispatchEvent(enter);
        expect(document.activeElement).toBe(button);
        expect(enter.defaultPrevented).toBe(false);
        button.blur();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(ui.chatInput);
    });

    test('submitting chat stays blurred instead of reopening globally', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onChatSend = jest.fn();
        const chatInput = document.getElementById('chat-input');
        const chatBox = document.getElementById('chat-box');
        ui.toggleChat(true);
        chatInput.value = 'hello party';
        chatInput.focus();

        const enter = new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true
        });
        chatInput.dispatchEvent(enter);

        expect(ui.onChatSend).toHaveBeenCalledWith('hello party');
        expect(chatInput.value).toBe('');
        expect(document.activeElement).not.toBe(chatInput);
        expect(enter.defaultPrevented).toBe(true);
        expect(chatBox.style.display).toBe('flex');
        ui.social.toggleSocial(true);
        expect(ui.social.isOpen).toBe(true);

        ui.handleEscape();

        expect(chatBox.style.display).toBe('flex');
        expect(ui.social.isOpen).toBe(false);
    });

    test('camera shake defaults off when no setting is stored', () => {
        buildDom();

        const ui = new UIManager(false);

        expect(ui.getCameraShakeEnabled()).toBe(false);
        expect(document.getElementById('camera-shake-enabled').checked).toBe(false);
    });

    test('setCameraShakeEnabled persists and invokes callback', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onCameraShakeChange = jest.fn();

        ui.setCameraShakeEnabled(true);

        expect(localStorage.getItem('eidolon.cameraShakeEnabled')).toBe('true');
        expect(ui.getCameraShakeEnabled()).toBe(true);
        expect(document.getElementById('camera-shake-enabled').checked).toBe(true);
        expect(ui.onCameraShakeChange).toHaveBeenCalledWith(true);
    });

    test('camera shake checkbox change updates setting', () => {
        buildDom();
        const ui = new UIManager(false);
        const checkbox = document.getElementById('camera-shake-enabled');

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(ui.getCameraShakeEnabled()).toBe(true);
        expect(localStorage.getItem('eidolon.cameraShakeEnabled')).toBe('true');
    });

    test('fullscreen setting persists and invokes callback', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onFullscreenChange = jest.fn();

        ui.setFullscreenEnabled(true);

        expect(localStorage.getItem('eidolon.fullscreenEnabled')).toBe('true');
        expect(ui.getFullscreenEnabled()).toBe(true);
        expect(document.getElementById('fullscreen-enabled').checked).toBe(true);
        expect(ui.onFullscreenChange).toHaveBeenCalledWith(true);
    });

    test('audio detail level persists and invokes callback', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onAudioDetailLevelChange = jest.fn();

        ui.setAudioDetailLevel('reduced');

        expect(localStorage.getItem('eidolon.audioDetailLevel')).toBe('reduced');
        expect(ui.getAudioDetailLevel()).toBe('reduced');
        expect(document.getElementById('audio-detail-level').value).toBe('reduced');
        expect(ui.onAudioDetailLevelChange).toHaveBeenCalledWith('reduced');
    });

    test('audio detail select change updates setting', () => {
        buildDom();
        const ui = new UIManager(false);
        const select = document.getElementById('audio-detail-level');

        select.value = 'reduced';
        select.dispatchEvent(new Event('change'));

        expect(ui.getAudioDetailLevel()).toBe('reduced');
        expect(localStorage.getItem('eidolon.audioDetailLevel')).toBe('reduced');
    });

    test('ui scale persists, clamps, and applies root css variable', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onUiScaleChange = jest.fn();

        ui.setUiScale(125);

        expect(localStorage.getItem('eidolon.uiScale')).toBe('125');
        expect(ui.getUiScale()).toBe(1.25);
        expect(document.getElementById('ui-scale').value).toBe('125');
        expect(document.getElementById('ui-scale-value').textContent).toBe('125%');
        expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.25');
        expect(ui.onUiScaleChange).toHaveBeenCalledWith(1.25);

        ui.setUiScale(200);
        expect(localStorage.getItem('eidolon.uiScale')).toBe('125');

        ui.setUiScale(10);
        expect(localStorage.getItem('eidolon.uiScale')).toBe('85');
        expect(ui.getUiScale()).toBe(0.85);
    });

    test('ui scale slider change updates setting', () => {
        buildDom();
        const ui = new UIManager(false);
        const slider = document.getElementById('ui-scale');

        slider.value = '115';
        slider.dispatchEvent(new Event('input'));

        expect(ui.getUiScale()).toBe(1.15);
        expect(localStorage.getItem('eidolon.uiScale')).toBe('115');
        expect(document.getElementById('ui-scale-value').textContent).toBe('115%');
    });

    test('invalid stored ui scale normalizes back to default without persisting', () => {
        localStorage.setItem('eidolon.uiScale', 'large');
        buildDom();

        const ui = new UIManager(false);

        expect(ui.getUiScale()).toBe(1);
        expect(document.getElementById('ui-scale').value).toBe('100');
        expect(document.getElementById('ui-scale-value').textContent).toBe('100%');
        expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1');
        expect(localStorage.getItem('eidolon.uiScale')).toBe('large');
    });

    test('control hint level persists and toggles detailed help reference', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onControlHintLevelChange = jest.fn();

        ui.setControlHintLevel('detailed');

        expect(localStorage.getItem('eidolon.controlHintLevel')).toBe('detailed');
        expect(ui.getControlHintLevel()).toBe('detailed');
        expect(document.getElementById('control-hint-level').value).toBe('detailed');
        expect(document.getElementById('help-keyboard-reference').style.display).toBe('block');
        expect(ui.onControlHintLevelChange).toHaveBeenCalledWith('detailed');

        ui.setControlHintLevel('invalid');
        expect(localStorage.getItem('eidolon.controlHintLevel')).toBe('standard');
        expect(ui.getControlHintLevel()).toBe('standard');
        expect(document.getElementById('help-keyboard-reference').style.display).toBe('none');
    });

    test('control hint select change updates setting', () => {
        buildDom();
        const ui = new UIManager(false);
        const select = document.getElementById('control-hint-level');

        select.value = 'detailed';
        select.dispatchEvent(new Event('change'));

        expect(ui.getControlHintLevel()).toBe('detailed');
        expect(localStorage.getItem('eidolon.controlHintLevel')).toBe('detailed');
        expect(document.getElementById('help-keyboard-reference').style.display).toBe('block');
    });

    test('invalid stored control hint level normalizes without persisting', () => {
        localStorage.setItem('eidolon.controlHintLevel', 'verbose');
        buildDom();

        const ui = new UIManager(false);

        expect(ui.getControlHintLevel()).toBe('standard');
        expect(document.getElementById('control-hint-level').value).toBe('standard');
        expect(document.getElementById('help-keyboard-reference').style.display).toBe('none');
        expect(localStorage.getItem('eidolon.controlHintLevel')).toBe('verbose');
    });

    test('esc menu toggle reports open and close state', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.onEscMenuChange = jest.fn();

        ui.toggleEscMenu();
        ui.toggleEscMenu();

        expect(ui.onEscMenuChange).toHaveBeenNthCalledWith(1, true);
        expect(ui.onEscMenuChange).toHaveBeenNthCalledWith(2, false);
    });
});
