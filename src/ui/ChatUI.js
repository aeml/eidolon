import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { socialSafetyActions } from './SocialSafetyUI.js';
const CHAT_SIZE_STORAGE_KEY = 'eidolon.chatSize';
const CHAT_VIEWS = new Set(['chat', 'party', 'guild', 'whisper', 'game']);

/**
 * Owns the two-stream chat log. Communication stays in the Chat stream while
 * character-specific rewards and progression stay in the Game stream.
 */
export class ChatUI {
    dispose() { this.closePlayerSafety(); disposeOwnedEvents(this); this.sizeObserver?.disconnect(); }

    constructor({ onSend = null, onMobileExpanded = null, onSafety = null } = {}) {
        this.onSend = onSend;
        this.onSafety = onSafety;
        this.onMobileExpanded = onMobileExpanded;
        this.chatBox = document.getElementById('chat-box');
        this.messages = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.composer = document.getElementById('chat-composer') || this.input;
        this.tabs = Array.from(document.querySelectorAll('[data-chat-tab]'));
        this.activeStream = 'chat';
        this.whisperTarget = '';
        this.unread = { chat: 0, party: 0, guild: 0, whisper: 0, game: 0 };
        this.maxMessages = 250;
        this.mobileToggle = document.getElementById('chat-mobile-toggle');
        this.mobileExpanded = false;
        this.mobileUnread = 0;

        this.bindEvents();
        this.restoreSize();
        this.setActiveStream('chat');
        this.observeSize();
        this.renderMobileToggle();
    }

    bindEvents() {
        ownedEvent(this, this.messages, 'click', event => {
            const sender = event.target.closest?.('button[data-chat-player]');
            if (!sender || !this.messages.contains(sender)) return;
            event.stopPropagation();
            if (this.safetySender === sender) { this.closePlayerSafety(true); return; }
            this.closePlayerSafety();
            const entry = sender.closest('.chat-message');
            const quote = entry.querySelector('.chat-message__text').textContent.trim().slice(0, 1000);
            const context = `${entry.dataset.chatChannel} chat; selected message (client-reported, not verified evidence): ${quote}`;
            this.safetySender = sender;
            sender.setAttribute('aria-expanded', 'true');
            const panel = socialSafetyActions(sender.dataset.chatPlayer, context, (action, username, selected) => {
                if (this.safetyPanel !== panel) return;
                this.closePlayerSafety(action !== 'report');
                this.onSafety?.(action, username, selected);
            }, sender.dataset.chatLabel || sender.dataset.chatPlayer);
            this.safetyPanel = panel;
            panel.open = true;
            panel.querySelector('summary').textContent = `${sender.dataset.chatLabel || sender.dataset.chatPlayer} · Player safety`;
            const close = document.createElement('button');
            close.type = 'button'; close.textContent = 'Close player safety';
            close.onclick = () => { if (this.safetyPanel === panel) this.closePlayerSafety(true); };
            this.safetyPanel.append(close);
            entry.append(this.safetyPanel);
            this.safetyPanel.querySelector('summary').focus();
            this.safetyPanel.scrollIntoView?.({block: 'nearest'});
        });
        ownedEvent(this, this.messages, 'keydown', event => {
            if (event.key === 'Escape' && this.safetyPanel) {
                event.preventDefault(); event.stopPropagation(); this.closePlayerSafety(true);
            }
        });
        ownedEvent(this, this.mobileToggle, 'click', () => this.setMobileExpanded(!this.mobileExpanded));
        this.tabs.forEach((tab, index) => {
            ownedEvent(this, tab, 'click', () => {
                this.setActiveStream(tab.dataset.chatTab, { focusInput: tab.dataset.chatTab === 'chat' });
            });
            ownedEvent(this, tab, 'keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
                this.setActiveStream(this.tabs[next].dataset.chatTab);
                this.tabs[next].focus();
            });
        });

        ownedEvent(this, this.input, 'keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.setActiveStream('chat');
                this.input.blur();
                return;
            }
            if (event.key !== 'Enter') return;

            // Prevent this Enter from reaching the global open-chat listener
            // after the input loses focus.
            event.preventDefault();
            event.stopPropagation();
            const message = this.input.value.trim();
            if (message) {
                // Tabs are also the composition destination. Use existing
                // server-authoritative commands so failed private/group sends
                // never fall back to public chat. Explicit commands still win.
                const prefix = { party: '/party ', guild: '/guild ',
                    whisper: this.whisperTarget ? `/w ${this.whisperTarget} ` : '/r ' }[this.activeStream] || '';
                this.onSend?.(message.startsWith('/') ? message : `${prefix}${message}`);
                this.input.value = '';
            }
            this.input.blur();
        });
    }

    normalizeStream(stream) {
        return CHAT_VIEWS.has(stream) ? stream : 'chat';
    }

    entryIsVisible(entry, view = this.activeStream) {
        const stream = entry?.dataset?.chatStream || 'chat';
        const channel = entry?.dataset?.chatChannel || '';
        if (view === 'game') return stream === 'game';
        if (stream !== 'chat') return false;
        if (view === 'party') return channel === 'party';
        if (view === 'guild') return channel === 'guild';
        if (view === 'whisper') return channel === 'whisper';
        return true;
    }

    setActiveStream(stream, { focusInput = false } = {}) {
        this.closePlayerSafety();
        const nextStream = this.normalizeStream(stream);
        this.activeStream = nextStream;

        this.tabs.forEach((tab) => {
            const isActive = tab.dataset.chatTab === nextStream;
            tab.classList.toggle('chat-tab--active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });

        if (this.messages) {
            this.messages.dataset.activeStream = nextStream;
            Array.from(this.messages.children).forEach((entry) => {
                entry.hidden = !this.entryIsVisible(entry, nextStream);
            });
            this.messages.scrollTop = this.messages.scrollHeight;
        }

        if (this.composer) {
            this.composer.hidden = nextStream === 'game';
        }
        if (this.input) {
            const destination = { party: 'Message your party…', guild: 'Message your guild…',
                whisper: this.whisperTarget ? `Whisper to ${this.whisperLabel || this.whisperTarget}…` : 'Reply to last whisper… or /w player message' }[nextStream] || 'Message the current world…';
            this.input.placeholder = destination;
            this.input.setAttribute('aria-label', destination);
        }

        this.clearUnread(nextStream);
        if (focusInput && nextStream === 'chat') {
            this.input?.focus();
        }
    }

    addMessage(sender, message, { stream = 'chat', channel = '', senderAccount = sender } = {}) {
        if (!this.chatBox || !this.messages || message === undefined || message === null) return;
        if (document.body.classList.contains('mobile-mode') && !this.mobileExpanded) {
            this.mobileUnread = Math.min(999, this.mobileUnread + 1);
            this.renderMobileToggle();
        }

        const normalizedStream = this.normalizeStream(stream);
        const entry = document.createElement('div');
        entry.className = `chat-message chat-message--${normalizedStream}`;
        entry.dataset.chatStream = normalizedStream;
        entry.dataset.chatChannel = String(channel || '');
        entry.hidden = !this.entryIsVisible(entry);

        if (channel) {
            const channelEl = document.createElement('span');
            channelEl.className = 'chat-message__channel';
            channelEl.textContent = `[${this.formatChannel(channel)}]`;
            entry.appendChild(channelEl);
        }

        const playerSender = typeof this.onSafety === 'function' && normalizedStream === 'chat'
            && ['world', 'global', 'party', 'guild', 'whisper'].includes(channel)
            && typeof senderAccount === 'string' && senderAccount !== 'System' && senderAccount.length <= 256 && !/[\s/]/.test(senderAccount) && senderAccount;
        const senderEl = document.createElement(playerSender ? 'button' : 'strong');
        senderEl.className = 'chat-message__sender';
        senderEl.textContent = `${sender || (normalizedStream === 'game' ? 'Game' : 'System')}:`;
        if (playerSender) {
            senderEl.type = 'button'; senderEl.dataset.chatPlayer = senderAccount; senderEl.dataset.chatLabel = sender;
            senderEl.setAttribute('aria-label', `Player safety for ${sender}`);
            senderEl.setAttribute('aria-expanded', 'false');
        }

        const messageEl = document.createElement('span');
        messageEl.className = 'chat-message__text';
        messageEl.textContent = ` ${message}`;

        entry.appendChild(senderEl);
        entry.appendChild(messageEl);
        this.messages.appendChild(entry);
        this.trimMessages();
        // Communication keeps the permanent gameplay transcript visible.
        if (normalizedStream === 'chat') {
            this.chatBox.style.display = 'flex';
        }

        if (!entry.hidden) {
            this.messages.scrollTop = this.messages.scrollHeight;
        } else {
            this.incrementUnread(normalizedStream === 'game' ? 'game' : 'chat');
        }
        const channelView = String(channel || '').toLowerCase();
        if (['party', 'guild', 'whisper'].includes(channelView) && this.activeStream !== channelView && this.activeStream !== 'chat') {
            this.incrementUnread(channelView);
        }
    }

    formatChannel(channel) {
        const normalized = String(channel || '').trim().toLowerCase();
        if (!normalized) return '';
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    trimMessages() {
        while (this.messages && this.messages.children.length > this.maxMessages) {
            if (this.messages.firstElementChild?.contains(this.safetyPanel)) this.closePlayerSafety();
            this.messages.firstElementChild?.remove();
        }
    }

    closePlayerSafety(restoreFocus = false) {
        const sender = this.safetySender;
        this.safetyPanel?.remove(); this.safetyPanel = null; this.safetySender = null;
        sender?.setAttribute('aria-expanded', 'false');
        if (restoreFocus && sender?.isConnected) sender.focus();
    }

    incrementUnread(stream) {
        this.unread[stream] = Math.min(999, (this.unread[stream] || 0) + 1);
        this.renderUnread(stream);
    }

    clearUnread(stream) {
        this.unread[stream] = 0;
        this.renderUnread(stream);
    }

    renderUnread(stream) {
        const tab = this.tabs.find((candidate) => candidate.dataset.chatTab === stream);
        if (!tab) return;
        const badge = tab.querySelector('[data-chat-unread]');
        const count = this.unread[stream] || 0;
        tab.classList.toggle('chat-tab--unread', count > 0);
        if (badge) {
            badge.hidden = count === 0;
            badge.textContent = count > 99 ? '99+' : String(count);
        }
    }

    show() {
        if (this.chatBox) this.chatBox.style.display = 'flex';
    }

    setMobileExpanded(expanded) {
        this.mobileExpanded = Boolean(expanded);
        this.onMobileExpanded?.(this.mobileExpanded);
        this.chatBox?.classList.toggle('chat-mobile-expanded', this.mobileExpanded);
        if (this.mobileExpanded) {
            this.mobileUnread = 0;
            if (this.messages) this.messages.scrollTop = this.messages.scrollHeight;
        }
        this.renderMobileToggle();
        this.show();
    }

    renderMobileToggle() {
        if (!this.mobileToggle) return;
        this.mobileToggle.setAttribute('aria-expanded', String(this.mobileExpanded));
        this.mobileToggle.setAttribute('aria-label', this.mobileExpanded ? 'Collapse chat history' : 'Open chat history');
        this.mobileToggle.setAttribute('aria-description', this.mobileUnread ? `${this.mobileUnread} new messages or game events` : '');
        this.mobileToggle.textContent = this.mobileExpanded ? 'Chat · Collapse' : `Chat${this.mobileUnread ? ` · ${this.mobileUnread} new` : ' · Open history'}`;
    }

    focusChatInput() {
        this.show(true);
        if (document.body.classList.contains('mobile-mode')) this.setMobileExpanded(true);
        this.setActiveStream(this.activeStream === 'game' ? 'chat' : this.activeStream);
        this.input?.focus();
    }

    beginWhisper(username, displayName = username) {
        // A username is one command token, never arbitrary command text.
        if (typeof username !== 'string' || !username || /[\s/]/.test(username)) return false;
        this.whisperTarget = username;
        this.whisperLabel = displayName;
        this.setActiveStream('whisper');
        this.focusChatInput();
        return true;
    }

    restoreSize() {
        if (!this.chatBox) return;
        try {
            const stored = JSON.parse(localStorage.getItem(CHAT_SIZE_STORAGE_KEY) || 'null');
            if (!stored) return;
            const maxWidth = Math.max(280, window.innerWidth - 24);
            const maxHeight = Math.max(180, window.innerHeight - 120);
            const width = Math.min(maxWidth, Math.max(280, Number(stored.width) || 0));
            const height = Math.min(maxHeight, Math.max(180, Number(stored.height) || 0));
            if (width) this.chatBox.style.width = `${Math.round(width)}px`;
            if (height) this.chatBox.style.height = `${Math.round(height)}px`;
        } catch {
            // Storage can be unavailable in privacy-restricted contexts.
        }
    }

    observeSize() {
        if (!this.chatBox || typeof ResizeObserver === 'undefined') return;
        this.sizeObserver = new ResizeObserver(() => {
            const rect = this.chatBox.getBoundingClientRect();
            if (!rect || rect.width < 1 || rect.height < 1) return;
            document.documentElement.style.setProperty('--chat-panel-height', `${Math.round(rect.height)}px`);
            // A compact phone strip must not overwrite the user's desktop size.
            if (document.body.classList.contains('mobile-mode')) return;
            try {
                localStorage.setItem(CHAT_SIZE_STORAGE_KEY, JSON.stringify({
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                }));
            } catch {
                // Storage can be disabled without affecting the resize control.
            }
        });
        this.sizeObserver.observe(this.chatBox);
    }
}
