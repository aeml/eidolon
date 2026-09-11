package game

import "time"

type abilityImpactReaction struct {
	attackerID, instanceID string
	defender               *Entity
	reflection             int
	explosion              *impactShieldExplosion
}

// One cast/impact owns this batch. Damage and capacity changes happen while the
// receiver is locked; reactions run only at a caller-chosen lock-free boundary.
// Never share a batch with a delayed callback or another parallel update.
type abilityImpactContext struct {
	world       *World
	worldLocked bool
	reactions   []abilityImpactReaction
	// Autonomous summons use owner stats/credit but receive retaliation on
	// their own visible actor. Empty means the ordinary combat attacker ID.
	retaliationTargetID string
}

// Immediate class handlers own w.Mu. A standalone handler gets its own batch;
// PerformAbility supplies one so reactions follow all cast bookkeeping.
func (w *World) worldLockedAbilityImpacts(existing []*abilityImpactContext) (*abilityImpactContext, func()) {
	if len(existing) > 0 && existing[0] != nil {
		return existing[0], func() {}
	}
	ctx := &abilityImpactContext{world: w, worldLocked: true}
	return ctx, ctx.flush
}

func (ctx *abilityImpactContext) damage(attacker, target *Entity, base int, kind string, skills ...string) int {
	skill := ""
	if len(skills) > 0 {
		skill = skills[0]
	}
	return ctx.damageWithCritical(attacker, target, base, kind, skill, false)
}

// Caller owns target.Mu. Outgoing bonuses/PvP scaling precede receiver defenses;
// absorption is applied once, before HP damage and the caller's death handling.
func (ctx *abilityImpactContext) damageWithCritical(attacker, target *Entity, base int, kind, skill string, critical bool) int {
	if target == nil || base <= 0 {
		return 0
	}
	outgoing, _ := calculateFinalDamageWithCritical(attacker, target, base, kind, skill, critical)
	attackerID := ""
	if attacker != nil {
		attackerID = attacker.ID
	}
	return ctx.receiveDamageLocked(attackerID, target, outgoing, kind, time.Now())
}

// Stored wound budgets have already inherited their application-time damage.
// They enter here without rerolling criticals or applying outgoing bonuses a
// second time. Only receiver state/phase limits are resolved at this impact.
func (ctx *abilityImpactContext) receiveDamageLocked(attackerID string, target *Entity, outgoing int, kind string, now time.Time) int {
	if target == nil || target.State == "DEAD" || target.Health <= 0 || outgoing <= 0 {
		return 0
	}
	resolved := resolveImpactDefenseLocked(target, outgoing, now)
	damage := resolved.damage
	target.Health -= damage
	target.LastDamageType = kind
	resolved.reflection += receivedDamageReflectionLocked(target, damage, now)
	if resolved.reflection > 0 || resolved.explosion != nil {
		if ctx.retaliationTargetID != "" {
			attackerID = ctx.retaliationTargetID
		}
		ctx.reactions = append(ctx.reactions, abilityImpactReaction{attackerID: attackerID,
			instanceID: target.InstanceID, defender: target, reflection: resolved.reflection, explosion: resolved.explosion})
	}
	return damage
}

// Caller owns no actor locks and retains the declared world-lock mode. Resolve
// reflected damage against the live attacker, never an outgoing-stat snapshot.
func (ctx *abilityImpactContext) flush() {
	reactions := ctx.reactions
	ctx.reactions = nil
	for _, reaction := range reactions {
		if reaction.explosion != nil {
			ctx.world.applyImpactShieldExplosion(reaction.defender, *reaction.explosion, ctx.worldLocked)
		}
		if reaction.reflection <= 0 || reaction.attackerID == "" {
			continue
		}
		var attacker *Entity
		if ctx.worldLocked {
			attacker = ctx.world.Entities[reaction.attackerID]
		} else {
			attacker = ctx.world.GetEntity(reaction.attackerID)
		}
		if attacker != nil {
			ctx.world.applyImpactReflection(attacker, reaction.defender, reaction.reflection, reaction.instanceID, ctx.worldLocked)
		}
	}
}
