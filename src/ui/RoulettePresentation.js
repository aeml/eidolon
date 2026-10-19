import { createMotionPreference } from '../core/MotionPreference.js';

export const rouletteOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const rouletteColor = n => n === 0 ? 'green' : reds.has(n) ? 'red' : 'black';
const wrap = n => (n % 360 + 360) % 360;

// Only the server supplies the pocket. Motion never draws a random result or
// affects funding, settlement or the shared round clock.
export function rouletteLanding(wheelAngle, number) {
    return wrap(wheelAngle + rouletteOrder.indexOf(number) * 360 / 37);
}

export class RoulettePresentation {
    constructor(parent) {
        this.motion = createMotionPreference();
        this.root = document.createElement('div'); this.root.className = 'roulette-theatre';
        this.bowl = document.createElement('div'); this.bowl.className = 'roulette-bowl';
        this.wheel = document.createElement('div'); this.wheel.className = 'roulette-wheel';
        this.wheel.setAttribute('aria-hidden', 'true');
        // Rotating half a sector aligns each pocket's centre with its label.
        this.wheel.style.background = `conic-gradient(from ${-180 / 37}deg, ${rouletteOrder.map((n, i) => `${n === 0 ? '#237d62' : reds.has(n) ? '#a83850' : '#182735'} ${i * 360 / 37}deg ${(i + 1) * 360 / 37}deg`).join(',')})`;
        this.pockets = rouletteOrder.map((number, i) => {
            const pocket = document.createElement('span'); pocket.className = `roulette-pocket ${rouletteColor(number)}`;
            pocket.textContent = String(number); pocket.style.setProperty('--angle', `${i * 360 / 37}deg`);
            this.wheel.append(pocket); return pocket;
        });
        const hub = document.createElement('div'); hub.className = 'roulette-hub'; hub.textContent = '✦';
        this.ball = document.createElement('div'); this.ball.className = 'roulette-ball-track';
        this.ball.setAttribute('aria-hidden', 'true'); this.ball.append(document.createElement('i'));
        this.bowl.append(this.wheel, hub, this.ball);
        this.label = document.createElement('strong'); this.label.className = 'roulette-outcome'; this.label.setAttribute('role', 'status');
        this.skip = document.createElement('button'); this.skip.type = 'button'; this.skip.textContent = 'Skip animation';
        this.skip.className = 'casino-skip-animation'; this.skip.hidden = true;
        this.skip.onclick = () => { this.skipped = true; this.finish(); };
        this.root.append(this.bowl, this.label, this.skip); parent.append(this.root);
    }

    update(view, scope) {
        if (scope !== this.scope) { this.clear(); this.scope = scope; }
        const spinning = view.phase === 'revealing';
        const number = Number.isInteger(view.number) && view.number >= 0 && view.number <= 36 ? view.number : null;
        if (spinning && !this.spinning) {
            this.spinning = true;
            const remaining = Date.parse(view.revealAt) - Date.parse(view.serverNow);
            this.started = performance.now() - Math.max(0, Math.min(6000, 6000 - (Number.isFinite(remaining) ? remaining : 6000)));
        }
        if (number !== null && this.number === null) {
            this.number = number;
            if (this.spinning && !this.skipped && !this.motion.matches) {
                this.landing = { at: performance.now(), wheel: this.wheelAngle || 0, ball: this.ballAngle || 0 };
            }
        }
        this.label.textContent = number !== null ? `${number} · ${rouletteColor(number)[0].toUpperCase()}${rouletteColor(number).slice(1)}` : spinning ? 'Ball in play · bets closed' : 'Place your bets';
        this.label.dataset.color = number === null ? '' : rouletteColor(number);
        this.ball.hidden = !spinning && number === null;
        this.pockets.forEach((p, i) => p.classList.toggle('winner', rouletteOrder[i] === number));
        if (this.motion.matches || this.skipped || (!spinning && !this.landing)) this.finish();
        else if (!this.frame) this.animate();
    }

    paint(wheel, ball, radius) {
        this.wheelAngle = wheel; this.ballAngle = ball;
        this.wheel.style.transform = `rotate(${wheel}deg)`;
        this.ball.style.transform = `rotate(${ball}deg)`;
        this.ball.style.setProperty('--ball-radius', String(radius));
    }

    animate() {
        this.frame = null;
        if (this.motion.matches || this.skipped) { this.finish(); return; }
        const now = performance.now();
        if (!this.root.classList.contains('close-up')) this.root.classList.add('close-up');
        if (this.skip.hidden) this.skip.hidden = false;
        if (this.landing) {
            const p = Math.min(1, Math.max(0, (now - this.landing.at) / 1600)), ease = 1 - (1 - p) ** 3;
            const finalWheel = this.landing.wheel - 100;
            const finalBall = this.landing.ball + 360 + wrap(rouletteLanding(finalWheel, this.number) - this.landing.ball);
            const bounce = Math.abs(Math.sin(p * Math.PI * 5)) * (1 - p) * .06;
            this.paint(this.landing.wheel - 100 * ease, this.landing.ball + (finalBall - this.landing.ball) * ease, .46 - .10 * ease + bounce);
            if (p === 1) { this.finish(); return; }
        } else {
            const t = Math.max(0, (now - this.started) / 1000);
            const launch = .13 * Math.max(0, 1 - t / .4) ** 2;
            this.paint(-t * 42, 90 + t * 560 / (1 + t * .09), .46 + launch + Math.sin(t * 18) * .005);
        }
        this.frame = requestAnimationFrame(() => this.animate());
    }

    finish() {
        cancelAnimationFrame(this.frame); this.frame = null; this.landing = null;
        this.root.classList.remove('close-up'); this.skip.hidden = true;
        if (this.number !== null) this.paint(this.wheelAngle || 0, rouletteLanding(this.wheelAngle || 0, this.number), .36);
        this.ball.hidden = this.number === null;
        if (this.number !== null) this.onResultVisible?.();
    }

    clear() {
        cancelAnimationFrame(this.frame); this.frame = null; this.landing = null;
        this.spinning = false; this.number = null; this.skipped = false;
        this.root.classList.remove('close-up'); this.skip.hidden = true; this.ball.hidden = true;
        this.paint(0, 0, .46);
    }

    dispose() { this.onResultVisible = null; this.clear(); this.skip.onclick = null; this.root.remove(); }
}
