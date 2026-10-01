def full_chest_shell(b,fit,p,legend,family):
    """Continuous crew-neck torso and short sleeves, with four open boundaries."""
    h=fit.h;clear={'plate':.024,'leather':.016,'cloth':.020}[family]+(.003 if legend else 0)
    base=Builder('Temporary shirt volume');bottom=h*.561;neck=fit.joint('neck_01');top=neck.z+.006
    rings=[];shoulder=fit.joint('upperarm_l');yoke_bottom=shoulder.z+.010*h/1.9
    neck_rx=abs(fit.torso(top,math.pi/2,clear).x);neck_ry=max(.061*h/1.9,abs(fit.torso(top,0,clear).y))
    levels=list(np.linspace(bottom,neck.z-.060,23))+[neck.z-.042,neck.z-.024,top,top+.018]
    for z in levels:
        rs=[fit.torso(float(min(z,top)),a,clear) for a in np.linspace(0,math.tau,64,endpoint=False)]
        for theta,q in zip(np.linspace(0,math.tau,64,endpoint=False),rs):
            # Bridge the clavicle to the sleeve with a continuous tailored yoke.
            # Horizontal body rays near the shoulder can fall through the arm
            # socket and make a sawtooth neckline if used without an envelope.
            u=max(0,min(1,(z-yoke_bottom)/(top-yoke_bottom)))
            rx=neck_rx+(shoulder.x+.035*h/1.9-neck_rx)*(1-u)**.72
            ry=neck_ry+(.115*h/1.9-neck_ry)*(1-u)
            if z>shoulder.z-.035*h/1.9:
                radius=1/math.sqrt((math.sin(theta)/rx)**2+(math.cos(theta)/ry)**2)
                current=math.hypot(q.x,q.y-.004)
                if radius>current:q.x=math.sin(theta)*radius;q.y=.004-math.cos(theta)*radius
            q.z=float(z)
        rings.append(rs)
    base.loft(rings,p['main'],True,True)
    sleeves=[]
    for side in [-1,1]:
        bone=fit.rig.data.bones['upperarm_'+('l' if side>0 else 'r')];a=bone.head_local;axis=(bone.tail_local-a).normalized();end=a.lerp(bone.tail_local,.39)
        front=Vector((0,-1,0));front=(front-axis*front.dot(axis)).normalized();across=axis.cross(front).normalized();rs=[]
        for t in np.linspace(-.10,.48,10):
            center=a.lerp(bone.tail_local,float(t));row=[]
            for theta in np.linspace(0,math.tau,40,endpoint=False):
                direction=front*math.cos(theta)+across*math.sin(theta)
                radius=fit.radius(center,direction,'left' if side>0 else 'right',.068*h/1.9,.045*h/1.9,.092*h/1.9)
                row.append(center+direction*(radius+clear*.76))
            rs.append(row)
        base.loft(rs,p['main'],True,True);sleeves.append((end,axis,side,abs(a.x)+.010*h/1.9))
    volume=base.mesh();bpy.context.view_layer.objects.active=volume;volume.select_set(True)
    remesh=volume.modifiers.new('Joined shoulder and sleeve volume','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.0045*h/1.9;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=volume.modifiers.new('Tailored cloth smoothing','SMOOTH');smooth.factor=.55;smooth.iterations=4;bpy.ops.object.modifier_apply(modifier=smooth.name)
    bm=bmesh.new();bm.from_mesh(volume.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,bottom+.009),plane_no=(0,0,-1),clear_outer=True,clear_inner=False)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,top),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
    for center,axis,side,inner_edge in sleeves:
        # An oblique sleeve plane also crosses the ribs if applied globally.
        # Restrict the cut to the actual outboard sleeve, keeping side seams.
        faces=[f for f in bm.faces if (f.calc_center_median()-center).length<h*.11 and f.calc_center_median().x*side>inner_edge]
        edges=set(e for f in faces for e in f.edges);verts=set(v for f in faces for v in f.verts)
        bmesh.ops.bisect_plane(bm,geom=list(verts)+list(edges)+faces,dist=.00001,plane_co=center,plane_no=axis,clear_outer=True,clear_inner=False)
    # Remove loose remesh fragments before collecting each open garment edge.
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bm.to_mesh(volume.data);bm.free();volume.data.update()
    decimate=volume.modifiers.new('Game garment topology','DECIMATE');decimate.ratio=.33;decimate.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=decimate.name)
    # Shell edge returns are kept explicit, so the collar reads as material.
    bm=bmesh.new();bm.from_mesh(volume.data);boundary=[e for e in bm.edges if e.is_boundary];unvisited=set(boundary);loops=[]
    while unvisited:
        edge=unvisited.pop();edges=[edge];start=edge.verts[0];current=edge.verts[1];path=[start.co.copy(),current.co.copy()]
        for unused in range(len(boundary)+1):
            candidates=[e for e in current.link_edges if e in unvisited]
            if not candidates:break
            edge=candidates[0];unvisited.remove(edge);edges.append(edge);current=edge.other_vert(current)
            if current==start:break
            path.append(current.co.copy())
        if len(path)>4:loops.append((path,edges,sum((path[i]-path[i-1]).length for i in range(len(path)))))
    loops.sort(key=lambda entry:-entry[2])
    for path,edges,perimeter in loops[4:]:
        assert perimeter<h*.20, 'Unexpected large garment opening'
        bmesh.ops.holes_fill(bm,edges=edges,sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(volume.data);bm.free();volume.data.update()
    loops=[entry[0] for entry in loops[:4]]
    assert len(loops)==4,'Shirt must have neck, hem, and two sleeve openings'
    b.add([v.co for v in volume.data.vertices],[list(f.vertices) for f in volume.data.polygons],p['main'],True)
    for path in loops:
        path_trim(b,path,p['trim'],.0035 if family=='plate' else .0026,True)
        center=sum(path,Vector())/len(path)
        inner=[q+(center-q).normalized()*.004 for q in path];b.loft([path,inner],p['main'],False,True)
    print('SHIRT_BOUNDARIES',fit.CLASS,family,legend,len(loops),flush=True)
    bpy.data.objects.remove(volume,do_unlink=True)
