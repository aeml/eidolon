from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/rebuild_subset.py').read_text(),'rebuild_subset.py','exec'))
import sys
for CLASS in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['Fighter','Wizard','Cleric','Rogue']):
    bpy.ops.wm.open_mainfile(filepath=str(WORK/(CLASS.lower()+'-equipment.blend')))
    rebuild_subset(CLASS,['chest'])
