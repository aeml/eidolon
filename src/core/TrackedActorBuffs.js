import { wellRestedBuff } from './WellRested.js';

// Pure actor-derived descriptions shared by desktop and phone status views.
// Lifetime bookkeeping remains owned by GameEngine's active-buff tracker.
export function getTrackedActorBuffs(actor) {
    if (!actor) return [];
    return [
        wellRestedBuff(actor),
        {
            id: 'iron_fortress',
            active: Number.isFinite(Number(actor.ironFortressTimer)) && Number(actor.ironFortressTimer) > 0,
            icon: '🛡️',
            name: 'Iron Fortress',
            durationSeconds: Number(actor.ironFortressTimer || 0),
            // Protection strength is not replicated here; do not display
            // the offline actor's default zero as the server's reduction.
            detail: 'Damage reduction active',
            isDebuff: false
        },
        {
            id: 'guardian_roar',
            active: Number(actor.guardianRoarTimer) > 0,
            icon: '🛡️',
            name: 'Guardian Roar',
            durationSeconds: Number(actor.guardianRoarTimer || 0),
            detail: `${Math.round(Number(actor.guardianRoarReduction || 0) * 100)}% damage reduction`,
            isDebuff: false
        },
        {
            id: 'blessing_resolve',
            active: Number(actor.blessingResolveTimer) > 0,
            icon: '✝️',
            name: 'Blessing of Resolve',
            durationSeconds: Number(actor.blessingResolveTimer || 0),
            detail: `${Math.round(Number(actor.blessingResolveReduction || 0) * 100)}% damage reduction`,
            isDebuff: false
        },
        {
            id: 'divine_intervention',
            active: Boolean(actor.divineInterventionActive) && Number(actor.divineInterventionTimer || 0) > 0,
            icon: '🪽',
            name: 'Divine Intervention',
            durationSeconds: Number(actor.divineInterventionTimer || 0),
            detail: 'Fatal damage prevention active',
            isDebuff: false
        },
        {
            id: 'blessing_zeal',
            active: Number(actor.blessingZealTimer) > 0,
            icon: '✨',
            name: 'Blessing of Zeal',
            durationSeconds: Number(actor.blessingZealTimer || 0),
            detail: `+${Math.round(Number(actor.blessingZealFactor || 0) * 100)}% damage and healing`,
            isDebuff: false
        },
        {
            id: 'spell_focus',
            active: Boolean(actor.spellFocusActive) && Number(actor.spellFocusTimer || 0) > 0,
            icon: '🔮',
            name: 'Spell Focus',
            durationSeconds: Number(actor.spellFocusTimer || 0),
            detail: `+${Math.round((Number(actor.spellFocusMultiplier || 1) - 1) * 100)}% next spell damage`,
            isDebuff: false
        },
        {
            id: 'time_warp',
            active: Number(actor.hasteTimer) > 0,
            icon: '⏩',
            name: 'Time Warp',
            durationSeconds: Number(actor.hasteTimer || 0),
            detail: `+${Math.round(Number(actor.hasteFactor || 0) * 100)}% haste`,
            isDebuff: false
        },
        {
            id: 'invulnerable',
            active: actor.state !== 'DEAD' && Math.max(actor.invulnerabilityTimer || 0, actor.teleportPhaseTimer || 0) > 0,
            icon: '✧', name: 'Protected',
            durationSeconds: Math.max(actor.invulnerabilityTimer || 0, actor.teleportPhaseTimer || 0),
            detail: 'Temporarily immune to damage', isDebuff: false
        },
        {
            id: 'arcane_shield',
            active: Number(actor.shieldHP) > 0,
            icon: '🔷',
            name: 'Arcane Shield',
            durationSeconds: Number(actor.arcaneShieldTimer || 0),
            detail: `${Math.round(Number(actor.shieldHP || 0))} shield remaining`,
            isDebuff: false
        },
        {
            id: 'vanish',
            active: Number(actor.speedBoostTimer) > 0,
            icon: '💨',
            name: 'Vanish',
            durationSeconds: Number(actor.speedBoostTimer || 0),
            detail: `+${Math.round(Number(actor.speedBoostFactor || 0) * 100)}% speed`,
            isDebuff: false
        },
        {
            id: 'last_stand',
            active: Number(actor.lastStandTimer) > 0,
            icon: '🔥',
            name: 'Last Stand',
            durationSeconds: Number(actor.lastStandTimer || 0),
            detail: `+${Math.round(Number(actor.lastStandDamageBoost || 0) * 100)}% Damage stat`,
            isDebuff: false
        },
        {
            id: 'berserker_edge',
            active: Number(actor.berserkerEdgeTimer) > 0,
            icon: '🔥',
            name: 'Berserker Edge',
            durationSeconds: Number(actor.berserkerEdgeTimer || 0),
            detail: `+${Math.round((Number(actor.berserkerEdgeMultiplier || 1.5) - 1) * 100)}% Damage stat; -20% defense`,
            isDebuff: false
        },
        {
            id: 'swift',
            active: Number(actor.swiftBuffTimer) > 0,
            icon: '⚡',
            name: 'Swift',
            durationSeconds: Number(actor.swiftBuffTimer || 0),
            detail: '+20% move speed',
            isDebuff: false
        },
        {
            id: 'weak_point',
            active: Number(actor.weakPointMarkTimer) > 0,
            icon: '🎯',
            name: 'Weak Point',
            durationSeconds: Number(actor.weakPointMarkTimer || 0),
            detail: 'Vulnerable to piercing throw',
            isDebuff: true
        },
        {
            id: 'mark_weakness',
            active: Number(actor.markWeaknessTimer) > 0,
            icon: '🎯',
            name: 'Marked',
            durationSeconds: Number(actor.markWeaknessTimer || 0),
            detail: Number(actor.markWeaknessFactor || 0) > 0 ? `+${Math.round(Number(actor.markWeaknessFactor || 0) * 100)}% damage taken` : 'Damage taken increased',
            isDebuff: true
        },
        {
            id: 'bleed',
            active: Number(actor.bleedTimer) > 0,
            icon: '🩸',
            name: 'Bleeding',
            durationSeconds: Number(actor.bleedTimer || 0),
            detail: Number(actor.bleedTickDamage || 0) > 0
                ? `${Math.round(Number(actor.bleedTickDamage || 0))} bleed per tick`
                : `${Math.max(1, Math.round(Number(actor.bleedStacks || 0)))} bleed stacks`,
            isDebuff: true
        },
        {
            id: 'poison',
            active: Number(actor.poisonTimer) > 0,
            icon: '☠️',
            name: 'Poisoned',
            durationSeconds: Number(actor.poisonTimer || 0),
            detail: Number(actor.poisonTickDamage || 0) > 0
                ? `${Math.round(Number(actor.poisonTickDamage || 0))} poison per tick`
                : `${Math.max(1, Math.round(Number(actor.poisonStacks || 0)))} poison stacks`,
            isDebuff: true
        },
        {
            id: 'root',
            active: Number(actor.rootTimer) > 0,
            icon: '🪤',
            name: 'Rooted',
            durationSeconds: Number(actor.rootTimer || 0),
            detail: 'Movement locked',
            isDebuff: true
        },
        {
            id: 'slow',
            active: Number(actor.slowTimer) > 0,
            icon: '🐢',
            name: 'Slowed',
            durationSeconds: Number(actor.slowTimer || 0),
            detail: `${Math.round(Number(actor.slowFactor || 0) * 100)}% slow`,
            isDebuff: true
        },
        {
            id: 'spirit_guardians',
            active: Boolean(actor.spiritsActive) && Number(actor.spiritDuration) > 0,
            icon: '👻',
            name: 'Spirit Guardians',
            durationSeconds: Number(actor.spiritDuration || 0),
            detail: actor.spiritBoosted ? 'Boosted guardians active' : 'Guardians active',
            isDebuff: false
        }
    ];
}
