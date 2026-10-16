# Garment saved sessions and remote protocol

Source `714e76689` adds a real saved-session check for the complete outfit and
independent held slots. The production runtime remains identical to Alpha61
source `a60c8e916`; this selects test/CI coverage, not new garment behavior.

A prepared returning Fighter retains three older individual looks, purchases
Iron Oath Regalia, Grovekeeper Blade and Grovekeeper Shield, then selects each
slot through actual sockets. Owner and nearby observer protobuf carry the same
selected looks without changing real gear or combat stats. Three ordinary server
process lifetimes preserve the collection and selections. Purchase replay does
not debit EP again. Removing the outfit retains the old head choice and new
independent hand choices, and the cleared outfit remains cleared after restart.
Gold, level/XP, inventory/stash and unrelated receipts stay unchanged.

Two race-enabled actual Mongo/socket cases pass with count1 and a90s timeout:
the existing chest purchase/confirmation/restart and this new case,23.062s total.
Seven workflow guard checks, gofmt and diff checks pass. Both socket cases are
now enrolled against the CI job's existing disposable Mongo and built binary.
The current61pipeline predates this addition; it does not execute the new case.

Initial new/diagnostic runs caught a fixture timing mistake: attributes10 at
login became11 after ordinary town rest activated the existing10% Well Rested
boost. The corrected baseline waits for that real transition. Healing, clocks,
rules and exact stat equality remain intact. Original failures are retained in
[the source-scoped receipt](2026-10-16-garment-saved-session-qualification.json).

All disposable processes/database were retired. No production account, currency,
role, access, schema or invitation changed. This is protocol/persistence proof,
not earned progression, actual browser rendering, old-binary migration or final
visual/beta acceptance. Existing garment render receipts remain separate.
