# Compact desktop party roster

The native four-player healing screenshot on899a8664 showed only two of four
teammates without scrolling. This follow-up keeps name, HP and combat role inside
each healing-target row, places leader actions alongside rather than below it,
and removes repeated per-member Gold-pool text. The complete shared-credit and
maximum eligible-party Gold explanation remains below the roster. Names truncate
visually but retain the full accessible target label; the clear-target action is
at the start of the mode button so a long name cannot hide it.

The panel uses more of its already-reserved space, retaining its chat clearance,
scrolling, viewport width bounds and separate phone presentation. Four-member
desktop layout is explicitly tested at1280x720 and1440x900 for leader/member
views. Short screens and ten-member raids retain scrolling; this is not a claim
that all raid members fit every viewport. No combat or server source changes.

Initial focused4271 passed129 tests/3suites12.009s plus lint.49855 passed final
lint and discovered three menu-layer browser cases, including the new layout
check. Browser proof, inspected screenshots, final full client regression,
primary integration and release/version/live acceptance remain pending. This
worktree was separated from primary so its running dungeon source stayed frozen.

Final action-separation16417 passed40 SocialUI tests2.702s plus lint. Kick and
Promote remain sibling controls rather than nested buttons, call their original
handlers, and do not alter the healing selection. No browser has run this source
yet; the four-role gameplay run still owns that test slot.

Native75590 passed all three menu-layer tests on cleanba481c09 in38.5s, including
four targets at720p/900p for leader/member, existing ten-member/resized-chat
reachability and service/dialog layers. The720p leader and900p member captures
were inspected: four readable HP/role rows, selected-row fill, ellipsized long
names with full accessible labels, separate K/P controls and clear chat spacing.
Secondary controls remain below the scroll fold at720p. This proves the compact
roster layout, not overall game art or physical-phone playability. Archive
`/tmp/eidolon-compact-party-proof-rKe4nx`; static listener41981 cleaned up.
Primary integration follows this native pass; full client regression and release
acceptance remain required.

Integrated full client97135 passed on clean4c3a6318:311 suites/4303 tests151.364s
plus zero-warning lint. This includes the latest party input policy tests and
roster behavior. Server source remains unchanged from the prior full race pass.
The next four-browser run still must verify the changed controller and complete
the dungeon/individual turn-in/relogin route; no deployment is implied.
Proposed patch note: The desktop party roster is more compact, keeping four
teammates' health and healing targets together on a standard720p display. Role
information stays with each member, and party reward rules are explained once.
