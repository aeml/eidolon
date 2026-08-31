const CHAT_SIZE_STORAGE_KEY = 'eidolon.chatSize';
const CHAT_STREAMS = new Set(['chat', 'game']);

/**
 * Owns the two-stream chat log. Communication stays in the Chat stream while
 * character-specific rewards and progression stay in the Game stream.
 */
export class ChatUI {
    constructor({ onSend = null } = {}) {
        this.onSend = onSend;
        this.chatBox = document.getElementById('chat-box');
        this.messages = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.composer = document.getElementById('chat-composer') || this.input;
        this.tabs = Array.from(document.querySelectorAll('[data-chat-tab]'));
        this.activeStream = 'chat';
        this.unread = { chat: 0, game: 0 };
        this.maxMessages = 250;
        this.dismissed = false;

        this.bindEvents();
        this.restoreSize();
        this.setActiveStream('chat');
        this.observeSize();
    }

    bindEvents() {
        this.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                this.setActiveStream(tab.dataset.chatTab, { focusInput: tab.dataset.chatTab === 'chat' });
            });
        });

        this.input?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            // Prevent this Enter from reaching the global open-chat listener
            // after the input loses focus.
            event.preventDefault();
            event.stopPropagation();
            const message = this.input.value.trim();
            if (message) {
                this.onSend?.(message);
                this.input.value = '';
            }
            this.input.blur();
        });
    }

    normalizeStream(stream) {
        return CHAT_STREAMS.has(stream) ? stream : 'chat';
    }

    setActiveStream(stream, { focusInput = false } = {}) {
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
                entry.hidden = entry.dataset.chatStream !== nextStream;
            });
            this.messages.scrollTop = this.messages.scrollHeight;
        }

        if (this.composer) {
            this.composer.hidden = nextStream !== 'chat';
        }

        this.clearUnread(nextStream);
        if (focusInput && nextStream === 'chat') {
            this.input?.focus();
        }
    }

    addMessage(sender, message, { stream = 'chat', channel = '' } = {}) {
        if (!this.chatBox || !this.messages || message === undefined || message === null) return;

        const normalizedStream = this.normalizeStream(stream);
        const entry = document.createElement('div');
        entry.className = `chat-message chat-message--${normalizedStream}`;
        entry.dataset.chatStream = normalizedStream;
        entry.dataset.chatChannel = String(channel || '');
        entry.hidden = normalizedStream !== this.activeStream;

        if (channel) {
            const channelEl = document.createElement('span');
            channelEl.className = 'chat-message__channel';
            channelEl.textContent = `[${this.formatChannel(channel)}]`;
            entry.appendChild(channelEl);
        }

        const senderEl = document.createElement('strong');
        senderEl.className = 'chat-message__sender';
        senderEl.textContent = `${sender || (normalizedStream === 'game' ? 'Game' : 'System')}:`;

        const messageEl = document.createElement('span');
        messageEl.className = 'chat-message__text';
        messageEl.textContent = ` ${message}`;

        entry.appendChild(senderEl);
        entry.appendChild(messageEl);
        this.messages.appendChild(entry);
        this.trimMessages();
        // Communication may reveal chat until the player explicitly dismisses
        // it. Game-feed events are frequent and should remain unread without
        // opening a panel over gameplay or another window.
        if (normalizedStream === 'chat' && !this.dismissed) {
            this.chatBox.style.display = 'flex';
        }

        if (normalizedStream === this.activeStream) {
            this.messages.scrollTop = this.messages.scrollHeight;
        } else {
            this.incrementUnread(normalizedStream);
        }
    }

    formatChannel(channel) {
        const normalized = String(channel || '').trim().toLowerCase();
        if (!normalized) return '';
        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    trimMessages() {
        while (this.messages && this.messages.children.length > this.maxMessages) {
            this.messages.firstElementChild?.remove();
        }
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

    show(show = true) {
        this.dismissed = !show;
        if (this.chatBox) {
            this.chatBox.style.display = show ? 'flex' : 'none';
        }
    }

    focusChatInput() {
        this.show(true);
        this.setActiveStream('chat');
        this.input?.focus();
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
