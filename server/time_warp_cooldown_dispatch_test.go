package main

import (
	"encoding/json"
	"testing"
	"time"

	"eidolon-server/internal/game"
)

func TestTimeWarpDispatchImmediatelySendsRefreshedCooldowns(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	p := newLevelCommandPlayer(client.playerID)
	p.SubType, p.Level, p.Health, p.Mana, p.MaxMana = "Wizard", 40, 100, 200, 200
	world.AddEntity(p)
	world.PerformSelectBranch(p.ID, "C")
	until := time.Now().Add(time.Minute)
	p.Cooldowns = map[string]time.Time{"Teleport": until, "Gravity Well": until, "Arcane Shield": until}
	payload, _ := json.Marshal(AbilityPayload{SkillName: "Time Warp", TargetX: p.X, TargetZ: p.Z})
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 2 || messages[0].Type != MsgAbilityResult || messages[1].Type != MsgAbilityCooldowns {
		t.Fatalf("missing immediate cooldown refresh: %+v", messages)
	}
	var result game.AbilityResult
	if err := json.Unmarshal(messages[0].Payload, &result); err != nil || !result.Accepted {
		t.Fatal("cast not accepted", err, result)
	}
	var state struct {
		Cooldowns map[string]float64 `json:"cooldowns"`
	}
	if err := json.Unmarshal(messages[1].Payload, &state); err != nil {
		t.Fatal(err)
	}
	if state.Cooldowns["Teleport"] != 0 || state.Cooldowns["Gravity Well"] != 0 || state.Cooldowns["Time Warp"] <= 0 || state.Cooldowns["Arcane Shield"] <= 0 {
		t.Fatal("wrong authoritative refresh", state.Cooldowns)
	}
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages = drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgAbilityResult {
		t.Fatal("rejected repeat sent a refresh")
	}
}

func TestIronFortressDispatchImmediatelyRefreshesShieldSlam(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	p := newLevelCommandPlayer(client.playerID)
	p.SubType, p.Level, p.Health, p.Mana, p.MaxMana = "Fighter", 40, 100, 200, 200
	world.AddEntity(p)
	world.PerformSelectBranch(p.ID, "A")
	until := time.Now().Add(time.Minute)
	p.Cooldowns = map[string]time.Time{"Shield Slam": until, "Whirlwind": until}
	payload, _ := json.Marshal(AbilityPayload{SkillName: "Iron Fortress", TargetX: p.X, TargetZ: p.Z})
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 2 || messages[1].Type != MsgAbilityCooldowns {
		t.Fatal("missing immediate counter refresh", messages)
	}
	var state struct {
		Cooldowns map[string]float64 `json:"cooldowns"`
	}
	if err := json.Unmarshal(messages[1].Payload, &state); err != nil {
		t.Fatal(err)
	}
	if state.Cooldowns["Shield Slam"] != 0 || state.Cooldowns["Whirlwind"] <= 0 || state.Cooldowns["Iron Fortress"] <= 0 {
		t.Fatal("incorrect counter cooldown snapshot", state.Cooldowns)
	}
}

func TestShadowDanceDispatchImmediatelyRefreshesTripwire(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	p := newLevelCommandPlayer(client.playerID)
	p.SubType, p.Level, p.Health, p.Mana, p.MaxMana = "Rogue", 40, 100, 200, 200
	world.AddEntity(p)
	world.PerformSelectBranch(p.ID, "C")
	if result := world.PerformAbility(p.ID, p.X, p.Z, "", "Cloak & Vanish"); !result.Accepted {
		t.Fatal(result)
	}
	p.LastAbilityTime = time.Now().Add(-time.Second)
	p.Cooldowns["Tripwire"] = time.Now().Add(time.Minute)
	payload, _ := json.Marshal(AbilityPayload{SkillName: "Smoke Bomb", TargetX: p.X, TargetZ: p.Z})
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 2 || messages[1].Type != MsgAbilityCooldowns {
		t.Fatal("missing trap cooldown refresh", messages)
	}
	var state struct {
		Cooldowns map[string]float64 `json:"cooldowns"`
	}
	if err := json.Unmarshal(messages[1].Payload, &state); err != nil {
		t.Fatal(err)
	}
	if state.Cooldowns["Tripwire"] != 0 || state.Cooldowns["Smoke Bomb"] <= 0 || state.Cooldowns["Cloak & Vanish"] <= 0 {
		t.Fatal("wrong trap rearm", state.Cooldowns)
	}
}

func TestZealDispatchImmediatelyRefreshesOwnGuardians(t *testing.T) {
	previousWorld, previousDB := world, db
	defer func() { world, db = previousWorld, previousDB }()
	db = nil
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	p := newLevelCommandPlayer(client.playerID)
	p.SubType, p.Level, p.Health, p.Mana, p.MaxMana = "Cleric", 40, 100, 200, 200
	world.AddEntity(p)
	world.PerformSelectBranch(p.ID, "C")
	until := time.Now().Add(time.Minute)
	p.Cooldowns = map[string]time.Time{"Spirit Guardians": until, "Mark of Weakness": until}
	payload, _ := json.Marshal(AbilityPayload{SkillName: "Blessing of Zeal", TargetX: p.X, TargetZ: p.Z})
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages := drainSentMessages(client.send)
	if len(messages) != 2 || messages[1].Type != MsgAbilityCooldowns {
		t.Fatal("missing guardian cooldown refresh", messages)
	}
	var state struct {
		Cooldowns map[string]float64 `json:"cooldowns"`
	}
	if err := json.Unmarshal(messages[1].Payload, &state); err != nil {
		t.Fatal(err)
	}
	if state.Cooldowns["Spirit Guardians"] != 0 || state.Cooldowns["Mark of Weakness"] <= 0 || state.Cooldowns["Blessing of Zeal"] <= 0 {
		t.Fatal("wrong guardian refresh", state.Cooldowns)
	}
	p.Cooldowns["Spirit Guardians"] = until
	client.handleMessage(Message{Type: MsgAbility, Payload: payload})
	messages = drainSentMessages(client.send)
	if len(messages) != 1 || messages[0].Type != MsgAbilityResult || p.Cooldowns["Spirit Guardians"] != until {
		t.Fatal("rejected repeat refreshed Guardians")
	}
}
