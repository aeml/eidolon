export class SkillStrategy {
    constructor(name, cooldown, resourceCost) {
        this.name = name;
        this.cooldown = cooldown;
        this.resourceCost = resourceCost;
        this.lastUsed = 0;
    }

    canExecute(owner) {
        const now = Date.now();
        if (now - this.lastUsed < this.cooldown) return false;
        // Check resource logic here (e.g. owner.stats.mana >= this.resourceCost)
        return true;
    }

    execute(owner, targetVector) {
        if (!this.canExecute(owner)) return;
        this.lastUsed = Date.now();
        this.perform(owner, targetVector);
    }

    perform(owner, targetVector) {
        console.warn('SkillStrategy.perform() must be implemented by subclass');
    }
}