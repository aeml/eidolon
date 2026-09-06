package main

import (
	"encoding/json"
	"math"
	"sort"
	"sync"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
	statepb "eidolon-server/internal/proto"

	"google.golang.org/protobuf/proto"
)

func socketedGemsFromDatabase(gems []database.SocketedGem) []game.SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]game.SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, game.SocketedGem{
			Type:    game.GemType(gem.Type),
			Quality: game.GemQuality(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func socketedGemsToDatabase(gems []game.SocketedGem) []database.SocketedGem {
	if len(gems) == 0 {
		return nil
	}
	converted := make([]database.SocketedGem, 0, len(gems))
	for _, gem := range gems {
		converted = append(converted, database.SocketedGem{
			Type:    string(gem.Type),
			Quality: string(gem.Quality),
			Stats:   gem.Stats,
		})
	}
	return converted
}

func entityToSnapshot(e *game.Entity) *EntitySnapshot {
	if e == nil {
		return nil
	}

	e.Mu.RLock()
	keys := 0
	spent := 0
	for tid, r := range e.TalentRanks {
		nr, ok := game.NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		keys++
		spent += nr
	}
	derivedTalentPoints := 0
	if e.Level >= 5 {
		derivedTalentPoints = (e.Level / 5) - spent
		if derivedTalentPoints < 0 {
			derivedTalentPoints = 0
		}
	}
	stunDuration := 0.0
	if e.Stunned {
		stunDuration = time.Until(e.StunEndTime).Seconds()
		if stunDuration < 0 {
			stunDuration = 0
		}
	}
	slowDuration := 0.0
	if e.Slowed {
		slowDuration = time.Until(e.SlowEndTime).Seconds()
		if slowDuration < 0 {
			slowDuration = 0
		}
	}
	rootDuration := 0.0
	if e.Rooted {
		rootDuration = time.Until(e.RootEndTime).Seconds()
		if rootDuration < 0 {
			rootDuration = 0
		}
	}
	bleedDuration := 0.0
	bleedDamage := 0
	if e.Bleeding {
		bleedDuration = time.Until(e.BleedEndTime).Seconds()
		if bleedDuration < 0 {
			bleedDuration = 0
		}
		if e.BleedDamage > 0 {
			bleedDamage = e.BleedDamage
		}
	}
	poisonDuration := 0.0
	poisonDamage := 0
	if e.Poisoned {
		poisonDuration = time.Until(e.PoisonEndTime).Seconds()
		if poisonDuration < 0 {
			poisonDuration = 0
		}
		if e.PoisonDamage > 0 {
			poisonDamage = e.PoisonDamage
		}
	}
	weakPointDuration := 0.0
	if e.WeakPointMarked {
		weakPointDuration = time.Until(e.WeakPointEndTime).Seconds()
		if weakPointDuration < 0 {
			weakPointDuration = 0
		}
	}
	markWeaknessDuration := 0.0
	if e.MarkWeakness {
		markWeaknessDuration = time.Until(e.MarkWeaknessEndTime).Seconds()
		if markWeaknessDuration < 0 {
			markWeaknessDuration = 0
		}
	}
	spiritDuration := 0.0
	if e.SpiritsActive {
		spiritDuration = time.Until(e.SpiritEndTime).Seconds()
		if spiritDuration < 0 {
			spiritDuration = 0
		}
	}
	blessingResolveDuration := 0.0
	if e.BlessingResolveActive {
		blessingResolveDuration = time.Until(e.BlessingResolveEndTime).Seconds()
		if blessingResolveDuration < 0 {
			blessingResolveDuration = 0
		}
	}
	timeWarpDuration := 0.0
	if e.TimeWarpActive {
		timeWarpDuration = time.Until(e.TimeWarpEndTime).Seconds()
		if timeWarpDuration < 0 {
			timeWarpDuration = 0
		}
	}
	guardianEmbraceDuration := 0.0
	if e.GuardianEmbraceActive {
		guardianEmbraceDuration = time.Until(e.GuardianEmbraceEndTime).Seconds()
		if guardianEmbraceDuration < 0 {
			guardianEmbraceDuration = 0
		}
	}
	arcaneShieldDuration := 0.0
	if e.ArcaneShieldActive && e.ArcaneShieldHP > 0 {
		arcaneShieldDuration = time.Until(e.ArcaneShieldEndTime).Seconds()
		if arcaneShieldDuration < 0 {
			arcaneShieldDuration = 0
		}
	}
	divineInterventionDuration := 0.0
	if e.DivineInterventionActive {
		divineInterventionDuration = time.Until(e.DivineInterventionEndTime).Seconds()
		if divineInterventionDuration < 0 {
			divineInterventionDuration = 0
		}
	}
	spellFocusDuration := 0.0
	if e.SpellFocusActive {
		spellFocusDuration = time.Until(e.SpellFocusEndTime).Seconds()
		if spellFocusDuration < 0 {
			spellFocusDuration = 0
		}
	}
	swiftDuration := 0.0
	if e.SwiftActive {
		swiftDuration = time.Until(e.SwiftEndTime).Seconds()
		if swiftDuration < 0 {
			swiftDuration = 0
		}
	}
	ironFortressDuration := 0.0
	if e.IronFortressActive {
		ironFortressDuration = time.Until(e.IronFortressEndTime).Seconds()
		if ironFortressDuration < 0 {
			ironFortressDuration = 0
		}
	}
	guardianRoarDuration := 0.0
	if e.GuardianRoarActive {
		guardianRoarDuration = time.Until(e.GuardianRoarEndTime).Seconds()
		if guardianRoarDuration < 0 {
			guardianRoarDuration = 0
		}
	}
	berserkerModeDuration := 0.0
	if e.BerserkerModeActive {
		berserkerModeDuration = time.Until(e.BerserkerModeEndTime).Seconds()
		if berserkerModeDuration < 0 {
			berserkerModeDuration = 0
		}
	}
	lastStandDuration := 0.0
	if e.LastStandActive {
		lastStandDuration = time.Until(e.LastStandEndTime).Seconds()
		if lastStandDuration < 0 {
			lastStandDuration = 0
		}
	}
	serratedEdgesDuration := 0.0
	if e.SerratedEdgesActive {
		serratedEdgesDuration = time.Until(e.SerratedEdgesEndTime).Seconds()
		if serratedEdgesDuration < 0 {
			serratedEdgesDuration = 0
		}
	}
	poisonCoatingDuration := 0.0
	if e.PoisonCoatingActive {
		poisonCoatingDuration = time.Until(e.PoisonCoatingEndTime).Seconds()
		if poisonCoatingDuration < 0 {
			poisonCoatingDuration = 0
		}
	}
	stealthDuration := 0.0
	if e.StealthActive {
		stealthDuration = time.Until(e.StealthEndTime).Seconds()
		if stealthDuration < 0 {
			stealthDuration = 0
		}
	}
	zealDuration := 0.0
	if e.ZealActive {
		zealDuration = time.Until(e.ZealEndTime).Seconds()
		if zealDuration < 0 {
			zealDuration = 0
		}
	}

	whirlwindDuration := e.WhirlwindRemaining(time.Now())
	snap := &EntitySnapshot{
		WhirlwindActive:            whirlwindDuration > 0,
		WhirlwindDuration:          whirlwindDuration,
		X:                          e.X,
		Z:                          e.Z,
		Y:                          e.Y,
		Rotation:                   e.Rotation,
		Health:                     e.Health,
		MaxHealth:                  e.MaxHealth,
		Mana:                       e.Mana,
		State:                      e.State,
		Level:                      e.Level,
		Scale:                      e.Scale,
		BodyRadius:                 e.ReplicatedBodyRadius(),
		IsCharging:                 e.IsCharging,
		SpiritsActive:              e.SpiritsActive,
		SpiritsBoosted:             e.SpiritsBoosted,
		GuardianEmbraceActive:      e.GuardianEmbraceActive,
		BlessingResolveActive:      e.BlessingResolveActive,
		DivineInterventionActive:   e.DivineInterventionActive,
		ArcaneShieldActive:         e.ArcaneShieldActive,
		ArcaneShieldHP:             e.ArcaneShieldHP,
		TimeWarpActive:             e.TimeWarpActive,
		SpellFocusActive:           e.SpellFocusActive,
		SwiftActive:                e.SwiftActive,
		IronFortressActive:         e.IronFortressActive,
		GuardianRoarActive:         e.GuardianRoarActive,
		BerserkerModeActive:        e.BerserkerModeActive,
		LastStandActive:            e.LastStandActive,
		SerratedEdgesActive:        e.SerratedEdgesActive,
		PoisonCoatingActive:        e.PoisonCoatingActive,
		StealthActive:              e.StealthActive,
		ZealActive:                 e.ZealActive,
		Stunned:                    e.Stunned,
		StunDuration:               stunDuration,
		Slowed:                     e.Slowed,
		SlowFactor:                 e.SlowFactor,
		SlowDuration:               slowDuration,
		Rooted:                     e.Rooted,
		RootDuration:               rootDuration,
		Bleeding:                   e.Bleeding,
		BleedDuration:              bleedDuration,
		BleedDamage:                bleedDamage,
		Poisoned:                   e.Poisoned,
		PoisonDuration:             poisonDuration,
		PoisonDamage:               poisonDamage,
		WeakPointMarked:            e.WeakPointMarked,
		WeakPointDuration:          weakPointDuration,
		MarkWeakness:               e.MarkWeakness,
		MarkWeaknessDuration:       markWeaknessDuration,
		SpiritDuration:             spiritDuration,
		BlessingResolveDuration:    blessingResolveDuration,
		TimeWarpDuration:           timeWarpDuration,
		GuardianEmbraceDuration:    guardianEmbraceDuration,
		ArcaneShieldDuration:       arcaneShieldDuration,
		DivineInterventionDuration: divineInterventionDuration,
		SpellFocusDuration:         spellFocusDuration,
		SwiftDuration:              swiftDuration,
		IronFortressDuration:       ironFortressDuration,
		GuardianRoarDuration:       guardianRoarDuration,
		BerserkerModeDuration:      berserkerModeDuration,
		LastStandDuration:          lastStandDuration,
		SerratedEdgesDuration:      serratedEdgesDuration,
		PoisonCoatingDuration:      poisonCoatingDuration,
		StealthDuration:            stealthDuration,
		ZealDuration:               zealDuration,
		JumpProgress:               e.JumpProgress,
		TalentPoints:               derivedTalentPoints,
		TalentKeys:                 keys,
		TalentSpent:                spent,
		PartyID:                    e.PartyID,
		SocialStatus:               e.SocialStatus,
		GuildID:                    e.GuildID,
		GuildTag:                   e.GuildTag,
		EquipmentRevision:          e.EquipmentRevision,
	}
	e.Mu.RUnlock()

	return snap
}

// hasEntityChanged checks if entity state differs from last snapshot
// Returns true if any tracked field changed significantly
func hasEntityChanged(current *game.Entity, last *EntitySnapshot) bool {
	// Snapshot current values under lock to avoid races (TalentRanks is a map).
	current.Mu.RLock()
	cx := current.X
	cz := current.Z
	cy := current.Y
	crot := current.Rotation
	chealth := current.Health
	cmaxHealth := current.MaxHealth
	cmana := current.Mana
	cstate := current.State
	clevel := current.Level
	cscale := current.Scale
	cbodyRadius := current.ReplicatedBodyRadius()
	cisCharging := current.IsCharging
	cspiritsActive := current.SpiritsActive
	cwhirlwindDuration := current.WhirlwindRemaining(time.Now())
	cwhirlwindActive := cwhirlwindDuration > 0
	cspiritsBoosted := current.SpiritsBoosted
	cguardianEmbraceActive := current.GuardianEmbraceActive
	cblessingResolveActive := current.BlessingResolveActive
	cdivineInterventionActive := current.DivineInterventionActive
	carcaneShieldActive := current.ArcaneShieldActive
	carcaneShieldHP := current.ArcaneShieldHP
	ctimeWarpActive := current.TimeWarpActive
	cspellFocusActive := current.SpellFocusActive
	cswiftActive := current.SwiftActive
	cironFortressActive := current.IronFortressActive
	cguardianRoarActive := current.GuardianRoarActive
	cberserkerModeActive := current.BerserkerModeActive
	clastStandActive := current.LastStandActive
	cserratedEdgesActive := current.SerratedEdgesActive
	cpoisonCoatingActive := current.PoisonCoatingActive
	cstealthActive := current.StealthActive
	czealActive := current.ZealActive
	cstunned := current.Stunned
	cstunDuration := 0.0
	if cstunned {
		cstunDuration = time.Until(current.StunEndTime).Seconds()
		if cstunDuration < 0 {
			cstunDuration = 0
		}
	}
	cslowed := current.Slowed
	cslowFactor := current.SlowFactor
	cslowDuration := 0.0
	if cslowed {
		cslowDuration = time.Until(current.SlowEndTime).Seconds()
		if cslowDuration < 0 {
			cslowDuration = 0
		}
	}
	crooted := current.Rooted
	crootDuration := 0.0
	if crooted {
		crootDuration = time.Until(current.RootEndTime).Seconds()
		if crootDuration < 0 {
			crootDuration = 0
		}
	}
	cbleeding := current.Bleeding
	cbleedDuration := 0.0
	cbleedDamage := 0
	if cbleeding {
		cbleedDuration = time.Until(current.BleedEndTime).Seconds()
		if cbleedDuration < 0 {
			cbleedDuration = 0
		}
		if current.BleedDamage > 0 {
			cbleedDamage = current.BleedDamage
		}
	}
	cpoisoned := current.Poisoned
	cpoisonDuration := 0.0
	cpoisonDamage := 0
	if cpoisoned {
		cpoisonDuration = time.Until(current.PoisonEndTime).Seconds()
		if cpoisonDuration < 0 {
			cpoisonDuration = 0
		}
		if current.PoisonDamage > 0 {
			cpoisonDamage = current.PoisonDamage
		}
	}
	cweakPointMarked := current.WeakPointMarked
	cweakPointDuration := 0.0
	if cweakPointMarked {
		cweakPointDuration = time.Until(current.WeakPointEndTime).Seconds()
		if cweakPointDuration < 0 {
			cweakPointDuration = 0
		}
	}
	cmarkWeakness := current.MarkWeakness
	cmarkWeaknessDuration := 0.0
	if cmarkWeakness {
		cmarkWeaknessDuration = time.Until(current.MarkWeaknessEndTime).Seconds()
		if cmarkWeaknessDuration < 0 {
			cmarkWeaknessDuration = 0
		}
	}
	cspiritDuration := 0.0
	if cspiritsActive {
		cspiritDuration = time.Until(current.SpiritEndTime).Seconds()
		if cspiritDuration < 0 {
			cspiritDuration = 0
		}
	}
	cblessingResolveDuration := 0.0
	if cblessingResolveActive {
		cblessingResolveDuration = time.Until(current.BlessingResolveEndTime).Seconds()
		if cblessingResolveDuration < 0 {
			cblessingResolveDuration = 0
		}
	}
	ctimeWarpDuration := 0.0
	if ctimeWarpActive {
		ctimeWarpDuration = time.Until(current.TimeWarpEndTime).Seconds()
		if ctimeWarpDuration < 0 {
			ctimeWarpDuration = 0
		}
	}
	cguardianEmbraceDuration := 0.0
	if cguardianEmbraceActive {
		cguardianEmbraceDuration = time.Until(current.GuardianEmbraceEndTime).Seconds()
		if cguardianEmbraceDuration < 0 {
			cguardianEmbraceDuration = 0
		}
	}
	carcaneShieldDuration := 0.0
	if carcaneShieldActive && carcaneShieldHP > 0 {
		carcaneShieldDuration = time.Until(current.ArcaneShieldEndTime).Seconds()
		if carcaneShieldDuration < 0 {
			carcaneShieldDuration = 0
		}
	}
	cdivineInterventionDuration := 0.0
	if cdivineInterventionActive {
		cdivineInterventionDuration = time.Until(current.DivineInterventionEndTime).Seconds()
		if cdivineInterventionDuration < 0 {
			cdivineInterventionDuration = 0
		}
	}
	cspellFocusDuration := 0.0
	if cspellFocusActive {
		cspellFocusDuration = time.Until(current.SpellFocusEndTime).Seconds()
		if cspellFocusDuration < 0 {
			cspellFocusDuration = 0
		}
	}
	cswiftDuration := 0.0
	if cswiftActive {
		cswiftDuration = time.Until(current.SwiftEndTime).Seconds()
		if cswiftDuration < 0 {
			cswiftDuration = 0
		}
	}
	cironFortressDuration := 0.0
	if cironFortressActive {
		cironFortressDuration = time.Until(current.IronFortressEndTime).Seconds()
		if cironFortressDuration < 0 {
			cironFortressDuration = 0
		}
	}
	cguardianRoarDuration := 0.0
	if cguardianRoarActive {
		cguardianRoarDuration = time.Until(current.GuardianRoarEndTime).Seconds()
		if cguardianRoarDuration < 0 {
			cguardianRoarDuration = 0
		}
	}
	cberserkerModeDuration := 0.0
	if cberserkerModeActive {
		cberserkerModeDuration = time.Until(current.BerserkerModeEndTime).Seconds()
		if cberserkerModeDuration < 0 {
			cberserkerModeDuration = 0
		}
	}
	clastStandDuration := 0.0
	if clastStandActive {
		clastStandDuration = time.Until(current.LastStandEndTime).Seconds()
		if clastStandDuration < 0 {
			clastStandDuration = 0
		}
	}
	cserratedEdgesDuration := 0.0
	if cserratedEdgesActive {
		cserratedEdgesDuration = time.Until(current.SerratedEdgesEndTime).Seconds()
		if cserratedEdgesDuration < 0 {
			cserratedEdgesDuration = 0
		}
	}
	cpoisonCoatingDuration := 0.0
	if cpoisonCoatingActive {
		cpoisonCoatingDuration = time.Until(current.PoisonCoatingEndTime).Seconds()
		if cpoisonCoatingDuration < 0 {
			cpoisonCoatingDuration = 0
		}
	}
	cstealthDuration := 0.0
	if cstealthActive {
		cstealthDuration = time.Until(current.StealthEndTime).Seconds()
		if cstealthDuration < 0 {
			cstealthDuration = 0
		}
	}
	czealDuration := 0.0
	if czealActive {
		czealDuration = time.Until(current.ZealEndTime).Seconds()
		if czealDuration < 0 {
			czealDuration = 0
		}
	}
	ctalentPoints := current.TalentPoints
	cjumpProgress := current.JumpProgress
	ctalentKeys := 0
	ctalentSpent := 0
	for tid, r := range current.TalentRanks {
		nr, ok := game.NormalizeTalentRank(current.SubType, tid, r)
		if !ok {
			continue
		}
		ctalentKeys++
		ctalentSpent += nr
	}
	// Compute derived points for comparison (don't depend on stored field).
	ctalentPoints = 0
	if clevel >= 5 {
		ctalentPoints = (clevel / 5) - ctalentSpent
		if ctalentPoints < 0 {
			ctalentPoints = 0
		}
	}
	cpartyID := current.PartyID
	csocialStatus := current.SocialStatus
	cguildID := current.GuildID
	cguildTag := current.GuildTag
	cequipmentRevision := current.EquipmentRevision
	current.Mu.RUnlock()

	if cscale != last.Scale || cbodyRadius != last.BodyRadius {
		return true
	}

	// Position change threshold (0.05 units = basically any movement)
	const posTolerance = 0.05
	dx := cx - last.X
	dz := cz - last.Z
	dy := cy - last.Y
	if dx*dx+dz*dz > posTolerance*posTolerance || dy*dy > posTolerance*posTolerance {
		return true
	}

	// Rotation change threshold (~3 degrees)
	const rotTolerance = 0.05
	dr := crot - last.Rotation
	if dr > rotTolerance || dr < -rotTolerance {
		return true
	}

	// Health/Mana changes are always significant
	if chealth != last.Health || cmaxHealth != last.MaxHealth {
		return true
	}
	if cmana != last.Mana {
		return true
	}

	// Talent changes are significant (UI needs timely updates)
	if ctalentPoints != last.TalentPoints || ctalentKeys != last.TalentKeys || ctalentSpent != last.TalentSpent {
		return true
	}

	// State changes are always significant
	if cstate != last.State {
		return true
	}
	if cstate == "JUMPING" && math.Abs(cjumpProgress-last.JumpProgress) > 0.01 {
		return true
	}

	// Charging state changes are always significant
	if cisCharging != last.IsCharging {
		return true
	}
	if cspiritsActive != last.SpiritsActive {
		return true
	}
	if cwhirlwindActive != last.WhirlwindActive || math.Abs(cwhirlwindDuration-last.WhirlwindDuration) > 0.05 {
		return true
	}
	if cspiritsBoosted != last.SpiritsBoosted {
		return true
	}
	if cguardianEmbraceActive != last.GuardianEmbraceActive {
		return true
	}
	if cblessingResolveActive != last.BlessingResolveActive {
		return true
	}
	if cdivineInterventionActive != last.DivineInterventionActive {
		return true
	}
	if carcaneShieldActive != last.ArcaneShieldActive || carcaneShieldHP != last.ArcaneShieldHP {
		return true
	}
	if ctimeWarpActive != last.TimeWarpActive {
		return true
	}
	if cweakPointMarked != last.WeakPointMarked {
		return true
	}
	if cmarkWeakness != last.MarkWeakness {
		return true
	}
	if cspellFocusActive != last.SpellFocusActive {
		return true
	}
	if cswiftActive != last.SwiftActive {
		return true
	}
	if cironFortressActive != last.IronFortressActive ||
		cguardianRoarActive != last.GuardianRoarActive ||
		cberserkerModeActive != last.BerserkerModeActive ||
		clastStandActive != last.LastStandActive ||
		cserratedEdgesActive != last.SerratedEdgesActive ||
		cpoisonCoatingActive != last.PoisonCoatingActive ||
		cstealthActive != last.StealthActive ||
		czealActive != last.ZealActive {
		return true
	}
	if cpartyID != last.PartyID || csocialStatus != last.SocialStatus || cguildID != last.GuildID || cguildTag != last.GuildTag {
		return true
	}
	if cequipmentRevision != last.EquipmentRevision {
		return true
	}
	if cstunned != last.Stunned || math.Abs(cstunDuration-last.StunDuration) > 0.05 || cslowed != last.Slowed || math.Abs(cslowFactor-last.SlowFactor) > 0.0001 || math.Abs(cslowDuration-last.SlowDuration) > 0.05 || crooted != last.Rooted || math.Abs(crootDuration-last.RootDuration) > 0.05 || cbleeding != last.Bleeding || math.Abs(cbleedDuration-last.BleedDuration) > 0.05 || cbleedDamage != last.BleedDamage || cpoisoned != last.Poisoned || math.Abs(cpoisonDuration-last.PoisonDuration) > 0.05 || cpoisonDamage != last.PoisonDamage || math.Abs(cweakPointDuration-last.WeakPointDuration) > 0.05 || math.Abs(cmarkWeaknessDuration-last.MarkWeaknessDuration) > 0.05 || math.Abs(cspiritDuration-last.SpiritDuration) > 0.05 || math.Abs(cblessingResolveDuration-last.BlessingResolveDuration) > 0.05 || math.Abs(ctimeWarpDuration-last.TimeWarpDuration) > 0.05 || math.Abs(cguardianEmbraceDuration-last.GuardianEmbraceDuration) > 0.05 || math.Abs(carcaneShieldDuration-last.ArcaneShieldDuration) > 0.05 || math.Abs(cdivineInterventionDuration-last.DivineInterventionDuration) > 0.05 || math.Abs(cspellFocusDuration-last.SpellFocusDuration) > 0.05 || math.Abs(cswiftDuration-last.SwiftDuration) > 0.05 || math.Abs(cironFortressDuration-last.IronFortressDuration) > 0.05 || math.Abs(cguardianRoarDuration-last.GuardianRoarDuration) > 0.05 || math.Abs(cberserkerModeDuration-last.BerserkerModeDuration) > 0.05 || math.Abs(clastStandDuration-last.LastStandDuration) > 0.05 || math.Abs(cserratedEdgesDuration-last.SerratedEdgesDuration) > 0.05 || math.Abs(cpoisonCoatingDuration-last.PoisonCoatingDuration) > 0.05 || math.Abs(cstealthDuration-last.StealthDuration) > 0.05 || math.Abs(czealDuration-last.ZealDuration) > 0.05 {
		return true
	}

	return false
}

func broadcastState() {
	const stateBroadcastRadius = 200.0

	// 1. Copy active sessions to minimize lock time
	sessionsMu.Lock()
	clients := make([]*Client, 0, len(activeSessions))
	for _, client := range activeSessions {
		if client.playerID != "" {
			clients = append(clients, client)
		}
	}
	sessionsMu.Unlock()

	// 2. Process in parallel
	var wg sync.WaitGroup

	for _, client := range clients {
		wg.Add(1)
		go func(c *Client) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					// Client likely disconnected
				}
			}()

			// Keep actors known well outside the camera so jump visuals can start
			// before a remote jumper enters the local player's visible area.
			currentState := world.GetStateForPlayer(c.playerID, stateBroadcastRadius)
			playerEntity := world.GetEntityCopy(c.playerID)
			if playerEntity != nil && playerEntity.InstanceID != "" {
				world.UpdateDungeonRoomProgress(c.playerID, playerEntity.X, playerEntity.Z)
			}

			// Initialize lastState if nil (shouldn't happen, but safety check)
			if c.lastState == nil {
				c.lastState = make(map[string]*EntitySnapshot)
			}
			if c.seenIDs == nil {
				c.seenIDs = make(map[string]bool)
			}

			// Track current IDs to detect removals
			currentIDs := make(map[string]bool, len(currentState))
			for id := range currentState {
				currentIDs[id] = true
			}

			// Find removed entities (were in seenIDs but not in currentState)
			removed := make([]string, 0)
			for id := range c.seenIDs {
				if !currentIDs[id] {
					removed = append(removed, id)
					delete(c.lastState, id)
					delete(c.seenIDs, id)
				}
			}

			// Find changed/new entities
			changedState := make(map[string]*game.Entity)
			for id, entity := range currentState {
				lastSnap, existed := c.lastState[id]

				// ALWAYS include the player's own entity - they need full state for UI.
				// Equipment appearance is tracked for observers, while inventory, gold,
				// quests, and other private/self-only fields are not.
				if id == c.playerID {
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
					c.seenIDs[id] = true
					continue
				}

				// New entity or entity changed?
				if !existed {
					// New entity - always send full state
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
					c.seenIDs[id] = true
				} else if hasEntityChanged(entity, lastSnap) {
					// Changed entity - send updated state
					changedState[id] = entity
					c.lastState[id] = entityToSnapshot(entity)
				}
				// else: unchanged, skip sending
			}

			// If nothing changed and nothing removed, skip this broadcast
			if len(changedState) == 0 && len(removed) == 0 {
				return
			}

			var data []byte

			// Use delta format if client has seen entities before (not first sync)
			// First sync sends full state, subsequent sends ALWAYS use delta
			// (We can't mix state/delta or client will incorrectly remove entities)
			isFirstSync := len(c.seenIDs) == len(changedState) && len(removed) == 0
			env := &statepb.StateEnvelope{
				Version:      uint32(stateProtoWireVersion),
				ServerTimeMs: uint64(time.Now().UnixMilli()),
			}

			if isFirstSync {
				full := &statepb.StateFull{Entities: make([]*statepb.Entity, 0, len(currentState))}
				for _, e := range currentState {
					full.Entities = append(full.Entities, entityToProto(e))
				}
				env.Payload = &statepb.StateEnvelope_Full{Full: full}

				// Update seenIDs with all current entities
				for id := range currentState {
					c.seenIDs[id] = true
				}
			} else {
				delta := &statepb.StateDelta{Entities: make([]*statepb.Entity, 0, len(changedState)), RemovedIds: removed}
				for _, e := range changedState {
					delta.Entities = append(delta.Entities, entityToProto(e))
				}
				env.Payload = &statepb.StateEnvelope_Delta{Delta: delta}
			}

			payload, err := proto.Marshal(env)
			if err != nil {
				return
			}

			// Wire format: "EDPB" + version byte + protobuf payload
			data = make([]byte, 0, 5+len(payload))
			data = append(data, stateProtoMagic...)
			data = append(data, stateProtoWireVersion)
			data = append(data, payload...)

			select {
			case c.send <- data:
			default:
			}

			if playerEntity != nil && playerEntity.InstanceID != "" {
				if roomState, ok := world.GetDungeonRoomSummary(playerEntity.InstanceID, c.playerID); ok {
					payloadBytes, _ := json.Marshal(roomState)
					roomStateMsg := Message{Type: MsgDungeonRoomState, Payload: payloadBytes}
					if roomStateData, err := json.Marshal(roomStateMsg); err == nil {
						select {
						case c.send <- roomStateData:
						default:
						}
					}
				}
			}
		}(client)
	}
	wg.Wait()
}

func statsToProto(s game.Stats) *statepb.Stats {
	return &statepb.Stats{
		Strength:     int32(s.Strength),
		Dexterity:    int32(s.Dexterity),
		Intelligence: int32(s.Intelligence),
		Wisdom:       int32(s.Wisdom),
		Vitality:     int32(s.Vitality),
	}
}

func itemToProto(i *game.Item) *statepb.Item {
	if i == nil {
		return nil
	}
	stats := make(map[string]int32, len(i.Stats))
	for k, v := range i.Stats {
		stats[k] = int32(v)
	}
	gems := make([]*statepb.SocketedGem, 0, len(i.Gems))
	for _, gem := range i.Gems {
		gemStats := make(map[string]int32, len(gem.Stats))
		for k, v := range gem.Stats {
			gemStats[k] = int32(v)
		}
		gems = append(gems, &statepb.SocketedGem{
			Type:    string(gem.Type),
			Quality: string(gem.Quality),
			Stats:   gemStats,
		})
	}
	return &statepb.Item{
		Id:               i.ID,
		Name:             i.Name,
		Type:             string(i.Type),
		Rarity:           string(i.Rarity),
		Slot:             i.Slot,
		Level:            int32(i.Level),
		Stats:            stats,
		Value:            int32(i.Value),
		Icon:             i.Icon,
		Description:      i.Description,
		Stack:            int32(i.Stack),
		MaxStack:         int32(i.MaxStack),
		Potency:          int32(i.Potency),
		Sockets:          int32(i.Sockets),
		GemType:          string(i.GemType),
		GemQuality:       string(i.GemQuality),
		Gems:             gems,
		SetId:            i.SetID,
		UniqueEffect:     i.UniqueEffect,
		StatScaleVersion: int32(i.StatScaleVersion),
	}
}

func questsToProto(qs []game.Quest) []*statepb.Quest {
	if qs == nil {
		return nil
	}
	out := make([]*statepb.Quest, 0, len(qs))
	for _, q := range qs {
		out = append(out, &statepb.Quest{
			Id:                 q.ID,
			Type:               q.Type,
			Target:             q.Target,
			Count:              int32(q.Count),
			MaxCount:           int32(q.MaxCount),
			RewardXp:           int32(q.RewardXP),
			RewardGold:         int32(q.RewardGold),
			GrantedGold:        int32(q.GrantedGold),
			GrantedXp:          int32(q.GrantedXP),
			GrantedResonanceXp: int32(q.GrantedResonanceXP),
			Completed:          q.Completed,
			Accepted:           q.Accepted,
			Title:              q.Title,
			Description:        q.Description,
			Lore:               q.Lore,
			Category:           q.Category,
			Chapter:            int32(q.Chapter),
			ObjectiveText:      q.ObjectiveText,
		})
	}
	return out
}

func entityToProto(e *game.Entity) *statepb.Entity {
	if e == nil {
		return nil
	}

	// Read-lock to avoid stale/racy reads while the world sim updates entities concurrently.
	// This is especially important for State/position consistency (ATTACKING vs MOVING).
	e.Mu.RLock()

	// Copy slices/maps/pointers while under the lock.
	unlockedSkills := append([]string(nil), e.UnlockedSkills...)
	skillRunes := make(map[string]string, len(e.SkillRunes))
	for skill, runeID := range e.SkillRunes {
		skillRunes[skill] = runeID
	}

	// Passive talents: ranked map (new) + derived unlocked list (legacy).
	talentRanks := make(map[string]int32)
	unlockedTalents := make([]string, 0)
	spentTalents := 0
	for tid, r := range e.TalentRanks {
		nr, ok := game.NormalizeTalentRank(e.SubType, tid, r)
		if !ok {
			continue
		}
		talentRanks[tid] = int32(nr)
		spentTalents += nr
		unlockedTalents = append(unlockedTalents, tid)
	}
	sort.Strings(unlockedTalents)
	// TalentPoints are derived from level and normalized ranks. Compute here to avoid
	// relying on the stored field (which may be stale if stats weren't recalculated yet).
	derivedTalentPoints := 0
	if e.Level >= 5 {
		derivedTalentPoints = (e.Level / 5) - spentTalents
		if derivedTalentPoints < 0 {
			derivedTalentPoints = 0
		}
	}
	quests := append([]game.Quest(nil), e.Quests...)

	equipment := make(map[string]*statepb.Item, len(e.Equipment))
	for slot, it := range e.Equipment {
		itemCopy := it
		equipment[slot] = itemToProto(&itemCopy)
	}

	var lootItem *game.Item
	if e.LootItem != nil {
		li := *e.LootItem
		lootItem = &li
	}

	stunDuration := float32(0)
	if e.Stunned {
		remaining := time.Until(e.StunEndTime).Seconds()
		if remaining > 0 {
			stunDuration = float32(remaining)
		}
	}
	slowDuration := float32(0)
	if e.Slowed {
		remaining := time.Until(e.SlowEndTime).Seconds()
		if remaining > 0 {
			slowDuration = float32(remaining)
		}
	}
	rootDuration := float32(0)
	if e.Rooted {
		remaining := time.Until(e.RootEndTime).Seconds()
		if remaining > 0 {
			rootDuration = float32(remaining)
		}
	}
	bleedDuration := float32(0)
	bleedDamage := int32(0)
	if e.Bleeding {
		remaining := time.Until(e.BleedEndTime).Seconds()
		if remaining > 0 {
			bleedDuration = float32(remaining)
		}
		if e.BleedDamage > 0 {
			bleedDamage = int32(e.BleedDamage)
		}
	}
	poisonDuration := float32(0)
	poisonDamage := int32(0)
	if e.Poisoned {
		remaining := time.Until(e.PoisonEndTime).Seconds()
		if remaining > 0 {
			poisonDuration = float32(remaining)
		}
		if e.PoisonDamage > 0 {
			poisonDamage = int32(e.PoisonDamage)
		}
	}
	weakPointDuration := float32(0)
	if e.WeakPointMarked {
		remaining := time.Until(e.WeakPointEndTime).Seconds()
		if remaining > 0 {
			weakPointDuration = float32(remaining)
		}
	}
	markWeaknessDuration := float32(0)
	if e.MarkWeakness {
		remaining := time.Until(e.MarkWeaknessEndTime).Seconds()
		if remaining > 0 {
			markWeaknessDuration = float32(remaining)
		}
	}
	spiritDuration := float32(0)
	if e.SpiritsActive {
		remaining := time.Until(e.SpiritEndTime).Seconds()
		if remaining > 0 {
			spiritDuration = float32(remaining)
		}
	}
	blessingResolveDuration := float32(0)
	if e.BlessingResolveActive {
		remaining := time.Until(e.BlessingResolveEndTime).Seconds()
		if remaining > 0 {
			blessingResolveDuration = float32(remaining)
		}
	}
	timeWarpDuration := float32(0)
	if e.TimeWarpActive {
		remaining := time.Until(e.TimeWarpEndTime).Seconds()
		if remaining > 0 {
			timeWarpDuration = float32(remaining)
		}
	}
	guardianEmbraceDuration := float32(0)
	if e.GuardianEmbraceActive {
		remaining := time.Until(e.GuardianEmbraceEndTime).Seconds()
		if remaining > 0 {
			guardianEmbraceDuration = float32(remaining)
		}
	}
	arcaneShieldDuration := float32(0)
	if e.ArcaneShieldActive && e.ArcaneShieldHP > 0 {
		remaining := time.Until(e.ArcaneShieldEndTime).Seconds()
		if remaining > 0 {
			arcaneShieldDuration = float32(remaining)
		}
	}
	divineInterventionDuration := float32(0)
	if e.DivineInterventionActive {
		remaining := time.Until(e.DivineInterventionEndTime).Seconds()
		if remaining > 0 {
			divineInterventionDuration = float32(remaining)
		}
	}
	spellFocusDuration := float32(0)
	if e.SpellFocusActive {
		remaining := time.Until(e.SpellFocusEndTime).Seconds()
		if remaining > 0 {
			spellFocusDuration = float32(remaining)
		}
	}
	swiftDuration := float32(0)
	if e.SwiftActive {
		remaining := time.Until(e.SwiftEndTime).Seconds()
		if remaining > 0 {
			swiftDuration = float32(remaining)
		}
	}
	ironFortressDuration := float32(0)
	if e.IronFortressActive {
		if remaining := time.Until(e.IronFortressEndTime).Seconds(); remaining > 0 {
			ironFortressDuration = float32(remaining)
		}
	}
	guardianRoarDuration := float32(0)
	if e.GuardianRoarActive {
		if remaining := time.Until(e.GuardianRoarEndTime).Seconds(); remaining > 0 {
			guardianRoarDuration = float32(remaining)
		}
	}
	berserkerModeDuration := float32(0)
	if e.BerserkerModeActive {
		if remaining := time.Until(e.BerserkerModeEndTime).Seconds(); remaining > 0 {
			berserkerModeDuration = float32(remaining)
		}
	}
	lastStandDuration := float32(0)
	if e.LastStandActive {
		if remaining := time.Until(e.LastStandEndTime).Seconds(); remaining > 0 {
			lastStandDuration = float32(remaining)
		}
	}
	serratedEdgesDuration := float32(0)
	if e.SerratedEdgesActive {
		if remaining := time.Until(e.SerratedEdgesEndTime).Seconds(); remaining > 0 {
			serratedEdgesDuration = float32(remaining)
		}
	}
	poisonCoatingDuration := float32(0)
	if e.PoisonCoatingActive {
		if remaining := time.Until(e.PoisonCoatingEndTime).Seconds(); remaining > 0 {
			poisonCoatingDuration = float32(remaining)
		}
	}
	stealthDuration := float32(0)
	if e.StealthActive {
		if remaining := time.Until(e.StealthEndTime).Seconds(); remaining > 0 {
			stealthDuration = float32(remaining)
		}
	}
	zealDuration := float32(0)
	if e.ZealActive {
		if remaining := time.Until(e.ZealEndTime).Seconds(); remaining > 0 {
			zealDuration = float32(remaining)
		}
	}

	whirlwindDuration := e.WhirlwindRemaining(time.Now())
	out := &statepb.Entity{
		WhirlwindActive:            whirlwindDuration > 0,
		WhirlwindDuration:          float32(whirlwindDuration),
		Id:                         e.ID,
		InstanceId:                 e.InstanceID,
		Name:                       e.Name,
		Type:                       string(e.Type),
		SubType:                    e.SubType,
		X:                          float32(e.X),
		Y:                          float32(e.Y),
		Z:                          float32(e.Z),
		Rotation:                   float32(e.Rotation),
		Health:                     int32(e.Health),
		MaxHealth:                  int32(e.MaxHealth),
		Mana:                       int32(e.Mana),
		MaxMana:                    int32(e.MaxMana),
		Level:                      int32(e.Level),
		Experience:                 int64(e.Experience),
		MaxExperience:              int64(e.MaxExperience),
		Gold:                       int32(e.Gold),
		SkillPoints:                int32(e.SkillPoints),
		SelectedBranch:             e.SelectedBranch,
		UnlockedSkills:             unlockedSkills,
		SkillRunes:                 skillRunes,
		TalentPoints:               int32(derivedTalentPoints),
		UnlockedTalents:            unlockedTalents,
		TalentRanks:                talentRanks,
		BaseStats:                  statsToProto(e.BaseStats),
		Stats:                      statsToProto(e.Stats),
		Damage:                     int32(e.Damage),
		Defense:                    int32(e.Defense),
		Speed:                      float32(e.Speed),
		AttackSpeed:                float32(e.AttackSpeed),
		CooldownReduction:          float32(e.CooldownReduction),
		HpRegen:                    float32(e.HpRegen),
		ManaRegen:                  float32(e.ManaRegen),
		CastSpeed:                  float32(e.CastSpeed),
		Scale:                      float32(e.Scale),
		BodyRadius:                 float32(e.ReplicatedBodyRadius()),
		State:                      e.State,
		Equipment:                  equipment,
		Quests:                     questsToProto(quests),
		LootItem:                   itemToProto(lootItem),
		OwnerId:                    e.OwnerID,
		VelX:                       float32(e.VelX),
		VelZ:                       float32(e.VelZ),
		SpiritsActive:              e.SpiritsActive,
		SpiritsBoosted:             e.SpiritsBoosted,
		IsCharging:                 e.IsCharging,
		GuardianEmbraceActive:      e.GuardianEmbraceActive,
		BlessingResolveActive:      e.BlessingResolveActive,
		DivineInterventionActive:   e.DivineInterventionActive,
		ArcaneShieldActive:         e.ArcaneShieldActive,
		ArcaneShieldHp:             int32(e.ArcaneShieldHP),
		TimeWarpActive:             e.TimeWarpActive,
		SpellFocusActive:           e.SpellFocusActive,
		SwiftActive:                e.SwiftActive,
		IronFortressActive:         e.IronFortressActive,
		GuardianRoarActive:         e.GuardianRoarActive,
		BerserkerModeActive:        e.BerserkerModeActive,
		LastStandActive:            e.LastStandActive,
		SerratedEdgesActive:        e.SerratedEdgesActive,
		PoisonCoatingActive:        e.PoisonCoatingActive,
		StealthActive:              e.StealthActive,
		ZealActive:                 e.ZealActive,
		Stunned:                    e.Stunned,
		StunDuration:               stunDuration,
		Slowed:                     e.Slowed,
		SlowFactor:                 float32(e.SlowFactor),
		SlowDuration:               slowDuration,
		Rooted:                     e.Rooted,
		RootDuration:               rootDuration,
		Bleeding:                   e.Bleeding,
		BleedDuration:              bleedDuration,
		BleedDamage:                bleedDamage,
		Poisoned:                   e.Poisoned,
		PoisonDuration:             poisonDuration,
		PoisonDamage:               poisonDamage,
		WeakPointMarked:            e.WeakPointMarked,
		WeakPointDuration:          float32(weakPointDuration),
		MarkWeakness:               e.MarkWeakness,
		MarkWeaknessDuration:       markWeaknessDuration,
		SpiritDuration:             spiritDuration,
		BlessingResolveDuration:    blessingResolveDuration,
		TimeWarpDuration:           timeWarpDuration,
		GuardianEmbraceDuration:    guardianEmbraceDuration,
		ArcaneShieldDuration:       arcaneShieldDuration,
		DivineInterventionDuration: divineInterventionDuration,
		SpellFocusDuration:         spellFocusDuration,
		SwiftDuration:              swiftDuration,
		IronFortressDuration:       ironFortressDuration,
		GuardianRoarDuration:       guardianRoarDuration,
		BerserkerModeDuration:      berserkerModeDuration,
		LastStandDuration:          lastStandDuration,
		SerratedEdgesDuration:      serratedEdgesDuration,
		PoisonCoatingDuration:      poisonCoatingDuration,
		StealthDuration:            stealthDuration,
		ZealDuration:               zealDuration,
		JumpStartX:                 float32(e.JumpStartX),
		JumpStartY:                 float32(e.JumpStartY),
		JumpStartZ:                 float32(e.JumpStartZ),
		JumpTargetX:                float32(e.JumpTargetX),
		JumpTargetY:                float32(e.JumpTargetY),
		JumpTargetZ:                float32(e.JumpTargetZ),
		JumpDuration:               float32(e.JumpDuration),
		JumpHeight:                 float32(e.JumpHeight),
		JumpProgress:               float32(e.JumpProgress),
		PartyId:                    e.PartyID,
		SocialStatus:               e.SocialStatus,
		GuildId:                    e.GuildID,
		GuildTag:                   e.GuildTag,
		MoveSequence:               e.LastMoveSequence,
	}

	e.Mu.RUnlock()
	return out
}

// autoSetSocialStatus applies a system-driven social status change for the
// given player (0.37.4).  It respects SetPlayerSocialStatusAutomatic's
// preconditions, then acks the new status to the player's client so their
// dropdown stays in sync, and broadcasts a fresh MsgSocial to all sessions.
// No-op (no ack, no broadcast) when the precondition is not met.
