"""Blender authoring primitives for Eidolon's fitted equipment collection."""
import bpy,bmesh,math,json
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=(Path(__file__).resolve().parents[3]);WORK=ROOT/'output/models/equipment-production';DEST=ROOT/'assets/equipment/authored'

def material(name,color,metal=.0,rough=.6,emission=0):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
    if emission:
        m.cycles.emission_sampling='NONE'
    return m

def palette(tier,family='plate',theme=None):
    legend=tier=='legendary';prefix=tier+' '+family
    palettes={'plate':((.16,.205,.25),(.64,.40,.12),(.035,.40,.75)),
              'leather':((.060,.038,.052),(.25,.19,.29),(.35,.025,.65)),
              'cloth':((.026,.04,.115),(.60,.42,.16),(.035,.44,.80)),
              'holy':((.55,.60,.57),(.74,.46,.12),(.95,.62,.15)),
              'wood':((.11,.051,.023),(.32,.19,.055),(.02,.35,.73))}
    base,trim,glow=palettes.get(family,palettes['plate'])
    if not legend:
        base={'plate':(.21,.25,.28),'leather':(.12,.059,.025),'cloth':(.068,.047,.105),'holy':(.24,.28,.29),'wood':(.14,.062,.023)}.get(family,base)
        trim=(.37,.31,.20) if family in ['wood','leather','cloth'] else (.43,.48,.50)
    ismetal=family in ['plate','holy']
    return {'main':material(prefix+' | main',base,.80 if ismetal else .0,.3 if ismetal else .78),
            'trim':material(prefix+' | edges',trim,.85,.28),
            'steel':material('Forged silver',(.48,.56,.62),.86,.25),
            'dark':material('Undersuit charcoal',(.023,.027,.035),.02,.87),
            'leather':material('Wrapped oxblood leather',(.10,.037,.023),0,.79),
            'wood':material('Dark ashwood',(.13,.054,.021),0,.67),
            'paper':material('Vellum',(.70,.63,.45),0,.9),
            'gem':material(prefix+' | cut crystal',glow,.35,.18,1.3 if legend else 0),
            'glow':material(prefix+' | luminous inlay',glow,0,.32,5 if legend else 0)}

class Builder:
    def __init__(self,name):self.name=name;self.v=[];self.f=[];self.mi=[];self.sm=[];self.mats=[]
    def add(self,verts,faces,mat,smooth=False):
        if mat not in self.mats:self.mats.append(mat)
        mid=self.mats.index(mat);offset=len(self.v);self.v.extend([tuple(v) for v in verts])
        self.f.extend([tuple(i+offset for i in f) for f in faces]);self.mi.extend([mid]*len(faces));self.sm.extend([smooth]*len(faces))
    def loft(self,rings,mat,cap=True,smooth=True):
        n=len(rings[0]);v=[p for ring in rings for p in ring];f=[]
        for j in range(len(rings)-1):
            for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        if cap:f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
        self.add(v,f,mat,smooth)
    def tube(self,points,radius,mat,sides=8,cap=True):
        points=[Vector(p) for p in points];rings=[]
        for i,p in enumerate(points):
            tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
            ref=Vector((0,1,0)) if abs(tangent.y)<.90 else Vector((1,0,0));u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
            r=radius[i] if hasattr(radius,'__len__') else radius
            rings.append([p+r*(math.cos(k*math.tau/sides)*u+math.sin(k*math.tau/sides)*v) for k in range(sides)])
        self.loft(rings,mat,cap,True)
    def lathe(self,profile,mat,center=(0,0,0),axis=(0,0,1),segments=24):
        q=Vector((0,0,1)).rotation_difference(Vector(axis).normalized());c=Vector(center)
        self.loft([[c+q@Vector((r*math.cos(k*math.tau/segments),r*math.sin(k*math.tau/segments),z)) for k in range(segments)] for r,z in profile],mat,True,True)
    def ball(self,center,radii,mat,segments=16,rings=8):
        c=Vector(center);rs=[]
        for j in range(rings+1):
            a=.002+(math.pi-.004)*j/rings
            rs.append([c+Vector((radii[0]*math.sin(a)*math.cos(k*math.tau/segments),radii[1]*math.sin(a)*math.sin(k*math.tau/segments),radii[2]*math.cos(a))) for k in range(segments)])
        self.loft(rs,mat,True,True)
    def panel(self,outline,y,depth,mat,bevel=.002):
        outline=np.array(outline);center=outline.mean(axis=0);r=max(np.linalg.norm(outline-center,axis=1).min(),.001);factor=max(.55,1-bevel/r)
        outer=outline;inner=center+(outline-center)*factor;bevel=min(bevel,depth*.4)
        rings=[[(x,yy,z) for x,z in a] for a,yy in [(inner,y-depth/2),(outer,y-depth/2+bevel),(outer,y+depth/2-bevel),(inner,y+depth/2)]]
        self.loft(rings,mat,True,False)
    def box(self,center,size,mat):
        x,y,z=center;a,b,c=[s/2 for s in size]
        self.panel([(x-a,z-c),(x+a,z-c),(x+a,z+c),(x-a,z+c)],y,b*2,mat,min(size)*.10)
    def ring(self,center,radius,wire,mat,axis=(0,1,0),segments=40):
        q=Vector((0,0,1)).rotation_difference(Vector(axis).normalized());c=Vector(center)
        pts=[c+q@Vector((radius*math.cos(k*math.tau/segments),radius*math.sin(k*math.tau/segments),0)) for k in range(segments+1)]
        self.tube(pts,wire,mat,8,False)
    def crystal(self,center,radius,height,mat,axis=(0,0,1),sides=6):
        q=Vector((0,0,1)).rotation_difference(Vector(axis).normalized());c=Vector(center)
        self.loft([[c+q@Vector((r*math.cos(k*math.tau/sides),r*math.sin(k*math.tau/sides),z)) for k in range(sides)] for r,z in [(radius*.015,-height*.43),(radius,-height*.12),(radius*.9,height*.20),(radius*.01,height*.57)]],mat,True,False)
    def rune(self,center,scale,mat,kind=0):
        x,y,z=center
        paths=[[(0,-1),(0,1),(.60,.35),(0,0),(-.55,.4)], [(-.6,-.8),(.6,.8),(0,1),(0,-1)], [(-.6,0),(0,1),(.6,0),(0,-1),(-.6,0)], [(-.55,-1),(-.55,1),(.55,.6),(-.55,0),(.45,-.4)]]
        self.tube([(x+a*scale,y,z+b*scale) for a,b in paths[kind%len(paths)]],scale*.075,mat,6)
    def mesh(self,collection=None):
        me=bpy.data.meshes.new(self.name);me.from_pydata(self.v,[],self.f);me.update()
        ob=bpy.data.objects.new(self.name,me);(collection or bpy.context.scene.collection).objects.link(ob)
        for m in self.mats:me.materials.append(m)
        for p,mi,sm in zip(me.polygons,self.mi,self.sm):p.material_index=mi;p.use_smooth=sm
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.update()
        uv=me.uv_layers.new(name='SurfaceUV')
        for p in me.polygons:
            drop=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=drop]
            for li in p.loop_indices:
                co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]*3,co[axes[1]]*3)
        return ob

def render_settings(s):
    s.render.engine='BLENDER_EEVEE'
    group=bpy.data.node_groups.new('Equipment restrained bloom','CompositorNodeTree');s.compositing_node_group=group
    group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    source=group.nodes.new('CompositorNodeRLayers');source.scene=s
    glare=group.nodes.new('CompositorNodeGlare')
    try:glare.inputs['Type'].default_value='FOG_GLOW'
    except:glare.inputs['Type'].default_value='Fog Glow'
    glare.inputs['Threshold'].default_value=1.25;glare.inputs['Strength'].default_value=.35;glare.inputs['Size'].default_value=.35
    output=group.nodes.new('NodeGroupOutput');group.links.new(source.outputs['Image'],glare.inputs['Image']);group.links.new(glare.outputs['Image'],output.inputs['Image'])

def studio():
    s=bpy.context.scene;render_settings(s);s.cycles.samples=12;s.cycles.use_denoising=True
    p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.refresh_devices()
    for d in p.devices:d.use=d.type=='OPTIX'
    s.cycles.device='GPU';s.world=bpy.data.worlds.new('Equipment studio');s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.25,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,loc,power,size in [('Key',(-3,-4,5),650,3),('Fill',(3,-3,2),340,2.5),('Rim',(0,2,4),850,2)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;ob=bpy.data.objects.new(name,data);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.objects.new('Equipment camera',bpy.data.cameras.new('Equipment camera'));s.collection.objects.link(camera);s.camera=camera;camera.data.type='ORTHO'
    s.view_settings.view_transform='AgX';s.render.resolution_percentage=100
    return s

def export_mesh(ob,path,rig=None):
    path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT');ob.hide_set(False);ob.hide_render=False;ob.select_set(True);bpy.context.view_layer.objects.active=ob
    if rig:rig.hide_set(False);rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_skins=rig is not None,export_morph=False,export_yup=True,export_extras=True,export_tangents=False)
    ob.data.calc_loop_triangles()
    return {'file':str(path.relative_to(ROOT)).replace('\\','/'),'vertices':len(ob.data.vertices),'triangles':len(ob.data.loop_triangles),'bytes':path.stat().st_size,'materials':len(ob.data.materials)}
