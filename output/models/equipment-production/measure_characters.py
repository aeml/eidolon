import bpy,json
from pathlib import Path
import numpy as np
ROOT=(Path(__file__).resolve().parents[3]);OUT=ROOT/'output/models/equipment-production';reports={}
for CLASS in ['Fighter','Wizard','Cleric','Rogue']:
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/models'/(CLASS.lower()+'-production')/(CLASS.lower()+'.blend')))
    rig=bpy.data.objects[CLASS+'_Rig'];rig.animation_data.action=None
    for p in rig.pose.bones:p.matrix_basis.identity()
    bpy.context.scene.frame_set(1);body=bpy.data.objects[CLASS+'_Body'];a=np.array([v.co[:] for v in body.data.vertices])
    reports[CLASS]={'height':float(a[:,2].max()),'bounds':[a.min(axis=0).tolist(),a.max(axis=0).tolist()],
      'bones':{b.name:{'head':list(b.head_local),'tail':list(b.tail_local),'matrix':[list(row) for row in b.matrix_local]} for b in rig.data.bones},
      'mesh_counts':{o.name:len(o.data.vertices) for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(CLASS)},
      'sockets':{o.name:[list(row) for row in o.matrix_world] for o in bpy.context.scene.objects if o.name.startswith('socket_')}}
(OUT/'character-measurements.json').write_text(json.dumps(reports,indent=2));print({n:r['height'] for n,r in reports.items()},flush=True)
