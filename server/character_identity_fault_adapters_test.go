package main

// Keep existing fault injection on the same logical save when a fixture loads
// a real account ID. Promoted DB methods would otherwise bypass wrapper faults.
import (
	"eidolon-server/internal/database"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func forwardBoundTestSave(c characterCommitter, account primitive.ObjectID, username string, character *database.Character, receipt string) error {
	copy := *character
	copy.AccountID = account
	return c.CommitCharacterSave(username, &copy, receipt)
}

func (c *refundFaultCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *groundAckCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c rejectedAdminCommit) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *vendorReceiptCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *coalescedSaveCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *shutdownJournalOrderCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c bossLootCheckingCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *epFailAfterPreflight) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c questLateProgressCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c questAckCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *bankCharacterRecoveryRepository) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *forgeReceiptCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *listingFaultCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *casinoFailCreditCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *bankSettlementFaultStore) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *bankCharacterMongoCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *adminRecoveryCommitter) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *tradeRecoveryStore) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
func (c *bankHandlerFaultStore) CommitBoundCharacterSave(a primitive.ObjectID, u string, p *database.Character, r string) error {
	return forwardBoundTestSave(c, a, u, p, r)
}
