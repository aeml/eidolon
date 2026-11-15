# Art authoring workspace

`art/source/` is checked-in work, **not disposable output**. It contains editable
Blender sources, authoring scripts, the equipment reviewer, and retained delivery
reports/previews. Runtime assets stay in [`assets/`](../assets/); temporary QA,
experiments and downloaded tools belong in ignored `output/`.

## Find the right entry point

- [Equipment authoring, bindings and local reviewer](../docs/art/EQUIPMENT_ASSETS.md)
- [Unequipped class bases](../docs/art/UNEQUIPPED_CLASS_BASES.md)
- [Provenance and component notices](../docs/art/CONTENT_PROVENANCE.md)
- [Source layout and migration notes](../docs/art/SOURCE_LAYOUT.md)

Use Git LFS to fetch `.blend` objects before opening them. A pointer-only clone is
sufficient for the read-only layout and runtime content checks, not Blender edits.

```sh
node scripts/check-art-source-layout.mjs
node scripts/generate-authored-equipment.mjs --check
```

The authoring and review scripts are **not** read-only checks: many export into
`assets/` or overwrite retained reports/previews alongside the sources. Run them
only for deliberate art work, and review the resulting diff. Do not bulk-delete
this tree, re-export binaries for a path cleanup, or commit unrelated QA output.
