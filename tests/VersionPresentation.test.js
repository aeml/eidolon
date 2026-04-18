import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('advances the login screen to alpha 0.22.20 for the latest shipped 0.22 closeout-support slice', () => {
        expect(indexHtml).toContain('Alpha 0.22.20');
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
        expect(indexHtml).toContain('vendor obvious junk');
        expect(indexHtml).toContain('keep Shards, Hearts, Gems');
        expect(indexHtml).toContain('level 30 to unlock all base dungeons');
        expect(indexHtml).toContain('level 100 for Heroic and Mythic runs');
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

    test('includes the latest player-facing patch notes entry for 0.22.20', () => {
        expect(indexHtml).toContain('Patch 0.22.20');
        expect(indexHtml).toContain('When a player is back in town after unlocking base dungeons, the objective panel now points them toward the Dungeon Guide');
        expect(indexHtml).toContain('Level-100 town guidance now points players toward Heroic and Mythic runs');
        expect(indexHtml).toContain('Added a written `0.22` first-hour closeout doc');
        expect(indexHtml).toContain('Added regression coverage for post-level-30 and post-level-100 town guidance plus 0.22.20 version presentation');
    });

    test('preserves a cumulative version-by-version patch notes history', () => {
        expect(indexHtml).toContain('PATCH NOTES');
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
