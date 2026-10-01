from pathlib import Path
exec(compile((Path(__file__).resolve().parents[3] / 'output/models/equipment-production/geometry.py').read_text(),'geometry.py','exec'))

def blade(b,p,legend,dagger=False):
    length=(.34 if dagger else .84)*(1.12 if legend else 1);w=(.033 if dagger else .039)*(1.25 if legend else 1)
    rings=[]
    for z,width in [(.105,w*.80),(.145,w),(.18,w*.92),(length*.72,w*.76),(length*.91,w*.52),(length+.11,.0005)]:
        shift=(.035*math.sin((z-.1)/length*math.pi)) if dagger and legend else 0
        rings.append([(shift+x,yy,z) for x,yy in [(-width,0),(-width*.8,-.004),(0,-.009),(width*.8,-.004),(width,0),(width*.8,.004),(0,.009),(-width*.8,.004)]])
    b.loft(rings,p['steel'],True,False)
    b.lathe([(.019,-.12),(.021,-.102),(.016,.06),(.023,.078)],p['leather'],segments=16)
    for j in range(10):b.ring((0,0,-.095+j*.015),.019,.0018,p['trim'],axis=(0,0,1),segments=16)
    b.lathe([(.023,-.13),(.031,-.15),(.025,-.177),(.01,-.186)],p['trim'],segments=12)
    guard=[(-.135,.04),(-.12,.073),(-.045,.108),(0,.105),(.045,.108),(.12,.073),(.135,.04),(.11,.055),(.032,.086),(-.032,.086),(-.11,.055)]
    if dagger:guard=[(x*.64,z) for x,z in guard]
    b.panel(guard,0,.034,p['trim'],.006)
    if legend:
        for side in [-1,1]:
            b.panel([(side*.025,.102),(side*.056,.175),(side*.045,.215),(side*.018,.17)],0,.022,p['trim'],.003)
            b.tube([(side*w*.33,-.010,.19),(side*w*.26,-.010,length*.72),(0,-.006,length+.075)],.0033,p['glow'],6)
        b.crystal((0,-.023,.108),.026,.060,p['gem'],axis=(0,-1,0))
        for j,z in enumerate(np.linspace(.23,length*.76,4 if dagger else 7)):b.rune((0,-.011,z),.014 if dagger else .018,p['glow'],j)
        b.crystal((0,0,-.168),.020,.07,p['gem'])

def staff(b,p,legend):
    bottom=-.72;top=.82 if legend else .73
    b.lathe([(.018,bottom),(.029,bottom+.04),(.025,-.54),(.023,-.12),(.027,.14),(.028,.59),(.034,top)],p['wood'],segments=18)
    for side in range(4):
        theta=side*math.tau/4
        b.tube([((.024+.005*math.sin(z*13))*math.cos(theta+z*.7),(.024+.005*math.sin(z*13))*math.sin(theta+z*.7),z) for z in np.linspace(-.60,.66,24)],.0035,p['main'],7)
    for z in [-.68,-.22,.17,.62]:b.lathe([(.029,z-.022),(.034,z-.015),(.034,z+.015),(.029,z+.022)],p['trim'],segments=20)
    for j in range(14):b.ring((0,0,-.12+j*.018),.029,.0025,p['leather'],axis=(0,0,1),segments=18)
    if legend:
        for k in range(4):
            a=k*math.tau/4;pts=[(r*math.cos(a),r*math.sin(a),z) for r,z in [(.027,.58),(.13,.78),(.11,1.02),(.058,1.09)]]
            b.tube(pts,[.023,.017,.014,.004],p['trim'],9)
        b.ball((0,0,.87),(.08,.08,.08),p['gem'],24,12)
        b.ring((0,0,.87),.137,.006,p['glow'],axis=(.35,.80,.4))
        b.ring((0,0,.87),.105,.005,p['trim'],axis=(0,0,1))
        b.crystal((0,0,1.055),.033,.10,p['glow'])
        for z in np.linspace(.24,.59,5):b.rune((0,-.031,z),.02,p['glow'],int(z*10))
    else:
        b.lathe([(.032,.66),(.065,.74),(.05,.81)],p['trim'],segments=12)
        b.crystal((0,0,.84),.046,.18,p['gem'])

def mace(b,p,legend):
    b.lathe([(.021,-.20),(.027,-.18),(.022,.08),(.025,.11),(.020,.37)],p['trim'],segments=16)
    for j in range(12):b.ring((0,0,-.16+j*.018),.023,.0027,p['leather'],axis=(0,0,1),segments=16)
    b.ball((0,0,-.20),(.033,.033,.032),p['trim'])
    b.lathe([(.048,.32),(.065,.38),(.058,.50),(.035,.55)],p['main'],segments=16)
    for k in range(6):
        a=k*math.tau/6;c,s=math.cos(a),math.sin(a)
        pts=[(.035,.32),(.105,.36),(.13,.46),(.065,.56),(.026,.52)] if legend else [(.035,.34),(.082,.35),(.092,.47),(.05,.52)]
        temp=Builder('flange');temp.panel(pts,0,.020,p['trim'],.005)
        b.add([(x*c-y*s,x*s+y*c,z) for x,y,z in temp.v],temp.f,p['trim'],False)
    if legend:
        b.crystal((0,0,.47),.048,.22,p['glow'])
        b.ring((0,0,.47),.151,.007,p['glow'],axis=(0,1,0),segments=48)
        for k in range(12):
            a=k*math.tau/12;b.tube([(math.sin(a)*r,-.007,.47+math.cos(a)*r) for r in [.155,.18 if k%3==0 else .167]],.004,p['trim'],6)
    else:b.ball((0,0,.51),(.038,.038,.052),p['steel'])

def shield(b,p,legend):
    w=.30 if legend else .26;top=.37 if legend else .33;bottom=-.43 if legend else -.36
    outer=[(0,top),(w*.77,top*.91),(w,top*.51),(w*.82,bottom*.43),(0,bottom),(-w*.82,bottom*.43),(-w,top*.51),(-w*.77,top*.91)]
    b.panel(outer,0,.045,p['trim'],.009)
    inside=[(x*.90,z*.91) for x,z in outer];b.panel(inside,-.030,.020,p['main'] if legend else p['wood'],.006)
    if not legend:
        for x in [-.15,-.075,0,.075,.15]:b.tube([(x,-.043,-.20+abs(x)*.65),(x,-.043,.27-abs(x)*.4)],.002,p['dark'],6)
        b.ball((0,-.054,.01),(.063,.036,.064),p['steel'],20,10)
    else:
        b.panel([(-.023,-.27),(.023,-.27),(.034,.10),(.12,.12),(.12,.16),(.034,.18),(.025,.28),(-.025,.28),(-.034,.18),(-.12,.16),(-.12,.12),(-.034,.10)],-.053,.014,p['trim'],.003)
        b.crystal((0,-.086,.075),.057,.09,p['gem'],axis=(0,-1,0),sides=8)
        b.ring((0,-.061,.075),.086,.005,p['glow'],axis=(0,1,0))
        for side in [-1,1]:
            for j in range(3):b.panel([(side*.065,.10-j*.045),(side*(.22-j*.025),.21-j*.055),(side*(.205-j*.027),.12-j*.055),(side*.060,.055-j*.035)],-.052,.010,p['trim'],.002)
            b.tube([(side*x,-.036,z) for x,z in [(w*.77,top*.86),(w*.90,top*.45),(w*.72,bottom*.42),(.025,bottom*.86)]],.004,p['glow'],7)
    for x,z in outer:b.ball((x*.92,-.030,z*.93),(.008,.006,.008),p['steel'],10,6)
    for x in [-.065,.065]:b.tube([(x,.031,-.10),(x,.11,-.07),(x,.11,.07),(x,.031,.10)],.017,p['leather'],8)
    b.tube([(-.065,.11,0),(.065,.11,0)],.017,p['leather'],10)
    b.v=[(x,y-.11,z) for x,y,z in b.v]

def tome(b,p,legend):
    width=.135 if legend else .115;z=.16
    b.box((0,0,0),(width*2,.045,.30),p['paper'])
    for y in [-.03,.03]:
        b.panel([(-width,-z),(width,-z),(width,z),(-width,z)],y,.015,p['main'],.006)
        for side in [-1,1]:
            for zz in [-1,1]:b.panel([(side*(width-.043),zz*z),(side*width,zz*z),(side*width,zz*(z-.043))],y+(-.01 if y<0 else .01),.010,p['trim'],.002)
    b.box((-width,0,0),(.028,.08,.33),p['leather'])
    for zz in [-.105,-.07,.07,.105]:b.box((-width-.005,0,zz),(.030,.085,.009),p['trim'])
    for zz in np.linspace(-.125,.125,19):b.tube([(-width+.006,-.005,zz),(width-.005,-.005,zz)],.0008,p['trim'],4)
    b.ring((0,-.045,0),.074,.0035,p['trim'])
    b.rune((0,-.046,0),.046,p['glow'] if legend else p['trim'],2)
    if legend:
        b.crystal((0,-.065,0),.027,.063,p['gem'],axis=(0,-1,0))
        b.ring((0,-.051,0),.088,.003,p['glow'])
        for j,zz in enumerate([-.115,.115]):
            for xx in [-.07,-.035,0,.035,.07]:b.rune((xx,-.043,zz),.012,p['glow'],j+int(xx*100))
        for side in [-1,1]:b.panel([(side*.08,.15),(side*.17,.21),(side*.13,.12)],0,.026,p['trim'],.004)
    b.v=[(x,y-.065,z+.10) for x,y,z in b.v]

WEAPONS={'iron-sword':('plate',lambda b,p,l:blade(b,p,l)), 'steel-dagger':('leather',lambda b,p,l:blade(b,p,l,True)),
         'wooden-staff':('wood',staff),'cleric-mace':('holy',mace),'wooden-shield':('holy',shield),'spell-tome':('cloth',tome)}

def build_weapons():
    scene=bpy.data.scenes.new('Eidolon | authored weapons');bpy.context.window.scene=scene
    for old in list(bpy.data.scenes):
        if old!=scene:bpy.data.scenes.remove(old)
    for action in list(bpy.data.actions):bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)
    collection=bpy.data.collections.new('WEAPONS | grip at origin');scene.collection.children.link(collection);reports=[]
    inventory=json.loads((WORK/'inventory.json').read_text())['items']
    for item in inventory:
        if item['id'] not in WEAPONS:continue
        family,fn=WEAPONS[item['id']]
        for tier in ['standard','legendary']:
            b=Builder(item['id']+'__'+tier);p=palette(tier,family);fn(b,p,tier=='legendary');ob=b.mesh(collection)
            ob['baseName']=item['name'];ob['equipmentSlot']=item['slot'];ob['rarityModel']=tier;ob['attachment']='socket_mainHand' if item['slot']=='mainHand' else 'socket_offHand';ob['gripAtOrigin']=True;ob['forwardAxis']='Blender +Z blade/shaft; glTF +Y'
            report=export_mesh(ob,DEST/'weapons'/(item['id']+'-'+tier+'.glb'));report.update(id=item['id'],tier=tier,name=item['name'],slot=item['slot']);reports.append(report)
            ob.hide_set(True);ob.hide_render=True
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'weapons.blend'),compress=True)
    (WORK/'weapon-report.json').write_text(json.dumps(reports,indent=2))
    return {'weapons':len(reports),'source':bpy.data.filepath}
