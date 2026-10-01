"""Read-only checks for the published packed Blender sources."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'output/models/equipment-production'
manifest=json.loads((WORK/'delivery-files.json').read_text(encoding='utf-8'))
results=[]
for name in manifest['files']:
    if not name.endswith('.blend'):continue
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/name))
    missing=[];packed=0
    for im in bpy.data.images:
        if im.source!='FILE':continue
        if im.packed_file or len(im.packed_files):packed+=1
        else:missing.append({'image':im.name,'path':im.filepath})
    if missing:raise RuntimeError(f'Unpacked image dependencies in {name}: {missing}')
    results.append({'file':name,'packedImages':packed,'externalImageDependencies':0})
(WORK/'revision-v2/source-audit.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print('Verified packed sources:',len(results),flush=True)
