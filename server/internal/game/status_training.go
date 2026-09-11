package game

import "math"

// Raw wounds have not been scaled for a recipient. Wounds inherited from an
// actual hit retain that hit's PvP scaling; spreading them must not apply 65%
// again. Every new player recipient still gets their own maximum-HP cap.
// This budget is application-local; entity wounds store the resulting amount.
type statusDamageBudget struct {
	amount    int
	pvpScaled bool
}

func (budget statusDamageBudget) forTarget(source, target *Entity) int {
	if budget.amount <= 0 {
		return budget.amount
	}
	if budget.pvpScaled && source != nil && target != nil && source.Type == TypePlayer && target.Type == TypePlayer {
		return capPvPDamage(target, budget.amount)
	}
	return ScalePvPDamage(source, target, budget.amount)
}

// A wound stores its damage at application; ticks never reread training. Raw
// Shadow Lunge/Poison Coating damage receives generic and matching skill damage.
// Serrated Edges derives from an already-modified hit, so only its own Mastery
// is added: inherited generic, equipment, rune and critical bonuses stay once.
func trainedStatusDamage(source *Entity, skill string, amount int, inheritedHit bool) int {
	if source == nil || amount <= 0 {
		return amount
	}
	canonical := make(map[string]int)
	for id, raw := range source.TalentRanks {
		rank, valid := NormalizeTalentRank(source.SubType, id, raw)
		if !valid {
			continue
		}
		id, valid = CanonicalizeTalentID(source.SubType, id)
		if valid && rank > canonical[id] {
			canonical[id] = rank
		}
	}
	bonus := 0.0
	for id, rank := range canonical {
		def, _ := talentDefForID(source.SubType, id)
		if def.PerRank.SkillName == skill || !inheritedHit && def.PerRank.SkillName == "" {
			bonus += def.PerRank.SkillDamage * float64(rank)
		}
	}
	return int(math.Floor(float64(amount)*(1+math.Max(0, bonus)) + 1e-9))
}
