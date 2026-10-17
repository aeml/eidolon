# Earned people and places in the Lore Book

The Lore Book requirements include navigable people and places as well as
chapters and discoveries. The current deployed book provides the latter two.
This candidate adds People and Places filters with references to the original
personal memories, preserving the existing All memories search and list.

An index entry exists only when a completed chapter, personally recorded
discovery or earned restoration account supplies its evidence. Pending quests,
completion counts, unrecorded sites and static catalog availability do not
unlock it. Names identify matching earned words; pages quote those words rather
than inventing biographies or revealing future descriptions. A surname appears
only after a recorded account uses it, with a stable identity across updates.
Recorded realm metadata supplies place context; unread places stay out.

Read opens the original account. Return restores the previous person/place,
filter, search and list scroll, and focuses the reading heading. Refresh keeps
the reader's context; switching characters or removing the underlying personal
evidence clears it. Original manual acceptance, reward claiming, saved receipts,
current tasks and story recap remain unchanged. Shared44px filter/action sizing
and wrapping support keyboard, mouse and phone touch layouts.

All30focused cases across the existing LoreBook and new LoreMemoryIndex suites
pass, including twelve new privacy/reference/navigation cases. Scoped lint passes.
The first run exposed duplicate index entries under All memories and an invalid
one-site test assumption. Original inputs and its three failures are retained;
the implementation preserves the original memory-only list and the fixture now
uses actual sparse multi-site evidence. Existing UI count/focus assertions were
retained. Twelve new cases do not replace the original eighteen.

The two existing desktop/phone earned-memory browser cases are extended with
people/place navigation and read/return interactions. The two returning-story
cases retain their coverage. Their first four native executions pass in13.1seconds.
Two subsequent targeted cases expose a lost Read focus and stale Return label
when new personal evidence rebuilds the page. Stable action identities now
preserve focus through the existing journal owner; return-label changes update
the page signature. Both negative cases and their inputs remain preserved.
Final-source native execution and reviewed captures are pending; this isolated
candidate is not yet selected, merged or published. Final physical
device, whole-game usability and owner art review remain open. The full original
goal stays active; no campaign, soak or server stress run is introduced.
