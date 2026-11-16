const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const suits = ['♣','♦','♥','♠'];

// One accessible card face throughout the table suite. Corner indices remain
// legible in small hands; the central suit reads clearly in the baccarat deal.
export function casinoCard(value, label) {
    const hidden = !Number.isInteger(value) || value < 0 || value >= 52;
    const suit = Math.floor(value / 13), name = hidden ? 'Hidden card' : `${ranks[value % 13]}${suits[suit]}`;
    const card = document.createElement('span');
    card.setAttribute('role', 'img');
    card.className = `blackjack-card casino-card${hidden ? ' back' : [1, 2].includes(suit) ? ' red' : ''}`;
    card.setAttribute('aria-label', label || name);
    if (hidden) card.textContent = '✦';
    else {
        const index = document.createElement('span'); index.className = 'casino-card-index'; index.textContent = name;
        const pip = document.createElement('span'); pip.className = 'casino-card-pip'; pip.textContent = suits[suit];
        index.setAttribute('aria-hidden', 'true'); pip.setAttribute('aria-hidden', 'true');
        card.append(index, pip);
    }
    return card;
}
