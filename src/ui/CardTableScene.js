const node = (tag, text = '', className = '') => {
    const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
};

// One persistent table, not a different lobby/hand screen. Seat identities come
// from physical presence; only server-provided cards enter the hand containers.
export class CardTableScene {
    constructor(kind) {
        this.root = node('div', '', `card-table-scene ${kind}-scene`);
        this.root.setAttribute('aria-label', `${{ poker: 'Poker', blackjack: 'Blackjack', roulette: 'Roulette', baccarat: 'Baccarat' }[kind] || 'Casino'} table and seats`);
        this.dealer = node('section', '', 'card-table-dealer');
        this.dealer.append(node('span', '✦', 'card-table-dealer-portrait'), node('strong', 'House dealer'));
        this.dealerCards = node('div', '', 'card-table-dealer-cards'); this.dealer.append(this.dealerCards);
        this.center = node('div', '', 'card-table-center');
        this.clock = node('div', '', 'card-table-clock'); this.clock.setAttribute('role', 'timer');
        this.clockLabel = node('span'); this.clockValue = node('strong'); this.clock.append(this.clockLabel, this.clockValue);
        this.root.append(this.dealer, this.center, this.clock);
        this.seats = Array.from({ length: 6 }, (_, seat) => {
            const root = node('section', '', 'card-table-seat'); root.dataset.seat = String(seat);
            const avatar = node('span', '◇', 'card-table-avatar');
            const name = node('strong', '', 'card-table-seat-name');
            const status = node('small', '', 'card-table-seat-status');
            const hands = node('div', '', 'card-table-seat-hands');
            root.append(avatar, name, status, hands); this.root.append(root);
            return { root, avatar, name, status, hands };
        });
    }

    update(view, playerID, presence = {}) {
        this.view = view;
        this.turnName = presence.occupants?.find(p => p.playerId === view.round?.turnPlayerId)?.name ||
            view.players?.find(p => p.playerId === view.round?.turnPlayerId)?.name || 'Player';
        const ownSeat = presence.yourSeat?.seat ?? view.players?.find(p => p.playerId === playerID)?.seat ?? 0;
        // Presence is authoritative when supplied. A departed player's dealt hand
        // may still settle at that spot, but must not hide a newly seated player.
        for (let seat = 0; seat < 6; seat++) {
            const slot = this.seats[seat];
            const funded = view.players?.find(p => p.seat === seat);
            const occupant = presence.occupants?.find(p => p.seat === seat) ??
                (presence.occupants ? null : funded || (seat === ownSeat ? { playerId: playerID, name: 'You' } : null));
            slot.root.dataset.position = String((seat - ownSeat + 6) % 6);
            slot.root.classList.toggle('own', occupant?.playerId === playerID);
            slot.root.classList.toggle('empty', !occupant);
            slot.root.classList.toggle('current', view.phase === 'playing' && view.round?.turnPlayerId === occupant?.playerId && Boolean(occupant));
            slot.name.textContent = occupant ? `${occupant.name || 'Player'}${occupant.playerId === playerID && occupant.name !== 'You' ? ' · You' : ''}` : `Seat ${seat + 1}`;
            slot.name.title = slot.name.textContent;
            slot.avatar.textContent = occupant ? (occupant.name || 'You').slice(0, 1).toUpperCase() : '◇';
            slot.status.textContent = !occupant ? 'Open seat' : occupant.connected === false ? 'Reconnecting' :
                funded?.playerId === occupant.playerId ? view.phase === 'betting' ? `${funded.bet ?? funded.buyIn ?? funded.wagers?.reduce((sum, w) => sum + w.amount, 0)} ${view.currency === 'ep' ? 'EP' : 'Gold'} confirmed` : 'In this hand' :
                    view.phase === 'betting' ? 'Choosing wager' : 'Waiting for next hand';
            const handPlayer = view.round?.players?.find(p => p.playerId === occupant?.playerId);
            if (handPlayer?.stack !== undefined && occupant?.connected !== false) slot.status.textContent = handPlayer.folded ? 'Folded' :
                view.phase === 'complete' ? 'Hand complete' : handPlayer.stack === 0 ? 'All-in' : `${handPlayer.stack} ${view.currency === 'ep' ? 'EP' : 'Gold'} stack`;
            if (view.round?.buttonSeat === seat && funded) slot.status.textContent += ' · D';
        }
        this.syncClock(view, playerID);
    }

    syncClock(view, playerID) {
        const deadline = view.phase === 'playing' ? view.round?.deadline : view.phase === 'revealing' ? view.revealAt : view.phase === 'complete' ? view.nextRoundAt : view.dealAt;
        const stamp = Date.parse(deadline), serverNow = Date.parse(view.serverNow);
        const key = `${view.roundId}:${view.phase}:${view.round?.revision}:${deadline}`;
        // Polls must not reset the local countdown. New server deadlines establish
        // a monotonic anchor, compensating for a player's incorrect system clock.
        if (key !== this.clockKey) {
            this.clockKey = key;
            this.expires = performance.now() + stamp - (Number.isFinite(serverNow) ? serverNow : Date.now());
        }
        this.clockLabel.textContent = !view.available ? 'Table unavailable' : view.processing || view.phase === 'settling' ? 'Saving payouts' :
            view.phase === 'complete' ? 'Next betting window' : view.phase === 'betting' ? 'Betting closes' : view.phase === 'revealing' ? view.game === 'roulette' ? 'Wheel spinning' : 'Dealing cards' :
                view.round?.turnPlayerId === playerID ? 'Your turn' : `${this.turnName}’s turn`;
        this.timed = view.available && !view.processing && ['betting', 'playing', 'revealing', 'complete'].includes(view.phase) && Number.isFinite(stamp) && stamp > 0;
        this.tick();
        if (!this.interval) this.interval = setInterval(() => this.tick(), 100);
    }

    tick() {
        const remaining = this.timed ? Math.max(0, Math.ceil((this.expires - performance.now()) / 1000)) : null;
        this.clockValue.textContent = remaining === null ? '—' : `${remaining}s`;
        this.clock.classList.toggle('urgent', remaining !== null && remaining <= 5);
        this.clock.style.setProperty('--time-left', `${remaining === null ? 0 : Math.min(1, remaining / 30)}`);
        // Reaching zero never invents a deal or a timeout locally.
        const wasExpired = this.expired;
        this.expired = remaining === 0;
        if (this.expired && !wasExpired) this.onExpire?.();
    }

    clear() { clearInterval(this.interval); this.interval = null; this.clockKey = null; this.expired = false; }
}
