import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('advances the login screen to alpha 0.22.13 for the latest shipped dungeon-readability slice', () => {
        expect(indexHtml).toContain('Alpha 0.22.13');
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
        expect(indexHtml).toContain('sell junk to Vendor / Repair');
        expect(indexHtml).toContain('save valuable drops for the Trading House');
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
        expect(indexHtml).toContain('Spend Hearts to permanently boost an equipped item');
        expect(indexHtml).toContain('add gem slots to equipped gear');
        expect(indexHtml).toContain('Insert gems for bonuses, combine extras into stronger gems, or remove them');
        expect(indexHtml).toContain('Buy from other players, list your own gear, and use auctions when an item is worth selling to the market');
    });

    test('includes the latest player-facing patch notes entry for 0.22.13', () => {
        expect(indexHtml).toContain('Patch 0.22.13');
        expect(indexHtml).toContain('Cleared dungeons now shift the objective panel into extraction language instead of a generic completed turn-in state');
        expect(indexHtml).toContain('Exit objectives now tell you to backtrack out with the loot after the boss is down');
        expect(indexHtml).toContain('Cleared dungeon guidance no longer falls back to Turn this in for 0 XP in the journal panel');
        expect(indexHtml).toContain('Added regression coverage for cleared-dungeon extraction guidance and 0.22.13 version presentation');
    });

    test('preserves a cumulative version-by-version patch notes history', () => {
        expect(indexHtml).toContain('PATCH NOTES');
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
