import bpy
from pathlib import Path
root=(Path(__file__).resolve().parents[3]);work=root/'output/models/equipment-production';rev=work/'revision-v2'
for CLASS in ['Fighter','Wizard','Cleric','Rogue']:
    source=root/'output/models'/(CLASS.lower()+'-production')/(CLASS.lower()+'.blend')
    bpy.ops.wm.open_mainfile(filepath=str(rev/(CLASS.lower()+'-animation-review.blend')))
    for action in list(bpy.data.actions):
        if '_' in action.name:bpy.data.actions.remove(action)
    rig=bpy.data.objects[CLASS+'_Rig'];rig.animation_data.action=None;rig['motion_revision']=2
    for p in rig.pose.bones:p.matrix_basis.identity()
    bpy.context.scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(work/(CLASS.lower()+'-equipment.blend')))
    rig=bpy.data.objects[CLASS+'_Rig'];rig.animation_data.action=None
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    with bpy.data.libraries.load(str(source),link=False) as(data,load):load.actions=list(data.actions)
    for action in load.actions:action.use_fake_user=True
    for p in rig.pose.bones:p.matrix_basis.identity()
    rig['motion_revision']=2;bpy.context.scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(work/(CLASS.lower()+'-equipment.blend')),compress=True)
    print('PROMOTED',CLASS,flush=True)
