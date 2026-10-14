import { getRogueBranchPlan } from './rogueBranchRunes.js';
import { clearOfflineStatus } from '../core/OfflineDamageOverTime.js';
import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { getAbilityAoeRadius } from './abilityRadii.js';
import { resolveRogueAbilityDamage } from './rogueAbilityDamage.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

export function applyOfflineDeathSpiral(source, engine) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer) return;
    const radius = getAbilityAoeRadius('Rogue', 'Death Spiral', source);
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
        ? engine.currentDungeonLayout?.walkRects : null;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (!(target instanceof Actor) || target === source || !target.isActive || target.state === 'DEAD' ||
            !(target.stats?.hp > 0) || target.isRemote || target.isMultiplayer || target.gameEngine?.isMultiplayer ||
            target.instanceId && target.instanceId !== (source.instanceId || engine.currentInstanceId)) continue;
        const hostile = engine.isHostileActorTarget?.(target) ??
            (!target.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(target.constructor.name));
        if (!hostile) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (Math.hypot(target.position.x - source.position.x, target.position.z - source.position.z) > radius + body ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        let damage = Math.floor(resolveRogueAbilityDamage(source, 'Death Spiral') * getRogueBranchPlan('Death Spiral', source.skillRunes?.['Death Spiral']).damage);
        // Preserve the existing finisher damage and consume wounds only after
        // a real target is admitted. Area training does not increase damage.
        const consumesWounds = Object.values(source.activeSetBonuses || {}).some(set => set.specials?.deathSpiralConsume);
        if (consumesWounds) {
            for (const kind of ['bleed', 'poison']) if (target[`${kind}Timer`] > 0) {
                damage += Math.max(0, target[`${kind}TickDamage`] || 0) * Math.ceil(target[`${kind}Timer`]);
                clearOfflineStatus(target, kind);
            }
        } else if (target.bleedStacks > 0 && target.bleedTimer > 0) {
            // The authoritative model keeps one wound, even after refreshes.
            damage += Math.floor(source.stats.dexterity / 2);
            clearOfflineStatus(target, 'bleed');
            engine.floatingTextManager?.spawn('EVISCERATE!', target.position, '#ff0000');
        }
        applyOfflineAbilityHit(source, target, damage, 'Death Spiral', engine.floatingTextManager);
    }
}
