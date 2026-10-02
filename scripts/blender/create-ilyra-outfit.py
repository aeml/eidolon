"""Build Ilyra's dedicated outfit in a new Blender scene; never edit player assets.

Run through Blender MCP with EIDOLON_ILYRA_ROOT set in the execution namespace.
The supplied Wizard low-detail head/hands and Idle motion retain their original
rig. Clothing, ornament, staff and fabric maps are generated here in metres.
"""
import bpy
import bmesh
import json
import math
import os
import re
import struct
from mathutils import Vector

ROOT = globals()['EIDOLON_ILYRA_ROOT']
DEST = os.path.join(ROOT, 'assets/npcs/ilyra')
os.makedirs(DEST, exist_ok=True)
scene = bpy.data.scenes.new('Ilyra_Fourfold_Archmage')
bpy.context.window.scene = scene
before = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'assets/archetypes/Wizard/wizard-runtime-low.glb'))
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
rig.name = 'Ilyra_Rig'
idle = next(a for a in bpy.data.actions if a not in before and a.name.split('.')[0] == 'Idle')
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.location = (0, 0, 0)
    bone.rotation_quaternion = (1, 0, 0, 0)
    bone.scale = (1, 1, 1)
scene.frame_set(1)

# Keep the delivered head, neck and hands. Covered anatomy is removed only from
# this imported NPC copy; no runtime coverage manager can restore naked skin.
body = next(o for o in scene.objects if o.type == 'MESH' and o.name.startswith('Wizard_Body'))
allowed = {'head', 'neck_01'}
allowed.update(g.name for g in body.vertex_groups if g.name.startswith(('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_')))
kept = {v.index for v in body.data.vertices if sum(g.weight for g in v.groups if body.vertex_groups[g.group].name in allowed) > .55}
bm = bmesh.new()
bm.from_mesh(body.data)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in kept], context='VERTS')
bm.to_mesh(body.data)
bm.free()
body.name = 'Ilyra_HeadAndHands'
for obj in list(scene.objects):
    if obj.type == 'MESH' and ('Undershorts' in obj.name or obj.name.startswith('Icosphere')):
        bpy.data.objects.remove(obj, do_unlink=True)

cloth_map = bpy.data.images.new('Ilyra indigo woven silk', width=256, height=256)
pixels = []
for y in range(256):
    for x in range(256):
        weave = .91 + .06*math.sin(x*math.pi)*math.sin(y*math.pi/2) + .025*math.sin(x*13.1+y*7.9)
        pixels.extend((.085*weave, .105*weave, .19*weave, 1))
cloth_map.pixels.foreach_set(pixels)
cloth_map.pack()

def material(name, color, metallic=0, roughness=.65, emission=0, woven=False):
    mat = bpy.data.materials.new('Ilyra | '+name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    if woven:
        image = mat.node_tree.nodes.new('ShaderNodeTexImage')
        image.image = cloth_map
        mat.node_tree.links.new(image.outputs['Color'], p.inputs['Base Color'])
    return mat

indigo = material('midnight woven silk', (.085, .105, .19), roughness=.74, woven=True)
velvet = material('plum mantle velvet', (.13, .035, .115), roughness=.8)
gold = material('aged gilded bronze', (.53, .31, .095), .8, .3)
ivory = material('pale oath embroidery', (.62, .53, .34), .22, .5)
wood = material('ebonwood staff', (.025, .018, .014), .1, .54)
crystal = material('resonance crystal', (.045, .48, .7), .25, .22, 1.65)
elements = [material(name+' covenant stone', color, .18, .25, .7) for name, color in [
    ('Earth', (.08, .42, .17)), ('Water', (.055, .35, .68)), ('Fire', (.75, .15, .03)), ('Air', (.38, .15, .75))]]

def weights_at(z):
    if z <= 1.06:
        return {'pelvis': 1}
    if z <= 1.2:
        t = (z-1.06)/.14
        return {'pelvis': 1-t, 'spine_02': t}
    t = min(1, (z-1.2)/.25)
    return {'spine_02': 1-t, 'spine_03': t}

def mesh(name, vertices, faces, mat, weights=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    for face in data.polygons:
        face.use_smooth = True
    uv = data.uv_layers.new(name='WovenUV')
    for loop in data.loops:
        v = data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = ((math.atan2(v.y+.035, v.x)/(2*math.pi)) % 1, v.z/1.85)
    if weights is not None:
        obj.parent = rig
        mod = obj.modifiers.new('Ilyra shared skin', 'ARMATURE')
        mod.object = rig
        for i, vertex in enumerate(vertices):
            mapping = weights(vertex, i) if callable(weights) else weights
            for name, weight in mapping.items():
                if weight <= 0:
                    continue
                group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                group.add([i], weight, 'REPLACE')
    return obj

def tube(name, points, radius, mat, weights, sides=10):
    verts, faces = [], []
    for i, p in enumerate(points):
        p = Vector(p)
        tangent = Vector(points[min(len(points)-1, i+1)])-Vector(points[max(0, i-1)])
        tangent.normalize()
        cross = tangent.cross(Vector((0, 0, 1)))
        if cross.length < .01:
            cross = tangent.cross(Vector((1, 0, 0)))
        cross.normalize()
        other = tangent.cross(cross).normalized()
        r = radius[i] if isinstance(radius, list) else radius
        for j in range(sides):
            a = j*2*math.pi/sides
            verts.append(tuple(p+r*(math.cos(a)*cross+math.sin(a)*other)))
    for i in range(len(points)-1):
        for j in range(sides):
            a = i*sides+j
            faces.append((a, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, a+sides))
    faces.extend([tuple(reversed(range(sides))), tuple(range((len(points)-1)*sides, len(points)*sides))])
    return mesh(name, verts, faces, mat, weights)

def ring(name, z, rx, ry, width, mat, bone='spine_03', center=(0, -.035), segments=64):
    points = [(center[0]+rx*math.cos(i*2*math.pi/segments), center[1]+ry*math.sin(i*2*math.pi/segments), z) for i in range(segments+1)]
    return tube(name, points, width, mat, {bone: 1}, sides=6)

# A fully closed, pleated floor-length robe, not the player's short chest piece.
rings = [(z, rx, ry) for z, rx, ry in [( .06, .39, .3), (.12, .395, .3), (.33, .35, .255),
    (.62, .29, .22), (.9, .24, .18), (1.04, .2, .145), (1.13, .185, .135),
    (1.26, .235, .145), (1.42, .25, .145), (1.49, .2, .12), (1.57, .115, .085)]]
verts, faces = [], []
for z, rx, ry in rings:
    for j in range(96):
        a = j*2*math.pi/96
        fold = 1 + .045*math.sin(12*a)*(1.57-z)/1.5
        verts.append((rx*math.cos(a)*fold, -.035+ry*math.sin(a)*fold, z))
for i in range(len(rings)-1):
    for j in range(96):
        a = i*96+j
        faces.append((a, i*96+(j+1)%96, (i+1)*96+(j+1)%96, a+96))
mesh('Ilyra_FullLengthRobe', verts, faces, indigo, lambda v, _: weights_at(v[2]))
ring('Ilyra_GoldHem', .072, .399, .307, .009, gold, 'pelvis')
ring('Ilyra_EmbroideredHem', .11, .405, .311, .0035, ivory, 'pelvis')
ring('Ilyra_WideSash', 1.065, .21, .157, .023, velvet, 'pelvis')
ring('Ilyra_SashBraid', 1.05, .222, .168, .006, gold, 'pelvis')
ring('Ilyra_NeckBinding', 1.568, .119, .09, .008, gold)

# Structured sleeves retain per-joint weights and decorative flared cuffs.
for side in ['l', 'r']:
    upper, lower, hand = [rig.data.bones[name+'_'+side] for name in ['upperarm', 'lowerarm', 'hand']]
    points = [upper.head_local, upper.head_local.lerp(upper.tail_local, .55), upper.tail_local,
        lower.head_local.lerp(lower.tail_local, .6), lower.tail_local]
    def arm_weights(v, i, side=side):
        row = i//20
        return {('upperarm_' if row < 2 else 'lowerarm_')+side: 1}
    tube('Ilyra_Sleeve_'+side, points, [.108, .092, .082, .09, .125], indigo, arm_weights, sides=20)
    cuff = lower.tail_local
    axis = (lower.tail_local-lower.head_local).normalized()
    tube('Ilyra_GildedCuff_'+side, [cuff-axis*.025, cuff+axis*.012], [.13, .127], gold, {'lowerarm_'+side: 1}, sides=20)

# Back mantle and a high open-front collar give the archmage a broad silhouette.
verts, faces = [], []
for row, (z, rx, ry) in enumerate([( .09, .43, .34), (.34, .39, .31), (.8, .33, .245), (1.25, .33, .195), (1.5, .35, .16), (1.66, .17, .1)]):
    for j in range(49):
        a = j*math.pi/48
        verts.append((rx*math.cos(a), .01+ry*math.sin(a)+.014*math.sin(a*8), z))
for i in range(5):
    for j in range(48):
        a = i*49+j
        faces.append((a, a+1, a+50, a+49))
mesh('Ilyra_HighMantle', verts, faces, velvet, lambda v, _: weights_at(v[2]))
for sign in [-1, 1]:
    tube('Ilyra_MantleGoldEdge_'+str(sign), [(sign*x, .015, z) for z, x in [( .09, .436), (.34, .396), (.8, .336), (1.25, .336), (1.5, .356), (1.66, .176)]], .008, gold, lambda v, _: weights_at(v[2]))

def gem(name, location, scale, mat, bone='spine_03'):
    x, y, z = location
    sx, sy, sz = scale
    vertices = [(x, y-sy, z), (x-sx, y, z), (x, y, z+sz), (x+sx, y, z), (x, y, z-sz), (x, y+sy*.4, z)]
    faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)]
    return mesh(name, vertices, faces, mat, {bone: 1})

for i, mat in enumerate(elements):
    x = (i-1.5)*.055
    gem('Ilyra_CovenantMount_'+str(i), (x, -.19, 1.4), (.029, .015, .04), gold)
    gem('Ilyra_Covenant_'+str(i), (x, -.208, 1.4), (.018, .012, .025), mat)
gem('Ilyra_OathSeal', (0, -.205, 1.23), (.065, .013, .085), gold)
gem('Ilyra_OathSealCrystal', (0, -.223, 1.23), (.029, .011, .038), crystal)

# Front stole with gilded borders and small geometric Fourfold sigils.
for sign in [-1, 1]:
    points = [(sign*x, y, z) for x, y, z in [( .094, -.13, 1.535), (.13, -.195, 1.4), (.08, -.207, 1.2), (.09, -.225, .86), (.14, -.292, .4), (.17, -.342, .12)]]
    tube('Ilyra_FourfoldStole_'+str(sign), points, .026, velvet, lambda v, _: weights_at(v[2]), sides=6)
    tube('Ilyra_StoleGold_'+str(sign), [(x+sign*.023, y-.007, z) for x, y, z in points], .004, gold, lambda v, _: weights_at(v[2]), sides=6)
for i, z in enumerate([.25, .42, .59, .76, .93]):
    for sign in [-1, 1]:
        x = sign*(.09+.075*(1-z))
        y = -.36+.16*z
        tube('Ilyra_Rune_'+str(i)+'_'+str(sign), [(x, y, z+.025), (x+.016, y, z), (x, y, z-.025), (x-.016, y, z), (x, y, z+.025)], .003, ivory, {'pelvis': 1}, sides=4)

# A circlet, rather than a tall cone hat, keeps the face and gold quest marker clear.
ring('Ilyra_ArchmageCirclet', 1.766, .106, .111, .008, gold, 'head', center=(0, -.04))
gem('Ilyra_CircletStone', (0, -.16, 1.773), (.026, .013, .036), crystal, 'head')
for side in [-1, 1]:
    tube('Ilyra_CircletWing_'+str(side), [(side*.025, -.144, 1.76), (side*.055, -.133, 1.795), (side*.083, -.118, 1.822)], [.008, .007, .002], gold, {'head': 1}, sides=6)

# Staff geometry is authored in the delivered Idle hand pose, then transformed
# back into bind space. It remains upright and genuinely follows that hand.
rig.animation_data.action = idle
scene.frame_set(1)
bpy.context.view_layer.update()
hand = rig.pose.bones['hand_r']
hand_position = hand.head.copy()
staff_objects = []
cx, cy = hand_position.x-.005, hand_position.y-.02
staff_objects.append(tube('Ilyra_StaffEbonwood', [(cx, cy, .07), (cx, cy, 1.91)], .018, wood, {'hand_r': 1}, sides=12))
for z in [.08, .2, .87, 1.02, 1.78, 1.88]:
    staff_objects.append(ring('Ilyra_StaffBinding_'+str(z), z, .027, .027, .007, gold, 'hand_r', center=(cx, cy), segments=20))
staff_objects.append(gem('Ilyra_StaffResonanceHeart', (cx, cy, 2.02), (.063, .047, .112), crystal, 'hand_r'))
for i in range(4):
    a = i*math.pi/2
    staff_objects.append(tube('Ilyra_StaffCrown_'+str(i), [(cx+.045*math.cos(a), cy+.045*math.sin(a), 1.88),
        (cx+.09*math.cos(a), cy+.09*math.sin(a), 2.01), (cx+.052*math.cos(a), cy+.052*math.sin(a), 2.13)], [.013, .01, .004], gold, {'hand_r': 1}, sides=8))
bind = rig.data.bones['hand_r'].matrix_local @ hand.matrix.inverted()
for obj in staff_objects:
    for vertex in obj.data.vertices:
        vertex.co = bind @ vertex.co

# Name and export only the NPC Idle action. Other actors' imported actions and
# scenes remain untouched in the shared Blender session.
idle.name = 'Ilyra_Idle'
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 120
for track in list(rig.animation_data.nla_tracks):
    rig.animation_data.nla_tracks.remove(track)
rig.animation_data.action = idle
# Combine compatible costume pieces into one skinned mesh with material groups:
# ornament count must not become dozens of draw calls for a stationary NPC.
costume = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith('Ilyra_') and o != body]
for obj in scene.objects:
    obj.select_set(obj in costume)
bpy.context.view_layer.objects.active = costume[0]
bpy.ops.object.join()
bpy.context.object.name = 'Ilyra_FourfoldCostume'
for obj in scene.objects:
    obj.select_set(obj.type in {'MESH', 'ARMATURE', 'EMPTY'})
bpy.context.view_layer.objects.active = rig
output = os.path.join(DEST, 'ilyra-archmage.glb')
bpy.ops.export_scene.gltf(filepath=output, export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_frame_range=True,
    export_force_sampling=True, export_yup=True, export_materials='EXPORT', export_image_format='AUTO',
    export_nla_strips_merged_animation_name='Idle')

# Shared Blender sessions suffix duplicate object names. Canonicalize only this
# generated GLB, never objects in someone else's scene. References use indices.
with open(output, 'rb') as exported:
    packed = exported.read()
json_length = struct.unpack_from('<I', packed, 12)[0]
document = json.loads(packed[20:20+json_length])
for collection in ('nodes', 'meshes', 'skins', 'materials'):
    for entry in document.get(collection, []):
        if 'name' in entry:
            entry['name'] = re.sub(r'\.\d{3}$', '', entry['name'])
encoded = json.dumps(document, separators=(',', ':')).encode('utf-8')
encoded += b' ' * ((-len(encoded)) % 4)
tail = packed[20+json_length:]
with open(output, 'wb') as exported:
    exported.write(struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(tail)))
    exported.write(struct.pack('<II', len(encoded), 0x4e4f534a))
    exported.write(encoded)
    exported.write(tail)

# Separate presentation scene content is not exported as game geometry.
floor_mat = material('preview floor', (.035, .045, .06), roughness=.84)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.025))
floor = bpy.context.object
floor.name = 'IlyraPreviewFloor'
floor.data.materials.append(floor_mat)
camera_data = bpy.data.cameras.new('IlyraPortrait')
camera = bpy.data.objects.new('IlyraPortrait', camera_data)
scene.collection.objects.link(camera)
camera.location = (3.2, -5.2, 2.75)
camera.rotation_euler = (Vector((-.04, 0, 1.08))-camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.65
scene.camera = camera
for name, location, energy, color, size in [
    ('Key', (2, -3, 4), 500, (1, .85, .68), 3),
    ('Fill', (-2, -1, 2), 230, (.6, .75, 1), 2),
    ('Rim', (0, 2, 3), 650, (.5, .65, 1), 2)]:
    light_data = bpy.data.lights.new('Ilyra'+name, 'AREA')
    light_data.energy, light_data.color, light_data.shape, light_data.size = energy, color, 'DISK', size
    light = bpy.data.objects.new('Ilyra'+name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0, 0, 1))-light.location).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('IlyraPortraitWorld')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.04, .055, .085, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = os.path.join(DEST, 'ilyra-portrait.png')
print(json.dumps({'scene': scene.name, 'glb': output, 'bytes': os.path.getsize(output), 'render': scene.render.filepath,
    'rigJoints': len(rig.data.bones), 'outfitMeshes': len([o for o in scene.objects if o.type == 'MESH' and o.name.startswith('Ilyra_')])}))
