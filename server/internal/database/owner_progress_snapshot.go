package database

import (
	"encoding/json"
	"errors"
	"time"
)

var errOwnerProgressSnapshot = errors.New("owner progression snapshot could not be encoded within its budget")

// This is a prepared serializer, not an export endpoint or ownership proof.
// Callers must supply a detached character read for the proved account, hold
// the appropriate authority, and choose a response budget before enabling it.
// It cannot be used as a restore image: private replay/custody data is omitted.
// Explicit nested DTOs ensure new database fields do not become exports merely
// because someone adds them to Character, Item, Quest or their child types.
type ownerProgressSnapshot struct {
	Format      string                 `json:"format"`
	Version     int                    `json:"version"`
	GeneratedAt time.Time              `json:"generated_at"`
	Coverage    ownerExportCoverage    `json:"coverage"`
	Character   ownerCharacterSnapshot `json:"character"`
}

type ownerCharacterSnapshot struct {
	Name                 string                             `json:"name"`
	Class                string                             `json:"class"`
	Level                int                                `json:"level"`
	XP                   int                                `json:"xp"`
	ResonanceLevel       int                                `json:"resonance_level"`
	ResonanceXP          int                                `json:"resonance_xp"`
	ResonancePoints      int                                `json:"resonance_points"`
	ResonanceRanks       map[string]int                     `json:"resonance_ranks"`
	Gold                 int                                `json:"gold"`
	EP                   int                                `json:"ep"`
	Stats                ownerStatsSnapshot                 `json:"stats"`
	Resources            *ownerResourcesSnapshot            `json:"resources,omitempty"`
	WellRested           *ownerWellRestedSnapshot           `json:"well_rested,omitempty"`
	Inventory            []ownerItemSnapshot                `json:"inventory"`
	Stash                []ownerItemSnapshot                `json:"stash"`
	Buyback              []ownerItemSnapshot                `json:"buyback"`
	Equipment            map[string]ownerItemSnapshot       `json:"equipment"`
	Loadouts             []ownerLoadoutSnapshot             `json:"loadouts"`
	Hotbar               []string                           `json:"hotbar"`
	Quests               []ownerQuestSnapshot               `json:"quests"`
	SkillPoints          int                                `json:"skill_points"`
	SelectedBranch       string                             `json:"selected_branch"`
	UnlockedSkills       []string                           `json:"unlocked_skills"`
	SkillRunes           map[string]string                  `json:"skill_runes"`
	UnlockedTalents      []string                           `json:"unlocked_talents"`
	TalentRanks          map[string]int                     `json:"talent_ranks"`
	AppearanceCollection map[string]ownerAppearanceSnapshot `json:"appearance_collection"`
	Appearances          map[string]ownerAppearanceSnapshot `json:"appearances"`
}

type ownerStatsSnapshot struct {
	Strength     int `json:"strength"`
	Dexterity    int `json:"dexterity"`
	Intelligence int `json:"intelligence"`
	Wisdom       int `json:"wisdom"`
	Vitality     int `json:"vitality"`
}

type ownerResourcesSnapshot struct {
	Health int  `json:"health"`
	Mana   int  `json:"mana"`
	Dead   bool `json:"dead"`
}

type ownerWellRestedSnapshot struct {
	RemainingSeconds float64 `json:"remaining_seconds"`
}

type ownerAppearanceSnapshot struct {
	BaseName string `json:"base_name"`
	Rarity   string `json:"rarity"`
	Slot     string `json:"slot"`
}

type ownerItemSnapshot struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Type         string             `json:"type"`
	Slot         string             `json:"slot"`
	Rarity       string             `json:"rarity"`
	Level        int                `json:"level"`
	Stats        map[string]int     `json:"stats"`
	Value        int                `json:"value"`
	Description  string             `json:"description"`
	Stack        int                `json:"stack"`
	MaxStack     int                `json:"max_stack"`
	Potency      int                `json:"potency"`
	Sockets      int                `json:"sockets"`
	Gems         []ownerGemSnapshot `json:"gems"`
	SetID        string             `json:"set_id"`
	UniqueEffect string             `json:"unique_effect"`
	GemType      string             `json:"gem_type"`
	GemQuality   string             `json:"gem_quality"`
}

type ownerGemSnapshot struct {
	Type    string         `json:"type"`
	Quality string         `json:"quality"`
	Stats   map[string]int `json:"stats"`
}

type ownerLoadoutSnapshot struct {
	Name      string              `json:"name"`
	Class     string              `json:"class"`
	Equipment map[string]string   `json:"equipment"`
	Hotbar    []string            `json:"hotbar"`
	Build     *ownerBuildSnapshot `json:"build,omitempty"`
}

type ownerBuildSnapshot struct {
	Branch      string            `json:"branch"`
	TalentRanks map[string]int    `json:"talent_ranks"`
	SkillRunes  map[string]string `json:"skill_runes"`
}

type ownerQuestSnapshot struct {
	ID                 string `json:"id"`
	Type               string `json:"type"`
	Target             string `json:"target"`
	Count              int    `json:"count"`
	MaxCount           int    `json:"max_count"`
	RewardXP           int    `json:"reward_xp"`
	RewardGold         int    `json:"reward_gold"`
	GrantedGold        int    `json:"granted_gold"`
	GrantedXP          int    `json:"granted_xp"`
	GrantedResonanceXP int    `json:"granted_resonance_xp"`
	Completed          bool   `json:"completed"`
	Accepted           bool   `json:"accepted"`
	Title              string `json:"title"`
	Description        string `json:"description"`
	Lore               string `json:"lore"`
	Category           string `json:"category"`
	Chapter            int    `json:"chapter"`
	ObjectiveText      string `json:"objective_text"`
}

func snapshotOwnerItem(item Item) ownerItemSnapshot {
	gems := make([]ownerGemSnapshot, len(item.Gems))
	for i, gem := range item.Gems {
		gems[i] = ownerGemSnapshot{Type: gem.Type, Quality: gem.Quality, Stats: gem.Stats}
	}
	return ownerItemSnapshot{ID: item.ID, Name: item.Name, Type: item.Type,
		Slot: item.Slot, Rarity: item.Rarity, Level: item.Level, Stats: item.Stats,
		Value: item.Value, Description: item.Description, Stack: item.Stack,
		MaxStack: item.MaxStack, Potency: item.Potency, Sockets: item.Sockets,
		Gems: gems, SetID: item.SetID, UniqueEffect: item.UniqueEffect,
		GemType: item.GemType, GemQuality: item.GemQuality}
}

func snapshotOwnerItems(items []Item) []ownerItemSnapshot {
	result := make([]ownerItemSnapshot, len(items))
	for i, item := range items {
		result[i] = snapshotOwnerItem(item)
	}
	return result
}

func snapshotOwnerAppearances(items map[string]EquipmentAppearance) map[string]ownerAppearanceSnapshot {
	result := make(map[string]ownerAppearanceSnapshot, len(items))
	for key, item := range items {
		result[key] = ownerAppearanceSnapshot{BaseName: item.BaseName, Rarity: item.Rarity, Slot: item.Slot}
	}
	return result
}

func encodeOwnerProgressSnapshot(character *Character, generatedAt time.Time, maxBytes int) ([]byte, error) {
	if character == nil || character.Name == "" || generatedAt.IsZero() || maxBytes < 1 {
		return nil, errOwnerProgressSnapshot
	}
	snapshot := ownerCharacterSnapshot{
		Name: character.Name, Class: character.Class, Level: character.Level, XP: character.XP,
		ResonanceLevel: character.ResonanceLevel, ResonanceXP: character.ResonanceXP,
		ResonancePoints: character.ResonancePoints, ResonanceRanks: character.ResonanceRanks,
		Gold: character.Gold, EP: character.EP,
		Stats: ownerStatsSnapshot{Strength: character.Stats.Strength, Dexterity: character.Stats.Dexterity,
			Intelligence: character.Stats.Intelligence, Wisdom: character.Stats.Wisdom, Vitality: character.Stats.Vitality},
		Inventory: snapshotOwnerItems(character.Inventory), Stash: snapshotOwnerItems(character.Stash),
		Buyback: snapshotOwnerItems(character.Buyback), Equipment: make(map[string]ownerItemSnapshot, len(character.Equipment)),
		Loadouts: make([]ownerLoadoutSnapshot, len(character.EquipmentLoadouts)), Hotbar: character.SavedHotbar,
		Quests: make([]ownerQuestSnapshot, len(character.Quests)), SkillPoints: character.SkillPoints,
		SelectedBranch: character.SelectedBranch, UnlockedSkills: character.UnlockedSkills, SkillRunes: character.SkillRunes,
		UnlockedTalents: character.UnlockedTalents, TalentRanks: character.TalentRanks,
		AppearanceCollection: snapshotOwnerAppearances(character.AppearanceCollection),
		Appearances:          snapshotOwnerAppearances(character.Appearances),
	}
	for slot, item := range character.Equipment {
		snapshot.Equipment[slot] = snapshotOwnerItem(item)
	}
	if character.Resources != nil {
		snapshot.Resources = &ownerResourcesSnapshot{Health: character.Resources.Health,
			Mana: character.Resources.Mana, Dead: character.Resources.Dead}
	}
	if character.WellRested != nil {
		snapshot.WellRested = &ownerWellRestedSnapshot{RemainingSeconds: character.WellRested.RemainingSeconds}
	}
	for i, loadout := range character.EquipmentLoadouts {
		exported := ownerLoadoutSnapshot{Name: loadout.Name, Class: loadout.Class,
			Equipment: loadout.Equipment, Hotbar: loadout.Hotbar}
		if loadout.Build != nil {
			exported.Build = &ownerBuildSnapshot{Branch: loadout.Build.Branch,
				TalentRanks: loadout.Build.TalentRanks, SkillRunes: loadout.Build.SkillRunes}
		}
		snapshot.Loadouts[i] = exported
	}
	for i, quest := range character.Quests {
		snapshot.Quests[i] = ownerQuestSnapshot{ID: quest.ID, Type: quest.Type,
			Target: quest.Target, Count: quest.Count, MaxCount: quest.MaxCount,
			RewardXP: quest.RewardXP, RewardGold: quest.RewardGold,
			GrantedGold: quest.GrantedGold, GrantedXP: quest.GrantedXP, GrantedResonanceXP: quest.GrantedResonanceXP,
			Completed: quest.Completed, Accepted: quest.Accepted, Title: quest.Title,
			Description: quest.Description, Lore: quest.Lore, Category: quest.Category,
			Chapter: quest.Chapter, ObjectiveText: quest.ObjectiveText}
	}
	encoded, err := json.Marshal(ownerProgressSnapshot{
		Format: "eidolon-owner-progression", Version: 1, GeneratedAt: generatedAt.UTC(), Coverage: ownerSectionCoverage("progress"), Character: snapshot,
	})
	// This bounds the returned response, not total serializer allocations. The
	// eventual reader/admission path also needs its own workload and input bounds.
	if err != nil || len(encoded) > maxBytes {
		return nil, errOwnerProgressSnapshot // Never return partial output or diagnostics containing data.
	}
	return encoded, nil
}
