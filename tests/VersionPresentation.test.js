import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('advances the login screen to alpha 0.31.38 for the shared player HUD signature slice', () => {
        expect(indexHtml).toContain('Alpha 0.31.38');
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

    test('includes the latest player-facing patch notes entry for 0.31.38', () => {
        expect(indexHtml).toContain('Patch 0.31.38');
        expect(indexHtml).toContain('The engine and UI layer share the same HP, mana, ability, cooldown, cost, and class HUD signature whenever the UI serializer is available');
        expect(indexHtml).toContain('Displayed stat rounding and ability payload comparisons stay aligned between render throttling and DOM updates');
        expect(indexHtml).toContain('Future HUD display changes can update the UI serializer without repeating render-loop checks');
        expect(indexHtml).toContain('Added GameEngine render throttling coverage for the UIManager player stats serializer path');
    });

    test('keeps the prior 0.31.37 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.37');
        expect(indexHtml).toContain('The engine and UI layer share the same visible character payload signature whenever the UI serializer is available');
        expect(indexHtml).toContain('Stat, resource, point, equipment, rarity, potency, and socket comparisons stay aligned between render throttling and DOM updates');
        expect(indexHtml).toContain('Future character sheet display changes can update the UI serializer without repeating render-loop signature code');
        expect(indexHtml).toContain('Added GameEngine render throttling coverage for the UIManager character sheet serializer path');
    });

    test('keeps the prior 0.31.36 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.36');
        expect(indexHtml).toContain('The engine and UI layer share the same displayed cooldown signature whenever the UI serializer is available');
        expect(indexHtml).toContain('Slot count, empty-slot, skill, and rounded cooldown comparisons stay aligned between render throttling and DOM updates');
        expect(indexHtml).toContain('Future hotbar display changes can update the UI serializer without duplicating render-loop signature logic');
        expect(indexHtml).toContain('Added GameEngine render throttling coverage for the UIManager hotbar cooldown serializer path');
    });

    test('keeps the prior 0.31.35 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.35');
        expect(indexHtml).toContain("Scene swaps clear the UI layer's combat, portal hint, HUD, XP, hotbar, and character sheet diff signatures");
        expect(indexHtml).toContain('The engine render signatures and UIManager display signatures reset together before the new scene presents');
        expect(indexHtml).toContain('Performance guards remain local to each UI surface while transitions can force a clean visible refresh');
        expect(indexHtml).toContain('Added GameEngine transition coverage for UI display cache resets and direct UIManager cache reset coverage');
    });

    test('keeps the prior 0.31.34 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.34');
        expect(indexHtml).toContain('Each open cycle forces one fresh render before repeated visible updates are diffed again');
        expect(indexHtml).toContain('Stats and equipment slots refresh after the panel is closed and opened, even when the player payload is unchanged');
        expect(indexHtml).toContain('Performance guards remain active while open, but panel entry points rebuild their visible contents');
        expect(indexHtml).toContain('Added UIManager coverage that reopening the character sheet refreshes visible stats and equipment slot updates');
    });

    test('keeps the prior 0.31.33 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.33');
        expect(indexHtml).toContain('Reassigning or rebuilding a skill slot forces the next cooldown overlay refresh even when the player cooldown value is unchanged');
        expect(indexHtml).toContain('Newly recreated overlays no longer stay hidden behind a matching cached cooldown signature');
        expect(indexHtml).toContain('The hotbar optimization now accounts for both state changes and local DOM replacement');
        expect(indexHtml).toContain('Added coverage for recreated cooldown overlay DOM after assigning a skill to the same visible hotbar slot');
    });

    test('keeps the prior 0.31.32 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.32');
        expect(indexHtml).toContain('Repeated identical level, resource, stat, point, and equipment payloads skip the full stats and slot rebuild');
        expect(indexHtml).toContain('Direct refresh calls no longer rewrite every equipment slot unless the visible character payload actually changes');
        expect(indexHtml).toContain('Always-visible HUD guards are joined by a guard around the most expensive player detail window');
        expect(indexHtml).toContain('Added UIManager character sheet diffing coverage for identical visible payloads and changed displayed damage values');
    });

    test('keeps the prior 0.31.31 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.31');
        expect(indexHtml).toContain('Repeated identical skill and displayed cooldown payloads skip redundant overlay writes');
        expect(indexHtml).toContain('Stable rounded cooldown values no longer rewrite the hotbar until the visible number or slot assignment changes');
        expect(indexHtml).toContain('Core always-visible UI surfaces share direct UI-layer guardrails');
        expect(indexHtml).toContain('Added UIManager hotbar cooldown diffing coverage for identical displayed cooldowns and changed cooldown values');
    });

    test('keeps the prior 0.31.30 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.30');
        expect(indexHtml).toContain('Repeated identical level, XP, and next-level XP payloads skip redundant progress-bar and level-label DOM writes');
        expect(indexHtml).toContain('The stat HUD guardrail added in 0.31.29 now extends to the always-visible XP bar');
        expect(indexHtml).toContain('Progress updates stay responsive while stable state stays quiet');
        expect(indexHtml).toContain('Added UIManager XP diffing coverage for identical XP payloads and changed displayed XP values');
    });

    test('keeps the prior 0.31.29 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.29');
        expect(indexHtml).toContain('Repeated identical HP, mana, ability, cooldown, and mana-cost payloads skip redundant DOM writes');
        expect(indexHtml).toContain('Direct callers outside the render signature path cannot spam the same HUD update every frame');
        expect(indexHtml).toContain('High-frequency combat state stays responsive without doing unnecessary UI work');
        expect(indexHtml).toContain('Added UIManager HUD diffing coverage for identical stat payloads and changed displayed health values');
    });

    test('keeps the prior 0.31.28 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.28');
        expect(indexHtml).toContain('HUD stats, XP, hotbar cooldowns, enemy bars, character sheet, and world map signatures are cleared');
        expect(indexHtml).toContain('UI diffing no longer carries stale scene signatures into the next area');
        expect(indexHtml).toContain('Runtime scene ownership and render-time UI throttling stay aligned during transitions');
        expect(indexHtml).toContain('Added coverage that entering an instance clears all render update signatures before rebuilding the scene');
    });

    test('keeps the prior 0.31.27 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.27');
        expect(indexHtml).toContain('Clearing a dungeon or town layout disposes geometry and material resources');
        expect(indexHtml).toContain('Static water, ground, and realm particles stay mounted and are not disposed during instance transitions');
        expect(indexHtml).toContain('Returning between dungeons and town now avoids leaving old generated environment resources behind');
        expect(indexHtml).toContain('Added coverage that instance environment meshes are disposed while static environment meshes are preserved');
    });

    test('keeps the prior 0.31.26 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.26');
        expect(indexHtml).toContain('Water, ground, and realm particles live in a static environment group');
        expect(indexHtml).toContain('Instance transitions now clear stale generated environment meshes alongside entities and effects');
        expect(indexHtml).toContain('The same scene-group foundation now covers environment geometry, not only entities and transient effects');
        expect(indexHtml).toContain('Added coverage for static/instance environment groups, per-instance world generation routing, and fallback transition cleanup');
    });

    test('keeps the prior 0.31.25 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.25');
        expect(indexHtml).toContain('Centering, viewport width, tall menu height, z-index, and flex column layout now live on the forge-window class');
        expect(indexHtml).toContain('The Forge keeps its large viewport-safe menu window without carrying layout details in HTML');
        expect(indexHtml).toContain('Stash cleanup now extends into the Forge shell that supports upgrade actions near the bottom of each tab');
        expect(indexHtml).toContain('Updated Forge viewport coverage to assert the shared class and removed the old inline Forge shell styling');
    });

    test('keeps the prior 0.31.24 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.24');
        expect(indexHtml).toContain('Window centering, viewport sizing, z-index, flex layout, and scrolling now live in shared window CSS');
        expect(indexHtml).toContain('The 10-column stash grid, padding, muted guidance color, font size, and centered copy now use named stash classes');
        expect(indexHtml).toContain('Merchant sell-button cleanup now extends into the stash service surface');
        expect(indexHtml).toContain('Added coverage for Stash shell/grid/guidance classes and removed the old inline stash styling');
    });

    test('keeps the prior 0.31.23 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.23');
        expect(indexHtml).toContain('Common, Uncommon, and Rare sell actions now share a base sell-button class plus rarity modifiers');
        expect(indexHtml).toContain('Button sizing, padding, font sizing, backgrounds, text colors, and border colors now live in window CSS');
        expect(indexHtml).toContain('Merchant shop layout cleanup now extends into its low-rarity cleanup controls');
        expect(indexHtml).toContain('Added coverage for Merchant sell-button classes and removed the old inline rarity button styling');
    });

    test('keeps the prior 0.31.22 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.22');
        expect(indexHtml).toContain('Window sizing, centering, z-index, flex layout, and overflow rules now live in shared window CSS');
        expect(indexHtml).toContain('Main shop and buyback panes now share scrollable content styling, guidance copy styling, mystery-box grid layout, and buyback grid sizing');
        expect(indexHtml).toContain('Split Stack cleanup now extends into the Merchant shop flow');
        expect(indexHtml).toContain('Added coverage for Merchant shop shell/content classes and removed the old inline shop layout styling');
    });

    test('keeps the prior 0.31.21 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.21');
        expect(indexHtml).toContain('The modal shell, scrollable content, item label, controls, and action row now share window CSS instead of inline HTML chrome');
        expect(indexHtml).toContain('Range width, number input sizing, field colors, borders, padding, and row spacing now live with the rest of the window styles');
        expect(indexHtml).toContain('Inventory footer cleanup now extends into stack management');
        expect(indexHtml).toContain('Added coverage for Split Stack classes and removed the old inline dialog styling');
    });

    test('keeps the prior 0.31.20 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.20');
        expect(indexHtml).toContain('The sort row, sort button, gold display, and starter guidance now share inventory CSS instead of inline HTML chrome');
        expect(indexHtml).toContain('Footer spacing, button treatment, gold text, guidance color, line height, alignment, and separators now live in window CSS');
        expect(indexHtml).toContain('Skill Tree placeholder cleanup now extends into the inventory management surface');
        expect(indexHtml).toContain('Added coverage for inventory footer classes and removed the old inline inventory footer styling');
    });

    test('keeps the prior 0.31.19 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.19');
        expect(indexHtml).toContain('The fallback message for selecting a class now shares skill-tree CSS instead of inline HTML chrome');
        expect(indexHtml).toContain('Center alignment, muted copy color, and top spacing now live beside the rest of the Skill Tree styles');
        expect(indexHtml).toContain('The spellbook cleanup now extends into the Skill Tree placeholder state');
        expect(indexHtml).toContain('Added coverage for the Skill Tree empty-state class and removed the old inline placeholder styling');
    });

    test('keeps the prior 0.31.18 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.18');
        expect(indexHtml).toContain('The spellbook window keeps its centered, viewport-safe layout in shared CSS instead of inline HTML chrome');
        expect(indexHtml).toContain('Padding, four-column layout, tile gaps, minimum height, and scroll behavior now live in window CSS');
        expect(indexHtml).toContain('Active ability tooltip cleanup now extends into the Abilities spellbook menu');
        expect(indexHtml).toContain('Added coverage for the Abilities menu shell/content classes and removed inline layout styling');
    });

    test('keeps the prior 0.31.17 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.17');
        expect(indexHtml).toContain('The compact ability name, description, and mana-cost rows now share ability-tooltip classes');
        expect(indexHtml).toContain('Tooltip title spacing, gold title color, description sizing, muted copy color, cost color, and cost spacing now live in abilities CSS');
        expect(indexHtml).toContain('The start flow and loading overlay cleanup now extends into the active ability tooltip');
        expect(indexHtml).toContain('Added coverage for ability tooltip text classes and removed inline ability tooltip text styling');
    });

    test('keeps the prior 0.31.16 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.16');
        expect(indexHtml).toContain('The loading screen shell, title, progress frame, progress fill, and status text now share loading-screen classes');
        expect(indexHtml).toContain('Fullscreen overlay positioning, centered layout, title color, progress sizing, bar transition, and status typography now live in overlay CSS');
        expect(indexHtml).toContain('Login, class selection, and loading states all move toward reusable class-based styling');
        expect(indexHtml).toContain('Added coverage for loading overlay classes and removed inline loading-screen progress chrome');
    });

    test('keeps the prior 0.31.15 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.15');
        expect(indexHtml).toContain('The create-character title and each class fantasy description now share class-selection title, description, and class-color modifier classes');
        expect(indexHtml).toContain('Shared width, alignment, spacing, font sizing, and class-specific description colors now live in start-screen CSS');
        expect(indexHtml).toContain('Version, first steps, auth, enter-world, and class-pick guidance all use class-based styling');
        expect(indexHtml).toContain('Added coverage for class-selection title/description/modifier classes and removed inline class-pick guidance chrome');
    });

    test('keeps the prior 0.31.14 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.14');
        expect(indexHtml).toContain('Auth title, auth action row, fill-width auth buttons, auth status text, and the play container button now share named start-screen classes');
        expect(indexHtml).toContain('Login title typography, auth button flex, status color and sizing, play container layout, and enter-world button emphasis now live in start-screen CSS');
        expect(indexHtml).toContain('Start screen version, first-step guidance, login controls, and enter-world affordance now follow the same class-based styling direction');
        expect(indexHtml).toContain('Added coverage for auth panel and play container classes and removed inline auth/enter-world chrome');
    });

    test('keeps the prior 0.31.13 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.13');
        expect(indexHtml).toContain('The start-flow shell, body, title, copy, and step text now share named start-flow-panel classes');
        expect(indexHtml).toContain('Positioning, width, margin, flex layout, body padding, title emphasis, copy color, and step typography now live in start-screen CSS');
        expect(indexHtml).toContain('The login screen now treats its version row and onboarding guidance as reusable styling surfaces');
        expect(indexHtml).toContain('Added coverage for start-flow panel shell/body/text classes and removed inline first-steps panel chrome');
    });

    test('keeps the prior 0.31.12 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.12');
        expect(indexHtml).toContain('The visible Alpha version label and login-screen Patch Notes shortcut now share named start-version-row classes');
        expect(indexHtml).toContain('The row spacing, version typography, gold shortcut color, underline, cursor, and link offset now live in start-screen CSS');
        expect(indexHtml).toContain('The same class-based menu polish direction now covers support windows, Patch Notes content, and the first visible version affordance');
        expect(indexHtml).toContain('Added coverage for start-version-row label/link classes and removed inline login version row chrome');
    });

    test('keeps the prior 0.31.11 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.11');
        expect(indexHtml).toContain('The full commit history hint and link now keep their compact secondary styling through named patch-notes header classes');
        expect(indexHtml).toContain('The remaining one-off font, color, margin, underline, and pointer styles now live in shared CSS');
        expect(indexHtml).toContain('Patch Notes now shares shell, scroll body, entry chrome, and header metadata styling through class-based CSS');
        expect(indexHtml).toContain('Added coverage for Patch Notes header meta/link classes and removed inline header helper styling');
    });

    test('keeps the prior 0.31.10 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.10');
        expect(indexHtml).toContain('Core Controls, First Hour Milestones, and Daily Return Loop now share help-guide section, title, separator, and highlighted key styling');
        expect(indexHtml).toContain('Shortcut labels, numbered guide markers, and section dividers now use class-based CSS');
        expect(indexHtml).toContain('Help now shares support-window shell/body chrome plus reusable internal guide content classes');
        expect(indexHtml).toContain('Added coverage for Help guide title/key/separator classes and removed repeated inline Help guide chrome');
    });

    test('keeps the prior 0.31.9 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.9');
        expect(indexHtml).toContain('Report Bug / Feature and Unstuck / Respawn now keep their warning and danger styling through named pause-menu button classes');
        expect(indexHtml).toContain('The remaining one-off border and color styles in the pause action stack now live in shared CSS');
        expect(indexHtml).toContain('Pause now shares viewport-safe shell, action-stack layout, and special action variants through class-based styling');
        expect(indexHtml).toContain('Added coverage for pause menu report/danger button variants and removed inline pause action styling');
    });

    test('keeps the prior 0.31.8 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.8');
        expect(indexHtml).toContain('The report type select and report text area now share the support-field control styling');
        expect(indexHtml).toContain('Report text keeps resize behavior through a reusable support-field textarea class');
        expect(indexHtml).toContain('Report now shares shell, body, actions, buttons, and field chrome');
        expect(indexHtml).toContain('Added coverage for reusable Report form field classes and removed inline report select/textarea chrome');
    });

    test('keeps the prior 0.31.7 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.7');
        expect(indexHtml).toContain('Release titles and bullet lists now share patch-note title and list classes');
        expect(indexHtml).toContain('Patch note entries now get their bottom spacing from the shared patch-note-entry class');
        expect(indexHtml).toContain('Patch Notes now shares both its support-window shell and its repeated content styling through class-based CSS');
        expect(indexHtml).toContain('Added coverage for patch-note entry title/list classes and removed repeated inline Patch Notes content chrome');
    });

    test('keeps the prior 0.31.6 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.6');
        expect(indexHtml).toContain('The cache header, status, progress meter, pack list, badges, metadata, and action row now share asset-cache CSS');
        expect(indexHtml).toContain('Recommended download, refresh, update, and clear actions keep their visual intent through reusable button modifier classes');
        expect(indexHtml).toContain('Settings now shares shell, body, footer, action-row, core field, and asset-cache panel patterns');
        expect(indexHtml).toContain('Added coverage for asset-cache panel markup, meter styling, pack badge styling, action button variants, and removed inline cache chrome');
    });

    test('keeps the prior 0.31.5 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.5');
        expect(indexHtml).toContain('Graphics quality, brightness, auto-loot, camera shake, and fullscreen controls now share field, row, label, hint, value, select, and range styling');
        expect(indexHtml).toContain('primary Settings controls no longer duplicate label colors, hint typography, row layout, or range width inline');
        expect(indexHtml).toContain('Settings now shares shell, body, footer, action-row, and core field patterns');
        expect(indexHtml).toContain('Added coverage for support-field markup and reusable Settings form CSS');
    });

    test('keeps the prior 0.31.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.4');
        expect(indexHtml).toContain('Settings and Help close areas use the shared support-window footer class');
        expect(indexHtml).toContain('Cancel and Submit now use reusable support button sizing classes');
        expect(indexHtml).toContain('Support windows now share shell, body, footer, and action-row patterns');
        expect(indexHtml).toContain('Added coverage for support footer/action-row classes and reusable report action buttons');
    });

    test('keeps the prior 0.31.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.3');
        expect(indexHtml).toContain('Settings, Help, Report, and Patch Notes now share support-window chrome');
        expect(indexHtml).toContain('Tall settings controls, help guides, report fields, and patch history content scroll through shared support-window body variants');
        expect(indexHtml).toContain('Static support menus now line up with the generated and pause menu cleanup direction');
        expect(indexHtml).toContain('Added coverage for support-window shell classes, support body scroll variants, and 0.31.3 version presentation');
    });

    test('keeps the prior 0.31.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.2');
        expect(indexHtml).toContain('The Escape menu now uses reusable pause-menu and pause-menu__actions classes');
        expect(indexHtml).toContain('The button stack now scrolls inside a viewport-capped pause menu frame');
        expect(indexHtml).toContain('Pause, generated, Forge, static, service, quest, and HUD utility windows');
        expect(indexHtml).toContain('Added coverage for pause menu viewport-safe chrome and reusable action-stack markup');
    });

    test('keeps the prior 0.31.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.1');
        expect(indexHtml).toContain('Dungeon Portal and Talent Master now let shared generated-menu classes own backdrop, position, sizing, overflow, and action-row behavior');
        expect(indexHtml).toContain('Dungeon selects, difficulty choices, and generated menu footers keep their layout through shared CSS');
        expect(indexHtml).toContain('Future generated menu polish can target one CSS surface');
        expect(indexHtml).toContain('Added coverage that generated menus use reusable chrome classes and no longer depend on inline viewport shell styles');
    });

    test('keeps the prior 0.31.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.31.0');
        expect(indexHtml).toContain('Dungeon Portal and Talent Master use shared generated-menu and backdrop classes');
        expect(indexHtml).toContain('Dungeon selects, difficulty rows, and footer action rows now carry reusable classes');
        expect(indexHtml).toContain('consistent headers, bodies, footers, tabs, and menu feel');
        expect(indexHtml).toContain('Added coverage for shared generated modal chrome, reusable generated action rows, and 0.31.0 version presentation');
    });

    test('keeps the prior 0.30.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.30.4');
        expect(indexHtml).toContain('Generated menus now cap their height, scroll internally, and keep footer actions reachable');
        expect(indexHtml).toContain('Skill Tree, party roster, and party invite surfaces now stay inside normal viewport bounds');
        expect(indexHtml).toContain('Dungeon selectors and difficulty controls now wrap or shrink inside their menu');
        expect(indexHtml).toContain('Added coverage for generated menu viewport caps, special panel sizing, and 0.30.4 version presentation');
    });

    test('keeps the prior 0.30.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.30.3');
        expect(indexHtml).toContain('The remaining HUD utility windows now use viewport-capped dimensions instead of fixed desktop-only frames');
        expect(indexHtml).toContain('Ability lists, character stats, inventory contents, and split-stack controls can scroll inside their windows when the available screen height is tight');
        expect(indexHtml).toContain('Primary HUD, service, quest, Forge, and static menus now share the same basic rule');
        expect(indexHtml).toContain('Added regression coverage for responsive HUD utility window constraints, plus 0.30.3 version presentation');
    });

    test('keeps the prior 0.30.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.30.2');
        expect(indexHtml).toContain('These primary gameplay menus now cap their width and height instead of assuming desktop-only space');
        expect(indexHtml).toContain('Merchant and Trading House content now scrolls inside the window frame so tabs, lists, and action controls remain usable when content grows');
        expect(indexHtml).toContain('Available Quests and Quest Journal now use viewport-capped frames with internal list scrolling');
        expect(indexHtml).toContain('Added regression coverage for responsive service and quest window constraints, plus 0.30.2 version presentation');
    });

    test('keeps the prior 0.30.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.30.1');
        expect(indexHtml).toContain('These static menus now cap their width and height against the current viewport instead of relying on fixed desktop dimensions');
        expect(indexHtml).toContain('Help and Report content keep their actions reachable when the viewport is short');
        expect(indexHtml).toContain('The Patch Notes window now keeps its history scroll inside a viewport-capped frame instead of exceeding short displays');
        expect(indexHtml).toContain('Added regression coverage for responsive Help, Report, and Patch Notes menu constraints, plus 0.30.1 version presentation');
    });

    test('keeps the prior 0.30.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.30.0');
        expect(indexHtml).toContain('Alpha now advances to 0.30.0 with the first menu-consistency slice focused on Forge usability');
        expect(indexHtml).toContain('The Forge window is wider and taller on normal screens while staying capped to the viewport');
        expect(indexHtml).toContain('Forge content now scrolls inside the menu, so upgrade, potency, socket, insert, combine, and remove actions remain accessible when tab content gets tall');
        expect(indexHtml).toContain('Added regression coverage for Forge menu sizing, internal scrolling, action-button reachability, and 0.30.0 version presentation');
    });

    test('keeps the prior 0.29.34 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.34');
        expect(indexHtml).toContain('Authoritative state now also replicates swift active state and duration so Swift can carry truthful remaining time in local self sync instead of relying only on local trigger guesses');
        expect(indexHtml).toContain('This lets local self sync and buff UI track the real remaining Swift window from server state while also fixing expired server Swift state to clear cleanly');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one buff field at a time, following spell focus duration with the remaining timer-backed unique speed buff case');
        expect(indexHtml).toContain('Added regression coverage for authoritative swift state and duration sync, plus 0.29.34 version presentation');
    });

    test('keeps the prior 0.29.33 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.33');
        expect(indexHtml).toContain('Authoritative state now also replicates spell focus duration so Spell Focus can carry truthful remaining time in local self sync instead of relying on a missing local timer');
        expect(indexHtml).toContain('This lets local self sync and buff UI track the real remaining Spell Focus window from server state while keeping the broader support-duration rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one buff field at a time, following divine intervention duration with the next timer-backed wizard setup buff case');
        expect(indexHtml).toContain('Added regression coverage for authoritative spell focus duration sync and 0.29.33 version presentation');
    });

    test('keeps the prior 0.29.26 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.26');
        expect(indexHtml).toContain('Authoritative state now also replicates mark weakness duration so marked targets can carry truthful remaining time in local self sync instead of relying on a placeholder timer');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining marked window from server state while keeping factor detail for later slices');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following mark weakness active state with the matching timer-backed marked case');
        expect(indexHtml).toContain('Added regression coverage for authoritative mark weakness duration sync and 0.29.26 version presentation');
    });

    test('keeps the prior 0.29.25 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.25');
        expect(indexHtml).toContain('Authoritative state now also replicates mark weakness active state so marked targets can stay truthfully flagged in local self sync instead of relying only on local guesswork');
        expect(indexHtml).toContain('This lets local self sync and debuff UI reflect the real server-owned mark weakness state while keeping duration and factor details for later slices');
        expect(indexHtml).toContain('When only authoritative active state is present, the debuff card now falls back to a truthful generic marked label instead of inventing a `+0% damage taken` factor');
        expect(indexHtml).toContain('Added regression coverage for authoritative mark weakness active sync, truthful marked-detail fallback, and 0.29.25 version presentation');
    });

    test('keeps the prior 0.29.24 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.24');
        expect(indexHtml).toContain('Authoritative state now also replicates weak point duration so marked targets can carry truthful remaining time in local self sync instead of relying on a placeholder timer');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining weak point window from server state while keeping weak point detail rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following weak point active state with the matching timer-backed weak point case');
        expect(indexHtml).toContain('Added regression coverage for authoritative weak point duration sync and 0.29.24 version presentation');
    });

    test('keeps the prior 0.29.23 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.23');
        expect(indexHtml).toContain('Authoritative state now also replicates weak point active state so marked targets can stay truthfully flagged in local self sync instead of relying only on local guesswork');
        expect(indexHtml).toContain('This lets local self sync and debuff UI reflect the real server-owned weak point mark state while keeping duration and damage details for later slices');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following slow duration with the first safe weak point state case');
        expect(indexHtml).toContain('Added regression coverage for authoritative weak point active sync and 0.29.23 version presentation');
    });

    test('keeps the prior 0.29.22 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.22');
        expect(indexHtml).toContain('Authoritative state now also replicates slow duration so active slows can carry truthful remaining time instead of relying only on slow factor and a local placeholder timer');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining slow window from server state while keeping the broader status rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following poison damage with the remaining timer-backed slow case');
        expect(indexHtml).toContain('Added regression coverage for authoritative slow duration sync and 0.29.22 version presentation');
    });

    test('keeps the prior 0.29.21 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.21');
        expect(indexHtml).toContain('Authoritative state now also replicates poison damage so active poison can carry truthful per-tick damage detail instead of relying only on local stack guesses');
        expect(indexHtml).toContain('This lets local self sync and debuff UI prefer the real server-owned poison tick damage while still falling back to local stack-based detail when that authoritative field is absent');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following bleed damage with the matching safe poison-owned damage detail');
        expect(indexHtml).toContain('Added regression coverage for authoritative poison damage sync and 0.29.21 version presentation');
    });

    test('keeps the prior 0.29.20 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.20');
        expect(indexHtml).toContain('Authoritative state now also replicates bleed damage so active bleeds can carry truthful per-tick damage detail instead of relying only on local stack guesses');
        expect(indexHtml).toContain('This lets local self sync and debuff UI prefer the real server-owned bleed tick damage while still falling back to local stack-based detail when that authoritative field is absent');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff field at a time, following poison duration with the next safe bleed-owned damage detail');
        expect(indexHtml).toContain('Added regression coverage for authoritative bleed damage sync and 0.29.20 version presentation');
    });

    test('keeps the prior 0.29.19 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.19');
        expect(indexHtml).toContain('Authoritative state now also replicates poison duration so active poison can carry truthful remaining time instead of only an on/off poisoned flag');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining poison window from server state while keeping the broader debuff-duration rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff at a time, following bleed with the matching safe server-owned poison case');
        expect(indexHtml).toContain('Added regression coverage for authoritative poison duration sync and 0.29.19 version presentation');
    });

    test('keeps the prior 0.29.18 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.18');
        expect(indexHtml).toContain('Authoritative state now also replicates bleed duration so active bleeds can carry truthful remaining time instead of only an on/off bleeding flag');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining bleed window from server state while keeping the broader debuff-duration rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff at a time, moving from timer-backed crowd control into the next safe server-owned bleed case');
        expect(indexHtml).toContain('Added regression coverage for authoritative bleed duration sync and 0.29.18 version presentation');
    });

    test('keeps the prior 0.29.17 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.17');
        expect(indexHtml).toContain('Authoritative state now also replicates stun duration so active stuns can carry truthful remaining time instead of only an on/off stunned flag');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining stun lockout from server state while keeping the broader debuff-duration rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff at a time, following root duration with the next safe timer-backed stun case');
        expect(indexHtml).toContain('Added regression coverage for authoritative stun duration sync and 0.29.17 version presentation');
    });

    test('keeps the prior 0.29.16 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.16');
        expect(indexHtml).toContain('Authoritative state now also replicates root duration so active roots can carry truthful remaining time instead of only an on/off rooted flag');
        expect(indexHtml).toContain('This lets local self sync and debuff UI track the real remaining root lockout from server state while keeping the broader debuff-duration rollout incremental and honest');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by extending status detail replication one debuff at a time, starting with the cleanest timer-backed root case');
        expect(indexHtml).toContain('Added regression coverage for authoritative root duration sync and 0.29.16 version presentation');
    });

    test('keeps the prior 0.29.15 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.15');
        expect(indexHtml).toContain('Authoritative state now also replicates slow factor so active slows can carry truthful strength data instead of only a boolean on/off signal');
        expect(indexHtml).toContain('This lets the local player sync and debuff tracker show the real slow percentage from server state while still avoiding any invented generic durations for other active debuffs');
        expect(indexHtml).toContain('The 0.29 cleanup line continues with the smallest truthful active-status detail replication slice before broader debuff duration work');
        expect(indexHtml).toContain('Added regression coverage for authoritative slow factor sync and 0.29.15 version presentation');
    });

    test('keeps the prior 0.29.14 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.14');
        expect(indexHtml).toContain('Server delta snapshots now track stunned, slowed, rooted, bleeding, and poisoned state changes so status-only transitions cannot be skipped by compressed authoritative updates');
        expect(indexHtml).toContain('This keeps the new local debuff-clear path and any remote status consumers supplied with timely authoritative debuff flips instead of relying on unrelated movement or stat changes to carry them through');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by tightening the server delta broadcaster before any broader status duration replication work');
        expect(indexHtml).toContain('Added regression coverage for debuff flag delta tracking and 0.29.14 version presentation');
    });

    test('keeps the prior 0.29.13 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.13');
        expect(indexHtml).toContain('Local authoritative self sync now clears stale debuff timers and stacks when server state explicitly says stun, slow, root, bleed, or poison are no longer active');
        expect(indexHtml).toContain('This keeps the local buff tracker and control-state truth from lingering after authoritative status removal without pretending to know missing server-side durations for still-active debuffs');
        expect(indexHtml).toContain('The 0.29 cleanup line continues with a narrow status-model correction that is safe to ship before any broader timer replication redesign');
        expect(indexHtml).toContain('Added regression coverage for authoritative local debuff clears and 0.29.13 version presentation');
    });

    test('keeps the prior 0.29.12 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.12');
        expect(indexHtml).toContain('Local authoritative self sync now also stores server-sent unlocked talent lists during delta updates instead of treating that field as a change trigger without ever applying it');
        expect(indexHtml).toContain('This keeps the local progression state aligned when authoritative player updates include talent unlocks alongside ranks and points, closing one more small split in the talent sync path');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by making local authoritative progression sync more internally complete before any broader status-model work');
        expect(indexHtml).toContain('Added regression coverage for local authoritative unlocked talent sync and 0.29.12 version presentation');
    });

    test('keeps the prior 0.29.11 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.11');
        expect(indexHtml).toContain('Local authoritative self sync now also applies server-sent skill rune selections during delta updates instead of relying only on the separate rune message or a later full-state refresh');
        expect(indexHtml).toContain('This keeps rune-driven skill behavior and UI truth aligned when authoritative player updates already contain the latest rune loadout, closing another small split path in the local progression sync flow');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by making the local authoritative player path more internally complete across both combat state and progression customisation');
        expect(indexHtml).toContain('Added regression coverage for local authoritative skill rune sync and 0.29.11 version presentation');
    });

    test('keeps the prior 0.29.10 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.10');
        expect(indexHtml).toContain('Local authoritative self sync now also applies server-sent charge state so the local player follows the same authoritative charging flag already used by remote entity sync');
        expect(indexHtml).toContain('This keeps local fighter charge behavior, animation selection, and related control-state checks from drifting when the server toggles charging without a separate local prediction path owning the transition');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by closing another emitted-but-not-applied self state flag in the authoritative player sync path');
        expect(indexHtml).toContain('Added regression coverage for local authoritative charge sync and 0.29.10 version presentation');
    });

    test('keeps the prior 0.29.9 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.9');
        expect(indexHtml).toContain('Local authoritative self sync now also applies server-sent scale so player size changes use the same authoritative <code>setScale</code> path that remote entities already follow');
        expect(indexHtml).toContain('This keeps local range, collision, and visual scale behavior aligned when the server changes player scale instead of leaving the local actor on stale size until some later rebuild');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by closing another emitted-but-not-applied self field in the authoritative player sync path');
        expect(indexHtml).toContain('Added regression coverage for local authoritative scale sync and 0.29.9 version presentation');
    });

    test('keeps the prior 0.29.8 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.8');
        expect(indexHtml).toContain('Local authoritative self sync now also applies quest data from entity state and delta payloads instead of depending only on separate quest update messages');
        expect(indexHtml).toContain('This keeps quest objectives and journal state aligned when authoritative player sync already includes the latest quest list, reducing one more split-brain path between dedicated UI events and entity state');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by making local self sync more complete across both combat stats and progression state');
        expect(indexHtml).toContain('Added regression coverage for local authoritative quest sync and 0.29.8 version presentation');
    });

    test('keeps the prior 0.29.7 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.7');
        expect(indexHtml).toContain('Local authoritative self sync now also applies server-sent cast speed so that remaining derived stat truth stays aligned after full and delta updates');
        expect(indexHtml).toContain('This closes another emitted-but-not-applied local stat field in the 0.29 cleanup line instead of leaving cast timing modifiers stale until a later local recalculation');
        expect(indexHtml).toContain('The local self-sync path now keeps base stats, regeneration, and cast speed aligned with the same authoritative payload that already drives other derived stat updates');
        expect(indexHtml).toContain('Added regression coverage for local authoritative cast speed sync and 0.29.7 version presentation');
    });

    test('keeps the prior 0.29.6 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.6');
        expect(indexHtml).toContain('Local authoritative self sync now also applies server-sent base attributes so character-sheet base-versus-bonus breakdowns stay truthful after full and delta updates');
        expect(indexHtml).toContain('This keeps authoritative stat migration, level overrides, and other server-side base-stat changes from leaving the local UI with stale underlying attribute baselines');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by closing another local-only stat truth gap while reusing the existing self-sync structure');
        expect(indexHtml).toContain('Added regression coverage for local authoritative base stat sync and 0.29.6 version presentation');
    });

    test('keeps the prior 0.29.5 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.5');
        expect(indexHtml).toContain('Local authoritative self sync now applies server-sent HP and mana regeneration values instead of leaving those derived stats stale between full recalculations');
        expect(indexHtml).toContain('This keeps passive sustain behavior aligned with authoritative server stats after delta and full-state updates, especially when gear, talents, or effects change regeneration mid-session');
        expect(indexHtml).toContain('The 0.29 cleanup line continues by closing another small local-only derived-stat sync gap without widening the broader status-model design');
        expect(indexHtml).toContain('Added regression coverage for local authoritative regeneration sync and 0.29.5 version presentation');
    });

    test('keeps the prior 0.29.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.4');
        expect(indexHtml).toContain('Boosted Spirit Guardians now syncs through both the server delta snapshot tracker and the client-side shared support helper instead of dropping that boosted state on compressed updates');
        expect(indexHtml).toContain('This keeps guardian boost metadata aligned with the rest of the authoritative support-state replication path, so boosted guardians stay visible and mechanically correct after the initial cast snapshot');
        expect(indexHtml).toContain('The active buff tracker can now keep showing boosted guardians from authoritative state instead of silently falling back to the normal guardian variant');
        expect(indexHtml).toContain('Added regression coverage for boosted guardian delta tracking, boosted guardian client sync, and 0.29.4 version presentation');
    });

    test('keeps the prior 0.29.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.3');
        expect(indexHtml).toContain('Spirit Guardians state now participates in the server delta snapshot change tracker, so guardian-only activation and expiry cannot get skipped by compressed state broadcasts');
        expect(indexHtml).toContain('This keeps the server delta path aligned with the newer support-effect replication set instead of leaving Spirit Guardians outside the consolidated comparison block');
        expect(indexHtml).toContain('Nearby guardian state readability and the shared client-side support sync path now have a more reliable authoritative trigger to react to');
        expect(indexHtml).toContain('Added server regression coverage for Spirit Guardians delta snapshot tracking and 0.29.3 version presentation');
    });

    test('keeps the prior 0.29.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.2');
        expect(indexHtml).toContain('Spirit Guardians now also syncs through the shared support-effect helper instead of keeping a separate one-off apply and teardown path');
        expect(indexHtml).toContain('Server-driven guardian expiry now clears only guardian state instead of routing through broader cleric ability cancellation that could drop unrelated support effects');
        expect(indexHtml).toContain('This closes the last major support-effect holdout from the 0.29 sync consolidation line while keeping nearby guardians readability unchanged');
        expect(indexHtml).toContain('Added regression coverage for guardian-only synced teardown and 0.29.2 version presentation');
    });

    test('keeps the prior 0.29.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.1');
        expect(indexHtml).toContain('The new shared effect sync path now also applies to the local authoritative player state, so server-driven buff expiry and consumption stop depending on one-off manual sync logic');
        expect(indexHtml).toContain('Time Warp, Spell Focus, Arcane Shield, and the newer support flags now clear or apply through the same helper whether the affected actor is local or remote');
        expect(indexHtml).toContain('This extends the 0.29 cleanup from remote readability into local correctness for server-authoritative buff and control state updates');
        expect(indexHtml).toContain('Added regression coverage for local authoritative effect sync reuse and 0.29.1 version presentation');
    });

    test('keeps the prior 0.29.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.29.0');
        expect(indexHtml).toContain('Remote support and control buffs now sync through one shared effect registry instead of a growing chain of hand-written per-flag blocks inside remote entity state handling');
        expect(indexHtml).toContain('Guardian Embrace, Blessing of Resolve, Divine Intervention, Arcane Shield, Time Warp, and Spell Focus now all reuse the same remote effect sync path while preserving their existing player-facing callouts');
        expect(indexHtml).toContain('This starts the next multiplayer cleanup line by consolidating server-authoritative buff replication rules before more support and control flags are added');
        expect(indexHtml).toContain('Added regression coverage for the shared remote effect sync registry and 0.29.0 version presentation');
    });

    test('keeps the prior 0.28.8 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.8');
        expect(indexHtml).toContain('Spell Focus now replicates through the hot-path multiplayer state snapshot so nearby clients can track that charged-cast window in real time');
        expect(indexHtml).toContain('Nearby remote wizards now surface <code>FOCUS UP</code> and <code>FOCUS DOWN</code> readability, and the replicated state now drives the existing spell-focus multiplier path instead of leaving remote prep windows implicit');
        expect(indexHtml).toContain('Activation still de-dupes against the explicit Spell Focus cast label, keeping the wizard utility readability rules consistent across buff and setup states');
        expect(indexHtml).toContain('Added regression coverage for Spell Focus replication readability and 0.28.8 version presentation');
    });

    test('keeps the prior 0.28.7 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.7');
        expect(indexHtml).toContain('Time Warp now replicates through the hot-path multiplayer state snapshot so nearby clients can track that haste window in real time');
        expect(indexHtml).toContain('Nearby remote wizards now surface <code>WARP UP</code> and <code>WARP DOWN</code> readability, and the replicated state now drives the existing haste buff path instead of leaving remote Time Warp implicit');
        expect(indexHtml).toContain('Activation still de-dupes against the explicit Time Warp cast label, keeping the support-state presentation rules consistent across the wizard utility kit');
        expect(indexHtml).toContain('Added regression coverage for Time Warp replication readability and 0.28.7 version presentation');
    });

    test('keeps the prior 0.28.6 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.6');
        expect(indexHtml).toContain('Arcane Shield now replicates through the hot-path multiplayer state snapshot with both its active flag and remaining shield value so nearby clients can track the protection state truthfully');
        expect(indexHtml).toContain('Nearby remote wizards now surface <code>SHIELD UP</code> and <code>SHIELD DOWN</code> readability, and the replicated shield value now feeds the existing shield buff tracker path instead of leaving remote shield state implicit');
        expect(indexHtml).toContain('Activation still de-dupes against the explicit Arcane Shield cast label, keeping the growing support-state line consistent even for HP-backed protective buffs');
        expect(indexHtml).toContain('Added regression coverage for Arcane Shield replication readability, buff tracking, and 0.28.6 version presentation');
    });

    test('keeps the prior 0.28.5 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.5');
        expect(indexHtml).toContain('Remote support-state readability now pulls its labels, colors, and cast de-dupe mapping from one shared registry instead of a growing chain of per-buff conditionals');
        expect(indexHtml).toContain('Spirit Guardians, Guardian Embrace, Blessing of Resolve, and Divine Intervention now all ride the same support metadata path, making the 0.28 support pass easier to extend without re-teaching timing rules each time');
        expect(indexHtml).toContain('This keeps behavior unchanged for existing support auras while setting up the next replicated buff slices on a cleaner shared foundation');
        expect(indexHtml).toContain('Added regression coverage for the shared remote support registry and 0.28.5 version presentation');
    });

    test('keeps the prior 0.28.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.4');
        expect(indexHtml).toContain('Divine Intervention now replicates through the hot-path multiplayer state snapshot so nearby clients can track that rescue buff in real time');
        expect(indexHtml).toContain('Nearby remote clerics now surface <code>INTERVENTION UP</code> and <code>INTERVENTION DOWN</code> readability, extending the support-state pass to another real timed protection effect');
        expect(indexHtml).toContain('Activation still de-dupes against the explicit Divine Intervention cast label, so the added support-state visibility does not reintroduce duplicate callouts');
        expect(indexHtml).toContain('Added regression coverage for Divine Intervention replication readability and 0.28.4 version presentation');
    });

    test('keeps the prior 0.28.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.3');
        expect(indexHtml).toContain('Remote support-state activation readability now de-dupes against each buff\'s own explicit cast label instead of only handling Spirit Guardians');
        expect(indexHtml).toContain('Guardian Embrace and Blessing of Resolve no longer double-call their activation state a beat after the named cast text already fired');
        expect(indexHtml).toContain('This starts consolidating the 0.28 support-state pass into shared timing rules instead of a chain of per-buff exceptions');
        expect(indexHtml).toContain('Added regression coverage for support activation de-dupe handling and 0.28.3 version presentation');
    });

    test('keeps the prior 0.28.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.2');
        expect(indexHtml).toContain('Blessing of Resolve now replicates through the hot-path multiplayer state snapshot so nearby clients can track that defensive aura in real time');
        expect(indexHtml).toContain('Nearby remote clerics now surface <code>RESOLVE UP</code> and <code>RESOLVE DOWN</code> readability, extending the support-state pass to another real timed buff');
        expect(indexHtml).toContain('This keeps the 0.28 line focused on server-authoritative support-state visibility rather than falling back to cast-start-only inference');
        expect(indexHtml).toContain('Added regression coverage for Blessing of Resolve replication readability and 0.28.2 version presentation');
    });

    test('keeps the prior 0.28.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.1');
        expect(indexHtml).toContain('Guardian Embrace now replicates through the hot-path multiplayer state snapshot so nearby clients can see that support aura come online and fall off in real time');
        expect(indexHtml).toContain('Nearby remote clerics now surface <code>EMBRACE UP</code> and <code>EMBRACE DOWN</code> readability, extending the new support-state pass beyond Spirit Guardians alone');
        expect(indexHtml).toContain('This turns another real server-authoritative support flag into player-facing multiplayer readability instead of relying on cast-start guesswork');
        expect(indexHtml).toContain('Added regression coverage for Guardian Embrace replication readability and 0.28.1 version presentation');
    });

    test('keeps the prior 0.28.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.28.0');
        expect(indexHtml).toContain('Nearby remote Spirit Guardians state now surfaces explicit support readability when the aura comes online or falls off instead of leaving the persistent support state mostly silent after cast start');
        expect(indexHtml).toContain('Activation de-dupes against the immediate named Spirit Guardians cast label, while expiry still calls out when the nearby support aura ends');
        expect(indexHtml).toContain('This starts the broader 0.28 multiplayer presentation pass by teaching a real replicated support state to read more like the cleaned-up remote combat states');
        expect(indexHtml).toContain('Added regression coverage for remote Spirit Guardians support-state readability and 0.28.0 version presentation');
    });

    test('keeps the prior 0.27.9 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.9');
        expect(indexHtml).toContain('Generic <code>ATTACK</code> echo suppression for named remote actions now lasts for the full named-callout throttle window instead of expiring a beat early');
        expect(indexHtml).toContain('This closes the last small leak where a repeat cast could still surface a stray generic label near the end of the named readability cooldown');
        expect(indexHtml).toContain('The de-echo window now matches the same 750ms cadence used by the explicit remote action callout throttle');
        expect(indexHtml).toContain('Added regression coverage for full-window remote de-echo timing and 0.27.9 version presentation');
    });

    test('keeps the prior 0.27.8 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.8');
        expect(indexHtml).toContain('Repeated explicit remote ability starts now keep suppressing the generic <code>ATTACK</code> echo even when the named callout itself is still inside its throttle window');
        expect(indexHtml).toContain('This keeps rapid repeat casts from falling back to a stray generic label just because the named readability text was intentionally rate-limited');
        expect(indexHtml).toContain('The suppress window now tracks explicit action starts, not only the moments when the named label was actually rendered');
        expect(indexHtml).toContain('Added regression coverage for throttled remote ability de-echo handling and 0.27.8 version presentation');
    });

    test('keeps the prior 0.27.7 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.7');
        expect(indexHtml).toContain('Remote damage packets no longer re-trigger generic attack presentation for nearby remote-versus-remote combat when explicit action-start messages already covered the swing or cast');
        expect(indexHtml).toContain('This keeps crowded fights from quietly stretching remote attack poses again through later damage confirmation side effects');
        expect(indexHtml).toContain('Damage against the local player still refreshes the attacker presentation as a fallback when the client needs a last-resort hit-read sync');
        expect(indexHtml).toContain('Added regression coverage for remote damage sync cleanup and 0.27.7 version presentation');
    });

    test('keeps the prior 0.27.6 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.6');
        expect(indexHtml).toContain('Named remote ability callouts now suppress the immediate generic <code>ATTACK</code> echo that could arrive from the next replicated attack-state confirmation for the same actor');
        expect(indexHtml).toContain('This keeps nearby spell readability focused on the real skill name instead of stacking a second generic label a beat later');
        expect(indexHtml).toContain('Generic replicated <code>ATTACK</code> readability still works when no explicit named action callout just fired');
        expect(indexHtml).toContain('Added regression coverage for remote ability readability de-echo handling and 0.27.6 version presentation');
    });

    test('keeps the prior 0.27.5 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.5');
        expect(indexHtml).toContain('Explicit remote attack and ability events can now restart nearby action presentation even if that actor was already in an <code>ATTACKING</code> pose from the previous action');
        expect(indexHtml).toContain('This keeps fast back-to-back remote swings and casts readable after the 0.27.4 duplicate-confirmation fix stopped generic sync from stretching one action forever');
        expect(indexHtml).toContain('Later replicated <code>ATTACKING</code> confirmations still stay idempotent, but real explicit action-start messages now re-arm the visual cadence for a new move');
        expect(indexHtml).toContain('Added regression coverage for explicit remote action refresh handling and 0.27.5 version presentation');
    });

    test('keeps the prior 0.27.4 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.4');
        expect(indexHtml).toContain('Duplicate remote attack confirmations now stop re-extending the same local attack pose when they are only confirming a swing that is already in progress');
        expect(indexHtml).toContain('This reduces overstretched remote swing visuals when explicit attack events and later replicated <code>ATTACKING</code> state both describe the same melee action');
        expect(indexHtml).toContain('The client now only starts a fresh remote attack timer when a nearby actor was not already attacking');
        expect(indexHtml).toContain('Added regression coverage for duplicate remote attack sequencing and 0.27.4 version presentation');
    });

    test('keeps the prior 0.27.3 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.3');
        expect(indexHtml).toContain('Remote players now accept server recovery states immediately after an attack instead of waiting for a client-side attack timer to expire');
        expect(indexHtml).toContain('This reduces cases where nearby actors look stuck swinging after the server has already moved them back to idle or movement');
        expect(indexHtml).toContain('The client now clears local remote attack timers when authoritative non-attack states arrive');
        expect(indexHtml).toContain('Added regression coverage for remote attack recovery sequencing and 0.27.3 version presentation');
    });

    test('keeps the prior 0.27.2 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.2');
        expect(indexHtml).toContain('Remote charge-state actors now keep their run-style presentation when the server says they are charging instead of falling back to a stationary attack loop');
        expect(indexHtml).toContain('This makes fighter charge-type abilities read more truthfully on nearby clients while the server is still driving the actual movement path');
        expect(indexHtml).toContain('The client now treats replicated charging as higher-priority presentation than generic <code>ATTACKING</code> for remote actors');
        expect(indexHtml).toContain('Added regression coverage for remote charge animation priority and 0.27.2 version presentation');
    });

    test('keeps the prior 0.27.1 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.1');
        expect(indexHtml).toContain('Remote ability casts now rotate nearby remote players toward the accepted cast target before later movement or state packets arrive');
        expect(indexHtml).toContain('Projectile shots, support casts, and ground-targeted spells now read with cleaner intent because the caster no longer appears to fire sideways for a beat');
        expect(indexHtml).toContain('This tightens remote spell readability on top of the new explicit basic-attack replication instead of waiting for the broader 0.28 presentation pass');
        expect(indexHtml).toContain('Added regression coverage for remote ability facing sync and 0.27.1 version presentation');
    });

    test('keeps the prior 0.27.0 patch notes entry in history', () => {
        expect(indexHtml).toContain('Patch 0.27.0');
        expect(indexHtml).toContain('Remote basic attacks now broadcast an explicit attack-start event instead of waiting for later damage or state side effects');
        expect(indexHtml).toContain('Other clients now rotate nearby remote players into their swing target and kick the attack animation immediately when the server accepts the hit attempt');
        expect(indexHtml).toContain('This narrows the gap between remote melee intent and visible impact before the later broader action-replication pass');
        expect(indexHtml).toContain('Added regression coverage for explicit remote basic-attack replication and 0.27.0 version presentation');
    });

    test('keeps the prior 0.26.0 patch notes entry in history', () => {
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
        expect(indexHtml).toContain('Patch 0.29.16');
        expect(indexHtml).toContain('Patch 0.29.15');
        expect(indexHtml).toContain('Patch 0.29.14');
        expect(indexHtml).toContain('Patch 0.29.13');
        expect(indexHtml).toContain('Patch 0.29.12');
        expect(indexHtml).toContain('Patch 0.29.11');
        expect(indexHtml).toContain('Patch 0.29.10');
        expect(indexHtml).toContain('Patch 0.29.9');
        expect(indexHtml).toContain('Patch 0.29.8');
        expect(indexHtml).toContain('Patch 0.29.7');
        expect(indexHtml).toContain('Patch 0.29.6');
        expect(indexHtml).toContain('Patch 0.29.5');
        expect(indexHtml).toContain('Patch 0.29.4');
        expect(indexHtml).toContain('Patch 0.29.3');
        expect(indexHtml).toContain('Patch 0.29.2');
        expect(indexHtml).toContain('Patch 0.29.1');
        expect(indexHtml).toContain('Patch 0.29.0');
        expect(indexHtml).toContain('Patch 0.28.8');
        expect(indexHtml).toContain('Patch 0.28.7');
        expect(indexHtml).toContain('Patch 0.28.6');
        expect(indexHtml).toContain('Patch 0.28.5');
        expect(indexHtml).toContain('Patch 0.28.4');
        expect(indexHtml).toContain('Patch 0.28.3');
        expect(indexHtml).toContain('Patch 0.28.2');
        expect(indexHtml).toContain('Patch 0.28.1');
        expect(indexHtml).toContain('Patch 0.28.0');
        expect(indexHtml).toContain('Patch 0.27.9');
        expect(indexHtml).toContain('Patch 0.27.8');
        expect(indexHtml).toContain('Patch 0.27.7');
        expect(indexHtml).toContain('Patch 0.27.6');
        expect(indexHtml).toContain('Patch 0.27.5');
        expect(indexHtml).toContain('Patch 0.27.4');
        expect(indexHtml).toContain('Patch 0.27.3');
        expect(indexHtml).toContain('Patch 0.27.2');
        expect(indexHtml).toContain('Patch 0.27.1');
        expect(indexHtml).toContain('Patch 0.27.0');
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
        expect(indexHtml).toContain('Patch 0.31.38');
        expect(indexHtml).toContain('Patch 0.31.37');
        expect(indexHtml).toContain('Patch 0.31.36');
        expect(indexHtml).toContain('Patch 0.31.35');
        expect(indexHtml).toContain('Patch 0.31.34');
        expect(indexHtml).toContain('Patch 0.31.33');
        expect(indexHtml).toContain('Patch 0.31.32');
        expect(indexHtml).toContain('Patch 0.31.31');
        expect(indexHtml).toContain('Patch 0.31.30');
        expect(indexHtml).toContain('Patch 0.31.29');
        expect(indexHtml).toContain('Patch 0.31.28');
        expect(indexHtml).toContain('Patch 0.31.27');
        expect(indexHtml).toContain('Patch 0.31.26');
        expect(indexHtml).toContain('Patch 0.31.25');
        expect(indexHtml).toContain('Patch 0.31.24');
        expect(indexHtml).toContain('Patch 0.31.23');
        expect(indexHtml).toContain('Patch 0.31.22');
        expect(indexHtml).toContain('Patch 0.31.21');
        expect(indexHtml).toContain('Patch 0.31.20');
        expect(indexHtml).toContain('Patch 0.31.19');
        expect(indexHtml).toContain('Patch 0.31.18');
        expect(indexHtml).toContain('Patch 0.31.17');
        expect(indexHtml).toContain('Patch 0.31.16');
        expect(indexHtml).toContain('Patch 0.31.15');
        expect(indexHtml).toContain('Patch 0.31.14');
        expect(indexHtml).toContain('Patch 0.31.13');
        expect(indexHtml).toContain('Patch 0.31.12');
        expect(indexHtml).toContain('Patch 0.31.11');
        expect(indexHtml).toContain('Patch 0.31.10');
        expect(indexHtml).toContain('Patch 0.31.9');
        expect(indexHtml).toContain('Patch 0.31.8');
        expect(indexHtml).toContain('Patch 0.31.7');
        expect(indexHtml).toContain('Patch 0.31.6');
        expect(indexHtml).toContain('Patch 0.31.5');
        expect(indexHtml).toContain('Patch 0.31.4');
        expect(indexHtml).toContain('Patch 0.31.3');
        expect(indexHtml).toContain('Patch 0.31.2');
        expect(indexHtml).toContain('Patch 0.31.1');
        expect(indexHtml).toContain('Patch 0.31.0');
        expect(indexHtml).toContain('Patch 0.30.4');
        expect(indexHtml).toContain('Patch 0.30.3');
        expect(indexHtml).toContain('Patch 0.30.2');
        expect(indexHtml).toContain('Patch 0.30.1');
        expect(indexHtml).toContain('Patch 0.30.0');
        expect(indexHtml).toContain('Patch 0.29.16');
        expect(indexHtml).toContain('Patch 0.29.15');
        expect(indexHtml).toContain('Patch 0.29.14');
        expect(indexHtml).toContain('Patch 0.29.13');
        expect(indexHtml).toContain('Patch 0.29.12');
        expect(indexHtml).toContain('Patch 0.29.11');
        expect(indexHtml).toContain('Patch 0.29.10');
        expect(indexHtml).toContain('Patch 0.29.9');
        expect(indexHtml).toContain('Patch 0.29.8');
        expect(indexHtml).toContain('Patch 0.29.7');
        expect(indexHtml).toContain('Patch 0.29.6');
        expect(indexHtml).toContain('Patch 0.29.5');
        expect(indexHtml).toContain('Patch 0.29.4');
        expect(indexHtml).toContain('Patch 0.29.3');
        expect(indexHtml).toContain('Patch 0.29.2');
        expect(indexHtml).toContain('Patch 0.29.1');
        expect(indexHtml).toContain('Patch 0.29.0');
        expect(indexHtml).toContain('Patch 0.28.8');
        expect(indexHtml).toContain('Patch 0.28.7');
        expect(indexHtml).toContain('Patch 0.28.6');
        expect(indexHtml).toContain('Patch 0.28.5');
        expect(indexHtml).toContain('Patch 0.28.4');
        expect(indexHtml).toContain('Patch 0.28.3');
        expect(indexHtml).toContain('Patch 0.28.2');
        expect(indexHtml).toContain('Patch 0.28.1');
        expect(indexHtml).toContain('Patch 0.28.0');
        expect(indexHtml).toContain('Patch 0.27.9');
        expect(indexHtml).toContain('Patch 0.27.8');
        expect(indexHtml).toContain('Patch 0.27.7');
        expect(indexHtml).toContain('Patch 0.27.6');
        expect(indexHtml).toContain('Patch 0.27.5');
        expect(indexHtml).toContain('Patch 0.27.4');
        expect(indexHtml).toContain('Patch 0.27.3');
        expect(indexHtml).toContain('Patch 0.27.2');
        expect(indexHtml).toContain('Patch 0.27.1');
        expect(indexHtml).toContain('Patch 0.27.0');
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
        expect(indexHtml).toContain('data-version="0.31.38"');
        expect(indexHtml).toContain('data-version="0.31.37"');
        expect(indexHtml).toContain('data-version="0.31.36"');
        expect(indexHtml).toContain('data-version="0.31.35"');
        expect(indexHtml).toContain('data-version="0.31.34"');
        expect(indexHtml).toContain('data-version="0.31.33"');
        expect(indexHtml).toContain('data-version="0.31.32"');
        expect(indexHtml).toContain('data-version="0.31.31"');
        expect(indexHtml).toContain('data-version="0.31.30"');
        expect(indexHtml).toContain('data-version="0.31.29"');
        expect(indexHtml).toContain('data-version="0.31.28"');
        expect(indexHtml).toContain('data-version="0.31.27"');
        expect(indexHtml).toContain('data-version="0.31.26"');
        expect(indexHtml).toContain('data-version="0.31.25"');
        expect(indexHtml).toContain('data-version="0.31.24"');
        expect(indexHtml).toContain('data-version="0.31.23"');
        expect(indexHtml).toContain('data-version="0.31.22"');
        expect(indexHtml).toContain('data-version="0.31.21"');
        expect(indexHtml).toContain('data-version="0.31.20"');
        expect(indexHtml).toContain('data-version="0.31.19"');
        expect(indexHtml).toContain('data-version="0.31.18"');
        expect(indexHtml).toContain('data-version="0.31.17"');
        expect(indexHtml).toContain('data-version="0.31.16"');
        expect(indexHtml).toContain('data-version="0.31.15"');
        expect(indexHtml).toContain('data-version="0.31.14"');
        expect(indexHtml).toContain('data-version="0.31.13"');
        expect(indexHtml).toContain('data-version="0.31.12"');
        expect(indexHtml).toContain('data-version="0.31.11"');
        expect(indexHtml).toContain('data-version="0.31.10"');
        expect(indexHtml).toContain('data-version="0.31.9"');
        expect(indexHtml).toContain('data-version="0.31.8"');
        expect(indexHtml).toContain('data-version="0.31.7"');
        expect(indexHtml).toContain('data-version="0.31.6"');
        expect(indexHtml).toContain('data-version="0.31.5"');
        expect(indexHtml).toContain('data-version="0.31.4"');
        expect(indexHtml).toContain('data-version="0.31.3"');
        expect(indexHtml).toContain('data-version="0.31.2"');
        expect(indexHtml).toContain('data-version="0.31.1"');
        expect(indexHtml).toContain('data-version="0.31.0"');
        expect(indexHtml).toContain('data-version="0.30.4"');
        expect(indexHtml).toContain('data-version="0.30.3"');
        expect(indexHtml).toContain('data-version="0.30.2"');
        expect(indexHtml).toContain('data-version="0.30.1"');
        expect(indexHtml).toContain('data-version="0.30.0"');
        expect(indexHtml).toContain('data-version="0.29.16"');
        expect(indexHtml).toContain('data-version="0.29.15"');
        expect(indexHtml).toContain('data-version="0.29.14"');
        expect(indexHtml).toContain('data-version="0.29.13"');
        expect(indexHtml).toContain('data-version="0.29.12"');
        expect(indexHtml).toContain('data-version="0.29.11"');
        expect(indexHtml).toContain('data-version="0.29.10"');
        expect(indexHtml).toContain('data-version="0.29.9"');
        expect(indexHtml).toContain('data-version="0.29.8"');
        expect(indexHtml).toContain('data-version="0.29.7"');
        expect(indexHtml).toContain('data-version="0.29.6"');
        expect(indexHtml).toContain('data-version="0.29.5"');
        expect(indexHtml).toContain('data-version="0.29.4"');
        expect(indexHtml).toContain('data-version="0.29.3"');
        expect(indexHtml).toContain('data-version="0.29.2"');
        expect(indexHtml).toContain('data-version="0.29.1"');
        expect(indexHtml).toContain('data-version="0.29.0"');
        expect(indexHtml).toContain('data-version="0.28.8"');
        expect(indexHtml).toContain('data-version="0.28.7"');
        expect(indexHtml).toContain('data-version="0.28.6"');
        expect(indexHtml).toContain('data-version="0.28.5"');
        expect(indexHtml).toContain('data-version="0.28.4"');
        expect(indexHtml).toContain('data-version="0.28.3"');
        expect(indexHtml).toContain('data-version="0.28.2"');
        expect(indexHtml).toContain('data-version="0.28.1"');
        expect(indexHtml).toContain('data-version="0.28.0"');
        expect(indexHtml).toContain('data-version="0.27.9"');
        expect(indexHtml).toContain('data-version="0.27.8"');
        expect(indexHtml).toContain('data-version="0.27.7"');
        expect(indexHtml).toContain('data-version="0.27.6"');
        expect(indexHtml).toContain('data-version="0.27.5"');
        expect(indexHtml).toContain('data-version="0.27.4"');
        expect(indexHtml).toContain('data-version="0.27.3"');
        expect(indexHtml).toContain('data-version="0.27.2"');
        expect(indexHtml).toContain('data-version="0.27.1"');
        expect(indexHtml).toContain('data-version="0.27.0"');
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
