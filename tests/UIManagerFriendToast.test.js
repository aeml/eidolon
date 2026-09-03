import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock heavy dependencies that UIManager imports transitively.
// ---------------------------------------------------------------------------
jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = { eidolon: { state: { StateEnvelope: { decode: jest.fn() } } } };
    return { default: mock, ...mock };
});

jest.unstable_mockModule('../src/core/ItemSystem.js', () => ({
    BASE_ITEMS: {},
    GEM_QUALITIES: {},
    GEM_TYPES: {},
    RARITY: {},
}));

jest.unstable_mockModule('../src/core/Constants.js', () => ({
    CONSTANTS: {},
}));

jest.unstable_mockModule('../src/assets/AssetCacheManager.js', () => ({
    AssetCacheManager: class { constructor() {} },
}));

jest.unstable_mockModule('../src/assets/assetManifest.js', () => ({
    DEFAULT_ASSET_VERSION: '1',
    getAssetPackEstimateMb: () => 0,
    getRecommendedAssetPackNames: () => [],
}));

jest.unstable_mockModule('../src/data/dungeonProgression.js', () => ({
    DUNGEON_RUN_LEVEL_BANDS: [],
    availableDungeonRunLevelsForPlayer: () => [],
    isEndgameDifficultyUnlocked: () => false,
}));

jest.unstable_mockModule('../src/audio/AudioManager.js', () => ({
    AudioManager: class {
        constructor() {}
        play() {}
        getSettings() { return { enabled: true, volume: 1.0, detailLevel: 'full' }; }
    },
    AUDIO_CUES: {},
}));

// Mock all sub-UI modules that UIManager imports.
const noopUI = () => ({
    default: class {
        constructor() {}
        close() {}
        toggleSocial() {}
        updateParty() {}
        updateSocialList() {}
        showPartyRequest() {}
        hidePartyRequest() {}
        setSocialStatus() {}
        updateFriendList() {}
        onFriendPresence() {}
        onIncomingFriendRequest() {}
    },
});

jest.unstable_mockModule('../src/ui/ForgeUI.js',      () => ({ ForgeUI:      class { constructor() {} close() {} } }));
jest.unstable_mockModule('../src/ui/SkillTreeUI.js',  () => ({ SkillTreeUI:  class { constructor() {} close() {} } }));
jest.unstable_mockModule('../src/ui/TradingUI.js',    () => ({ TradingUI:    class { constructor() {} close() {} } }));
jest.unstable_mockModule('../src/ui/QuestUI.js',      () => ({ QuestUI:      class { constructor() {} close() {} } }));
jest.unstable_mockModule('../src/ui/InventoryUI.js',  () => ({ InventoryUI:  class { constructor() {} close() {} } }));
jest.unstable_mockModule('../src/ui/SocialUI.js',     () => ({
    SocialUI: class {
        constructor() {
            this.onFriendRequest = null;
            this.onFriendAccept  = null;
            this.onFriendDecline = null;
            this.onFriendRemove  = null;
        }
        close() {}
        toggleSocial() {}
        updateParty() {}
        updateSocialList() {}
        showPartyRequest() {}
        hidePartyRequest() {}
        setSocialStatus() {}
        updateFriendList() {}
        onFriendPresence() {}
        onIncomingFriendRequest() {}
    }
}));

const { UIManager } = await import('../src/ui/UIManager.js');

// ---------------------------------------------------------------------------
// Minimal DOM setup required by UIManager constructor
// ---------------------------------------------------------------------------
function setupMinimalDOM() {
    const ids = [
        'player-hud', 'player-hp-bar', 'player-hp-text',
        'player-mana-bar', 'player-mana-text',
        'ui-layer', 'game-timer', 'conn-indicator',
        'combat-intent-panel', 'combat-intent-name', 'combat-intent-meta',
        'combat-intent-status', 'combat-intent-preview-basic',
        'combat-intent-preview-ability', 'combat-intent-preview-ability-label',
        'dungeon-entrance-hint', 'dungeon-entrance-hint-name',
        'dungeon-entrance-hint-status', 'dungeon-entrance-hint-prompt',
        'xp-bar-fill', 'xp-text', 'character-sheet', 'stats-content',
        'party-panel', 'party-list',
        'ability-container',
    ];
    for (const id of ids) {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        }
    }
}

function createUIManager() {
    setupMinimalDOM();
    const audioManager = {
        play: jest.fn(),
        getSettings: () => ({ enabled: true, volume: 1.0, detailLevel: 'full' }),
    };
    return new UIManager(false, { audioManager });
}

// ---------------------------------------------------------------------------
// showFriendToast — fires only for online=true
// ---------------------------------------------------------------------------

describe('UIManager.showFriendToast', () => {
    let uiManager;

    beforeEach(() => {
        uiManager = createUIManager();
        // Ensure toast is enabled and rate-limit map is fresh.
        uiManager.friendOnlineToastEnabled = true;
        uiManager._friendToastLastShown = new Map();
    });

    afterEach(() => {
        // Remove any toast elements left in the DOM.
        document.querySelectorAll('.friend-toast').forEach(el => el.remove());
    });

    test('creates a .friend-toast element when online=true', () => {
        uiManager.showFriendToast('alice', true);
        const toast = document.querySelector('.friend-toast');
        expect(toast).not.toBeNull();
        expect(toast.textContent).toBe('alice is now online.');
    });

    test('does NOT create toast when online=false', () => {
        uiManager.showFriendToast('alice', false);
        const toast = document.querySelector('.friend-toast');
        expect(toast).toBeNull();
    });

    test('does NOT create toast when friendOnlineToastEnabled is false', () => {
        uiManager.setFriendOnlineToastEnabled(false);
        uiManager.showFriendToast('alice', true);
        const toast = document.querySelector('.friend-toast');
        expect(toast).toBeNull();
    });

    test('rate-limits: second call within 30s is suppressed', () => {
        uiManager.showFriendToast('alice', true);
        document.querySelectorAll('.friend-toast').forEach(el => el.remove());
        // Second call immediately — within 30 s window.
        uiManager.showFriendToast('alice', true);
        const toasts = document.querySelectorAll('.friend-toast');
        expect(toasts.length).toBe(0);
    });

    test('rate-limit is per-user: different user not suppressed', () => {
        uiManager.showFriendToast('alice', true);
        document.querySelectorAll('.friend-toast').forEach(el => el.remove());
        uiManager.showFriendToast('bob', true);
        const toast = document.querySelector('.friend-toast');
        expect(toast).not.toBeNull();
        expect(toast.textContent).toBe('bob is now online.');
    });

    test('rate-limit resets after 30 s (mocked Date.now)', () => {
        const realDateNow = Date.now;
        try {
            let fakeNow = 1_000_000;
            Date.now = () => fakeNow;

            uiManager.showFriendToast('alice', true);
            document.querySelectorAll('.friend-toast').forEach(el => el.remove());

            // Advance time by 31 seconds.
            fakeNow += 31_000;
            uiManager.showFriendToast('alice', true);
            const toast = document.querySelector('.friend-toast');
            expect(toast).not.toBeNull();
        } finally {
            Date.now = realDateNow;
        }
    });

    test('toast has role=status and aria-live=polite', () => {
        uiManager.showFriendToast('carol', true);
        const toast = document.querySelector('.friend-toast');
        expect(toast.getAttribute('role')).toBe('status');
        expect(toast.getAttribute('aria-live')).toBe('polite');
    });
});

// ---------------------------------------------------------------------------
// setFriendOnlineToastEnabled / getFriendOnlineToastEnabled
// ---------------------------------------------------------------------------

describe('UIManager.setFriendOnlineToastEnabled', () => {
    let uiManager;

    beforeEach(() => {
        localStorage.clear();
        uiManager = createUIManager();
    });

    test('getFriendOnlineToastEnabled defaults to true', () => {
        expect(uiManager.getFriendOnlineToastEnabled()).toBe(true);
    });

    test('setFriendOnlineToastEnabled(false) persists to localStorage', () => {
        uiManager.setFriendOnlineToastEnabled(false);
        expect(localStorage.getItem('eidolon.friendOnlineToast')).toBe('false');
    });

    test('setFriendOnlineToastEnabled(true) persists to localStorage', () => {
        uiManager.setFriendOnlineToastEnabled(true);
        expect(localStorage.getItem('eidolon.friendOnlineToast')).toBe('true');
    });

    test('getFriendOnlineToastEnabled returns current value after set', () => {
        uiManager.setFriendOnlineToastEnabled(false);
        expect(uiManager.getFriendOnlineToastEnabled()).toBe(false);
        uiManager.setFriendOnlineToastEnabled(true);
        expect(uiManager.getFriendOnlineToastEnabled()).toBe(true);
    });

    test('new UIManager reads localStorage preference (false)', () => {
        localStorage.setItem('eidolon.friendOnlineToast', 'false');
        const ui2 = createUIManager();
        expect(ui2.getFriendOnlineToastEnabled()).toBe(false);
    });

    test('new UIManager reads localStorage preference (true)', () => {
        localStorage.setItem('eidolon.friendOnlineToast', 'true');
        const ui2 = createUIManager();
        expect(ui2.getFriendOnlineToastEnabled()).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// _renderFriendToast DOM output
// ---------------------------------------------------------------------------

describe('UIManager._renderFriendToast', () => {
    let uiManager;

    beforeEach(() => {
        uiManager = createUIManager();
    });

    afterEach(() => {
        document.querySelectorAll('.friend-toast').forEach(el => el.remove());
    });

    test('appends .friend-toast to document.body', () => {
        uiManager._renderFriendToast('Test message');
        const toast = document.querySelector('.friend-toast');
        expect(toast).not.toBeNull();
        expect(toast.parentNode).toBe(document.body);
    });

    test('sets text content', () => {
        uiManager._renderFriendToast('Hello!');
        expect(document.querySelector('.friend-toast').textContent).toBe('Hello!');
    });

    test('adds friend-toast--visible class (transition trigger)', () => {
        uiManager._renderFriendToast('visible?');
        const toast = document.querySelector('.friend-toast');
        expect(toast.classList.contains('friend-toast--visible')).toBe(true);
    });
});
