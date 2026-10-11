# Licensing and fork policy

Eidolon uses the [Eidolon Source-Available Share-Back License v1.0](../LICENSE).
The license is authoritative; this document explains the intended workflow.

## What is allowed?

| Activity | Conditions |
| --- | --- |
| Translate UI, menus, items, quests, and other text into any language | Share the translation source when distributing or hosting it. |
| Modify code or add features | Share the complete modified source and notify upstream. |
| Host a regional server, including in Thailand | Keep attribution and provide a prominent source link to players. |
| Replace player or monster models, weapons, armor, equipment, or animations | Share editable asset sources, exports, and required custom tools with reuse rights. |
| Sell cosmetics, mounts, convenience items, VIP access, or other virtual items | Commercial use is allowed; the same sharing duties apply. |
| Integrate a payment provider | Share integrated payment code; keep credentials and customer data private. |

## Sharing improvements with upstream

Before distributing or opening a modified server to outside users:

1. Publish the complete matching code, translation files, editable assets, build
   scripts, and installation instructions under the same license. A GLB export
   alone is insufficient when a Blender project is the editable source.
2. Add a visible source link in the game and preserve license and provenance files.
3. Open an [upstream issue or pull request](https://github.com/aeml/eidolon)
   with the source URL, version identifier, and summary. Keep that submission or
   its linked release history current as you publish updates.
4. Keep sources available while the version is offered and for at least three
   years afterward. Retain an accessible source snapshot for each such version.

Publication alone does not satisfy the upstream notification requirement.
Upstream does not have to merge a submission for you to meet the license.
Authors retain ownership, but upstream receives the same rights to reuse,
modify, host, and redistribute their contributions as other recipients.
Private, unshared development does not require submission.

## Attribution

Use this credit in an accessible credits/about screen and on a public server website:

> Based on Eidolon by Robert Mendola, original developer and maintainer

Link to https://github.com/aeml/eidolon where supported. You may translate the
credit and add credits for your team. Clearly label your fork and server as
independently operated. Preserve other authors' notices too.

## Monetization and contribution acceptance

Official Eidolon does not sell in-game power. Paid membership and items must
remain cosmetic; upstream will not merge features that sell gameplay advantages.
For review purposes, consider an item's effects: a cosmetic mount appearance is
different from a paid speed bonus, and a "convenience" label does not make a
progression advantage cosmetic.

Independent forks may choose different monetization, including paid power.
That permission is deliberate and does not imply upstream endorsement. Their
integrated changes must still be shared, even when upstream declines them.
Payment-provider integration is permitted without separate project permission;
operators remain responsible for provider agreements and applicable law.

## Third-party material

Existing third-party licenses remain in force. Examples include the MakeHuman
CC0 source components documented in `assets/archetypes/*/PROVENANCE.md`, Cinzel's
SIL Open Font License in `assets/fonts/OFL.txt`, meshoptimizer's notice in
`assets/notices/meshoptimizer-LICENSE.txt`, and dependency/vendor notices.
These examples are not an exhaustive inventory or a grant of third-party rights.
The project license covers project-authored additions only to the extent the
copyright holders have authority to license them.

Replacement assets must permit delivery of editable sources and upstream reuse.
Buying an asset does not necessarily grant those rights. Do not submit assets
with incompatible redistribution terms. Do not publish secrets or player data.

## Why a custom license?

The [GNU AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html) addresses source
access for users of modified network software. It does not require sending
contributions to a particular upstream maintainer. Separate replacement artwork
also needs explicit terms. Eidolon's license explicitly requires upstream
notification and editable asset sharing, so describe it as **source-available**
rather than OSI-approved open source. It is not AGPL with extra restrictions.
