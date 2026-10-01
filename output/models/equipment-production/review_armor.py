from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/geometry.py').read_text(),'geometry.py','exec'))
FAMILIES={
 'plate':['iron-helm','plate-mail','plate-greaves','iron-boots','iron-gauntlets','steel-pauldrons','plated-girdle'],
 'leather':['leather-cap','leather-tunic','leather-pants','leather-boots','leather-gloves','reinforced-spaulders','studded-belt'],
 'cloth':['silk-hood','robes','silk-skirt','sandals','silk-gloves','velvet-mantle','silk-sash']}
def review_armor(CLASS,family='plate',tier='legendary',prefix=None):
    scene=bpy.context.scene;rig=bpy.data.objects[CLASS+'_Rig'];body=bpy.data.objects[CLASS+'_Body'];h=max(v.co.z for v in body.data.vertices)
    rig.animation_data.action=None
    for p in rig.pose.bones:p.matrix_basis.identity()
    scene.frame_set(1)
    for ob in bpy.data.collections['EQUIPMENT | individual fitted pieces'].objects:
        visible=ob.name in [name+'__'+tier+'__'+CLASS for name in FAMILIES[family]];ob.hide_render=not visible;ob.hide_set(not visible)
        if family=='cloth' and ob.name.startswith('silk-skirt__'):ob.hide_render=True;ob.hide_set(True)
    for name in [CLASS+'_Hair',CLASS+'_Scalp',CLASS+'_Undershorts',CLASS+'_Undertop',CLASS+'_Undershorts_Seams',CLASS+'_Undertop_Seams',CLASS+'_ClothSeams']:
        ob=bpy.data.objects.get(name)
        if ob:ob.hide_render=True;ob.hide_set(True)
    render_settings(scene);p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.refresh_devices()
    for d in p.devices:d.use=d.type=='OPTIX'
    scene.cycles.device='GPU';scene.cycles.samples=16;scene.render.resolution_x=720;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    if not scene.camera:studio()
    for label,loc in [('front',(0,-5,h*.63)),('angle',(3,-5,h*.87)),('back',(2,5,h*.78))]:
        camera=scene.camera;camera.location=loc;camera.rotation_euler=(Vector((0,0,h*.53))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=h*1.22
        scene.render.filepath=str(WORK/((prefix or CLASS.lower()+'-'+family+'-'+tier)+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
    return {'class':CLASS,'family':family,'tier':tier}
