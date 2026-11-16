# Authored sources versus disposable output

## Directory contract

| Location | Purpose | Retention |
| --- | --- | --- |
| `art/source/class-bases/` | Roster Blender source and runtime derivation helper | Checked in |
| `art/source/{fighter,wizard,cleric,rogue}-production/` | Editable class bodies | Checked in with Git LFS |
| `art/source/equipment-production/` | Equipment sources, authoring tools, reviewer and accepted delivery evidence | Checked in |
| `assets/` | Published originals, selected runtime derivatives, manifests and notices | Checked in; preserve runtime paths and exact asset hashes |
| `output/` | Local experiments, temporary QA, downloaded tools and unselected exports | Ignored; not an authoring source location |

Start with [equipment authoring](EQUIPMENT_ASSETS.md) or
[unequipped class bases](UNEQUIPPED_CLASS_BASES.md). The repository-root static
server serves the reviewer at `/art/source/equipment-production/viewer.html`.
The production publisher still selects only its existing runtime inputs; it does
not publish the authoring tree. The reviewer is a local development tool.

## Migration inventory (2026-11-15)

All **104 tracked files** previously under `output/models/` were relocated under
`art/source/`, preserving their suffixes and directory depth. The migration moves
15 Blender LFS pointers, 27 PNG previews, four GLBs, 26 JSON files, 19 Python
scripts, 11 MJS scripts, one JS viewer and one HTML viewer. No untracked scratch
files are included. Blender pointer bytes and PNG/GLB bytes are unchanged; no
binary has been re-exported and no LFS object has been replaced.

The source/delivery paths in the authoring tools, delivery file list, source audit
locators, current art guides, source README references, NOTICE and equipment
manifest now use `art/source/`. The retained audit's measurements are historical,
not a claim that Blender validation was rerun. The dated Fighter pilot record
keeps its original historical `output/models/` reference. Embedded paths in
binary metadata are also historical; changing those would require a re-export.
External/manual commands using the old path must be updated; no filesystem
symlink or platform-specific alias is required.

The equipment runtime manifest pins the byte hash of the authored manifest.
That provenance hash changes to reflect the relocated source metadata. Runtime
model URLs, binary hashes, generated asset-version strings, grips, skeletal
bindings, motion profiles and selected geometry remain unchanged. No runtime
export/derivation command is needed for this move.

The reference inventory also checked `scripts/`, `.github/` and `package.json`:
none used the old authoring directory as a default or CI path. Root-depth-relative
imports in the moved tools remain valid because the new prefix has the same depth.

## Working safely

Run `node scripts/art/check-art-source-layout.mjs` to verify the listed delivery files,
source locators and LFS rule without changing assets. Run
`node scripts/content/generate-authored-equipment.mjs --check` for manifest hashes and the
runtime projection; `npm run check:content` covers the other generated content.

The retained export/QA helpers intentionally keep their existing behavior. Some
write runtime assets or evidence beside sources, and historical preservation
checks may require untracked `revision-v2/before/` inputs. They are not migration
checks. Do not run packaging, Blender export, screenshot capture or preservation
rewrites simply to validate a directory move. Put new disposable experiments in
`output/`; intentionally selected evidence requires a reviewed commit.

This reorganization does not change [asset terms](../../ASSET-LICENSE),
[software terms](../../LICENSE), [NOTICE](../../NOTICE), provenance, or the scope
of supplied component licenses.
