import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('advances the login screen to alpha 0.26.0 for the latest shipped movement-authority slice', () => {
        expect(indexHtml).toContain('Alpha 0.26.0');
    });

    test('includes first-session onboarding guidance on the start screen', () => {
        expect(indexHtml).toContain('id="start-flow-title"');
        expect(indexHtml).toContain('id="start-flow-copy"');
        expect(indexHtml).toContain('id="start-flow-steps"');
        expect(indexHtml).toContain('id="class-fighter-description"');
        expect(indexHtml).toContain('id="class-rogue-description"');
        expect(indexHtml).toContain('id="class-wizard-description"');
        expect(indexHtml).toContain('id="class-cleric-description"');
        expect(indexHtml).toContain('Vendor / Repair');
        expect(indexHtml).toContain('Trading House');
        expect(indexHtml).toContain('Fighter for frontline control');
        expect(indexHtml).toContain('Rogue for burst and tricks');
        expect(indexHtml).toContain('Wizard for ranged spell pressure');
        expect(indexHtml).toContain('Cleric for healing and support');
        expect(indexHtml).toContain('Skill Tree (K)');
        expect(indexHtml).toContain('level 30 to unlock all base dungeons');
        expect(indexHtml).toContain('level 100 for Heroic and Mythic runs');
    });

    test('surfaces class and branch identity copy in the skill tree', () => {
        expect(indexHtml).toContain('Skill Tree');
    });

    test('includes a first-hour milestone quick-reference in the help screen', () => {
        expect(indexHtml).toContain('id="help-first-hour-guide"');
        expect(indexHtml).toContain('First Hour Milestones');
        expect(indexHtml).toContain('Level 30');
        expect(indexHtml).toContain('Dungeon Guide');
        expect(indexHtml).toContain('Level 100');
        expect(indexHtml).toContain('Heroic');
        expect(indexHtml).toContain('World Map (M)');
        expect(indexHtml).toContain('Journal (J)');
    });

    test('includes a daily return loop quick-reference in the help screen', () => {
        expect(indexHtml).toContain('id="help-daily-return-guide"');
        expect(indexHtml).toContain('Daily Return Loop');
        expect(indexHtml).toContain('Repeatable Ladder');
        expect(indexHtml).toContain('ET reset clock');
        expect(indexHtml).toContain('+10% rewards per nearby member');
        expect(indexHtml).toContain('Trading House');
        expect(indexHtml).toContain('After reset, reopen the Journal');
    });

    test('includes plain-language starter service guidance on merchant stash forge and trading house windows', () => {
        expect(indexHtml).toContain('id="shop-service-guidance"');
        expect(indexHtml).toContain('id="shop-buyback-guidance"');
        expect(indexHtml).toContain('id="stash-guidance"');
        expect(indexHtml).toContain('id="forge-upgrade-guidance"');
        expect(indexHtml).toContain('id="forge-potency-guidance"');
        expect(indexHtml).toContain('id="forge-socket-guidance"');
        expect(indexHtml).toContain('id="forge-gems-guidance"');
        expect(indexHtml).toContain('id="trading-house-guidance"');
        expect(indexHtml).toContain('Buyback lets you recover something you just sold');
        expect(indexHtml).toContain('park spare gear, gems, Hearts, and Shards');
        expect(indexHtml).toContain('Spend Shards to raise item level');
        expect(indexHtml).toContain('Spend Hearts to permanently boost an equipped item when it already feels worth keeping');
        expect(indexHtml).toContain('add gem slots to equipped gear');
        expect(indexHtml).toContain('Gems are build materials, not normal vendor trash');
        expect(indexHtml).toContain('Buy from other players, list your own gear, and use auctions when an item is worth selling to the market instead of being simple vendor cleanup');
        expect(indexHtml).toContain('id="inventory-guidance"');
        expect(indexHtml).toContain('Common gear is usually vendor junk unless it is an upgrade');
    });

    test('includes the latest player-facing patch notes entry for 0.26.0', () => {
        expect(indexHtml).toContain('Patch 0.26.0');
        expect(indexHtml).toContain('Large self movement corrections still apply the server position immediately for gameplay truth');
        expect(indexHtml).toContain('the local player mesh and locked camera now ease into the corrected position over a short visual window instead of popping there in one frame');
        expect(indexHtml).toContain('Authoritative jump visuals still override the new correction smoothing so airborne travel does not get a second conflicting interpolation pass');
        expect(indexHtml).toContain('Added regression coverage for self-correction visual smoothing, correction expiry, jump-priority handling, and 0.26.0 version presentation');
    });

    test('keeps the prior 0.25.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.25.4');
        expect(indexHtml).toContain('Help now includes a Daily Return Loop reference that ties together the Journal ladder, ET reset clock, nearby party reward bonus, and Trading House circulation path');
        expect(indexHtml).toContain('The guide only points at systems that already exist in the game, so the 0.25 closeout explains the real sticky loop instead of promising fake weekly sludge');
        expect(indexHtml).toContain('Added a dedicated 0.25 retention QA checklist covering Journal reset timing, party bonus visibility, dungeon rerun ladder, and Trading House flow');
        expect(indexHtml).toContain('Added regression coverage for the Daily Return Loop help reference and 0.25.4 version presentation');
    });

    test('keeps the prior 0.25.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.25.3');
        expect(indexHtml).toContain('Quest Journal reset messaging now runs off authoritative server time instead of a static daily-reset sentence');
        expect(indexHtml).toContain('Repeatable ladder copy now shows exactly how long remains before the next reset, giving live-ops and tuning work a truthful clock to point at');
        expect(indexHtml).toContain('The HUD clock now reads from the same server-time feed, so daily reset messaging and the visible clock stop drifting apart');
        expect(indexHtml).toContain('Added regression coverage for authoritative reset countdown rendering, journal refresh on server-time ticks, and 0.25.3 version presentation');
    });

    test('keeps the prior 0.25.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.25.2');
        expect(indexHtml).toContain('Quest Journal now surfaces a repeatable ladder summary for the highest-value daily quests instead of hiding the best return loop behind accepted-only entries');
        expect(indexHtml).toContain('The journal now shows which top dailies are Active, Ready, or still Available, along with a quick accepted-versus-ready count');
        expect(indexHtml).toContain('This gives max-level players a visible come-back-tomorrow XP ladder without adding fake mobile-style sludge systems');
        expect(indexHtml).toContain('Added regression coverage for repeatable ladder journal rendering, high-value daily visibility, and 0.25.2 version presentation');
    });

    test('keeps the prior 0.25.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.25.1');
        expect(indexHtml).toContain('Trading House browse rows now surface bid state and time remaining so search results stop reading like bare item ledgers');
        expect(indexHtml).toContain('Listing flow now explains starting bid, buyout, and the sold-auction payout path before you post');
        expect(indexHtml).toContain('My Auctions now makes it clearer whether you are collecting gold or reclaiming an unsold item');
        expect(indexHtml).toContain('Added regression coverage for trading-house tab guidance, auction timing hints, collection outcome messaging, and 0.25.1 version presentation');
    });

    test('keeps the prior 0.25.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.26.0');
        expect(indexHtml).toContain('Patch 0.25.4');
        expect(indexHtml).toContain('Patch 0.25.3');
        expect(indexHtml).toContain('Patch 0.25.2');
        expect(indexHtml).toContain('Patch 0.25.1');
        expect(indexHtml).toContain('Patch 0.25.0');
        expect(indexHtml).toContain('The party panel now explains why grouping matters by calling out shared nearby kill rewards, dungeon boss credit, and the live party reward bonus');
        expect(indexHtml).toContain('Party members now show clearer role tags like Leader, You, and Member instead of reading like anonymous HP bars');
        expect(indexHtml).toContain('Party invite prompts now explain the cooperative upside before you accept');
        expect(indexHtml).toContain('Added regression coverage for party benefit guidance, role visibility in the party panel, invite benefit messaging, and 0.25.0 version presentation');
    });

    test('keeps the prior 0.24.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.24.4');
        expect(indexHtml).toContain('The Dungeon Guide now spells out whether the party is starting a fresh run, continuing a live run, or sitting on an empty instance that is about to collapse');
        expect(indexHtml).toContain('Leader-only reset ownership is now explicit in the menu, while non-leaders are told they can only continue the current party instance');
        expect(indexHtml).toContain('Enter and reset buttons now read like party actions instead of generic solo-instance verbs');
        expect(indexHtml).toContain('Added regression coverage for party instance state messaging, continue-versus-start labeling, leader-only reset controls, and 0.24.4 version presentation');
    });

    test('keeps the prior 0.24.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.24.3');
        expect(indexHtml).toContain('The Dungeon Guide now surfaces a live repeat-run ladder tied to your accepted daily dungeon boss quests');
        expect(indexHtml).toContain('The ladder updates by selected dungeon and difficulty so players can see which reruns are still paying the strongest daily XP');
        expect(indexHtml).toContain('This gives max-level dungeon play a visible reward ladder before the later party-flow hardening pass');
        expect(indexHtml).toContain('Added regression coverage for dungeon menu repeat-run ladder rendering, selected dungeon/difficulty daily quest visibility, and 0.24.3 version presentation');
    });

    test('keeps the prior 0.24.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.24.2');
        expect(indexHtml).toContain('Heroic bosses now guarantee a bonus gem drop, while Mythic bosses guarantee both a bonus gem and a unique-effect item');
        expect(indexHtml).toContain('The dungeon menu now explains each difficulty as a distinct endgame lane instead of only listing stat multipliers');
        expect(indexHtml).toContain('Boss reward summaries now surface the exact Heroic or Mythic bonus rule that paid out on the kill');
        expect(indexHtml).toContain('Added regression coverage for endgame difficulty reward notes, guaranteed Mythic unique-effect gear, dungeon menu identity copy, and 0.24.2 version presentation');
    });

    test('keeps the prior 0.24.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.24.1');
        expect(indexHtml).toContain('Longer multi-boss dungeons can now stage a second chest pocket and a second elite ambush deeper in the run');
        expect(indexHtml).toContain('The shrine beat still anchors the deep pre-boss reset');
        expect(indexHtml).toContain('This is the first real encounter-cadence pass on top of the new room-role metadata');
        expect(indexHtml).toContain('Added server and client regression coverage for expanded long-run hook distribution, repeated reward/ambush beats, and preserved late-shrine recovery pacing');
    });

    test('keeps the prior 0.24.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.24.0');
        expect(indexHtml).toContain('Dungeon room state now tags rooms with shared roles like travel, reward, recovery, elite, event, and boss');
        expect(indexHtml).toContain('journal, hovered dungeon portals, minimap markers, and world-map active dungeon marker now surface cadence reads like Payoff, Reset, Spike, Pressure, and Climax');
        expect(indexHtml).toContain('This starts the dungeon-depth line by making room-role metadata explicit and reusable');
        expect(indexHtml).toContain('Added regression coverage for normalized dungeon room metadata, cadence-aware route guidance, entrance hints, minimap overlays, and world-map beat previews');
    });

    test('keeps the prior 0.23.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.23.4');
        expect(indexHtml).toContain('Boss-kill and room-clear reward callouts now lead with a payoff read instead of only a ledger');
        expect(indexHtml).toContain('Reward chat now surfaces short punchier lines like boss down, build drops secured, and elite-room payoff');
        expect(indexHtml).toContain('This closes the `0.23` line with class identity, loot readability, buildcraft coherence, and stronger reward presentation');
        expect(indexHtml).toContain('Added regression coverage for stronger reward/chat payoff messaging, updated room-clear summaries, and 0.23.4 version presentation');
    });

    test('keeps the prior 0.23.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.23.3');
        expect(indexHtml).toContain('The Forge now spells out the buildcraft sequence up front');
        expect(indexHtml).toContain('Upgrade previews now show current Shard availability and disable actions you cannot afford yet');
        expect(indexHtml).toContain('The Talent Master now explains when to reset talents, when to reset skills, and when a full rebuild makes sense');
        expect(indexHtml).toContain('Added regression coverage for forge upgrade material visibility, forge-to-respec handoff, richer respec explanations, and 0.23.3 version presentation');
    });

    test('keeps the prior 0.23.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.23.2');
        expect(indexHtml).toContain('Starter equippable tooltips now call out open-slot items, likely upgrades, likely weaker drops, and mixed-signal sidegrades');
        expect(indexHtml).toContain('Desktop item tooltips now explicitly tell you when to hold Shift and which equipped item you are comparing against');
        expect(indexHtml).toContain('This keeps the early `0.23` buildcraft pass centered on loot and item-decision readability');
        expect(indexHtml).toContain('Added regression coverage for starter equip-read tooltip guidance, compare-target hints, and 0.23.2 version presentation');
    });

    test('keeps the prior 0.23.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.23.1');
        expect(indexHtml).toContain('Skill Tree branches now show role tags plus quick "Wants" and "Excels at" summaries');
        expect(indexHtml).toContain('Tank Core vs Bruiser, Burst Assassin vs Throw Specialist, AoE Caster vs Boss Caster');
        expect(indexHtml).toContain('This keeps the early `0.23` effort focused on class/spec fantasy and branch differentiation');
        expect(indexHtml).toContain('Added regression coverage for branch-role identity cards and 0.23.1 version presentation');
    });

    test('keeps the prior 0.23.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.23.0');
        expect(indexHtml).toContain('Character creation and first-login messaging now push players toward picking a combat fantasy');
        expect(indexHtml).toContain('Skill Tree now leads with a class identity summary and branch-role summaries');
        expect(indexHtml).toContain('this is the first `0.23` slice focused on class/spec fantasy presentation');
        expect(indexHtml).toContain('Added regression coverage for skill-tree identity copy, updated first-login guidance, and 0.23.0 version presentation');
    });

    test('preserves a cumulative version-by-version patch notes history', () => {
        expect(indexHtml).toContain('PATCH NOTES');
        expect(indexHtml).toContain('Patch 0.26.0');
        expect(indexHtml).toContain('Patch 0.25.4');
        expect(indexHtml).toContain('Patch 0.25.3');
        expect(indexHtml).toContain('Patch 0.25.1');
        expect(indexHtml).toContain('Patch 0.25.0');
        expect(indexHtml).toContain('Patch 0.24.4');
        expect(indexHtml).toContain('Patch 0.24.3');
        expect(indexHtml).toContain('Patch 0.24.2');
        expect(indexHtml).toContain('Patch 0.24.1');
        expect(indexHtml).toContain('Patch 0.24.0');
        expect(indexHtml).toContain('Patch 0.23.4');
        expect(indexHtml).toContain('Patch 0.23.3');
        expect(indexHtml).toContain('Patch 0.23.2');
        expect(indexHtml).toContain('Patch 0.23.1');
        expect(indexHtml).toContain('Patch 0.23.0');
        expect(indexHtml).toContain('Patch 0.22.21');
        expect(indexHtml).toContain('Patch 0.22.20');
        expect(indexHtml).toContain('Patch 0.22.19');
        expect(indexHtml).toContain('Patch 0.22.18');
        expect(indexHtml).toContain('Patch 0.22.17');
        expect(indexHtml).toContain('Patch 0.22.16');
        expect(indexHtml).toContain('Patch 0.22.15');
        expect(indexHtml).toContain('Patch 0.22.14');
        expect(indexHtml).toContain('Patch 0.22.13');
        expect(indexHtml).toContain('Patch 0.22.12');
        expect(indexHtml).toContain('Patch 0.22.11');
        expect(indexHtml).toContain('Patch 0.22.10');
        expect(indexHtml).toContain('Patch 0.22.9');
        expect(indexHtml).toContain('Patch 0.22.8');
        expect(indexHtml).toContain('Patch 0.22.7');
        expect(indexHtml).toContain('Patch 0.22.6');
        expect(indexHtml).toContain('Patch 0.22.5');
        expect(indexHtml).toContain('Patch 0.22.4');
        expect(indexHtml).toContain('Patch 0.22.3');
        expect(indexHtml).toContain('Patch 0.22.2');
        expect(indexHtml).toContain('Patch 0.22.1');
        expect(indexHtml).toContain('Patch 0.22.0');
        expect(indexHtml).toContain('Patch 0.21.5');
        expect(indexHtml).toContain('Patch 0.21.4');
        expect(indexHtml).toContain('Patch 0.21.3');
        expect(indexHtml).toContain('Patch 0.19');
        expect(indexHtml).toContain('Patch 0.18');
        expect(indexHtml).toContain('Patch 0.17');
        expect(indexHtml).toContain('Patch 0.01');
    });

    test('keeps a dedicated patch notes history container with release entries', () => {
        expect(indexHtml).toContain('id="patch-notes-history"');
        expect(indexHtml).toContain('class="patch-note-entry"');
        expect(indexHtml).toContain('data-version="0.26.0"');
        expect(indexHtml).toContain('data-version="0.25.4"');
        expect(indexHtml).toContain('data-version="0.25.3"');
        expect(indexHtml).toContain('data-version="0.25.2"');
        expect(indexHtml).toContain('data-version="0.25.1"');
        expect(indexHtml).toContain('data-version="0.25.0"');
        expect(indexHtml).toContain('data-version="0.24.4"');
        expect(indexHtml).toContain('data-version="0.24.3"');
        expect(indexHtml).toContain('data-version="0.24.2"');
        expect(indexHtml).toContain('data-version="0.24.1"');
        expect(indexHtml).toContain('data-version="0.24.0"');
        expect(indexHtml).toContain('data-version="0.23.4"');
        expect(indexHtml).toContain('data-version="0.23.3"');
        expect(indexHtml).toContain('data-version="0.23.2"');
        expect(indexHtml).toContain('data-version="0.23.1"');
        expect(indexHtml).toContain('data-version="0.23.0"');
        expect(indexHtml).toContain('data-version="0.22.21"');
        expect(indexHtml).toContain('data-version="0.22.20"');
        expect(indexHtml).toContain('data-version="0.22.19"');
        expect(indexHtml).toContain('data-version="0.22.18"');
        expect(indexHtml).toContain('data-version="0.22.17"');
        expect(indexHtml).toContain('data-version="0.22.16"');
        expect(indexHtml).toContain('data-version="0.22.15"');
        expect(indexHtml).toContain('data-version="0.22.14"');
        expect(indexHtml).toContain('data-version="0.22.13"');
        expect(indexHtml).toContain('data-version="0.22.12"');
        expect(indexHtml).toContain('data-version="0.22.11"');
        expect(indexHtml).toContain('data-version="0.22.10"');
        expect(indexHtml).toContain('data-version="0.22.9"');
        expect(indexHtml).toContain('data-version="0.22.8"');
        expect(indexHtml).toContain('data-version="0.22.7"');
        expect(indexHtml).toContain('data-version="0.22.6"');
        expect(indexHtml).toContain('data-version="0.22.5"');
        expect(indexHtml).toContain('data-version="0.22.4"');
        expect(indexHtml).toContain('data-version="0.22.3"');
        expect(indexHtml).toContain('data-version="0.22.2"');
        expect(indexHtml).toContain('data-version="0.22.1"');
        expect(indexHtml).toContain('data-version="0.22.0"');
        expect(indexHtml).toContain('data-version="0.21.5"');
        expect(indexHtml).toContain('data-version="0.21.4"');
        expect(indexHtml).toContain('data-version="0.21.3"');
        expect(indexHtml).toContain('data-version="0.19"');
    });
});
