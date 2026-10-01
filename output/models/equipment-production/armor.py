"""Individually tailored modular armor, using each delivered character's bind pose."""
from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/geometry.py').read_text(),'geometry.py','exec'))
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

class Fit:
    def __init__(self,CLASS):
        self.CLASS=CLASS;self.rig=bpy.data.objects[CLASS+'_Rig'];self.body=bpy.data.objects[CLASS+'_Body'];self.h=max(v.co.z for v in self.body.data.vertices)
        self.rig.animation_data.action=None
        for p in self.rig.pose.bones:p.matrix_basis.identity()
        for k in self.body.data.shape_keys.key_blocks:k.value=0
        bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
        self.points=[];self.weights=[];self.faces=[];self.regions={k:[] for k in ['torso','head','left','right']}
        refs=[self.body]+[o for o in bpy.context.scene.objects if o.name in [CLASS+'_Undershorts',CLASS+'_Undertop']]
        for ob in refs:
            offset=len(self.points);self.points.extend([tuple(ob.matrix_world@v.co) for v in ob.data.vertices])
            for v in ob.data.vertices:self.weights.append([(ob.vertex_groups[g.group].name,g.weight) for g in v.groups if ob.vertex_groups[g.group].name in self.rig.data.bones])
            for p in ob.data.polygons:
                ids=[i+offset for i in p.vertices];self.faces.append(ids);center=sum((Vector(self.points[i]) for i in ids),Vector())/len(ids)
                influences={}
                for i in ids:
                    for bone,w in self.weights[i]:influences[bone]=influences.get(bone,0)+w
                dominant=max(influences,key=influences.get) if influences else ''
                if dominant.startswith(('pelvis','spine_','neck_','clavicle_')):self.regions['torso'].append(ids)
                if dominant.startswith(('head','neck_')):self.regions['head'].append(ids)
                if center.x>=0:self.regions['left'].append(ids)
                if center.x<=0:self.regions['right'].append(ids)
        self.tree=BVHTree.FromPolygons(self.points,self.faces)
        self.trees={k:BVHTree.FromPolygons(self.points,faces) for k,faces in self.regions.items()}
        self.kd=KDTree(len(self.points))
        for i,p in enumerate(self.points):self.kd.insert(p,i)
        self.kd.balance();self.profile_cache={}
    def joint(self,bone):return self.rig.data.bones[bone].head_local.copy()
    def weight(self,point):
        hits=self.kd.find_n(point,3);weights={}
        for co,i,d in hits:
            for bone,w in self.weights[i]:weights[bone]=weights.get(bone,0)+w/max(d*d,1e-7)
        strongest=sorted(weights.items(),key=lambda x:-x[1])[:4];total=sum(w for n,w in strongest)
        return [(n,w/total) for n,w in strongest] if total else [('pelvis',1)]
    def radius(self,center,direction,region='torso',default=.10,minimum=.015,maximum=.35):
        direction=Vector(direction).normalized();center=Vector(center);outside=center+direction*maximum
        hit,normal,face,d=self.trees[region].ray_cast(outside,-direction,maximum*1.25)
        if hit is None:return default
        projected=(hit-center).dot(direction)
        return max(minimum,min(maximum,projected)) if projected>0 else default
    def torso(self,z,theta,clearance=.018):
        center=Vector((0,.004,z));direction=Vector((math.sin(theta),-math.cos(theta),0))
        default=self.h*(.09 if z<self.h*.75 else .065)
        radius=self.radius(center,direction,'torso',default,.035,self.h*.21)
        return center+direction*(radius+clearance)
    def skin(self,ob,rigid=None):
        if rigid:
            vg=ob.vertex_groups.new(name=rigid);vg.add(list(range(len(ob.data.vertices))),1,'REPLACE')
        else:
            groups={}
            for v in ob.data.vertices:
                for bone,w in self.weight(v.co):
                    if bone not in groups:groups[bone]=ob.vertex_groups.new(name=bone)
                    groups[bone].add([v.index],w,'REPLACE')
        arm=ob.modifiers.new('Character skin','ARMATURE');arm.object=self.rig
        # glTF skins remain scene-root siblings of the rig; their bind matrices
        # carry the deformation, avoiding ignored parent-transform semantics.
    def limb(self,b,side,segment,mat,clearance=.014,start=0,end=1,n=11,detail=False):
        suffix='l' if side>0 else 'r';name={'thigh':'thigh_','calf':'calf_','forearm':'lowerarm_'}[segment]+suffix
        bone=self.rig.data.bones[name];a=bone.head_local;bpoint=bone.tail_local;axis=(bpoint-a).normalized()
        front=Vector((0,-1,0));front=(front-axis*front.dot(axis)).normalized();across=axis.cross(front).normalized();rings=[]
        samples=[];centers=[];directions=[]
        for t in np.linspace(start,end,n):
            center=a.lerp(bpoint,float(t));rs=[]
            for k in range(32):
                theta=k*math.tau/32;direction=front*math.cos(theta)+across*math.sin(theta)
                fallback=(.08 if segment=='thigh' else .044 if segment=='calf' else .035)*self.h/1.9
                radius=self.radius(center,direction,'left' if side>0 else 'right',fallback,.014,self.h*(.10 if segment=='thigh' else .075))
                rs.append(radius)
                if len(directions)<32:directions.append(direction)
            samples.append(rs);centers.append(center)
        # Ray misses over masked source-body triangles must never produce a
        # one-vertex dent in a garment. A small conservative envelope bridges
        # those holes while retaining the measured taper of the whole limb.
        radii=np.array(samples)
        envelope=np.maximum.reduce([np.roll(radii,k,axis=1) for k in [-2,-1,0,1,2]])
        padded=np.pad(envelope,((1,1),(0,0)),mode='edge')
        envelope=np.maximum.reduce([padded[j:j+n] for j in range(3)])
        smooth=sum(np.roll(envelope,k,axis=1) for k in [-1,0,1])/3
        for j,center in enumerate(centers):
            rings.append([center+direction*(max(radii[j,k],smooth[j,k])+clearance) for k,direction in enumerate(directions)])
        b.loft(rings,mat,False,True)
        return rings

def path_trim(b,points,mat,radius=.003,closed=False):
    pts=list(points)
    if closed:pts.append(pts[0])
    b.tube(pts,radius,mat,7,not closed)

def shell(b,rings,mat,thickness=.005):
    b.loft(rings,mat,False,True)
    # A modest inside return makes every cut edge read as solid material.
    for ring in [rings[0],rings[-1]]:
        center=sum((Vector(p) for p in ring),Vector())/len(ring)
        inner=[Vector(p)+(center-Vector(p)).normalized()*thickness for p in ring]
        b.loft([ring,inner],mat,False,True)

def torso_armor(b,fit,p,legend,family):
    if 'full_chest_shell' not in globals():exec(compile((WORK/'chest_shell.py').read_text(),'chest_shell.py','exec'),globals())
    h=fit.h;clear=.024 if family=='plate' else .020 if family=='cloth' else .014
    if legend:clear+=.005
    bottom=h*.561;rings=[];n=64
    def point(t,theta,extra=0):
        top=h*(.841-.084*abs(math.sin(theta))**1.8)
        z=bottom+(top-bottom)*t
        v=fit.torso(z,theta,clear+extra)
        if family=='cloth':v.x*=1.025;v.y*=1.035
        return v
    full_chest_shell(b,fit,p,legend,family)
    if family=='plate':
        for t in [.09,.18,.29]:path_trim(b,[point(t,a,.004) for a in np.linspace(-1.5,1.5,35)],p['trim'],.004)
        for side in [-1,1]:
            path=[point(t,side*(.60*(1-t)+.24),.006) for t in np.linspace(.30,.87,15)]
            path_trim(b,path,p['trim'],.005)
        center=point(.78,0,.022)
        b.panel([(center.x-.055,center.z),(center.x,center.z-.065),(center.x+.055,center.z),(center.x,center.z+.055)],center.y,.013,p['trim'],.004)
        if legend:
            b.crystal(tuple(center+Vector((0,-.012,0))),.031,.068,p['gem'],axis=(0,-1,0))
            for side in [-1,1]:
                for j in range(3):
                    path=[point(.74-j*.10,side*.17,.012),point(.82-j*.11,side*.46,.012),point(.78-j*.10,side*.87,.012)]
                    path_trim(b,path,p['trim'],.012-j*.001)
                path_trim(b,[point(t,side*.19,.011) for t in np.linspace(.36,.64,12)],p['glow'],.003)
            for t in [.36,.45,.54]:
                q=point(t,0,.009);b.rune(q,.014,p['glow'],int(t*10))
    elif family=='leather':
        for side in [-1,1]:
            path=[point(t,side*(.78-1.4*t),.008) for t in np.linspace(.1,.96,26)]
            path_trim(b,path,p['dark'],.014);path_trim(b,[q+Vector((side*.009,-.002,0)) for q in path],p['trim'],.002)
        q=point(.63,0,.025);b.ring(q,.024,.005,p['trim'])
        for theta in [-.75,.75]:
            for t in np.linspace(.18,.78,8):
                q=point(t,theta,.004);b.ball(q,(.0035,.0025,.0035),p['trim'],8,5)
        if legend:
            for side in [-1,1]:
                path=[point(t,side*(.85-.45*t),.010) for t in np.linspace(.32,.87,22)];path_trim(b,path,p['glow'],.0027)
                q=point(.82,side*.28,.021);b.crystal(q,.018,.048,p['gem'],axis=(0,-1,0))
            q=point(.44,0,.012);b.rune(q,.036,p['trim'],2)
    else:
        for side in [-1,1]:
            for theta in [side*.13,side*.22]:path_trim(b,[point(t,theta,.006) for t in np.linspace(.02,.99,36)],p['trim'],.003)
        q=point(.84,0,.021);b.ring(q,.028,.004,p['trim'])
        if legend:
            b.crystal(q,.025,.065,p['gem'],axis=(0,-1,0))
            for t in np.linspace(.20,.69,7):b.rune(point(t,0,.010),.018,p['glow'],int(t*11))
        skirt(b,fit,p,legend,bottom=.24,top=.582,robe=True)

def skirt(b,fit,p,legend,bottom=.29,top=.58,robe=False):
    h=fit.h;steps=12;segments=64;clear=.028
    # Four separated gores permit leg movement and retain deliberate front/back slits.
    for part in range(4):
        a0=part*math.pi/2+.06;a1=(part+1)*math.pi/2-.06;rs=[]
        for t in np.linspace(0,1,steps):
            z=h*(top+(bottom-top)*t);row=[]
            for theta in np.linspace(a0,a1,segments//4+1):
                waist=fit.torso(top*h,theta,clear);flare=1+t*(.40 if robe else .27)
                r=Vector((waist.x*flare,waist.y*flare,z));r.x+=.007*math.sin(theta*16)*(t*.8+.2);r.y-=.007*math.cos(theta*16)*(t*.8+.2)
                if robe and z>h*.40:
                    # Waist-only scaling underestimates the hips on the female
                    # fits. Keep each gore outside the actual pelvis/underwear.
                    direction=Vector((math.sin(theta),-math.cos(theta),0));radius=math.hypot(r.x,r.y-.004)
                    measured=max(fit.radius((0,.004,float(zz)),direction,'torso',radius-clear,.035,h*.24) for zz in [z-.014*h,z,z+.014*h])+.037
                    target=max(radius,measured);r.x=direction.x*target;r.y=.004+direction.y*target
                r.z+=h*.025*t*abs(math.sin(theta*2)) if legend else 0;row.append(r)
            rs.append(row)
        n=len(rs[0]);v=[p for row in rs for p in row];faces=[]
        for j in range(steps-1):
            for k in range(n-1):faces.append((j*n+k,j*n+k+1,(j+1)*n+k+1,(j+1)*n+k))
        b.add(v,faces,p['main'],True)
        for path in [[r[0] for r in rs],[r[-1] for r in rs],rs[-1]]:path_trim(b,path,p['trim'],.0035)
        if legend:
            path_trim(b,rs[-2],p['glow'],.0025)
            for k in range(2,n-2,4):
                q=Vector(rs[-3][k]);q.y-=.003;b.rune(q,.016,p['glow'],k)

def legs(b,fit,p,legend,family):
    h=fit.h
    if family=='cloth':skirt(b,fit,p,legend);return
    for side in [-1,1]:
        joint_rings=[]
        for segment in ['thigh','calf']:
            rings=fit.limb(b,side,segment,p['dark'] if family=='plate' else p['main'],.022,start=.0,end=1,n=17)
            joint_rings.append(rings)
            if family=='plate':
                for jrange in [(1,5),(6,10)]:
                    patch=[[ring[k%32]+Vector((0,-.008,0)) for k in range(-7,8)] for ring in rings[jrange[0]:jrange[1]+1]]
                    n=len(patch[0]);v=[q for row in patch for q in row];faces=[(j*n+i,j*n+i+1,(j+1)*n+i+1,(j+1)*n+i) for j in range(len(patch)-1) for i in range(n-1)]
                    b.add(v,faces,p['main'],True)
                    for path in [patch[0],patch[-1],[r[0] for r in patch],[r[-1] for r in patch]]:path_trim(b,path,p['trim'],.004)
                    if legend:path_trim(b,[r[n//2] for r in patch],p['glow'],.003)
            else:
                for k in [9,23]:path_trim(b,[r[k] for r in rings],p['trim'],.002)
                if legend:path_trim(b,[r[3] for r in rings[2:-2]],p['glow'],.0025)
        b.loft([joint_rings[0][-1],joint_rings[1][0]],p['dark'] if family=='plate' else p['main'],False,True)
        knee=fit.joint('calf_'+('l' if side>0 else 'r'));knee.y-=h*.055
        b.ball(knee,(.054,.019,.065),p['main'] if family=='plate' else p['leather'])
        if legend:b.crystal(knee+Vector((0,-.022,0)),.024,.062,p['gem'],axis=(0,-1,0))
    # The supplied tailored shorts have a proper crotch bridge and each class's
    # exact waist fit. Use their topology as the padded upper trouser lining.
    shorts=bpy.data.objects[fit.CLASS+'_Undershorts']
    b.add([v.co+v.normal*.010 for v in shorts.data.vertices],[list(f.vertices) for f in shorts.data.polygons],p['dark'] if family=='plate' else p['main'],True)

def boots(b,fit,p,legend,family):
    h=fit.h
    for side in [-1,1]:
        suffix='l' if side>0 else 'r';ankle=fit.joint('foot_'+suffix);ball=fit.joint('ball_'+suffix)
        points=np.array([q for q in fit.points if q[0]*side>0 and q[2]<h*.045]);xmin,ymin,zmin=points.min(axis=0);xmax,ymax,zmax=points.max(axis=0)
        x=(xmin+xmax)/2;width=(xmax-xmin)/2+.015;cy=(ymin+ymax)/2;depth=(ymax-ymin)/2+.022
        rounded=lambda v:math.copysign(abs(v)**.62,v)
        outline=[Vector((x+width*rounded(math.sin(k*math.tau/32)),cy-depth*rounded(math.cos(k*math.tau/32)),.004)) for k in range(32)]
        sole=[outline,[q+Vector((0,0,.019)) for q in outline]];b.loft(sole,p['dark'],True,True)
        if family=='sandals':
            for yy in [cy-depth*.45,cy+depth*.18]:
                pts=[(x+width*math.cos(a),yy,.022+math.sin(a)*h*.04) for a in np.linspace(0,math.pi,18)]
                path_trim(b,pts,p['leather'],.013)
            path_trim(b,[(ankle.x+math.sin(a)*.041,ankle.y+math.cos(a)*.046,ankle.z+.025) for a in np.linspace(0,math.tau,40)],p['trim'],.009)
            if legend:b.crystal((x,cy-depth*.25,h*.05),.022,.048,p['gem'])
            continue
        rings=[]
        for z,rx,ry,yy in [(.020,width,depth,cy),(.049,width*.97,depth*.96,cy),(.090,width*.90,depth*.78,cy+.015),(ankle.z+.055,width*.76,.052,ankle.y),(ankle.z+.15,width*.91,.057,ankle.y+.009)]:
            rings.append([(x+rx*(rounded(math.sin(a)) if z<.09 else math.sin(a)),yy-ry*(rounded(math.cos(a)) if z<.09 else math.cos(a)),z) for a in np.linspace(0,math.tau,32,endpoint=False)])
        shell(b,rings,p['main'],.005);path_trim(b,rings[-1],p['trim'],.004,True)
        for zz in [.040,.064]:
            path_trim(b,[(x+width*.88*math.sin(a),cy-depth*.85*math.cos(a),zz) for a in np.linspace(-1.2,1.2,15)],p['trim'],.003)
        if legend:
            q=Vector((x,ankle.y-.059,ankle.z+.12));b.crystal(q,.022,.066,p['gem'],axis=(0,-1,0))
            for side2 in [-1,1]:path_trim(b,[(x+side2*width*.46,cy-depth*.60,.075),(x+side2*width*.38,ankle.y-.056,ankle.z+.09)],p['glow'],.003)

def gloves(b,fit,p,legend,family):
    body=fit.body;coords=[];faces=[];lookup={};h=fit.h
    for poly in body.data.polygons:
        keep=True
        for vi in poly.vertices:
            v=body.data.vertices[vi];weights=[(body.vertex_groups[g.group].name,g.weight) for g in v.groups]
            dominant=max(weights,key=lambda x:x[1])[0]
            side='l' if v.co.x>0 else 'r';wrist=fit.joint('hand_'+side)
            if not (dominant.startswith(('hand_','thumb_','index_','middle_','ring_','pinky_')) or dominant.startswith('lowerarm_') and (v.co-wrist).length<h*.066):keep=False;break
        if keep:
            face=[]
            for vi in poly.vertices:
                if vi not in lookup:
                    v=body.data.vertices[vi];lookup[vi]=len(coords);coords.append(v.co+v.normal*(.0045 if family=='cloth' else .006))
                face.append(lookup[vi])
            faces.append(face)
    b.add(coords,faces,p['main'] if family!='plate' else p['dark'],True)
    for side in [-1,1]:
        rings=fit.limb(b,side,'forearm',p['main'],.012,start=.61,end=.91,n=5);path_trim(b,rings[0],p['trim'],.003,True);path_trim(b,rings[-1],p['trim'],.003,True)
        suffix='l' if side>0 else 'r';wrist=fit.joint('hand_'+suffix);hand=fit.rig.data.bones['hand_'+suffix]
        q=(hand.head_local+hand.tail_local)/2+Vector((0,-.019,0))
        if family=='plate':b.ball(q,(.038,.013,.034),p['main'])
        if legend:b.crystal(q+Vector((0,-.014,0)),.017,.038,p['gem'],axis=(0,-1,0));b.rune(rings[2][0]+Vector((0,-.003,0)),.023,p['glow'],2)

def shoulders(b,fit,p,legend,family):
    h=fit.h
    for side in [-1,1]:
        center=fit.joint('upperarm_'+('l' if side>0 else 'r'));center.x+=side*.023;center.z+=.012
        layers=3 if legend else 2
        for layer in range(layers):
            rx=(.094+(.018 if legend else 0)-layer*.014)*h/1.9;ry=(.104-layer*.010)*h/1.9;rz=(.081-layer*.006)*h/1.9
            rs=[]
            for t in np.linspace(.035,1.7,9):
                rs.append([center+Vector((side*(rx*math.sin(t)*math.cos(a)+layer*.020),ry*math.sin(t)*math.sin(a),rz*math.cos(t)-layer*.024)) for a in np.linspace(0,math.tau,32,endpoint=False)])
            shell(b,rs,p['main'],.005);path_trim(b,rs[-1],p['trim'],.0035,True)
        if family=='cloth':
            for j in range(4):
                a=center+Vector((side*(.02+j*.017),-.070,-.04-j*.013));z=a+Vector((side*.012,.015,-.11))
                path_trim(b,[a,z],p['trim'],.003)
        if legend:
            for j in range(3):
                base=center+Vector((side*(.010+j*.036),.006,.055-j*.015));tip=base+Vector((side*(.045+j*.012),0,.090-j*.016))
                b.tube([base,(base+tip)/2,tip],[.021,.013,.0018],p['trim'],7)
            q=center+Vector((0,-.103,.015));b.crystal(q,.031,.065,p['gem'],axis=(0,-1,0));b.ring(q,.042,.003,p['glow'])

def belt(b,fit,p,legend,family):
    h=fit.h;z=h*.581;width=h*(.045 if legend else .031)
    rings=[[fit.torso(zz,a,.038 if family=='plate' else .029) for a in np.linspace(0,math.tau,64,endpoint=False)] for zz in [z-width/2,z,z+width/2]]
    shell(b,rings,p['main'],.008)
    for ring in [rings[0],rings[-1]]:path_trim(b,ring,p['trim'],.003,True)
    front=Vector(rings[1][0])+Vector((0,-.015,0));sx=.045 if legend else .032;sz=.040 if legend else .030
    b.panel([(front.x-sx,front.z-sz),(front.x+sx,front.z-sz),(front.x+sx,front.z+sz),(front.x-sx,front.z+sz)],front.y,.015,p['trim'],.004)
    if legend:b.crystal(front+Vector((0,-.021,0)),.025,.063,p['gem'],axis=(0,-1,0));b.rune(front+Vector((0,-.013,0)),.027,p['glow'],2)
    else:b.box(front+Vector((0,-.010,0)),(.032,.014,.035),p['dark'])
    if family=='cloth':
        start=Vector(rings[1][8]);path_trim(b,[start,start+Vector((.035,-.015,-.12)),start+Vector((.055,-.04,-.30))],p['main'],.024)
    else:
        for k in [7,11,21,25,32,40,48,56]:
            q=Vector(rings[1][k]);normal=(q-Vector((0,0,q.z))).normalized();b.ball(q+normal*.005,(.006,.006,.006),p['trim'],10,6)

def headwear(b,fit,p,legend,family):
    h=fit.h;center=fit.joint('head');center.z=h*.936;center.y=.002;rs=[];N=64
    for t in np.linspace(.015,1,18):
        row=[]
        for k in range(N):
            theta=k*math.tau/N;bottom=h*(.945-.090*(1-math.cos(theta))/2)
            if family=='cloth':bottom-=h*.034*(1-math.cos(theta))/2
            rz=h*(.086 if family=='cloth' else .073);phi=math.acos(max(-.98,min(.98,(bottom-center.z)/rz)))*t
            direction=Vector((math.sin(phi)*math.sin(theta),-math.sin(phi)*math.cos(theta),math.cos(phi)))
            distance=fit.radius(center,direction,'head',h*.062,.025,h*.18)+(.020 if family=='cloth' else .012)
            v=center+direction*distance
            if family=='cloth':v.z+=h*.032*(1-t)**2
            row.append(v)
        rs.append(row)
    shell(b,rs,p['main'],.006);path_trim(b,rs[-1],p['trim'],.004,True)
    if family=='plate':
        # A central swept crest and cheek rims distinguish the helmet from a cap.
        for side in [-1,1]:
            points=[rs[-1][(side*k)%N] for k in range(5,24)];path_trim(b,points,p['trim'],.004)
        if legend:
            for j in range(5):
                hit,normal,face,d=fit.trees['head'].ray_cast(Vector((0,h*(-.019+j*.012),h*1.15)),Vector((0,0,-1)),h*.3)
                if hit is not None:
                    c=hit+normal*.009;b.tube([c,c+Vector((0,.008,.07 if j<3 else .045))],[.016,.002],p['trim'],7)
    if legend:
        brow=Vector(rs[-1][0])+Vector((0,-.011,.010));b.crystal(brow,.025,.058,p['gem'],axis=(0,-1,0))
        for side in [-1,1]:
            path=[rs[-1][(side*k)%N]+Vector((0,-.002,.011)) for k in range(0,13)];path_trim(b,path,p['glow'],.0026)
            base=Vector(rs[11][(side*16)%N]);tip=base+Vector((side*.080,.035,.11 if family!='cloth' else .055));b.tube([base,base.lerp(tip,.6),tip],[.021,.015,.0015],p['trim'],7)

def accessories(b,fit,p,legend,item):
    h=fit.h;variant=item['variant'];slot=item['slot']
    p=dict(p)
    if variant in ['gold','ruby','pendant','amulet']:
        p['trim']=material('Antique gold settings',(.67,.40,.115),.9,.25)
    if variant in ['ruby','amulet','talisman','orb','necklace','choker']:
        color=(.74,.025,.045) if variant in ['ruby','amulet'] else (.025,.54,.21) if variant=='talisman' else (.30,.035,.47) if variant=='choker' else (.035,.30,.78)
        p['gem']=material(variant+' '+('legendary' if legend else 'standard')+' jewel',color,.28,.20,1.5 if legend else 0)
        p['glow']=material(variant+(' legendary' if legend else ' standard')+' inscription',color,0,.3,5 if legend else 0)
    if slot=='ring':
        bone=fit.rig.data.bones['ring_01_l'];axis=(bone.tail_local-bone.head_local).normalized();center=bone.head_local.lerp(bone.tail_local,.42)
        b.ring(center,.011 if fit.CLASS!='Fighter' else .013,.0025,p['trim'],axis,32)
        q=center+Vector((0,-.013,0));b.ball(q,(.010,.004,.011),p['main'],12,7)
        if variant=='ruby' or legend:b.crystal(q+Vector((0,-.007,0)),.009,.018,p['gem'],axis=(0,-1,0))
        if legend:b.ring(q+Vector((0,-.003,0)),.012,.0015,p['glow'],segments=24)
    elif slot=='neck':
        neck=fit.joint('neck_01');z=neck.z-.012
        drop=h*(.013 if variant=='choker' else .047)
        pts=[fit.torso(z-drop*max(0,math.cos(a)),a,.009 if variant=='choker' else .011) for a in np.linspace(0,math.tau,65)]
        path_trim(b,pts,p['main'] if variant=='choker' else p['trim'],.005 if variant=='choker' else .0028)
        q=fit.torso(pts[0].z-(.018 if variant=='choker' else .027),0,.019)
        path_trim(b,[pts[0],q+Vector((0,0,.012))],p['trim'],.0025)
        b.crystal(q,.021 if legend else .014,.057 if legend else .038,p['gem'],axis=(0,-1,0))
        if legend:
            b.ring(q,.030,.003,p['trim'])
            for side in [-1,1]:b.panel([(side*.015,q.z+.015),(side*.065,q.z+.038),(side*.050,q.z+.010),(side*.022,q.z-.018)],q.y-.004,.007,p['trim'],.001)
    else:
        q=fit.torso(h*.574,-.89,.055)
        if variant=='orb':
            b.ball(q,(.030,.030,.030),p['gem'],20,10)
            for axis in [(1,0,0),(0,1,0),(0,0,1)]:b.ring(q,.036,.0025,p['trim'],axis,28)
        else:
            b.panel([(q.x-.022,q.z+.024),(q.x+.022,q.z+.024),(q.x+.029,q.z-.017),(q.x,q.z-.05),(q.x-.029,q.z-.017)],q.y,.012,p['trim'],.003)
            b.rune(q+Vector((0,-.010,-.006)),.019,p['glow'] if legend else p['main'],1 if variant=='talisman' else 2)
        path_trim(b,[q+Vector((0,0,.025)),q+Vector((-.008,0,.07))],p['leather'],.005)

def build_item(fit,item,tier):
    family='plate' if item['material']=='metal' else 'cloth' if item['material']=='cloth' else 'leather'
    p=palette(tier,'holy' if fit.CLASS=='Cleric' and family=='plate' else family);legend=tier=='legendary';b=Builder(item['id']+'__'+tier+'__'+fit.CLASS)
    slot=item['slot'];variant=item['variant']
    if slot=='chest':torso_armor(b,fit,p,legend,family)
    elif slot=='legs':legs(b,fit,p,legend,family)
    elif slot=='feet':boots(b,fit,p,legend,'sandals' if variant=='sandals' else family)
    elif slot=='gloves':gloves(b,fit,p,legend,family)
    elif slot=='shoulders':shoulders(b,fit,p,legend,family)
    elif slot=='belt':belt(b,fit,p,legend,family)
    elif slot=='head':headwear(b,fit,p,legend,family)
    else:accessories(b,fit,p,legend,item)
    ob=b.mesh();fit.skin(ob,'head' if slot=='head' else 'ring_01_l' if slot=='ring' else None)
    ob['baseName']=item['name'];ob['equipmentSlot']=slot;ob['rarityModel']=tier;ob['fittedCharacter']=fit.CLASS;ob['sharedRarities']='Common,Uncommon,Rare' if not legend else 'Legendary';ob['skinBinding']='Rebind by bone name to the supplied '+fit.CLASS+' bind pose'
    if slot=='ring':ob['alternateSlot']='Mirror bind-space X and remap _l bones to _r for ring2'
    if slot=='trinket':ob['alternateSlot']='Mirror bind-space X for trinket2'
    ob['hideHair']=slot=='head';ob['hideUnderclothes']='Undertop' if slot=='chest' else 'Undershorts' if slot=='legs' and variant!='skirt' else ''
    return ob

def build_armor(CLASS):
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/models'/(CLASS.lower()+'-production')/(CLASS.lower()+'.blend')))
    fit=Fit(CLASS);scene=bpy.context.scene;scene.name=CLASS+' | fitted equipment source';reports=[]
    inventory=json.loads((WORK/'inventory.json').read_text())['items']
    gear=bpy.data.collections.new('EQUIPMENT | individual fitted pieces');scene.collection.children.link(gear)
    for item in inventory:
        if item['slot'] in ['mainHand','offHand']:continue
        for tier in ['standard','legendary']:
            ob=build_item(fit,item,tier)
            for col in list(ob.users_collection):col.objects.unlink(ob)
            gear.objects.link(ob)
            report=export_mesh(ob,DEST/'fits'/CLASS/(item['id']+'-'+tier+'.glb'),fit.rig)
            report.update(id=item['id'],name=item['name'],tier=tier,character=CLASS,slot=item['slot'],bones=len(fit.rig.data.bones),maximumInfluences=max(len(v.groups) for v in ob.data.vertices))
            reports.append(report);ob.hide_set(True);ob.hide_render=True
            print('BUILT',CLASS,item['id'],tier,report['triangles'],flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(CLASS.lower()+'-equipment.blend')),compress=True)
    (WORK/(CLASS.lower()+'-report.json')).write_text(json.dumps(reports,indent=2))
    return {'class':CLASS,'fitted_items':len(reports),'source':bpy.data.filepath}
