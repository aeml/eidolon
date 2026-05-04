import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = { eidolon: { state: { StateEnvelope: { decode: jest.fn() } } } };
    return { default: mock, ...mock };
});

const { SocialUI } = await import('../src/ui/SocialUI.js');

// ---------------------------------------------------------------------------
// Minimal DOM harness required by SocialUI constructor
// ---------------------------------------------------------------------------
function setupDOM() {
    // SocialUI._createSocialWindow looks for #social-window or creates one.
    // Party panel elements are looked up by ID after construction.
    const ids = [
        'party-panel', 'party-list', 'party-invite-input',
        'btn-invite-party', 'btn-leave-party',
        'party-request-modal', 'party-inviter-name',
        'btn-accept-party', 'btn-decline-party',
    ];
    for (const id of ids) {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            document.body.appendChild(el);
        }
    }
    // Remove any stale social-window from a previous test so each test gets fresh DOM.
    const old = document.getElementById('social-window');
    if (old) old.remove();
}

function createSocialUI() {
    setupDOM();
    const ctx = {
        getLastPlayer: () => null,
        addChatMessage: jest.fn(),
        openManagedWindow: jest.fn(),
        closeManagedWindow: jest.fn(),
        closePrimaryHudMenus: jest.fn(),
    };
    const ui = new SocialUI(ctx);
    return { ui, ctx };
}

// ---------------------------------------------------------------------------
// updateFriendList
// ---------------------------------------------------------------------------

describe('SocialUI.updateFriendList', () => {
    test('stores friendEntries and pendingUsernames', () => {
        const { ui } = createSocialUI();
        ui.updateFriendList({
            friends: [{ username: 'alice', online: true, socialStatus: 'available' }],
            pending: ['bob'],
        });
        expect(ui.friendEntries).toHaveLength(1);
        expect(ui.friendEntries[0].username).toBe('alice');
        expect(ui.pendingUsernames).toEqual(['bob']);
    });

    test('handles empty payload gracefully', () => {
        const { ui } = createSocialUI();
        ui.updateFriendList({ friends: [], pending: [] });
        expect(ui.friendEntries).toHaveLength(0);
        expect(ui.pendingUsernames).toHaveLength(0);
    });

    test('handles missing friends/pending keys', () => {
        const { ui } = createSocialUI();
        ui.updateFriendList({});
        expect(ui.friendEntries).toHaveLength(0);
        expect(ui.pendingUsernames).toHaveLength(0);
    });

    test('renders friends panel when tab is active', () => {
        const { ui } = createSocialUI();
        ui._activeTab = 'friends';
        ui.updateFriendList({
            friends: [{ username: 'carol', online: false, socialStatus: '' }],
            pending: [],
        });
        const rows = ui._friendsList.querySelectorAll('.friends-row');
        expect(rows.length).toBe(1);
    });

    test('does not render friends panel when online tab is active', () => {
        const { ui } = createSocialUI();
        ui._activeTab = 'online';
        // _friendsList starts empty; calling updateFriendList should NOT populate it
        ui.updateFriendList({
            friends: [{ username: 'dave', online: true, socialStatus: '' }],
            pending: [],
        });
        const rows = ui._friendsList.querySelectorAll('.friends-row');
        expect(rows.length).toBe(0);
    });

    test('updates badge count', () => {
        const { ui } = createSocialUI();
        ui.updateFriendList({ friends: [], pending: ['x', 'y', 'z'] });
        expect(ui._friendsBadge.textContent).toBe('3');
        expect(ui._friendsBadge.style.display).not.toBe('none');
    });

    test('hides badge when no pending', () => {
        const { ui } = createSocialUI();
        ui.updateFriendList({ friends: [], pending: [] });
        expect(ui._friendsBadge.style.display).toBe('none');
    });
});

// ---------------------------------------------------------------------------
// onFriendPresence
// ---------------------------------------------------------------------------

describe('SocialUI.onFriendPresence', () => {
    test('updates entry.online to true', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [{ username: 'alice', online: false, socialStatus: '' }];
        ui.onFriendPresence({ username: 'alice', online: true });
        expect(ui.friendEntries[0].online).toBe(true);
    });

    test('clears socialStatus on offline event', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [{ username: 'alice', online: true, socialStatus: 'in_run' }];
        ui.onFriendPresence({ username: 'alice', online: false });
        expect(ui.friendEntries[0].online).toBe(false);
        expect(ui.friendEntries[0].socialStatus).toBe('');
    });

    test('is a no-op for unknown username', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [{ username: 'alice', online: false, socialStatus: '' }];
        ui.onFriendPresence({ username: 'ghost', online: true });
        expect(ui.friendEntries[0].online).toBe(false);
    });

    test('re-renders panel when friends tab active', () => {
        const { ui } = createSocialUI();
        ui._activeTab = 'friends';
        ui.friendEntries = [{ username: 'bob', online: false, socialStatus: '' }];
        ui.onFriendPresence({ username: 'bob', online: true });
        const rows = ui._friendsList.querySelectorAll('.friends-row');
        expect(rows.length).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// onIncomingFriendRequest
// ---------------------------------------------------------------------------

describe('SocialUI.onIncomingFriendRequest', () => {
    test('adds username to pendingUsernames', () => {
        const { ui } = createSocialUI();
        ui.pendingUsernames = [];
        ui.onIncomingFriendRequest({ username: 'alice' });
        expect(ui.pendingUsernames).toContain('alice');
    });

    test('does not add duplicate', () => {
        const { ui } = createSocialUI();
        ui.pendingUsernames = ['alice'];
        ui.onIncomingFriendRequest({ username: 'alice' });
        expect(ui.pendingUsernames).toHaveLength(1);
    });

    test('updates badge', () => {
        const { ui } = createSocialUI();
        ui.pendingUsernames = [];
        ui.onIncomingFriendRequest({ username: 'bob' });
        expect(ui._friendsBadge.textContent).toBe('1');
    });
});

// ---------------------------------------------------------------------------
// _switchTab
// ---------------------------------------------------------------------------

describe('SocialUI._switchTab', () => {
    test('switching to friends hides online panel and shows friends panel', () => {
        const { ui } = createSocialUI();
        ui._switchTab('friends');
        const onlinePanel = ui.socialWindow.querySelector('#tab-panel-online');
        const friendsPanel = ui.socialWindow.querySelector('#tab-panel-friends');
        expect(onlinePanel.style.display).toBe('none');
        expect(friendsPanel.style.display).not.toBe('none');
    });

    test('switching to online shows online panel and hides friends panel', () => {
        const { ui } = createSocialUI();
        ui._switchTab('friends');
        ui._switchTab('online');
        const onlinePanel = ui.socialWindow.querySelector('#tab-panel-online');
        const friendsPanel = ui.socialWindow.querySelector('#tab-panel-friends');
        expect(onlinePanel.style.display).not.toBe('none');
        expect(friendsPanel.style.display).toBe('none');
    });

    test('sets aria-selected on tab buttons', () => {
        const { ui } = createSocialUI();
        ui._switchTab('friends');
        const onlineBtn = ui.socialWindow.querySelector('#tab-btn-online');
        const friendsBtn = ui.socialWindow.querySelector('#tab-btn-friends');
        expect(friendsBtn.getAttribute('aria-selected')).toBe('true');
        expect(onlineBtn.getAttribute('aria-selected')).toBe('false');
    });

    test('sets _activeTab', () => {
        const { ui } = createSocialUI();
        ui._switchTab('friends');
        expect(ui._activeTab).toBe('friends');
        ui._switchTab('online');
        expect(ui._activeTab).toBe('online');
    });
});

// ---------------------------------------------------------------------------
// _renderFriendsPanel
// ---------------------------------------------------------------------------

describe('SocialUI._renderFriendsPanel', () => {
    test('shows empty-state message when no friends', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [];
        ui._renderFriendsPanel();
        const empty = ui._friendsList.querySelector('.friends-empty');
        expect(empty).not.toBeNull();
    });

    test('renders one row per friend', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [
            { username: 'alice', online: true, socialStatus: 'available' },
            { username: 'bob',   online: false, socialStatus: '' },
        ];
        ui._renderFriendsPanel();
        const rows = ui._friendsList.querySelectorAll('.friends-row');
        expect(rows.length).toBe(2);
    });

    test('sorts online friends before offline', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [
            { username: 'offline-first', online: false, socialStatus: '' },
            { username: 'online-second', online: true,  socialStatus: '' },
        ];
        ui._renderFriendsPanel();
        const rows = ui._friendsList.querySelectorAll('.friends-row');
        expect(rows[0].classList.contains('friends-row--online')).toBe(true);
        expect(rows[1].classList.contains('friends-row--offline')).toBe(true);
    });

    test('sorts alphabetically within the same online status', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [
            { username: 'zara', online: true, socialStatus: '' },
            { username: 'anya', online: true, socialStatus: '' },
        ];
        ui._renderFriendsPanel();
        const names = [...ui._friendsList.querySelectorAll('.friends-name')].map(el => el.textContent);
        expect(names).toEqual(['anya', 'zara']);
    });

    test('shows Offline label for offline friends', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [{ username: 'bob', online: false, socialStatus: '' }];
        ui._renderFriendsPanel();
        const status = ui._friendsList.querySelector('.friends-status--offline');
        expect(status).not.toBeNull();
        expect(status.textContent).toBe('Offline');
    });

    test('shows social status label for online friend with status', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [{ username: 'alice', online: true, socialStatus: 'looking_party' }];
        ui._renderFriendsPanel();
        const status = ui._friendsList.querySelector('.friends-status--looking_party');
        expect(status).not.toBeNull();
        expect(status.textContent).toBe('Looking for Party');
    });

    test('shows pending section when pendingUsernames non-empty', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [];
        ui.pendingUsernames = ['carol'];
        ui._renderFriendsPanel();
        expect(ui._friendsPendingSection.style.display).not.toBe('none');
        const rows = ui._friendsPendingList.querySelectorAll('.friends-row--pending');
        expect(rows.length).toBe(1);
    });

    test('hides pending section when pendingUsernames is empty', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [];
        ui.pendingUsernames = [];
        ui._renderFriendsPanel();
        expect(ui._friendsPendingSection.style.display).toBe('none');
    });

    test('pending row has Accept and Decline buttons', () => {
        const { ui } = createSocialUI();
        ui.friendEntries = [];
        ui.pendingUsernames = ['dave'];
        ui._renderFriendsPanel();
        const acceptBtn = ui._friendsPendingList.querySelector('.friends-btn--accept');
        const declineBtn = ui._friendsPendingList.querySelector('.friends-btn--decline');
        expect(acceptBtn).not.toBeNull();
        expect(declineBtn).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Callback wiring
// ---------------------------------------------------------------------------

describe('SocialUI callback wiring', () => {
    test('onFriendRequest called when Add Friend button clicked', () => {
        const { ui } = createSocialUI();
        const cb = jest.fn();
        ui.onFriendRequest = cb;
        const input = ui.socialWindow.querySelector('#friend-add-input');
        const btn   = ui.socialWindow.querySelector('#btn-add-friend');
        input.value = 'targetUser';
        btn.click();
        expect(cb).toHaveBeenCalledWith('targetUser');
        expect(input.value).toBe('');
    });

    test('onFriendAccept called when Accept button clicked in pending row', () => {
        const { ui } = createSocialUI();
        const cb = jest.fn();
        ui.onFriendAccept = cb;
        ui.pendingUsernames = ['requester'];
        ui._renderFriendsPanel();
        const acceptBtn = ui._friendsPendingList.querySelector('.friends-btn--accept');
        acceptBtn.click();
        expect(cb).toHaveBeenCalledWith('requester');
    });

    test('onFriendDecline called when Decline button clicked in pending row', () => {
        const { ui } = createSocialUI();
        const cb = jest.fn();
        ui.onFriendDecline = cb;
        ui.pendingUsernames = ['requester'];
        ui._renderFriendsPanel();
        const declineBtn = ui._friendsPendingList.querySelector('.friends-btn--decline');
        declineBtn.click();
        expect(cb).toHaveBeenCalledWith('requester');
    });

    test('onFriendRemove called when Remove button clicked in friends list', () => {
        const { ui } = createSocialUI();
        const cb = jest.fn();
        ui.onFriendRemove = cb;
        ui.friendEntries = [{ username: 'alice', online: false, socialStatus: '' }];
        ui._renderFriendsPanel();
        const removeBtn = ui._friendsList.querySelector('.friends-btn--remove');
        removeBtn.click();
        expect(cb).toHaveBeenCalledWith('alice');
    });

    test('Add Friend button is no-op when input is empty', () => {
        const { ui } = createSocialUI();
        const cb = jest.fn();
        ui.onFriendRequest = cb;
        const btn = ui.socialWindow.querySelector('#btn-add-friend');
        btn.click();
        expect(cb).not.toHaveBeenCalled();
    });
});
