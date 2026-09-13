package game

import (
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const MaxEquipmentLoadouts = 3

// A preset contains references, never duplicate item/stat snapshots.
type EquipmentLoadout struct {
	Name      string            `json:"name" bson:"name"`
	Class     string            `json:"class" bson:"class"`
	Equipment map[string]string `json:"equipment" bson:"equipment"`
	Hotbar    []string          `json:"hotbar" bson:"hotbar"`
}

func CloneEquipmentLoadouts(source []EquipmentLoadout) []EquipmentLoadout {
	if source == nil {
		return nil
	}
	result := make([]EquipmentLoadout, len(source))
	for i, profile := range source {
		result[i] = profile
		result[i].Equipment = make(map[string]string, len(profile.Equipment))
		for slot, id := range profile.Equipment {
			result[i].Equipment[slot] = id
		}
		result[i].Hotbar = append([]string(nil), profile.Hotbar...)
	}
	return result
}

// Caller holds World.Mu and the player's lock in that order.
func (w *World) loadoutAccess(player *Entity, index int) error {
	if player == nil || player.Type != TypePlayer {
		return errors.New("Character not found")
	}
	if index < 0 || index >= MaxEquipmentLoadouts {
		return errors.New("Choose one of the three loadout slots")
	}
	if player.Health <= 0 || player.State == "DEAD" {
		return errors.New("Respawn before changing loadouts")
	}
	if player.InstanceID != "" || !w.inSafeZone(player) {
		return errors.New("Return to a safe town to change loadouts")
	}
	if player.IsCharging || player.State == "JUMPING" || player.State == "ATTACKING" || player.State == "CASTING" || time.Since(player.LastAttackTime) < 10*time.Second {
		return errors.New("Finish combat before changing loadouts")
	}
	return nil
}

func (w *World) validateLoadoutHotbar(player *Entity, hotbar []string) error {
	if len(hotbar) > 4 {
		return errors.New("A loadout has four skill slots")
	}
	allowed := make(map[string]bool)
	for _, skill := range w.getBaseSkillsForClass(player.SubType) {
		allowed[skill] = true
	}
	for _, skill := range player.UnlockedSkills {
		allowed[skill] = true
	}
	for _, skill := range hotbar {
		if skill != "" && !allowed[skill] {
			return errors.New("A saved skill is not currently unlocked")
		}
	}
	return nil
}

func (w *World) SaveEquipmentLoadout(playerID string, index int, name string, hotbar []string) error {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return errors.New("Character not found")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if err := w.loadoutAccess(player, index); err != nil {
		return err
	}
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 40 || strings.IndexFunc(name, unicode.IsControl) >= 0 {
		return errors.New("Use a loadout name of 1–40 characters without control characters")
	}
	if err := w.validateLoadoutHotbar(player, hotbar); err != nil {
		return err
	}
	profile := EquipmentLoadout{Name: name, Class: player.SubType, Equipment: make(map[string]string), Hotbar: make([]string, 4)}
	copy(profile.Hotbar, hotbar)
	seen := make(map[string]bool)
	for slot, item := range player.Equipment {
		if item.ID == "" || !isEquipmentSlot(slot) {
			continue
		}
		if !activeEquipmentItem(slot, item) || item.Stack > 1 || seen[item.ID] {
			return errors.New("Recover invalid or stacked equipped items before saving a loadout")
		}
		seen[item.ID] = true
		profile.Equipment[slot] = item.ID
	}
	profiles := CloneEquipmentLoadouts(player.EquipmentLoadouts)
	for len(profiles) < MaxEquipmentLoadouts {
		profiles = append(profiles, EquipmentLoadout{})
	}
	profiles[index] = profile
	player.EquipmentLoadouts = profiles
	return nil
}

func (w *World) ApplyEquipmentLoadout(playerID string, index int) (EquipmentLoadout, error) {
	w.Mu.Lock()
	defer w.Mu.Unlock()
	player := w.Entities[playerID]
	if player == nil {
		return EquipmentLoadout{}, errors.New("Character not found")
	}
	player.Mu.Lock()
	defer player.Mu.Unlock()
	if err := w.loadoutAccess(player, index); err != nil {
		return EquipmentLoadout{}, err
	}
	if index >= len(player.EquipmentLoadouts) || player.EquipmentLoadouts[index].Name == "" {
		return EquipmentLoadout{}, errors.New("Save this loadout first")
	}
	profile := player.EquipmentLoadouts[index]
	if profile.Class != player.SubType {
		return EquipmentLoadout{}, errors.New("That loadout belongs to another class")
	}
	if err := w.validateLoadoutHotbar(player, profile.Hotbar); err != nil {
		return EquipmentLoadout{}, err
	}

	selected := make(map[string]bool)
	equipment := make(map[string]Item)
	// Preserve unsupported legacy slots for the existing recovery flow.
	for slot, item := range player.Equipment {
		if !isEquipmentSlot(slot) {
			equipment[slot] = item
		}
	}
	for slot, id := range profile.Equipment {
		if !isEquipmentSlot(slot) || id == "" || selected[id] {
			return EquipmentLoadout{}, errors.New("Invalid or duplicate loadout item reference")
		}
		var item Item
		found := 0
		currentSlot := ""
		for _, candidate := range player.Inventory {
			if candidate.ID == id {
				item = candidate
				found++
			}
		}
		for equippedSlot, candidate := range player.Equipment {
			if candidate.ID == id {
				if !isEquipmentSlot(equippedSlot) {
					return EquipmentLoadout{}, errors.New("Recover items from unsupported equipment slots before using them in a loadout")
				}
				item = candidate
				currentSlot = equippedSlot
				found++
			}
		}
		if found != 1 {
			return EquipmentLoadout{}, errors.New("A loadout item is missing or ambiguous; retrieve it from your stash or save a new loadout")
		}
		if item.Level > player.Level || item.Stack > 1 || !(itemFitsEquipmentSlot(item, slot) || currentSlot == slot && activeEquipmentItem(slot, item)) {
			return EquipmentLoadout{}, errors.New("A loadout item no longer fits its slot or level requirement")
		}
		selected[id] = true
		equipment[slot] = item
	}
	// Stage every removal before inserting displaced gear. Full-bag swaps and
	// exchanging ring1/ring2 can succeed without a temporary extra bag slot.
	inventory := cloneItems(player.Inventory)
	for i, item := range inventory {
		if selected[item.ID] {
			inventory[i] = Item{}
		}
	}
	for slot, item := range player.Equipment {
		if !isEquipmentSlot(slot) || item.ID == "" || selected[item.ID] {
			continue
		}
		placed := false
		for i := range inventory {
			if inventory[i].ID == "" {
				if item.Stack < 1 {
					item.Stack = 1
				}
				inventory[i] = item
				placed = true
				break
			}
		}
		if !placed {
			return EquipmentLoadout{}, errors.New("Free enough bag space for the equipment this loadout removes")
		}
	}
	player.Inventory = inventory
	player.Equipment = equipment
	player.EquipmentRevision++
	player.RecalculateStats() // Clamps excess resources, never heals a deficit.
	return CloneEquipmentLoadouts([]EquipmentLoadout{profile})[0], nil
}
