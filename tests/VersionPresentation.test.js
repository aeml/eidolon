import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd());
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

describe('version presentation', () => {
    test('advances the login screen to alpha 0.29.5 for the latest shipped local regen sync slice', () => {
        expect(indexHtml).toContain('Alpha 0.29.5');
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

    test('includes the latest player-facing patch notes entry for 0.29.5', () => {
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
