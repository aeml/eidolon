package game

import (
	"errors"
	"maps"
)

// Build choices, not copied combat stats. Points and derived stats always come
// from the character's current level and the canonical class definitions.
type LoadoutBuild struct {
	Branch      string            `json:"branch" bson:"branch"`
	TalentRanks map[string]int    `json:"talentRanks" bson:"talent_ranks"`
	SkillRunes  map[string]string `json:"skillRunes" bson:"skill_runes"`
}

func CloneLoadoutBuild(build *LoadoutBuild) *LoadoutBuild {
	if build == nil {
		return nil
	}
	return &LoadoutBuild{Branch: build.Branch, TalentRanks: maps.Clone(build.TalentRanks), SkillRunes: maps.Clone(build.SkillRunes)}
}

func CaptureLoadoutBuild(player *Entity) *LoadoutBuild {
	return CloneLoadoutBuild(&LoadoutBuild{Branch: player.SelectedBranch, TalentRanks: player.TalentRanks, SkillRunes: player.SkillRunes})
}

// Caller supplies a locked entity or detached snapshot.
func LoadoutBuildCost(player *Entity, profile EquipmentLoadout) int {
	if profile.Build == nil {
		return 0
	}
	branchChanged := player.SelectedBranch != profile.Build.Branch
	talentsChanged := !maps.Equal(player.TalentRanks, profile.Build.TalentRanks)
	if branchChanged && talentsChanged {
		return respecGoldCost(player.Level, "both")
	}
	if branchChanged {
		return respecGoldCost(player.Level, "skills")
	}
	if talentsChanged {
		return respecGoldCost(player.Level, "talents")
	}
	return 0
}

func (w *World) stageLoadoutBuild(player *Entity, profile EquipmentLoadout) (*Entity, error) {
	staged := &Entity{SubType: player.SubType, Level: player.Level, SelectedBranch: player.SelectedBranch,
		UnlockedSkills: append([]string(nil), player.UnlockedSkills...), TalentRanks: maps.Clone(player.TalentRanks), SkillRunes: maps.Clone(player.SkillRunes)}
	if profile.Build == nil {
		return staged, nil
	} // Existing gear-only presets.
	build := profile.Build
	if build.Branch != "" && build.Branch != "A" && build.Branch != "B" && build.Branch != "C" {
		return nil, errors.New("Invalid saved specialization")
	}
	staged.SelectedBranch = build.Branch
	staged.UnlockedSkills = w.getBaseSkillsForClass(player.SubType)
	w.UpdateUnlockedSkills(staged)
	staged.TalentRanks = make(map[string]int, len(build.TalentRanks))
	spent := 0
	for id, rank := range build.TalentRanks {
		normalized, valid := NormalizeTalentRank(player.SubType, id, rank)
		canonical, canonicalOK := CanonicalizeTalentID(player.SubType, id)
		if !valid || !canonicalOK || normalized != rank || staged.TalentRanks[canonical] != 0 {
			return nil, errors.New("A saved talent is invalid for this class")
		}
		staged.TalentRanks[canonical] = rank
		spent += rank
	}
	if spent > player.maxTalentPoints() {
		return nil, errors.New("This build requires more talent points than your current level provides")
	}
	staged.SkillRunes = make(map[string]string, len(build.SkillRunes))
	for skill, id := range build.SkillRunes {
		if id == "" {
			continue
		}
		valid := false
		for _, def := range GetRunesForSkill(player.SubType, skill) {
			if def.ID == id && player.Level >= def.UnlockLevel {
				valid = true
				break
			}
		}
		if !valid {
			return nil, errors.New("A saved rune is not available to this class and level")
		}
		staged.SkillRunes[skill] = id
	}
	return staged, nil
}

// A respec can invalidate an old bar; restore only skills still owned, keeping
// the chosen slot positions and intentional empty slots.
func RestoredLoadoutHotbar(player *Entity) []string {
	if player.SavedHotbar == nil {
		return nil
	}
	bar := make([]string, 4)
	for i, skill := range player.SavedHotbar[:min(4, len(player.SavedHotbar))] {
		if IsBaseClassSkill(player.SubType, skill) {
			bar[i] = skill
			continue
		}
		for _, unlocked := range player.UnlockedSkills {
			if unlocked == skill {
				bar[i] = skill
				break
			}
		}
	}
	return bar
}
