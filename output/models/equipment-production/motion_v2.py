"""Weapon-aware skeletal animation authoring, with explicit grip and foot contacts."""
import bpy,math,json,re
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
import numpy as np
ROOT=(Path(__file__).resolve().parents[3]);WORK=ROOT/'output/models/equipment-production';REV=WORK/'revision-v2'
DEFAULT={'Fighter':'Sword','Wizard':'Staff','Cleric':'Mace','Rogue':'Dagger'}
TIMES={'Idle':3.2,'CombatIdle':2.4,'Walk':1.0,'Run':.72,'Attack':1.0,'Block':1.6,'Hit':.5,'Jump':1.0,'JumpStart':.4,'JumpLoop':.8,'JumpLand':.4,'Death':1.6,'Cast':1.,'Channel':2.4,'Heal':2.4,'StealthIdle':2.4}
LOOPS={'Idle','CombatIdle','Walk','Run','Block','JumpLoop','Channel','Heal','StealthIdle'}
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def hermite(a,b,ma,mb,t):return a*(2*t**3-3*t*t+1)+b*(-2*t**3+3*t*t)+ma*(t**3-2*t*t+t)+mb*(t**3-t*t)
def curve(keys,t):
    if t<=keys[0][0]:return Vector(keys[0][1])
    if t>=keys[-1][0]:return Vector(keys[-1][1])
    for i,((ta,pa),(tb,pb)) in enumerate(zip(keys,keys[1:])):
        if ta<=t<=tb:
            pa=Vector(pa);pb=Vector(pb);dt=tb-ta
            ma=Vector() if i==0 else (pb-Vector(keys[i-1][1]))*(dt/(tb-keys[i-1][0]))
            mb=Vector() if i+2>=len(keys) else (Vector(keys[i+2][1])-pa)*(dt/(keys[i+2][0]-ta))
            return hermite(pa,pb,ma,mb,(t-ta)/dt)
def frame(across,longitudinal):
    z=Vector(across).normalized();x=Vector(longitudinal);x=(x-z*x.dot(z)).normalized();y=z.cross(x).normalized();return Matrix((x,y,z)).transposed()

class Motion:
    def __init__(self,CLASS):
        self.CLASS=CLASS;self.rig=bpy.data.objects[CLASS+'_Rig'];self.pb=self.rig.pose.bones;self.scene=bpy.context.scene
        self.S=max(v.co.z for v in bpy.data.objects[CLASS+'_Body'].data.vertices)/1.9
        self.rest={b.name:b.matrix_local.copy() for b in self.rig.data.bones};self.length={b.name:b.length/self.S for b in self.rig.data.bones}
        self.rig.animation_data_create();self.rig.animation_data.action=None
        for p in self.pb:p.rotation_mode='QUATERNION';p.matrix_basis.identity()
        bpy.context.view_layer.update();self.grips={};self.foot_points={};self.report=[];self.link_frames={}
        body=bpy.data.objects[CLASS+'_Body']
        for side in ['l','r']:
            hand=self.rest['hand_'+side];mid=self.rest['middle_01_'+side].translation;ring=self.rest['ring_01_'+side].translation
            across=self.rest['index_01_'+side].translation-self.rest['pinky_01_'+side].translation
            long=mid-hand.translation;basis=frame(across,long);normal=basis.col[1]
            center=(mid+ring)/2+normal*(.020*self.S)
            local=hand.inverted()@(Matrix.Translation(center)@basis.to_4x4())
            if side=='l':local=local@Matrix.Rotation(math.pi/2,4,'Z')
            self.grips[side]=local
            ankle=self.rest['foot_'+side].translation
            self.foot_points[side]=[(v.co-ankle)/self.S for v in body.data.vertices if v.co.z<self.S*.085 and v.co.x*(1 if side=='l' else -1)>0]
    def reset(self):
        self.rig.animation_data.action=None
        for p in self.pb:p.matrix_basis.identity()
        bpy.context.view_layer.update()
    def direction(self,name,head,direction):
        q=self.rest[name].to_quaternion();old=q@Vector((0,1,0));new=old.rotation_difference(Vector(direction).normalized())@q
        self.pb[name].matrix=Matrix.Translation(Vector(head)*self.S)@new.to_matrix().to_4x4();bpy.context.view_layer.update()
    def ik(self,upper,lower,target,pole):
        start=self.pb[upper].head.copy()/self.S;target=Vector(target);delta=target-start;l1=self.length[upper];l2=self.length[lower]
        d=max(abs(l1-l2)+.001,min(delta.length,l1+l2-.003));axis=delta.normalized();bend=Vector(pole)-start;bend-=axis*bend.dot(axis)
        if bend.length<.001:bend=Vector((0,-1,0))
        bend.normalize();a=(l1*l1-l2*l2+d*d)/(2*d);joint=start+axis*a+bend*math.sqrt(max(.000001,l1*l1-a*a));end=start+axis*d
        normal=axis.cross(bend).normalized()
        key=(upper,lower)
        if key not in self.link_frames:
            a0=self.rest[upper].translation;b0=self.rest[lower].translation;c0=self.rig.data.bones[lower].tail_local
            n0=(c0-a0).cross(b0-a0).normalized();offsets={}
            for name in [upper,lower]:
                y=self.rest[name].col[1].xyz.normalized();x=(n0-y*n0.dot(y)).normalized();z=x.cross(y).normalized();basis=Matrix((x,y,z)).transposed()
                offsets[name]=basis.inverted()@self.rest[name].to_3x3()
            self.link_frames[key]=offsets
        for name,head,direction in [(upper,start,joint-start),(lower,joint,end-joint)]:
            y=direction.normalized();x=(normal-y*normal.dot(y)).normalized();z=x.cross(y).normalized();basis=Matrix((x,y,z)).transposed()@self.link_frames[key][name]
            self.pb[name].matrix=Matrix.Translation(head*self.S)@basis.to_4x4();bpy.context.view_layer.update()
        return end,(end-joint).normalized()
    def world_rot(self,name,x=0,y=0,z=0):
        p=self.pb[name];q=Quaternion((0,0,1),z)@Quaternion((0,1,0),y)@Quaternion((1,0,0),x)@p.matrix.to_quaternion()
        p.matrix=Matrix.Translation(p.head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
    def fingers(self,side,amount):
        for finger in ['index','middle','ring','pinky','thumb']:
            for j,m in [(1,.82),(2,1.12),(3,.66)]:
                b=self.pb.get(f'{finger}_{j:02d}_{side}')
                if b:b.rotation_quaternion=Quaternion((1,0,0),amount*m*(.55 if finger=='thumb' else 1))
    def hand(self,side,grip,axis,amount=1,offhand=False,pole=None):
        sg=1 if side=='l' else -1;grip=Vector(grip);T=self.grips[side];pole=pole or (sg*.47,.18,1.20)
        q=self.rest['hand_'+side].to_quaternion();wrist=grip-q@(T.translation/self.S)
        for iteration in range(3):
            end,forearm=self.ik('upperarm_'+side,'lowerarm_'+side,wrist,pole)
            if offhand:
                weapon=Quaternion((0,0,1),-.08*sg).to_matrix()
            else:
                # A continuous blade-plane reference avoids a wrist roll flip
                # when the forearm briefly aligns with the blade during recovery.
                z=Vector(axis).normalized();y=Vector((1,0,0));y=(y-z*y.dot(z)).normalized();x=y.cross(z).normalized();weapon=Matrix((x,y,z)).transposed()
            q=weapon.to_quaternion()@T.to_quaternion().inverted();wrist=grip-q@(T.translation/self.S)
        end,unused=self.ik('upperarm_'+side,'lowerarm_'+side,wrist,pole)
        self.pb['hand_'+side].matrix=Matrix.Translation(end*self.S)@q.to_matrix().to_4x4();self.fingers(side,amount);bpy.context.view_layer.update()
    def free_hand(self,side,wrist,curl=.12,pole=None):
        sg=1 if side=='l' else -1;end,direction=self.ik('upperarm_'+side,'lowerarm_'+side,wrist,pole or (sg*.40,.27,1.17))
        self.direction('hand_'+side,end,direction);self.fingers(side,curl)
    def foot_target(self,side,point,pitch=0,lift=0):
        sg=1 if side=='l' else -1;point=Vector(point);delta=Quaternion((0,0,1),sg*.035)@Quaternion((1,0,0),pitch)
        samples=self.foot_points[side];min_z=min((delta@p).z for p in samples)
        pivot=Vector((0,.050,-.071)) if pitch<0 else (self.rest['ball_'+side].translation-self.rest['foot_'+side].translation)/self.S
        point.y+=pivot.y-(delta@pivot).y;point.z=.003-min_z+lift
        return point,delta,min_z
    def foot(self,side,point,pitch=0,lift=0):
        point,delta,min_z=self.foot_target(side,point,pitch,lift);sg=1 if side=='l' else -1
        end,unused=self.ik('thigh_'+side,'calf_'+side,point,(sg*.12,-1,.52))
        q=delta@self.rest['foot_'+side].to_quaternion();self.pb['foot_'+side].matrix=Matrix.Translation(end*self.S)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
        return {'side':side,'ankle':list(end),'soleMinimum':end.z+min_z,'pitch':pitch,'lift':lift}
    def pose(self,kind,t,profile):
        self.reset();phase=math.tau*t;running=kind=='Run';moving=kind in ['Walk','Run'];combat=kind in ['CombatIdle','Attack','Block','Hit','Cast','Channel','Heal','StealthIdle'];attack=kind in ['Attack','Cast'];weapon=profile!='Unarmed'
        bob=-.012+.002*math.sin(phase);lean=.018;twist=0;sway=0;root_y=0;stance=.40 if running else .60;travel=.76 if running else .72
        if moving:
            bob=curve([(0,(0,0,-.066)),(.10,(0,0,-.096)),(.28,(0,0,-.037)),(.43,(0,0,.008)),(.5,(0,0,-.066))],t%.5).z if running else (-.049-.014*math.cos(phase*2))
            lean=.10 if running else .026;sway=(.005 if running else .007)*math.sin(phase);twist=(.055 if running else .035)*math.cos(phase)
        if combat:bob=-.028;lean=.035
        if profile=='Dagger' and combat:bob-=.023;lean+=.035
        if attack:
            twist=curve([(0,(0,0,0)),(.25,(0,0,-.25)),(.4666667,(0,0,.28)),(.63,(0,0,.33)),(1,(0,0,0))],t).z
            lean+=.035*math.sin(math.pi*t)**2;root_y=-.018*math.sin(math.pi*t)**2
        if kind=='Hit':lean=-.11*math.sin(math.pi*t);bob-=.028*math.sin(math.pi*t)
        if kind in ['Jump','JumpStart','JumpLoop','JumpLand']:
            bob=-.065*math.sin(math.pi*t) if kind in ['JumpStart','JumpLand'] else .25*math.sin(math.pi*t) if kind=='Jump' else .05
        self.pb['Root'].matrix=Matrix.Translation((sway*self.S,root_y*self.S,bob*self.S))@self.rest['Root'];bpy.context.view_layer.update()
        self.world_rot('pelvis',y=(.018*math.sin(phase) if moving else 0),z=twist*.25)
        for name,weight in [('spine_01',.4),('spine_02',.35),('spine_03',.25)]:self.world_rot(name,x=lean*weight,z=(-twist*.65 if moving else twist*.75)*weight)
        # Keep the gaze forward while the torso turns through the strike.
        self.pb['head'].matrix=Matrix.Translation(self.pb['head'].head)@(Quaternion((0,0,1),twist*.10)@self.rest['head'].to_quaternion()).to_matrix().to_4x4();bpy.context.view_layer.update()
        feet=[];foot_commands=[]
        for side,sg,offset in [('l',1,0),('r',-1,.5)]:
            u=(t+offset)%1;pitch=0;lift=0;y=-.015;x=sg*.108
            if moving:
                if u<stance:
                    y=-travel/2+travel*u/stance
                    if u<.09:pitch=-.15*(1-smooth(u/.09))
                    elif u>stance-.12:pitch=(.42 if running else .28)*smooth((u-stance+.12)/.12)
                else:
                    v=(u-stance)/(1-stance);m=travel*(1-stance)/stance;y=hermite(travel/2,-travel/2,m,m,v)
                    lift=(.145 if running else .048)*math.sin(math.pi*v)**2
                    pitch=curve([(0,(.42 if running else .28,0,0)),(.42,(-.20,0,0)),(1,(-.15,0,0))],v).x
                x+=sg*(.006 if running else .002)*math.sin(math.pi*max(0,(u-stance)/(1-stance)))**2
            elif combat:
                x=sg*.13;y=-.10 if side=='l' else .115
                if attack and side=='r':pitch=.16*math.sin(math.pi*t)**2
            if kind in ['Jump','JumpLoop']:
                lift=(.30*math.sin(math.pi*t) if kind=='Jump' else .15)+(.05 if side=='r' else 0);y+=.05
            foot_commands.append((side,(x,y,0),pitch,lift))
        correction=0
        for side,point,pitch,lift in foot_commands:
            if lift>.0001:continue
            target,unused,min_z=self.foot_target(side,point,pitch,lift);hip=self.pb['thigh_'+side].head/self.S;reach=self.length['thigh_'+side]+self.length['calf_'+side]-.006
            horizontal=(hip.x-target.x)**2+(hip.y-target.y)**2
            allowed=math.sqrt(max(.01,reach*reach-horizontal));correction=max(correction,hip.z-target.z-allowed)
        if correction>0:
            self.pb['Root'].location.z-=correction*self.S;bpy.context.view_layer.update()
        for command in foot_commands:feet.append(self.foot(*command))
        pulse=math.sin(phase);carry=.014*pulse if moving else .002*math.sin(phase)
        right=Vector((-.30,-.29,1.16+carry));axis=Vector((-.08,-.65,.756));left=Vector((.30,-.28,1.20-carry*.35));offhand=profile in ['Sword','Mace','Staff']
        if profile=='Staff':right=Vector((-.36,-.22,1.18+carry*.5));axis=Vector((.10,-.035,.994))
        elif profile=='Dagger':right=Vector((-.28,-.17,1.05+carry));axis=Vector((-.12,-.75,.65))
        elif profile=='Mace':axis=Vector((-.1,-.45,.888));right.z+=.015
        if running:
            right.z+=.055;right.y-=.015;left.z+=.045
            if profile=='Dagger':axis=Vector((-.12,-.90,.42))
        if combat:
            right=Vector((-.27,-.34,1.23));axis=Vector((-.13,-.36,.924));left=Vector((.29,-.32,1.28))
            if profile=='Staff':right=Vector((-.37,-.22,1.25));axis=Vector((.10,-.06,.993))
            if profile=='Dagger':right=Vector((-.28,-.30,1.19));axis=Vector((-.2,-.80,.565))
        if kind in ['Block','Channel','Heal']:
            left=Vector((.20,-.43,1.47));right.y=-.33;right.z=1.32
            if profile=='Staff':right=Vector((-.36,-.24,1.33));left=Vector((.28,-.34,1.44))
        if attack:
            if profile=='Sword':
                right=curve([(0,(-.27,-.34,1.23)),(.23,(-.40,.01,1.49)),(.31,(-.38,-.10,1.55)),(.4666667,(-.08,-.53,1.27)),(.62,(.22,-.40,1.06)),(.85,(-.19,-.35,1.12)),(1,(-.27,-.34,1.23))],t)
                axis=curve([(0,(-.13,-.36,.924)),(.23,(-.24,.50,.83)),(.31,(-.17,.28,.95)),(.4666667,(.34,-.94,-.08)),(.62,(.64,-.48,-.60)),(.85,(.04,-.75,.66)),(1,(-.13,-.36,.924))],t).normalized()
            elif profile=='Mace':
                right=curve([(0,(-.27,-.34,1.23)),(.24,(-.40,-.01,1.44)),(.32,(-.36,-.15,1.53)),(.4666667,(-.12,-.49,1.26)),(.64,(.10,-.41,1.07)),(1,(-.27,-.34,1.23))],t)
                axis=curve([(0,(-.13,-.36,.924)),(.24,(-.1,.40,.91)),(.32,(-.06,.10,.99)),(.4666667,(.12,-.97,-.20)),(.64,(.28,-.48,-.83)),(1,(-.13,-.36,.924))],t).normalized()
            elif profile=='Dagger':
                right=curve([(0,(-.28,-.30,1.19)),(.24,(-.43,-.11,1.39)),(.4666667,(.05,-.49,1.26)),(.61,(.29,-.37,1.14)),(1,(-.28,-.30,1.19))],t)
                axis=curve([(0,(-.2,-.8,.565)),(.24,(-.3,-.05,.95)),(.4666667,(.5,-.8,-.30)),(.61,(.75,-.2,-.63)),(1,(-.2,-.8,.565))],t).normalized()
            elif profile=='Staff':
                a=math.sin(math.pi*t)**2;right=Vector((-.37,-.22-.08*a,1.25+.15*a));axis=Vector((.10,-.06-.18*a,.993)).normalized();left=Vector((.28,-.32-.035*a,1.28+.12*a))
        if kind=='Hit':right.y+=.08*math.sin(math.pi*t);left.y+=.08*math.sin(math.pi*t)
        if attack and profile in ['Sword','Mace']:
            clear=math.sin(math.pi*t)**2;left.x+=.13*clear;left.y+=.19*clear;left.z-=.025*clear
        if weapon:
            self.hand('r',right,axis,1.0)
            if offhand:self.hand('l',left,(0,0,1),.85,True)
            else:self.free_hand('l',(.24,-.06-(.15 if running else .08)*pulse,1.03+(.18 if running else 0)),.30)
        else:
            for side,sg,offset in [('l',1,0),('r',-1,math.pi)]:
                wave=math.cos(phase+offset);wrist=(sg*.245,-.04+(.12 if moving else .005)*wave,1.02)
                if running:wrist=(sg*.255,-.22+.14*wave,1.21+.018*math.sin(phase+offset))
                if combat:wrist=(sg*.25,-.30,1.22)
                if attack and side=='r':wrist=(-.24+.10*math.sin(math.pi*t)**2,-.30-.23*math.sin(math.pi*t)**2,1.24)
                self.free_hand(side,wrist,.8 if combat else .16)
        if kind=='Death':
            u=smooth((t-.12)/.88);self.pb['Root'].matrix=Matrix.Translation((0,0,.12*u*self.S))@Quaternion((1,0,0),-math.pi/2*u).to_matrix().to_4x4()@self.rest['Root'];bpy.context.view_layer.update()
        return {'time':t,'feet':feet,'rightGrip':list(right),'weaponAxis':list(axis.normalized())}

def bake(motion,name,kind,profile,duration):
    scene=motion.scene;rig=motion.rig;pb=motion.pb;count=round(duration*30)+1;names=[b.name for b in pb];data={n:{'location':[],'rotation_quaternion':[]} for n in names};reports=[]
    for i in range(count):
        t=i/(count-1);reports.append(motion.pose(kind,t,profile))
        for n in names:
            p=pb[n];q=p.rotation_quaternion.copy();previous=data[n]['rotation_quaternion']
            if previous and sum(a*b for a,b in zip(q,previous[-1]))<0:q.negate()
            data[n]['location'].append(tuple(p.location));previous.append(tuple(q))
    action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
    for p in pb:
        p.location=data[p.name]['location'][0];p.rotation_quaternion=data[p.name]['rotation_quaternion'][0]
        p.keyframe_insert('location',frame=1,group=p.name);p.keyframe_insert('rotation_quaternion',frame=1,group=p.name)
    curves=action.fcurves if hasattr(action,'fcurves') else action.layers[0].strips[0].channelbag(rig.animation_data.action_slot).fcurves
    for fcurve in curves:
        n=re.search(r'pose.bones\["(.*?)"\]',fcurve.data_path).group(1);prop=fcurve.data_path.rsplit('.',1)[-1]
        values=data[n][prop];fcurve.keyframe_points.add(count-1);array=np.array([(i+1,v[fcurve.array_index]) for i,v in enumerate(values)],dtype=np.float32).ravel();fcurve.keyframe_points.foreach_set('co',array)
        for key in fcurve.keyframe_points:key.interpolation='LINEAR'
        fcurve.update()
    action['motion_version']=2;action['weapon_profile']=profile;action['loop']=kind in LOOPS;action['contact_seconds']=14/30 if kind in ['Attack','Cast'] else 0
    rig.animation_data.action=None;print('BAKED',motion.CLASS,name,count,flush=True)
    return {'name':name,'kind':kind,'profile':profile,'duration':duration,'loop':kind in LOOPS,'samples':reports}

def author(CLASS):
    source=ROOT/'output/models'/(CLASS.lower()+'-production')/(CLASS.lower()+'.blend');bpy.ops.wm.open_mainfile(filepath=str(source));m=Motion(CLASS);scene=m.scene;scene.render.fps=30
    states=[]
    for ob in scene.objects:
        if ob.type=='MESH':
            for mod in ob.modifiers:states.append((mod,mod.show_viewport));mod.show_viewport=False
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)
    specs=[(n,n,DEFAULT[CLASS],d) for n,d in TIMES.items() if n in ['Idle','CombatIdle','Walk','Run','Attack','Block','Hit','Jump','JumpStart','JumpLoop','JumpLand','Death']]
    if CLASS=='Wizard':specs += [('Cast','Cast','Staff',1.),('Channel','Channel','Staff',2.4)]
    if CLASS=='Cleric':specs += [('Cast','Cast','Staff',1.),('Heal','Heal','Staff',2.4)]
    if CLASS=='Rogue':specs += [('Cast','Attack','Dagger',1.),('StealthIdle','CombatIdle','Dagger',2.4)]
    for profile in ['Sword','Dagger','Staff','Mace','Unarmed']:
        for kind in ['Idle','CombatIdle','Walk','Run','Attack','Block']:specs.append((profile+'_'+kind,kind,profile,TIMES[kind]))
    reports=[bake(m,*spec) for spec in specs];m.reset()
    for mod,visible in states:mod.show_viewport=visible
    scene.frame_set(1);scene.frame_end=96
    # Grip calibration is measured in the unchanged character bind space.
    grips={};C=Matrix.Rotation(-math.pi/2,4,'X')
    for side,slot in [('r','mainHand'),('l','offHand')]:
        socket=bpy.data.objects['socket_'+slot];local=socket.matrix_world.inverted()@m.rest['hand_'+side]@m.grips[side]@Matrix.Scale(m.S,4)
        gltf=C@local@C.inverted();grips[slot]={'socket':'socket_'+slot,'localMatrix':[gltf[row][col] for col in range(4) for row in range(4)],'handToGripBlender':[list(row) for row in m.grips[side]]}
    (REV/(CLASS.lower()+'-grips.json')).write_text(json.dumps(grips,indent=2));(REV/(CLASS.lower()+'-motion-report.json')).write_text(json.dumps(reports,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(REV/(CLASS.lower()+'-animation-review.blend')),compress=True)
    bpy.ops.object.select_all(action='DESELECT');m.rig.hide_set(False);m.rig.select_set(True)
    for ob in scene.objects:
        if ob.name.startswith('socket_'):ob.hide_set(False);ob.select_set(True)
    bpy.context.view_layer.objects.active=m.rig
    bpy.ops.export_scene.gltf(filepath=str(REV/(CLASS.lower()+'-motion.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_morph=False,export_yup=True,export_extras=True,export_force_sampling=True)
    print('FINISHED',CLASS,flush=True)
