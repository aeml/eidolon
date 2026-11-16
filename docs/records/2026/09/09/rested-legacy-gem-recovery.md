# Legacy gem recovery with earned town rest

Complete58 run12130 on a7ef83c reached equipment recovery after passing initial
authentication/manual pickup/portal, the dungeon batch, area/shape spells and
phone movement/combat/party/inventory checks. The legacy save fixture then failed:
it expected10 Intelligence but observed11. Original log
`/tmp/eidolon-rest58-all-node24-rerun-0610.log`; sanitized failure archive
`/tmp/eidolon-rest58-gem-rest-failure-e5EF2M/test-results`. Terminal1, scan0 and
exact temporary containers/image independently confirmed absent.

That fixture starts a living Wizard in Lanternhold with saved base Intelligence10
and an unsupported equipped loose gem claiming+999 Intelligence. The intended
production behavior is base10 and total11 with earned Well Rested, not disabling
the requested town stat bonus to retain an old assertion.

Before recovery and after reconnect, the test now waits for positive earned rest
in Lanternhold and asserts BOTH base10 and total11. This still rejects the gem's
illegal stats or compounded modifiers. The full25-slot rejection, legal sword
equip,18+5=23 exact gem quantity, unsupported-slot removal, rejected gem equip,
actual Mongo save and fresh-login assertions are unchanged. No production code,
fixture grant, timer mutation or resource refill is added.

Lint/diff passed; focused actual legacy recovery and complete gameplay reruns
remain required. A targeted source search for the same hardcoded player-stat
assumption found only a raw equipped-weapon damage46 assertion in Forge, which
must remain raw item data and is not modified by Well Rested. This search is not
proof that every remaining gameplay scenario passes.
