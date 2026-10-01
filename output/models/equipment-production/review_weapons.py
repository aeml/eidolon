from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/geometry.py').read_text(),'geometry.py','exec'))
scene=bpy.data.scenes.new('Eidolon | weapon catalogue');bpy.context.window.scene=scene
with bpy.data.libraries.load(str(WORK/'weapons.blend'),link=False) as (data,load):
    load.objects=[n for n in data.objects if '__standard' in n or '__legendary' in n]
mat=material('Catalogue lettering',(.67,.72,.80),0,.8)
names=['iron-sword','steel-dagger','wooden-staff','cleric-mace','wooden-shield','spell-tome']
for item in load.objects:
    scene.collection.objects.link(item);item.hide_set(False);item.hide_render=False
    stem,tier=item.name.split('__')[:2];column=names.index(stem);height=max(v.co.z for v in item.data.vertices)-min(v.co.z for v in item.data.vertices);scale=1.32/height
    item.scale=(scale,scale,scale);item.location.x=(column-2.5)*1.28;item.location.z=(1.93 if tier=='standard' else .14)-min(v.co.z for v in item.data.vertices)*scale
    item.rotation_euler.z=math.radians(-12)
def label(text,loc,size):
    d=bpy.data.curves.new(text,'FONT');d.body=text;d.size=size;d.align_x='CENTER';o=bpy.data.objects.new(text,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);d.materials.append(mat)
for i,name in enumerate(names):label(name.upper().replace('-',' '),((i-2.5)*1.28,-.08,3.48),.11)
label('COMMON / UNCOMMON / RARE',(0,0,3.72),.14);label('L E G E N D A R Y',(0,0,1.72),.16)
s=studio();s.camera.location=(0,-10,4.2);target=Vector((0,0,2));s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=8.1
s.render.resolution_x=2160;s.render.resolution_y=1160;s.render.filepath=str(WORK/'weapon-catalogue.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'weapon-catalogue.blend'),compress=True)
result={'preview':s.render.filepath}
