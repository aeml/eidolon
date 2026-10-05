package database

// Coverage describes this file, not a claim that remaining categories contain
// no data. Provider/local/archive data cannot be collected by this Mongo reader.
type ownerExportCoverage struct {
	CompleteAccountExport bool     `json:"complete_account_export"`
	Included              []string `json:"included"`
	NotIncluded           []string `json:"not_included"`
	WithheldPrivate       []string `json:"withheld_private"`
	SeparateHandling      []string `json:"separate_handling"`
	Consistency           string   `json:"consistency"`
}

func ownerSectionCoverage(section string) ownerExportCoverage {
	coverage := ownerExportCoverage{
		WithheldPrivate:  []string{"Credential hashes, recovery digests and authentication secrets", "Private staff reasons, review receipts and economic replay/custody payloads", "Other accounts' private records"},
		SeparateHandling: []string{"Activity/session history and account moderation/VIP information", "Friendships, guilds/invites, auctions/trades and economic/reward outcome summaries", "PvP profiles, raid lockouts and shared casino state", "Save journals, server logs, backups and infrastructure records", "Postmark/analytics provider copies and data held by your browser/device"},
		Consistency:      "Current bounded section read, not a restore image or cross-store point-in-time account snapshot. Unsupported data is not assumed absent.",
	}
	switch section {
	case "profile":
		coverage.Included = []string{"Account username, public name, submitted registration email and creation time", "Verified recovery address/time if present and valid"}
		coverage.NotIncluded = []string{"All character gameplay sections", "Owner-submitted report pages"}
	case "progress":
		coverage.Included = []string{"One named character: class, level, XP/resonance, currencies, stats/resources and Well Rested", "Inventory, stash, buyback, equipment/loadouts, hotbar, quests, skill/talent choices and appearances"}
		coverage.NotIncluded = []string{"Account profile and other characters", "Position, active dungeon/run state, timestamps and private recovery/delivery state", "Owner-submitted report pages"}
	case "reports":
		coverage.Included = []string{"One page of your submitted report text, type, reference, case status and timestamps"}
		coverage.NotIncluded = []string{"Account profile and character gameplay sections", "Reports submitted by anyone else, including reports about your account"}
		coverage.Consistency = "Newest-first immutable-ID keyset pages, at most ten submissions per file. Follow next until absent; new submissions and reviews during paging are not a frozen account snapshot. A failed/oversized page is not complete."
	}
	return coverage
}
