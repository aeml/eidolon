# Auction operation recovery — required next, not implemented

The refund outbox is implemented and tested separately. It does not make bid
debits, item transfers or seller payouts atomic with the auction document.
Do not assign/release the resource candidate on the strength of refund-only QA.

## Confirmed gap

`TradingSystem.BidAuction` subtracts the new bid from the live entity, then saves
the changed auction. The actor's full character save is a different operation.
A process interruption between those writes can retain an auction bid without
its debit. An ambiguous auction write error currently rolls memory back even
though Mongo may have committed the transition; a later full auction update
can overwrite that committed state, including a refund intent. Buyout and
collection similarly persist claimed flags separately from item/gold delivery.

## Next implementation: durable bid operation first

Use an auction-local pending operation as the durable decision record. Give it
an immutable ID, actor/account, amount, original bid/escrow identity and intended
next bid. Do not replace the active bid or issue its preceding-bid refund until
the new debit is durably receipted. Reserve the auction against competing
mutations while this operation is unresolved.

1. Persist the pending bid operation before any character debit. An ambiguous
   reply is an unresolved decision, not permission to revert and overwrite.
   Reconcile with an authoritative read; retain/freeze state if that read fails.
2. Apply the operation's signed gold delta and matching receipt in one complete
   character journal/save under account ordering. Same-ID replay must detect an
   already applied debit before checking the current balance. Insufficient funds
   may abort only when the debit receipt is provably absent.
3. Atomically advance the auction, append the preceding bidder's refund intent,
   and clear the pending operation in the same auction update. Retry/reconcile
   an ambiguous result without charging the actor again or losing the intent.

Startup must recover pending operations before affected accounts can log in and
spend stale balances. Ordinary commands already hold the account work lock, so
use an explicitly lock-owned delivery helper; do not call a helper that acquires
the same non-reentrant lock again. Recovery outside command dispatch must acquire
it. Never hold a global world/entity lock during database IO, nor acquire an
account work lock while holding the trading lock. Keep auction state reservation
separate from the short mutex protecting its in-memory record.

The debit receipt must travel with every subsequent complete character snapshot,
including local write failure pinning, expiry, reconnect and final shutdown.
Do not implement a debit as an unrelated Mongo increment underneath a pending
full snapshot. Do not manufacture funds to get recovery through an error.

## Required bid acceptance

| Interrupted boundary | Required recovered result |
|---|---|
| Before operation record commits | Original bid/character unchanged |
| Operation persisted, debit not applied | Finish valid debit/transition once, or proven clean abort |
| Debit journaled, Mongo write pending | Replay exact character and receipt before completing bid |
| Debit committed, transition not committed | Complete bid without a second debit |
| Transition committed, reply lost | Read/recognize final bid and one preceding-bid refund |
| Old refund paid, acknowledgement lost | Existing refund receipt prevents a second payout |

Exercise ordinary bid input and real saved sessions; prepared starting escrow is
acceptable if labeled. Include same-bidder raises, concurrent competing bidders,
insufficient funds, repeated reconnects, failed local journal, delayed/rejected
Mongo writes, and actual interruption at each boundary. Keep receipt/intent,
equipment, resources, XP and both participants' gold assertions explicit.

## Then extend the same recovery contract

- Buyout: reserve operation, debit once, deliver the exact item once, create any
  previous-bid refund, and finalize sold/claimed state without lost items.
- Seller collection/cancellation: durable payout/item-return operation and
  receipt, with full bags/stash and already-claimed retry cases.
- Fail-closed operation loading and bounded recovery under outages; maintain
  existing refund worker coalescing/backoff/shutdown limits.
- Compatible rollback or an enforceable roll-forward-only deployment guard.
  Legacy full-character writers erase new resources/receipts and cannot serve
  as an assumed safe rollback target. Receipt retention/compaction must not
  reopen previously acknowledged operations.

This is implementation direction, not a completed design proof or replacement
for the full roadmap. Validate each state transition against the actual code and
real failure evidence as it is implemented.
