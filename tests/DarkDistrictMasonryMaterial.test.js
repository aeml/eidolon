import * as THREE from 'three';
import { createDarkDistrictMasonryMaterial, sampleDarkDistrictMasonry, DARK_DISTRICT_MASONRY_SPAN } from '../src/art/DarkDistrictMasonryMaterial.js';
import { createDarkDistrictArchitectureGeometry } from '../src/art/DarkDistrictArchitectureGeometry.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { darkRealmFixture } from './darkRealmFixture.js';

const variants = ['high','low'].flatMap(quality => ['shore','archive','foundry','city'].map(recipe => [quality,recipe]));
test.each(variants)('%s %s masonry retains metric scale and outward tangent orientation on every wall and clipped corner', (quality,recipe) => {
    const parts=createDarkDistrictArchitectureGeometry(recipe,quality),g=parts.stone,p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal;
    try {
        const a=new THREE.Vector3(),b=a.clone(),c=a.clone();let faces=0;
        for(let i=0;i<p.count;i+=3){
            a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
            const e1=b.clone().sub(a),e2=c.clone().sub(a),du1=uv.getX(i+1)-uv.getX(i),dv1=uv.getY(i+1)-uv.getY(i),du2=uv.getX(i+2)-uv.getX(i),dv2=uv.getY(i+2)-uv.getY(i),d=du1*dv2-du2*dv1;
            const tangent=e1.clone().multiplyScalar(dv2).addScaledVector(e2,-dv1).divideScalar(d),up=e1.clone().multiplyScalar(-du2).addScaledVector(e2,du1).divideScalar(d);
            expect(Number.isFinite(d)&&d>0).toBe(true);expect(tangent.length()).toBeCloseTo(DARK_DISTRICT_MASONRY_SPAN,4);expect(up.length()).toBeCloseTo(DARK_DISTRICT_MASONRY_SPAN,4);
            expect(Math.abs(tangent.dot(up))).toBeLessThan(.0001);expect(tangent.cross(up).normalize().dot(new THREE.Vector3().fromBufferAttribute(n,i))).toBeGreaterThan(.99999);
            if(Math.abs(n.getY(i))<.01)expect(up.y).toBeCloseTo(DARK_DISTRICT_MASONRY_SPAN,4);faces++;
        }
        expect(faces).toBeGreaterThan(40);
    } finally {Object.values(parts).forEach(g=>g.dispose());}
});

test('basalt signals repeat without seams, with bounded shallow relief and separate roughness',()=>{
    let maxDelta=0;const colors=[],heights=[],roughness=[];
    for(let y=0;y<61;y++)for(let x=0;x<67;x++){
        const a=sampleDarkDistrictMasonry(x/67,y/61),b=sampleDarkDistrictMasonry(x/67-2,y/61+3),values=s=>[...s.color,s.height,s.roughness];
        for(const [i,value] of values(a).entries()){expect(Number.isFinite(value)).toBe(true);maxDelta=Math.max(maxDelta,Math.abs(value-values(b)[i]));}
        expect(a.color.every(v=>v>=44&&v<105)).toBe(true);expect(a.height).toBeGreaterThanOrEqual(0);expect(a.height).toBeLessThan(.032);expect(a.roughness).toBeGreaterThanOrEqual(.84);expect(a.roughness).toBeLessThanOrEqual(.99);
        colors.push(a.color[0]);heights.push(a.height);roughness.push(a.roughness);
    }
    expect(maxDelta).toBeLessThan(1e-9);expect(Math.max(...colors)-Math.min(...colors)).toBeGreaterThan(30);expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(.02);expect(Math.max(...roughness)-Math.min(...roughness)).toBeGreaterThan(.07);
    for(const t of [.13,.37,.79]){const a=sampleDarkDistrictMasonry(t,1e-10),b=sampleDarkDistrictMasonry(t,1-1e-10);expect(Math.abs(a.height-b.height)).toBeLessThan(1e-8);expect(Math.max(...a.color.map((v,i)=>Math.abs(v-b.color[i])))).toBeLessThan(1e-8);}
});

test.each([['high',256],['low',128]])('%s skyline batches share bounded scene-owned maps and retire each resource once',(quality,size)=>{
    const root=createDarkRealmScene(new THREE.Group(),darkRealmFixture(),null,{quality}),walls=root.children.filter(m=>m.material?.userData.darkDistrictMasonry);
    const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});
    expect(meshes).toHaveLength(49);expect(walls).toHaveLength(4);expect(new Set(walls.map(m=>m.material)).size).toBe(1);
    const m=walls[0].material,counters=[];expect(m.emissive.getHex()).toBe(0);expect(m.displacementMap).toBeNull();
    for(const [i,key] of ['map','normalMap','roughnessMap'].entries()){
        const texture=m[key];expect(texture.image.width).toBe(size);expect(texture.image.height).toBe(size);expect(texture.colorSpace).toBe(i===0?THREE.SRGBColorSpace:THREE.NoColorSpace);expect(texture.wrapS).toBe(THREE.RepeatWrapping);expect(texture.wrapT).toBe(THREE.RepeatWrapping);expect(texture.generateMipmaps).toBe(true);
        let count=0;texture.addEventListener('dispose',()=>count++);counters.push(()=>count);
    }
    let materials=0;m.addEventListener('dispose',()=>materials++);const normals=m.normalMap.image.data;let valid=true;
    for(let i=0;i<normals.length;i+=4){const n=[normals[i],normals[i+1],normals[i+2]].map(v=>v/255*2-1);valid&&=Math.abs(Math.hypot(...n)-1)<.007&&n[2]>.8;}
    expect(valid).toBe(true);RenderSystem.prototype.disposeObjectResources.call({},root);expect(counters.map(fn=>fn())).toEqual([1,1,1]);expect(materials).toBe(1);
});

test('independent owners receive deterministic maps without sharing disposal ownership',()=>{
    const a=createDarkDistrictMasonryMaterial('low'),b=createDarkDistrictMasonryMaterial('low');
    try{for(const key of ['map','normalMap','roughnessMap']){expect(a[key]).not.toBe(b[key]);expect(a[key].image.data).toEqual(b[key].image.data);}}
    finally{for(const m of [a,b]){for(const key of ['map','normalMap','roughnessMap'])m[key].dispose();m.dispose();}}
});

test.each(['high','low'])('%s retained recipes survive scene texture mutation, disposal and profile changes',quality=>{
    const keys=['map','normalMap','roughnessMap'],first=createDarkDistrictMasonryMaterial(quality);
    const expected=keys.map(key=>new Uint8Array(first[key].image.data));
    for(const key of keys){first[key].image.data.fill(0);first[key].dispose();}first.dispose();
    const other=createDarkDistrictMasonryMaterial(quality==='high'?'low':'high');
    for(const key of keys)other[key].dispose();other.dispose();
    const returning=createDarkDistrictMasonryMaterial(quality);
    try{for(const [i,key]of keys.entries())expect(returning[key].image.data).toEqual(expected[i]);}
    finally{for(const key of keys)returning[key].dispose();returning.dispose();}
});
