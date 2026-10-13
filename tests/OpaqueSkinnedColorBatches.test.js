import * as THREE from 'three';
import { OpaqueSkinnedColorBatches } from '../src/core/OpaqueSkinnedColorBatches.js';
import { OpaqueSkinnedColorRuntime } from '../src/core/OpaqueSkinnedColorRuntime.js';

function fixture({ runtime = false } = {}) {
    const scene = new THREE.Scene(), group = new THREE.Group(), root = new THREE.Group(), bone = new THREE.Bone();
    scene.add(group); group.add(root); root.add(bone); root.userData.authoredClass = 'Fighter';
    const skeleton = new THREE.Skeleton([bone]), material = new THREE.MeshStandardMaterial(), meshes = [];
    for (const x of [0, 2]) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, 0, x + 1, 0, 0, x, 1, 0], 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));
        geometry.setAttribute('skinIndex',new THREE.Uint8BufferAttribute(new Uint8Array(12),4));
        geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
        geometry.setIndex([0,1,2]);const mesh = new THREE.SkinnedMesh(geometry,material);
        root.add(mesh);mesh.bind(skeleton);mesh.castShadow = true;mesh.frustumCulled = false;meshes.push(mesh);
    }
    const camera = new THREE.OrthographicCamera(-20,20,20,-20,.1,100);camera.position.z = 20;
    const renderer = { calls: [], casters: [], throwRender: false,
        renderBufferDirect(camera,scene,geometry,material,object) { this.calls.push({ camera, scene, geometry, material, object }); },
        render(scene,camera) {
            scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);scene.onBeforeRender(this,scene,camera,null);
            this.casters = [];scene.traverseVisible(mesh=>{if(mesh.isMesh&&mesh.castShadow)this.casters.push(mesh);});
            if (this.throwRender) throw new Error('render failed');
            const projected=[];scene.traverseVisible(mesh=>{if(mesh.isMesh&&mesh.material.visible&&mesh.layers.test(camera.layers))projected.push(mesh);});
            this.beforeProjected?.(projected);
            for (const mesh of projected) this.renderBufferDirect(camera,scene,mesh.geometry,mesh.material,mesh,null);
            scene.onAfterRender(this,scene,camera);
        }
    };
    const originals = { render: renderer.render, direct: renderer.renderBufferDirect, before: scene.onBeforeRender };
    const manager = runtime ? new OpaqueSkinnedColorRuntime(renderer,scene,camera,[scene,group]) : null;
    const owner = manager?.owner || new OpaqueSkinnedColorBatches(renderer,scene,camera);
    if (!runtime) owner.register(root);
    const frame = (targetScene=scene,targetCamera=camera) => {renderer.calls=[];renderer.render(targetScene,targetCamera);return renderer.calls;};
    return { scene,group,root,meshes,material,skeleton,camera,renderer,originals,owner,manager,frame };
}

test.each(['attribute', 'offset', 'stride', 'itemSize', 'count', 'normalized', 'gpuType'])(
    'live %s attribute metadata invalidates the color copy and recovers exactly', field => {
        const f = fixture(); f.frame();
        const entry = [...f.owner.entries.values()][0], geometry = f.meshes[0].geometry;
        const attribute = geometry.attributes.position, descriptors = Object.getOwnPropertyDescriptors(attribute);
        expect(f.owner.valid(entry)).toBe(true);
        if (field === 'attribute') geometry.attributes.position = attribute.clone();
        if (field === 'offset') attribute.offset = 0;
        if (field === 'stride') attribute.data = { stride: 4 };
        if (field === 'itemSize') attribute.itemSize = 2;
        if (field === 'count') attribute.count++;
        if (field === 'normalized') attribute.normalized = true;
        if (field === 'gpuType') attribute.gpuType = THREE.IntType;
        expect(f.owner.valid(entry)).toBe(false);
        geometry.attributes.position = attribute;
        for (const key of Object.keys(attribute)) if (!Object.hasOwn(descriptors, key)) delete attribute[key];
        Object.defineProperties(attribute, descriptors);
        expect(f.owner.valid(entry)).toBe(true); f.owner.dispose();
    });

test('color draws combine while all original casters, source identities and borrowed ownership stay exact', () => {
    const f=fixture(),source=f.meshes.map(mesh=>mesh.geometry);expect(f.frame()).toHaveLength(1);
    const entry=[...f.owner.entries.values()][0];expect(f.renderer.calls[0].object).toBe(entry.proxy);
    expect(entry.geometry.index.count).toBe(6);expect(entry.proxy.skeleton).toBe(f.skeleton);expect(entry.proxy.material).toBe(f.material);
    expect(f.renderer.casters).toEqual(f.meshes);expect(f.meshes.map(mesh=>mesh.geometry)).toEqual(source);
    expect(f.meshes.every(mesh=>mesh.visible&&mesh.castShadow)).toBe(true);expect(entry.proxy.parent).toBeNull();
    expect(f.owner.lastSavedSubmissions).toBe(1);let disposed=0;entry.geometry.addEventListener('dispose',()=>disposed++);
    f.owner.dispose();f.owner.dispose();expect(disposed).toBe(1);expect(f.material.version).toBe(0);
    expect(f.renderer.render).toBe(f.originals.render);expect(f.renderer.renderBufferDirect).toBe(f.originals.direct);expect(f.scene.onBeforeRender).toBe(f.originals.before);
});

test('steady frames retain one owned generation; source geometry replacement retires once', () => {
    const f=fixture();f.frame();const first=[...f.owner.entries.values()][0];let count=0;first.geometry.addEventListener('dispose',()=>count++);
    for(let i=0;i<5;i++){f.frame();expect([...f.owner.entries.values()][0]).toBe(first);}
    f.meshes[1].geometry=f.meshes[1].geometry.clone();expect(f.frame()).toHaveLength(1);
    expect([...f.owner.entries.values()][0]).not.toBe(first);expect(count).toBe(1);f.owner.dispose();
});

test.each(['positionVersion','indexVersion','attributeRename','material','skeleton'])('%s source generation replaces the owned copy', change => {
    const f=fixture();f.frame();const old=[...f.owner.entries.values()][0];let count=0;old.geometry.addEventListener('dispose',()=>count++);
    if(change==='positionVersion')f.meshes[0].geometry.attributes.position.needsUpdate=true;
    if(change==='indexVersion')f.meshes[0].geometry.index.needsUpdate=true;
    if(change==='attributeRename')for(const mesh of f.meshes){const uv=mesh.geometry.attributes.uv;mesh.geometry.deleteAttribute('uv');mesh.geometry.setAttribute('uv1',uv);}
    if(change==='material'){const material=f.material.clone();for(const mesh of f.meshes)mesh.material=material;}
    if(change==='skeleton'){const skeleton=new THREE.Skeleton(f.skeleton.bones,f.skeleton.boneInverses);for(const mesh of f.meshes)mesh.skeleton=skeleton;}
    expect(f.frame()).toHaveLength(1);expect([...f.owner.entries.values()][0]).not.toBe(old);expect(count).toBe(1);
    if(change==='attributeRename')expect([...f.owner.entries.values()][0].geometry.attributes.uv1).toBeDefined();f.owner.dispose();
});

test.each(['hidden','parentHidden','alpha','worldMatrix','layer','normalFormat','callback','transmission'])('%s incompatibility falls back and recovers without altering originals', change => {
    const f=fixture();f.frame();const other=f.meshes[1];
    if(change==='hidden')other.visible=false;
    if(change==='parentHidden')f.root.visible=false;
    if(change==='alpha')f.material.alphaTest=.1;
    if(change==='worldMatrix')other.position.x=1;
    if(change==='layer')other.layers.set(2);
    if(change==='normalFormat')other.geometry.attributes.normal.normalized=true;
    if(change==='callback')other.onBeforeRender=()=>{};
    if(change==='transmission'){const material=new THREE.MeshPhysicalMaterial({transmission:.5});for(const mesh of f.meshes)mesh.material=material;}
    const calls=f.frame();expect(f.owner.entries.size).toBe(0);expect(calls.every(call=>f.meshes.includes(call.object))).toBe(true);
    other.visible=true;f.root.visible=true;f.material.alphaTest=0;other.position.x=0;other.layers.set(0);
    other.geometry.attributes.normal.normalized=false;other.onBeforeRender=THREE.Object3D.prototype.onBeforeRender;
    for(const mesh of f.meshes)mesh.material=f.material;
    expect(f.frame()).toHaveLength(1);f.owner.dispose();
});

test('partial frustum visibility retains original draws rather than including extra source triangles', () => {
    const f=fixture();for(const mesh of f.meshes)mesh.frustumCulled=true;
    f.meshes[1].geometry.translate(1000,0,0);expect(f.frame()).toHaveLength(2);expect(f.owner.lastSavedSubmissions).toBe(0);
    f.owner.dispose();
});

test('another camera and disabled owner use original sources only', () => {
    const f=fixture();expect(f.frame(f.scene,f.camera.clone())).toHaveLength(2);expect(f.owner.entries.size).toBe(0);
    f.owner.enabled=false;expect(f.frame()).toHaveLength(2);f.owner.enabled=true;expect(f.frame()).toHaveLength(1);f.owner.dispose();
});

test('render exception removes every temporary proxy and leaves stock source visibility intact', () => {
    const f=fixture();f.renderer.throwRender=true;expect(()=>f.frame()).toThrow('render failed');
    expect(f.owner.context).toBeNull();expect([...f.owner.entries.values()].every(e=>!e.proxy.parent)).toBe(true);
    expect(f.meshes.every(mesh=>mesh.visible&&mesh.castShadow)).toBe(true);f.renderer.throwRender=false;
    expect(f.frame()).toHaveLength(1);f.owner.dispose();
});

test('nested same-camera render suspends projected proxies and returns to the outer pass', () => {
    const f=fixture();let nested=false,nestedCalls;
    f.renderer.beforeProjected=()=>{if(!nested){nested=true;const before=f.renderer.calls.length;f.renderer.render(f.scene,f.camera);nestedCalls=f.renderer.calls.slice(before);}};
    f.frame();expect(nestedCalls).toHaveLength(2);expect(nestedCalls.every(call=>f.meshes.includes(call.object))).toBe(true);
    expect(f.renderer.calls).toHaveLength(3);expect(f.owner.context).toBeNull();f.owner.dispose();
});

test('nested render failure restores the outer projected proxy and source state', () => {
    const f=fixture();let nested=false;
    f.renderer.beforeProjected=()=>{if(!nested){nested=true;f.renderer.throwRender=true;expect(()=>f.renderer.render(f.scene,f.camera)).toThrow('render failed');f.renderer.throwRender=false;}};
    expect(f.frame()).toHaveLength(1);expect(f.owner.context).toBeNull();expect(f.meshes.every(mesh=>mesh.visible&&mesh.castShadow)).toBe(true);f.owner.dispose();
});

test('source disposal retires derived geometry and does not resurrect a disposed source', () => {
    const f=fixture();f.frame();const entry=[...f.owner.entries.values()][0];let count=0;entry.geometry.addEventListener('dispose',()=>count++);
    f.meshes[0].geometry.dispose();expect(f.owner.entries.size).toBe(0);expect(count).toBe(1);
    expect(f.frame()).toHaveLength(2);expect(f.owner.entries.size).toBe(0);f.owner.dispose();
});

test('foreign disposal of an owned geometry is observed without a second disposal', () => {
    const f=fixture();f.frame();const entry=[...f.owner.entries.values()][0];let count=0;entry.geometry.addEventListener('dispose',()=>count++);
    entry.geometry.dispose();expect(f.frame()).toHaveLength(1);expect(count).toBe(1);f.owner.dispose();
});

test('unregister, clear and reset bound geometry and borrowed disposal listeners', () => {
    const f=fixture();f.frame();const source=f.meshes[0].geometry;
    expect(source._listeners.dispose).toHaveLength(1);f.owner.reset();expect(f.owner.entries.size).toBe(0);expect(source._listeners.dispose).toHaveLength(0);
    expect(f.frame()).toHaveLength(1);f.owner.clear();expect(f.owner.roots.size).toBe(0);expect(f.frame()).toHaveLength(2);f.owner.dispose();
});

test('disposing during a projected frame defers hook restoration until stale proxies are suppressed', () => {
    const f=fixture();f.renderer.beforeProjected=()=>f.owner.dispose();
    expect(f.frame()).toHaveLength(2);expect(f.owner.entries.size).toBe(0);expect(f.renderer.render).toBe(f.originals.render);
    expect(f.scene.onBeforeRender).toBe(f.originals.before);expect(f.owner.context).toBeNull();
});

test.each(['material','castShadow','visible','callback','geometry','attributeVersion'])('foreign proxy %s changes retain the original source route', change => {
    const f=fixture();let once=false;
    f.renderer.beforeProjected=()=>{if(once)return;once=true;const entry=[...f.owner.entries.values()][0];
        if(change==='material')entry.proxy.material=entry.proxy.material.clone();
        if(change==='castShadow')entry.proxy.castShadow=true;
        if(change==='visible')entry.proxy.visible=false;
        if(change==='callback')entry.proxy.onBeforeRender=()=>{};
        if(change==='geometry')entry.proxy.geometry=entry.proxy.geometry.clone();
        if(change==='attributeVersion')entry.geometry.attributes.normal.needsUpdate=true;
    };
    expect(f.frame()).toHaveLength(2);expect(f.renderer.calls.every(call=>f.meshes.includes(call.object))).toBe(true);
    expect(f.frame()).toHaveLength(1);expect(f.renderer.casters).toEqual(f.meshes);f.owner.dispose();
});

test('constructor rollback and disposal preserve exact hook ownership/descriptors', () => {
    const f=fixture();f.owner.dispose();Object.defineProperty(f.renderer,'renderBufferDirect',{value:f.originals.direct,writable:false,configurable:true});
    expect(()=>new OpaqueSkinnedColorBatches(f.renderer,f.scene,f.camera)).toThrow();expect(f.scene.onBeforeRender).toBe(f.originals.before);
    Object.defineProperty(f.renderer,'renderBufferDirect',{value:f.originals.direct,writable:true,configurable:true});
    const owner=new OpaqueSkinnedColorBatches(f.renderer,f.scene,f.camera);const external=()=>{};f.scene.onBeforeRender=external;
    owner.dispose();expect(f.scene.onBeforeRender).toBe(external);expect(f.renderer.render).toBe(f.originals.render);
});

test('one orthographic owner admission excludes duplicate and unsupported installations', () => {
    const f=fixture();expect(()=>new OpaqueSkinnedColorBatches(f.renderer,f.scene,f.camera)).toThrow(/One orthographic/);f.owner.dispose();
    expect(()=>new OpaqueSkinnedColorBatches(f.renderer,f.scene,new THREE.PerspectiveCamera())).toThrow(/orthographic/);
});

test('runtime ignores owned proxy events and retains steady root generations', () => {
    const f=fixture({runtime:true});expect(f.manager.roots.size).toBe(1);f.frame();const entry=[...f.owner.entries.values()][0];
    for(let i=0;i<4;i++){expect(f.frame()).toHaveLength(1);expect([...f.owner.entries.values()][0]).toBe(entry);}
    f.manager.dispose();expect(f.owner.roots.size).toBe(0);expect(f.owner.entries.size).toBe(0);
});

test.each(['revision','quality','newChild'])('runtime refreshes %s appearance generations', change => {
    const f=fixture({runtime:true});f.frame();const entry=[...f.owner.entries.values()][0];
    if(change==='revision')f.root.userData.equipmentVisualRevision=1;
    if(change==='quality')f.root.userData.authoredQuality='low';
    if(change==='newChild'){const other=f.meshes[0].clone();other.skeleton=f.skeleton;other.geometry=other.geometry.clone();f.root.add(other);}
    f.frame();expect([...f.owner.entries.values()][0]).not.toBe(entry);expect(f.owner.lastSavedSubmissions).toBe(change==='newChild'?2:1);f.manager.dispose();
});

test('runtime realm detach/rearrival and root replacement remove old listeners and rebuild new ownership', () => {
    const f=fixture({runtime:true});f.frame();f.group.remove(f.root);expect(f.manager.roots.size).toBe(0);expect(f.owner.entries.size).toBe(0);
    f.group.add(f.root);expect(f.frame()).toHaveLength(1);f.scene.remove(f.group);expect(f.manager.roots.size).toBe(0);
    f.scene.add(f.group);expect(f.frame()).toHaveLength(1);f.manager.clear();expect(f.manager.roots.size).toBe(0);f.manager.dispose();
    expect(f.group._listeners.childadded).toHaveLength(0);expect(f.root._listeners.childadded).toHaveLength(0);
});
