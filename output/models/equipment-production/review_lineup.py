from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/review_armor.py').read_text(),'review_armor.py','exec'))
from mathutils import Quaternion
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='Eidolon | legendary equipment collection'
roster=[('Fighter','plate','iron-sword','wooden-shield'),('Wizard','cloth','wooden-staff','spell-tome'),('Cleric','plate','cleric-mace','wooden-shield'),('Rogue','leather','steel-dagger',None)]
grips=json.loads((DEST/'grip-transforms.json').read_text())['characters'];conversion=Matrix.Rotation(-math.pi/2,4,'X')
letter=material('Atelier lettering',(.62,.54,.37),.2,.55)
def text_label(text,location,size):
    data=bpy.data.curves.new(text,'FONT');data.body=text;data.size=size;data.align_x='CENTER'
    ob=bpy.data.objects.new(text,data);scene.collection.objects.link(ob);ob.location=location;ob.rotation_euler=(math.pi/2,0,0);data.materials.append(letter)
for index,(CLASS,family,main,off) in enumerate(roster):
    selected=[n+'__legendary__'+CLASS for n in FAMILIES[family]]
    with bpy.data.libraries.load(str(WORK/(CLASS.lower()+'-equipment.blend')),link=False) as(data,load):
        names=[n for n in data.objects if n.startswith(CLASS+'_') or n.startswith('socket_') or n in selected];load.objects=names.copy()
    objects=dict(zip(names,load.objects));root=bpy.data.objects.new(CLASS+' equipment display',None);scene.collection.objects.link(root)
    root.location.x=(index-1.5)*1.85
    for name,ob in objects.items():
        scene.collection.objects.link(ob)
        if ob.parent is None:ob.parent=root
        show=name in selected or name.startswith(CLASS+'_')
        if any(s in name for s in ['_Hair','_Scalp','_Undertop','_ClothSeams']):show=False
        if family!='cloth' and '_Undershorts' in name:show=False
        if family=='cloth' and name.startswith('silk-skirt__'):show=False
        ob.hide_set(not show);ob.hide_render=not show
    rig=objects[CLASS+'_Rig'];rig.hide_set(False);rig.hide_render=False
    with bpy.data.libraries.load(str(WORK/(CLASS.lower()+'-equipment.blend')),link=False) as(data,load):load.actions=['CombatIdle']
    rig.animation_data_create();rig.animation_data.action=load.actions[0]
    scene.frame_set(1);bpy.context.view_layer.update()
    for slot,item in [('mainHand',main),('offHand',off)]:
        if not item:continue
        with bpy.data.libraries.load(str(WORK/'weapons.blend'),link=False) as(data,load):load.objects=[item+'__legendary']
        weapon=load.objects[0];scene.collection.objects.link(weapon);weapon.hide_set(False);weapon.hide_render=False
        attachment=grips[CLASS][slot];weapon.parent=objects[attachment['socket']];a=attachment['localMatrix'];matrix=Matrix([a[i::4] for i in range(4)])
        weapon.matrix_basis=conversion.inverted()@matrix@conversion
    text_label(CLASS.upper(),(root.location.x,-.15,-.19),.14)
floor_mat=material('Slate stage',(.031,.043,.063),.15,.66)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.011));bpy.context.object.data.materials.append(floor_mat)
s=studio();s.camera.location=(1.0,-12,3.7);target=Vector((0,0,1.03));s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=8.2
s.render.resolution_x=2560;s.render.resolution_y=1300;s.render.resolution_percentage=100
text_label('E I D O L O N  /  L E G E N D A R Y',(0,.12,2.65),.17)
text_label('FOUR CHARACTER FITS  /  MODULAR ARMOR AND WEAPONS',(0,.12,2.43),.077)
scene.frame_end=73;scene.render.fps=30
s.render.filepath=str(WORK/'legendary-lineup.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'legendary-lineup.blend'),compress=True)
