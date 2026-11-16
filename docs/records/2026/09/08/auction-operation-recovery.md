# Auction operation recovery — implementation and remaining release gates

The refund outbox, recoverable bids, seller payouts, item claims/returns, buyouts
and listing escrow are implemented, with their acceptance evidence below and in
the resource implementation ledger. Stale client selection binding is added in
57c97c1;46ea069 closes publication-delay duration fairness. This remains an
unpublished candidate: enforced compatible-writer/rollback protection is open.

## Publication acceptance — September 8, 21:04 UTC

46ea069 starts the paid duration at first successful publication. Retries match
the existing listing's stored start/end and exact item/terms/owner/receipt, never
extend an acknowledged-lost publication. Earlier preparation-time publications
remain recoverable. Full64867 PASS root22.355/database1.172/game417.161s;
actual32868 PASS262.172s, TWO repetitions including an aged three-day decision
after a real failed publication/crash. First recovery grants a fresh24-hour
window and subsequent restart keeps it.84 child logs clean:16 intentional kills,
68 normal drains. Owned disposable Mongo2057/volumes removed/absent.

The schema7 compatibility bridgef2238ce is separate and unpublished. It refuses
schema8 before index/migration writes; actual binary refusal preserves unknown
character fields and zero mana. It still needs its full verification, ordered
release, integration here, and actual format-crossing/roll-forward acceptance.

## Selection acceptance — September 8, 20:51 UTC

57c97c1 requires expected item ID and exact selected stack count in ordinary
listing requests. Both are checked under the seller lock before reserving the
decision. Old/missing expectations fail closed. The UI stores the selection's
scalar identity/quantity and forwards those values; it does not reinterpret a
stale slot as its replacement. Open inventory refresh and submission invalidate
stale selections; explicit reselection permits listing the new item.

Full race77182 PASS0, root17.736/game415.255s (database/lifecycle cached).
Actual31382 PASS0/232.806s, TWO repetitions of nine normal/rejected listing
cases and seven SIGKILL boundaries. Independently checked78 child logs:14
intended crashes,64 clean normal drains, no races/panics. Owned corrected
Mongo2046/volumes removed/absent. Exact Go source unchanged from57c97c1.
Initial actual55659 failed its launcher's binary-basename identity setup and
skipped non-enabled failpoint cases; it provides no acceptance. Keep its log.

Historical duration requirement (now implemented in46ea069): preserve the paid listing's full advertised window
from first successful publication, not spend that window while escrow/publication
is unavailable. Preserve the unique auction/operation/item/deposit identity;
ambiguous insert recovery must reuse the already-published start/end, never
extend an existing listing on retry. The decision still stores preparation times;
the published auction now stores the actual publication window.

## Original gap, now addressed for bids

The former `TradingSystem.BidAuction` subtracted the bid from the live entity, then saved
the changed auction. The actor's full character save is a different operation.
A process interruption between those writes can retain an auction bid without
its debit. An ambiguous auction write error currently rolls memory back even
though Mongo may have committed the transition; a later full auction update
can overwrite that committed state, including a refund intent. Buyout and
collection similarly persist claimed flags separately from item/gold delivery.

## Implemented bid sequence — runtime030ec67, test correctiona09ac66

Schema8 uses a separate `auction_bid_operations` collection, not the earlier
proposed auction-local field. Unique indexes on operation ID and auction ID
allow one immutable decision per auction. It records actor/account, amount,
original escrow, refund ID and a once-computed anti-sniping deadline. This avoids
an ambiguous decision insert being overwritten by later full-auction saves.
In-memory reservations block competing bids, buyout, claims, cancellation,
expiry and refund acknowledgements while the operation is unresolved.

1. Persist the pending bid operation before any character debit. An ambiguous
   reply is an unresolved decision, not permission to revert and overwrite.
   Reconcile with an authoritative read; retain/freeze state if that read fails.
2. Apply the operation's signed gold delta and matching receipt in one complete
   character journal/save under account ordering. Same-ID replay must detect an
   already applied debit before checking the current balance. Insufficient funds
   may abort only when the debit receipt is provably absent.
3. Atomically advance the auction, append the preceding bidder's refund intent,
   and set `last_bid_operation_id` in one guarded pipeline update. Read that
   marker to recognize replay, then delete ONLY the matching operation ID and
   auction ID. The reservation remains until deletion is confirmed. A failed
   reply at either stage retains recoverable intent; it does not revert memory
   and overwrite an ambiguously committed transition.

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

## Bid acceptance and remaining cases

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

Actual corrected run37895 PASS439.525s, three repetitions on a09ac66:
six SIGKILL cut points plus same-bidder raises, repeated accepted requests and
simultaneous equal bids. Exact full-character resources/gear/XP and signed
receipt checks survive fresh-process logins. Same-bidder43→50→60 leaves1174
wallet gold plus60 escrow from initial1234 wealth; competing50 bids produce one
winner at1184, unchanged loser1234 and previous bidder refunded to1234. Current
same-bidder policy still requires the full new bid in the wallet before refund.

The same run repeats prior offline pending-save ordering, refund save/ack
failures, delayed100-intent backlogs and corrupt auction startup refusal.
All115 server logs independently clean:18 intended kills and97 normal shutdowns,
plus three expected startup rejections. Disposable Mongo/volumes removed.
Log `/tmp/eidolon-auction-bid-corrected-sessions.log`.

Earlier combined15368 FAIL252.707s is retained: global skip-two-update failpoint
selection hit a character save rather than the requested final auction write.
a09ac66 scopes the fault by namespace; the exact Mongo7.0.14 implementation
supports this filter in [commands.cpp](https://github.com/mongodb/mongo/blob/r7.0.14/src/mongo/db/commands.cpp).
No assertion was relaxed. Full Go race1501 PASS on the unchanged runtime030ec67
(root20.900/database1.129/game367.539s). Separate failed local journal, malformed
operation and rollback acceptance must still be extended; this is not arbitrary
unsaved-tick/power-loss/multiple-server-writer proof.

## Then extend the same recovery contract

Seller gold collection is implemented in3bd5df4 and the two-repetition actual
crash suite78070 passes337.931s. A seller_payout kind freezes amount/fee, shares
the per-auction reservation, credits through the account-ordered full-character
journal with receipt seller-payout:<operationID>, then finalizes only the seller
claim. All98 bid/payout/refund session logs are clean (24 intended kills,74
normal drained shutdowns). See the implementation evidence for exact boundaries
and limitations. This does not complete seller item returns or buyouts.

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

### Exact item delivery implementation (acceptance pending)

Update20:08:0c847a8 fullrace54188 and two-repetition actual85368 now PASS,
with68 independently clean logs. Buyout481c3d0 is implemented on top: debit and
item receipts commit with the full character before the guarded final sale and
previous-bid refund append. Initial focused tests pass; full83710 and actual73205
remain ACTIVE. Listing/deposit escrow and compatible rollback are still open.

0c847a8 implements item_claim operations for buyer claims and seller returns,
with immutable payload/original status, full-character item receipts, complete
storage-capacity planning, and account-ordered live/offline delivery before
claim finalization. Capacity failure is atomic, and replay checks the receipt
before storage. Focused race tests pass; full54188 and actual85368 are running.
See the implementation evidence for the exact pending scenarios. Buyout and
listing paths are not converted yet, and old writers remain unsafe rollback
targets. The following inspection/design records why this work was needed.

### Historical item-delivery inspection — September8, 19:39

Update20:29: buyout full83710 and actual73205 PASS,88 clean child logs.
Listing0908438 now persists current ownership before the decision, then journals
deposit+item escrow before idempotent publication. Focused tests pass; full34429
and actual39545 remain active. Stale listing-slot identity binding, delayed
publication/expiry fairness and enforced old-writer rollback are still open.

September8 inspection confirms persistent BuyoutAuction saves ItemClaimed before
debiting/granting the item in memory; CollectAuction finalizes the claim before
the handler adds the item. Neither path yet includes an item receipt in a full
character commit. Inventory/stash overflow currently falls back to nonpersistent
ground loot. These paths are not protected by the accepted seller-gold work.

Implement buyer claims and seller returns with an immutable item payload and
operation identity, a full-character delivery receipt and atomic inventory/stash
mutation under the existing world/entity/account ordering. Replay the receipt
before examining capacity, so a full bag after successful delivery cannot cause
a second grant or block finalization. If the entire item cannot fit before any
delivery, keep it collectible and leave bag/stash/claim unchanged, rather than
partially delivering and dropping an unjournaled remainder. Preserve every stat,
gem, potency, forge basis, icon and stack quantity. Buyouts must subsequently
commit the debit and exact item delivery together, before finalizing SOLD/claim
and previous-bid refund. Listing removal/deposit uses the matching escrow side.
Extend save/hydration/journal round-trip coverage for any new receipt fields;
old-writer rollback must be explicitly guarded before publication.
