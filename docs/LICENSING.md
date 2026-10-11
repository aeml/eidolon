# Licensing and fork policy

Eidolon's software uses **GNU AGPL v3 only** ([LICENSE](../LICENSE),
`AGPL-3.0-only`). Project-authored visual and audio game assets use the separate
[Eidolon Asset Share-Alike License v1.0](../ASSET-LICENSE). [NOTICE](../NOTICE)
defines scope and attribution. The license texts are authoritative.

## Permissions

You may translate the game into any language, modify code, add features, host
regional servers, replace assets, charge for VIP, sell virtual items, and
integrate payments. No separate project permission or revenue share is required
for compliant use. Third-party agreements and applicable laws still apply.

## Software source access

AGPL governs distribution of covered software and requires operators of modified
network versions to prominently offer interacting users free access to the
corresponding source under AGPL (section 13). Provide the exact matching version,
including covered modifications, translations, build scripts, and installation
materials required by the license. A visible Source link to the matching
repository or archive is a practical way to comply. Follow sections 4-6 when
distributing source or executable copies.

AGPL does not require a public GitHub repository, direct upstream notification,
or a pull request. Source recipients can redistribute it under AGPL, and
upstream can reuse it under AGPL. Contributions are welcome, but acceptance is
not required for compliance. Private development does not itself require
publishing changes.

Share integrated payment code when it is part of the covered software.
Independent payment services do not become AGPL simply because the game calls
their APIs. Keep credentials, private keys, player data, and transaction records
private; supply configuration templates instead.

## Assets and new models

When distributing or publicly hosting licensed assets or an adapted Eidolon
asset collection, provide recipients and network users free access to complete
matching editable asset sources under ASSET-LICENSE. This includes new and
replacement models, monsters, weapons, armor, equipment, mounts, textures, rigs,
and animations integrated into that adapted collection. A GLB export alone is
insufficient when a Blender project is the preferred editable source. Include
exports, required custom tools, and reproduction instructions.

Upstream receives the same reuse rights as every other recipient. No direct
submission is required. Retain accessible matching asset sources while offering
the version and for at least three years afterward. Replacement assets must
permit editable-source sharing and reuse; buying an asset does not necessarily
grant those rights.

The asset license applies to licensed assets and adaptations of their protected
collection, not AGPL software. Entirely independent artwork that neither uses
nor adapts those assets or their protected collection is outside its scope.
Standard AGPL software licensing cannot guarantee sharing of every independently
created replacement in a wholly independent asset collection.

Gameplay streams, screenshots, and promotional images have explicit permission
to display assets with reasonable attribution without delivering editable
sources for the recording or image.

## Attribution

Preserve applicable notices and credit Robert Mendola as Eidolon's original
developer and maintainer. NOTICE contains the software attribution term under
AGPL section 7(b). For assets, use this credit in accessible credits/about:

> Based on Eidolon by Robert Mendola, original developer and maintainer

Link to https://github.com/aeml/eidolon where supported. Translations are allowed.
Credit your contributors too and identify independently operated servers.
Credit does not grant endorsement or trademark rights.

## Monetization and contribution acceptance

Official Eidolon sells cosmetics, never in-game power. Upstream will not merge
paid gameplay advantages. A cosmetic mount appearance differs from a speed
bonus; calling a progression advantage "convenience" does not make it cosmetic.

Independent forks may choose different monetization, including paid power,
subject to the same applicable source-sharing duties. Permission does not imply
upstream endorsement or an obligation to merge their changes.

## Third-party material and transition

Existing third-party licenses remain in force, including MakeHuman CC0 base
components documented in `assets/archetypes/*/PROVENANCE.md`, Cinzel's SIL Open
Font License in `assets/fonts/OFL.txt`, meshoptimizer notices in
`assets/notices/meshoptimizer-LICENSE.txt`, and dependency/vendor notices.
These examples are not an exhaustive rights audit. The project grants only
rights its copyright holders own or have authority to license.

These terms replace the earlier combined custom license for this revision and
subsequent material released under them. They do not retroactively cancel
permissions already granted for copies under the earlier license.
