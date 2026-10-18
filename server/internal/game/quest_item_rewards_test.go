package game

import (
	"reflect"
	"testing"
)

func TestQuestItemRewardsCatalogCadenceAndLevel(t *testing.T) {
	for i, quest := range chronicleQuestCatalog() {
		level, _, known := chronicleRewardTerms(quest.ID)
		if !known {
			t.Fatalf("missing authored level: %s", quest.ID)
		}
		want := 0
		if (i+1)%2 == 0 {
			want = level
		}
		if quest.RewardChoiceLevel != want {
			t.Fatalf("chapter %s level %d expected %d", quest.ID, quest.RewardChoiceLevel, want)
		}
	}
	for _, quest := range dailyQuestCatalog() {
		if quest.RewardChoiceLevel != 0 {
			t.Fatal("daily silently opted into story rewards")
		}
	}
}

func TestQuestItemRewardsQualityAndDistinctEquipment(t *testing.T) {
	for _, level := range []int{1, 12, 30, 70, 100} {
		for n := 0; n < 20; n++ {
			choices := generateQuestRewardChoices(level)
			if len(choices) != 6 {
				t.Fatal("not six offers")
			}
			names, ids := map[string]bool{}, map[string]bool{}
			for _, item := range choices {
				if item.Level != level || item.ID == "" || ids[item.ID] || names[item.Name] || item.Stack != 1 || item.MaxStack != 1 {
					t.Fatalf("invalid offer %+v", item)
				}
				if item.Type != ItemWeapon && item.Type != ItemArmor && item.Type != ItemAccessory {
					t.Fatal("material or unusable reward", item)
				}
				if item.Rarity != RarityUncommon && item.Rarity != RarityRare && item.Rarity != RarityLegendary {
					t.Fatal("below green", item)
				}
				names[item.Name], ids[item.ID] = true, true
			}
		}
	}
	for _, tc := range []struct {
		roll   float64
		rarity ItemRarity
	}{{0, RarityLegendary}, {0.09999, RarityLegendary}, {0.10, RarityRare}, {0.44999, RarityRare}, {0.45, RarityUncommon}, {0.99999, RarityUncommon}} {
		rarity, _, _ := questItemRarity(tc.roll)
		if rarity != tc.rarity {
			t.Fatalf("roll %f produced %s", tc.roll, rarity)
		}
	}
}

func TestQuestItemRewardsRetainFullBagRejectForgeryAndReplay(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("reward-claim", "Fighter")
	p.Inventory = make([]Item, MaxInventorySize)
	w.AddEntity(p)
	choices := generateQuestRewardChoices(12)
	p.Quests = []Quest{{ID: "earned", Completed: true, RewardChoiceLevel: 12, RewardChoices: choices}}
	for i := range p.Inventory {
		p.Inventory[i] = Item{ID: "filler", Stack: 1, MaxStack: 1}
	}
	if w.PerformClaimQuestItem(p.ID, "earned", choices[0].ID) {
		t.Fatal("full bag accepted")
	}
	if !reflect.DeepEqual(p.Quests[0].RewardChoices, choices) {
		t.Fatal("full bag rerolled")
	}
	p.Inventory[0] = Item{}
	if w.PerformClaimQuestItem(p.ID, "earned", "forged") || w.PerformClaimQuestItem(p.ID, "other", choices[0].ID) {
		t.Fatal("forgery accepted")
	}
	p.Quests[0].Completed = false
	if w.PerformClaimQuestItem(p.ID, "earned", choices[0].ID) {
		t.Fatal("unearned choice claimed")
	}
	p.Quests[0].Completed = true
	if !w.PerformClaimQuestItem(p.ID, "earned", choices[0].ID) || !reflect.DeepEqual(p.Inventory[0], choices[0]) {
		t.Fatal("exact item not awarded")
	}
	if p.Quests[0].ClaimedRewardID != choices[0].ID || len(p.Quests[0].RewardChoices) != 0 {
		t.Fatal("receipt missing")
	}
	p.Inventory[1] = Item{}
	if w.PerformClaimQuestItem(p.ID, "earned", choices[1].ID) || w.PerformClaimQuestItem(p.ID, "earned", choices[0].ID) {
		t.Fatal("second item or replay awarded")
	}
}

func TestQuestRewardCopiesAndReconciliationPreserveOffers(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("reward-copy", "Wizard")
	w.AddEntity(p)
	q := chronicleQuestCatalog()[1]
	q.Accepted, q.Completed, q.RewardChoices = true, true, generateQuestRewardChoices(q.RewardChoiceLevel)
	p.Quests = []Quest{q}
	snapshot := w.GetEntityCopy(p.ID)
	snapshot.Quests[0].RewardChoices[0].Stats["damage"] = -777
	if p.Quests[0].RewardChoices[0].Stats["damage"] == -777 {
		t.Fatal("save aliases live reward stats")
	}
	refreshed := copyQuestDefinition(q, chronicleQuestCatalog()[1])
	if !reflect.DeepEqual(refreshed.RewardChoices, q.RewardChoices) {
		t.Fatal("catalog rerolled pending offers")
	}
	old := q
	old.RewardChoices = nil
	old.RewardChoiceLevel = 0
	if reconciled := copyQuestDefinition(old, chronicleQuestCatalog()[1]); reconciled.RewardChoiceLevel != 0 || len(reconciled.RewardChoices) != 0 {
		t.Fatal("retroactive reward invented")
	}
}

func TestQuestItemRewardsOnlyAppearOnSuccessfulTurnIn(t *testing.T) {
	w := newTestWorld()
	p := newTestPlayer("reward-turnin", "Fighter")
	w.AddEntity(p)
	p.X, p.Z, p.Level, p.MaxExperience = 20, 215, 30, experienceRequiredForLevel(30)
	p.Inventory = make([]Item, MaxInventorySize)
	catalog := chronicleQuestCatalog()
	first, reward := catalog[0], catalog[1]
	first.Accepted, first.Completed = true, true
	reward.Accepted, reward.Count = true, reward.MaxCount
	if reward.Type == "INVESTIGATE" {
		reward.InvestigationMask = (1 << reward.MaxCount) - 1
	}
	p.Quests = []Quest{first, reward}
	if reward.Type == "COLLECT" {
		p.Inventory[0] = Item{ID: "turnin-material", Name: reward.Target, Stack: reward.MaxCount, MaxStack: reward.MaxCount}
	}
	p.X = -20
	if _, ok := w.PerformCompleteQuest(p.ID, reward.ID); ok || len(p.Quests[1].RewardChoices) != 0 {
		t.Fatal("remote turnin minted offers")
	}
	p.X = 20
	if _, ok := w.PerformCompleteQuest(p.ID, reward.ID); !ok {
		t.Fatal("ready nearby quest rejected")
	}
	earned := questByID(t, p, reward.ID)
	choices := cloneItems(earned.RewardChoices)
	if len(choices) != 6 || !earned.Completed {
		t.Fatal("turnin did not save six offers")
	}
	if _, ok := w.PerformCompleteQuest(p.ID, reward.ID); ok {
		t.Fatal("replayed turnin accepted")
	}
	ensureChronicleLocked(p)
	if !reflect.DeepEqual(questByID(t, p, reward.ID).RewardChoices, choices) {
		t.Fatal("replay/reconciliation rerolled earned choices")
	}
}
