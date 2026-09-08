package database

import "go.mongodb.org/mongo-driver/bson"

// Reward fields have historically been stored without omitempty. Their actual
// BSON presence distinguishes a promised zero from a pre-reward legacy save.
// Derive each flag independently: older quests can have XP but no gold field.
// Flags are server-only metadata; ordinary saves continue writing both amounts.
func (q *Quest) UnmarshalBSON(data []byte) error {
	type questDocument Quest
	var decoded questDocument
	if err := bson.Unmarshal(data, &decoded); err != nil {
		return err
	}
	raw := bson.Raw(data)
	_, xpError := raw.LookupErr("reward_xp")
	_, goldError := raw.LookupErr("reward_gold")
	decoded.RewardXPQuoted = xpError == nil
	decoded.RewardGoldQuoted = goldError == nil
	*q = Quest(decoded)
	return nil
}
