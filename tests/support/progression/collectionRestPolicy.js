// A verification route's ordinary between-encounter resource decision. Never
// interrupts an unfinished encounter or treats death as a free rest stop.
export function collectionRestReason({ hp, maxHP, mana, maxMana, castCost, dead }) {
    if (dead) return null;
    if (![hp, maxHP, mana, maxMana, castCost].every(Number.isFinite) ||
        hp <= 0 || maxHP <= 0 || hp > maxHP || mana < 0 || maxMana <= 0 ||
        mana > maxMana || castCost < 0) throw new Error('Invalid collection resource observation');
    if (mana < Math.min(maxMana, 2 * castCost)) return 'mana';
    if (hp < maxHP * .8) return 'health';
    return null;
}

// An unfinished hunt is allowed to fail and retreat through ordinary Recall.
// Keep fighting while a cast remains and health is not critical; between kills
// the more conservative policy above still prepares for the next encounter.
export function huntDisengageReason(resources) {
    collectionRestReason(resources); // Retain the same validation/death contract.
    if (resources.dead) return null;
    if (resources.mana < Math.min(resources.maxMana, resources.castCost)) return 'mana';
    if (resources.hp < resources.maxHP * .35) return 'health';
    return null;
}
