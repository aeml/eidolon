package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"reflect"
	"testing"
	"time"

	"eidolon-server/internal/database"
	"eidolon-server/internal/game"
)

type questAckCommitter struct {
	store  *tradeRecoveryStore
	client *Client
}

type questLateProgressCommitter struct {
	store  *tradeRecoveryStore
	player *game.Entity
}

func (committer questLateProgressCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if err := committer.store.CommitCharacterSave(username, character, id); err != nil {
		return err
	}
	// An independent combat effect can arrive while database IO is finishing.
	// It is valid live state, but was not part of this conversation's save.
	committer.player.Mu.Lock()
	committer.player.Quests[1].Count = 1
	committer.player.Inventory[1].Potency = 5
	committer.player.UnjournaledSave = true
	committer.player.Mu.Unlock()
	return nil
}

func TestQuestConversationAcknowledgesExactSavedImageNotLaterCombat(t *testing.T) {
	client, player, store, _ := questConversationFixture(t, false)
	player.Quests = append(player.Quests, game.Quest{ID: "independent-kills", Type: "KILL", Target: "Skeleton", Accepted: true, MaxCount: 4})
	characterSaveCommitter = questLateProgressCommitter{store, player}
	client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"daily_skeleton"}`)})
	replies := drainSentMessages(client.send)
	if len(replies) < 2 || replies[0].Type != MsgInventory || replies[1].Type != MsgQuestUpdate {
		t.Fatal("saved turn-in did not produce ordered bag and quest replies", replies)
	}
	var bag []game.Item
	var quests []game.Quest
	if json.Unmarshal(replies[0].Payload, &bag) != nil || json.Unmarshal(replies[1].Payload, &quests) != nil ||
		len(quests) != 2 || !quests[0].Completed || quests[1].Count != 0 || bag[1].Potency != 4 {
		t.Fatal("conversation confirmed later unsaved combat/bag progress")
	}
	saved := store.characters[client.username]
	if saved.Quests[1].Count != 0 || saved.Inventory[1].Potency != 4 || player.Quests[1].Count != 1 || player.Inventory[1].Potency != 5 {
		t.Fatal("saved feedback overwrote independent later live progress")
	}
}

func (committer questAckCommitter) CommitCharacterSave(username string, character *database.Character, id string) error {
	if len(committer.client.send) != 0 {
		return errors.New("quest conversation preceded saved reward")
	}
	return committer.store.CommitCharacterSave(username, character, id)
}

func questConversationFixture(t *testing.T, story bool) (*Client, *game.Entity, *tradeRecoveryStore, string) {
	t.Helper()
	dir, _ := setupCharacterJournalTest(t)
	world = game.NewWorld(nil)
	t.Cleanup(world.StopBackground)
	client := newLevelCommandClient()
	player := newLevelCommandPlayer(client.playerID)
	player.Name, player.Gold, player.EP = client.username, 731, 19
	player.X, player.Z, player.LastDailyQuest = -20, 200, time.Now()
	player.Quests = []game.Quest{{ID: "daily_skeleton", Type: "COLLECT", Target: "Verdant Memory Seed", Accepted: true,
		Count: 2, MaxCount: 2, RewardXP: 1234, RewardGold: 321, RewardXPQuoted: true, RewardGoldQuoted: true}}
	player.Inventory[0] = game.Item{ID: "earned-seeds", Name: "Verdant Memory Seed", Stack: 3, MaxStack: 8}
	player.Inventory[1] = game.Item{ID: "keep-sword", Name: "Earned sword", Stack: 1, Potency: 4, Stats: map[string]int{"damage": 23}}
	if story {
		player.X, player.Z = 20, 215
		player.Quests = []game.Quest{{ID: "chronicle_01_bell_below", Category: game.QuestCategoryChronicle,
			Type: "KILL", Target: "Skeleton", Accepted: true, Count: 3, MaxCount: 3,
			RewardXP: 1234, RewardGold: 321, RewardXPQuoted: true, RewardGoldQuoted: true}}
	}
	world.AddEntity(player)
	store := &tradeRecoveryStore{characters: map[string]*database.Character{client.username: cloneTradeRecoveryCharacter(characterSnapshotForSave(client.username, world.GetEntityCopy(player.ID)))}, writes: map[string]int{}}
	characterSaveCommitter = questAckCommitter{store, client}
	return client, player, store, dir
}

func TestQuestConversationSaveBarrierAndColdReceiptRecovery(t *testing.T) {
	for _, story := range []bool{false, true} {
		for _, action := range []string{MsgAcceptQuest, MsgCompleteQuest} {
			for _, lostAck := range []bool{false, true} {
				t.Run(fmt.Sprintf("story=%t/action=%s/lostAck=%t", story, action, lostAck), func(t *testing.T) {
					client, player, store, dir := questConversationFixture(t, story)
					if action == MsgAcceptQuest {
						player.Quests[0].Accepted = false
						store.characters[client.username] = cloneTradeRecoveryCharacter(characterSnapshotForSave(client.username, world.GetEntityCopy(player.ID)))
					}
					callbacks := 0
					world.OnEvent = func(string, interface{}) { callbacks++ }
					store.failSaveAccount, store.failSaveAfter = client.username, lostAck
					payload, _ := json.Marshal(CompleteQuestPayload{QuestID: player.Quests[0].ID})
					request := Message{Type: action, Payload: payload}
					client.handleMessage(request)
					if replies := drainSentMessages(client.send); len(replies) != 1 || replies[0].Type != MsgError || callbacks != 0 {
						t.Fatal("unconfirmed quest announced completion or next chapter", replies, callbacks)
					}
					pending, err := characterSaveJournal.Read(client.username)
					if err != nil || pending == nil {
						t.Fatal("unconfirmed conversation lost its complete recovery image", err)
					}
					planned, err := pending.Character()
					if err != nil || planned == nil || planned.EP != 19 || !planned.Quests[0].Accepted {
						t.Fatal("conversation changed unrelated wallet or lost acceptance", err)
					}
					if action == MsgCompleteQuest {
						if !planned.Quests[0].Completed || planned.Quests[0].GrantedGold != 321 || planned.Quests[0].GrantedXP != 1234 || planned.Gold != 1052 {
							t.Fatal("recovery image lost the earned quote and exact reward", planned.Quests[0])
						}
						if !story && (planned.Inventory[0].Stack != 1 || planned.Inventory[1].Potency != 4) {
							t.Fatal("collection recovery lost exact consumption or unrelated earned gear")
						}
					} else if planned.Quests[0].Completed || planned.Gold != 731 || planned.Inventory[0].Stack != 3 {
						t.Fatal("acceptance issued a premature reward")
					}
					// Discard runtime state; reopen the real journal and replay its
					// exact complete snapshot, not a fresh synthetic quest award.
					liveWorld := world
					world = nil
					failedCharacterSaves.users = map[string]bool{}
					characterSaveJournal, err = database.OpenCharacterSaveJournal(dir)
					if err != nil {
						t.Fatal(err)
					}
					if err := retryPendingCharacterSaveLocked(client.username); err != nil {
						t.Fatal(err)
					}
					stored := store.characters[client.username]
					if stored.LastSaveID != pending.SaveID || store.writes[client.username] != 1 || !reflect.DeepEqual(stored.Inventory, planned.Inventory) || stored.Gold != planned.Gold || stored.EP != planned.EP || !reflect.DeepEqual(stored.Quests, planned.Quests) {
						t.Fatal("cold replay changed or repeated the saved conversation")
					}
					world = liveWorld
					client.handleMessage(request)
					if replies := drainSentMessages(client.send); len(replies) != 1 || replies[0].Type != MsgError || store.writes[client.username] != 1 || callbacks != 0 {
						t.Fatal("replayed conversation granted another reward or advanced again", replies)
					}
				})
			}
		}
	}
}

func TestQuestConversationConfirmedStorySavesBeforeNextChapterFeedback(t *testing.T) {
	client, _, store, _ := questConversationFixture(t, true)
	world.OnEvent = func(string, interface{}) { t.Fatal("ordinary quest leaked pre-save world feedback") }
	client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"chronicle_01_bell_below"}`)})
	replies := drainSentMessages(client.send)
	if len(replies) < 3 || replies[0].Type != MsgInventory || replies[1].Type != MsgQuestUpdate || replies[2].Type != "chronicle_advance" || store.writes[client.username] != 1 || !store.characters[client.username].Quests[0].Completed {
		t.Fatal("confirmed reward did not precede ordered story feedback", replies)
	}
}

func TestQuestConversationMissingPersistenceDoesNotMutate(t *testing.T) {
	client, player, _, _ := questConversationFixture(t, false)
	characterSaveCommitter = nil
	before := world.GetEntityCopy(player.ID)
	client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"daily_skeleton"}`)})
	after := world.GetEntityCopy(player.ID)
	if !reflect.DeepEqual(before.Quests, after.Quests) || !reflect.DeepEqual(before.Inventory, after.Inventory) || before.Gold != after.Gold {
		t.Fatal("missing persistence changed a quest reward")
	}
	if replies := drainSentMessages(client.send); len(replies) != 1 || replies[0].Type != MsgError {
		t.Fatal("missing persistence returned a quest success", replies)
	}
}

func TestQuestConversationWalletOverflowPreservesItemsAndReward(t *testing.T) {
	client, player, store, _ := questConversationFixture(t, false)
	player.Gold = math.MaxInt - 320
	before := world.GetEntityCopy(player.ID)
	client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"daily_skeleton"}`)})
	after := world.GetEntityCopy(player.ID)
	if before.Gold != after.Gold || !reflect.DeepEqual(before.Quests, after.Quests) || !reflect.DeepEqual(before.Inventory, after.Inventory) || store.writes[client.username] != 0 {
		t.Fatal("unrepresentable quest payout consumed items or wrapped Gold")
	}
	if replies := drainSentMessages(client.send); len(replies) != 1 || replies[0].Type != MsgError {
		t.Fatal("unrepresentable quest payout announced completion", replies)
	}
}

func TestQuestConversationSavesCapRewardSplit(t *testing.T) {
	for _, level := range []int{99, 100} {
		t.Run(fmt.Sprint(level), func(t *testing.T) {
			client, player, store, _ := questConversationFixture(t, false)
			player.Level, player.MaxExperience = level, game.ExperienceRequiredForLevel(level)
			player.Experience = player.MaxExperience
			wantXP := 0
			if level == 99 {
				player.Experience -= 50
				wantXP = 50
			}
			client.handleMessage(Message{Type: MsgCompleteQuest, Payload: json.RawMessage(`{"questId":"daily_skeleton"}`)})
			saved := store.characters[client.username]
			if saved.Level != 100 || saved.Quests[0].GrantedXP != wantXP || saved.Quests[0].GrantedResonanceXP != 1234-wantXP || saved.Gold != 1052 || saved.EP != 19 || saved.Inventory[0].Stack != 1 {
				t.Fatal("confirmed cap turn-in lost exact XP/Resonance split or consumption")
			}
			if replies := drainSentMessages(client.send); len(replies) < 2 || replies[0].Type != MsgInventory || replies[1].Type != MsgQuestUpdate {
				t.Fatal("cap reward lacked saved conversation feedback", replies)
			}
		})
	}
}
