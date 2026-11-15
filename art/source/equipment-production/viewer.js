import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const $=id=>document.getElementById(id),stage=$('stage');
const inventory=await(await fetch('./inventory.json')).json();
const gripTransforms=await(await fetch('/assets/equipment/authored/grip-transforms.json')).json();
const families={plate:['iron-helm','plate-mail','plate-greaves','iron-boots','iron-gauntlets','steel-pauldrons','plated-girdle'],leather:['leather-cap','leather-tunic','leather-pants','leather-boots','leather-gloves','reinforced-spaulders','studded-belt'],cloth:['silk-hood','robes','silk-skirt','sandals','silk-gloves','velvet-mantle','silk-sash']};
const slotNames={head:'Head',chest:'Chest',legs:'Legs',feet:'Feet',gloves:'Gloves',shoulders:'Shoulders',belt:'Belt',mainHand:'Main hand',offHand:'Off hand',neck:'Neck',ring:'Ring',trinket:'Trinket'};
const selectors={};
for(const [slot,label]of Object.entries(slotNames)){const el=document.createElement('select');el.id='slot-'+slot;el.innerHTML='<option value="">Unequipped</option>'+inventory.items.filter(i=>i.slot===slot).map(i=>`<option value="${i.id}">${i.name}</option>`).join('');const lab=document.createElement('label');lab.textContent=label;lab.htmlFor=el.id;$('slots').append(lab,el);selectors[slot]=el;el.onchange=()=>loadEquipment();}
const scene=new THREE.Scene();scene.background=new THREE.Color('#10151d');scene.fog=new THREE.Fog('#10151d',7,18);
const camera=new THREE.PerspectiveCamera(33,1,.02,50);camera.position.set(2.8,1.6,4.7);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.append(renderer.domElement);
const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();scene.environmentIntensity=.8;
scene.add(new THREE.HemisphereLight(0xb7d4ff,0x2d2421,1.4));
for(const [color,intensity,x,y,z]of[[0xffeedc,3,-3,4,4],[0x8fb9ff,2,3,3,-2]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);if(z>0){light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=3;light.shadow.camera.bottom=-1;light.shadow.bias=-.0002;}scene.add(light);}
const floor=new THREE.Mesh(new THREE.CircleGeometry(15,96),new THREE.MeshStandardMaterial({color:'#141c27',roughness:.78}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;floor.receiveShadow=true;scene.add(floor);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.96,0);controls.enableDamping=true;controls.minDistance=1;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.53;
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.28,.35,1.25);composer.addPass(bloom);composer.addPass(new OutputPass());
const loader=new GLTFLoader(),clock=new THREE.Clock();let character=null,mixer=null,clips=[],skeleton=null,equipment=[],loadedClass='',paused=false,loadToken=0,equipmentToken=0,height=1.9,currentAction=null,currentGrips=null;const socketRest=new Map(),armRest=new Map();let collarHeight=1.6;
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);resize();
function disposeObject(object){object.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});object.removeFromParent();}
function chosen(){return Object.fromEntries(Object.entries(selectors).map(([s,el])=>[s,el.value]));}
function defaults(){const c=$('character').value,f=$('family').value;for(const el of Object.values(selectors))el.value='';for(const id of families[f]){const item=inventory.items.find(i=>i.id===id);selectors[item.slot].value=id;}selectors.mainHand.value={Fighter:'iron-sword',Wizard:'wooden-staff',Cleric:'cleric-mace',Rogue:'steel-dagger'}[c];selectors.offHand.value=c==='Fighter'||c==='Cleric'?'wooden-shield':c==='Wizard'?'spell-tome':'';}
function weaponProfile(){return({'iron-sword':'Sword','steel-dagger':'Dagger','wooden-staff':'Staff','cleric-mace':'Mace'})[selectors.mainHand.value]||'Unarmed';}
function resolvedClip(name){
 if(!name)return null;
 const profile=weaponProfile(),clip=clips.find(c=>c.name===profile+'_'+name)||clips.find(c=>c.name===name);
 if(!clip)return null;
 // A shield or book needs a supported left arm even with a dagger equipped.
 if(profile==='Dagger'&&selectors.offHand.value){const support=clips.find(c=>c.name==='Sword_'+name);if(support){const left=t=>/^(?:clavicle|upperarm|lowerarm|hand|thumb_\d+|index_\d+|middle_\d+|ring_\d+|pinky_\d+)_l\./.test(t.name);return new THREE.AnimationClip(profile+'_'+name+'_Offhand',clip.duration,[...clip.tracks.filter(t=>!left(t)),...support.tracks.filter(left)]);}}
 return clip;
}
function setMotion({immediate=false}={}){if(!mixer)return;const clip=resolvedClip($('motion').value);if(!clip){mixer.stopAllAction();currentAction=null;skeleton.pose();}else{const action=mixer.clipAction(clip);if(action!==currentAction){action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();if(currentAction&&!immediate)currentAction.crossFadeTo(action,.18,false);else{mixer.stopAllAction();action.reset().play();}currentAction=action;}else if(immediate)action.reset();}character.updateMatrixWorld(true);}
async function loadCharacter(){const token=++loadToken;++equipmentToken;$('status').textContent='Loading character…';window.reviewReady=false;for(const o of equipment)disposeObject(o);equipment=[];if(character)disposeObject(character);character=null;
 const c=$('character').value,gltf=await loader.loadAsync(`/assets/archetypes/${c}/${c.toLowerCase()}-runtime-high.glb`);if(token!==loadToken){disposeObject(gltf.scene);return;}
 character=gltf.scene;loadedClass=c;scene.add(character);clips=gltf.animations;currentGrips=gripTransforms.characters[c];currentAction=null;skeleton=null;
 const bank=await loader.loadAsync(`/assets/equipment/authored/motions/${c}.glb`);if(token!==loadToken)return;clips=bank.animations;
 mixer=new THREE.AnimationMixer(character);character.traverse(o=>{if(o.isSkinnedMesh){o.castShadow=true;if(!skeleton)skeleton=o.skeleton;if(o.name.startsWith(c+'_Body')){skeleton=o.skeleton;o.userData.originalIndex=o.geometry.index.clone();}}});
 skeleton.pose();character.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(character);height=box.max.y;controls.target.set(0,height*.52,0);socketRest.clear();character.traverse(o=>{if(o.name.startsWith('socket_'))socketRest.set(o.name,o.matrixWorld.clone());});
 collarHeight=character.getObjectByName('neck_01').getWorldPosition(new THREE.Vector3()).y;armRest.clear();for(const s of ['l','r']){const a=character.getObjectByName('upperarm_'+s).getWorldPosition(new THREE.Vector3()),b=character.getObjectByName('lowerarm_'+s).getWorldPosition(new THREE.Vector3());armRest.set(s,{a,axis:b.sub(a),lengthSquared:b.lengthSq()});}
 $('motion').innerHTML='<option value="">Bind pose</option>'+clips.filter(a=>!a.name.includes('_')).map(a=>`<option>${a.name}</option>`).join('');$('motion').value='CombatIdle';await loadEquipment();
}
function updateCoverage(selection){const c=loadedClass,head=!!selection.head,chest=!!selection.chest,pants=!!selection.legs&&!selection.legs.includes('skirt'),gloves=!!selection.gloves,boots=!!selection.feet&&selection.feet!=='sandals';
 character.traverse(o=>{if(!o.isMesh||o.userData.equipment)return;const name=o.name;if(/_(Hair|Scalp)(_|$)/.test(name))o.visible=!head;if(/_Undertop|_ClothSeams/.test(name))o.visible=!chest;if(/_Undershorts/.test(name))o.visible=!pants;
 if(!name.startsWith(c+'_Body')||!o.userData.originalIndex)return;const g=o.geometry,index=o.userData.originalIndex,position=g.attributes.position,skin=g.attributes.skinIndex,weight=g.attributes.skinWeight,keep=[];
 const hidden=vi=>{let max=-1,bone='';for(let k=0;k<4;k++){const w=weight.getComponent(vi,k);if(w>max){max=w;bone=o.skeleton.bones[skin.getComponent(vi,k)].name;}}const y=position.getY(vi)/height;
 const torsoCovered=chest&&/^(pelvis|spine_|clavicle_|neck_)/.test(bone)&&y>.583&&position.getY(vi)<collarHeight-.005;
 let sleeveCovered=false;if(chest&&/^upperarm_/.test(bone)){const r=armRest.get(bone.endsWith('_l')?'l':'r');const v=new THREE.Vector3().fromBufferAttribute(position,vi);sleeveCovered=v.sub(r.a).dot(r.axis)/r.lengthSquared<.31;}
 return torsoCovered||sleeveCovered||(pants&&/^(pelvis|thigh_|calf_)/.test(bone)&&y>.055&&y<.554)||(boots&&/^(calf_|foot_|ball_)/.test(bone)&&y<.104)||(gloves&&/^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(bone));};
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(!(hidden(a)&&hidden(b)&&hidden(c)))keep.push(a,b,c);}g.setIndex(keep);
 });
}
function attachRigid(gltf,item){const root=gltf.scene,attachment=currentGrips[item.slot],socket=character.getObjectByName(attachment.socket),local=new THREE.Matrix4().fromArray(attachment.localMatrix);local.decompose(root.position,root.quaternion,root.scale);socket.add(root);root.userData.attachmentMatrix=local.toArray();root.userData.itemId=item.id;root.traverse(o=>{if(o.isMesh)o.castShadow=true;});equipment.push(root);
}
async function loadEquipment(){if(!character)return;const token=++equipmentToken;window.reviewReady=false;const c=loadedClass,tier=$('tier').value,selection=chosen();$('status').textContent='Fitting equipment…';for(const o of equipment)disposeObject(o);equipment=[];const byName=new Map(skeleton.bones.map(b=>[b.name,b]));
 const requested=Object.values(selection).filter(Boolean).map(id=>inventory.items.find(i=>i.id===id));
 const all=await Promise.all(requested.map(async item=>({item,gltf:await loader.loadAsync(`/assets/equipment/authored/${['mainHand','offHand'].includes(item.slot)?'weapons':'fits/'+c}/${item.id}-${tier}.glb`)})));
 if(token!==equipmentToken){all.forEach(({gltf})=>disposeObject(gltf.scene));return;}
 for(const{item,gltf}of all){if(['mainHand','offHand'].includes(item.slot)){attachRigid(gltf,item);continue;}const parts=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)parts.push(o);});
 for(const part of parts){const joints=part.skeleton.bones.map(b=>{const target=byName.get(b.name);if(!target)throw Error('Missing bone '+b.name);return target;});const sk=new THREE.Skeleton(joints,part.skeleton.boneInverses.map(m=>m.clone()));part.removeFromParent();character.add(part);part.bind(sk,part.bindMatrix);part.castShadow=true;part.userData.equipment=true;part.userData.itemId=item.id;part.userData.slot=item.slot;equipment.push(part);}}
 // Robes completely cover the shorter silk skirt. Suppress its nested panels
 // while this combination is worn, so their trim cannot emerge during a stride.
 for(const part of equipment)if(part.userData.itemId==='silk-skirt')part.visible=selection.chest!=='robes';
 updateCoverage(selection);character.updateMatrixWorld(true);setMotion();$('title').textContent=c+' · '+({plate:'Plate',leather:'Leather',cloth:'Cloth'}[$('family').value]);$('rarity-label').textContent=tier==='legendary'?'Legendary collection':'Standard collection';$('status').textContent=`${requested.length} equipped pieces · fitted to ${c}`;window.reviewReady=true;
}
function fail(e){console.error(e);$('status').textContent=e.message;$('status').classList.add('error');window.reviewError=e.message;}
$('character').onchange=()=>{$('family').value={Fighter:'plate',Cleric:'plate',Wizard:'cloth',Rogue:'leather'}[$('character').value];defaults();loadCharacter().catch(fail);};$('family').onchange=()=>{defaults();loadEquipment().catch(fail);};$('tier').onchange=()=>loadEquipment().catch(fail);$('motion').onchange=setMotion;
$('front').onclick=()=>{camera.position.set(0,height*.68,4.6);controls.target.set(0,height*.52,0);};$('back').onclick=()=>{camera.position.set(0,height*.68,-4.6);controls.target.set(0,height*.52,0);};$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Play':'Pause';};
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.05);if(mixer&&!paused)mixer.update(dt);controls.update();composer.render();});
window.equipmentReview={async configure(c,f,t){$('character').value=c;$('family').value=f;$('tier').value=t;defaults();if(loadedClass!==c)await loadCharacter();else await loadEquipment();},get equipment(){return equipment;},get character(){return character;},get clips(){return clips;},get mixer(){return mixer;},get skeleton(){return skeleton;},get renderer(){return renderer;},set paused(v){paused=v;},motion(name){$('motion').value=name;setMotion();},sample(){character.updateMatrixWorld(true);const results=[],v=new THREE.Vector3();for(const mesh of equipment){if(!mesh.isSkinnedMesh)continue;mesh.skeleton.update();let max=0,minY=Infinity,maxY=-Infinity;for(let i=0;i<mesh.geometry.attributes.position.count;i+=Math.max(1,Math.floor(mesh.geometry.attributes.position.count/250))){mesh.getVertexPosition(i,v);if(!Number.isFinite(v.lengthSq()))throw Error('Nonfinite skin '+mesh.name);max=Math.max(max,v.length());minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}if(max>5)throw Error('Exploding skin '+mesh.name);results.push({name:mesh.name,maxRadius:max,minY,maxY});}return results;}};
window.equipmentReview.freezeRendering=()=>renderer.setAnimationLoop(null);
window.equipmentReview.render=()=>{controls.update();composer.render();};
window.equipmentReview.focus=(y,distance=1.5)=>{controls.target.set(0,y,0);camera.position.set(0,y,distance);controls.update();composer.render();};
window.equipmentReview.setView=(angle,distance=4.6)=>{controls.target.set(0,height*.53,0);camera.position.set(Math.sin(angle)*distance,height*.65,Math.cos(angle)*distance);controls.update();composer.render();};
window.equipmentReview.pose=(name,time=0)=>{$('motion').value=name;setMotion({immediate:true});mixer.setTime(time);character.updateMatrixWorld(true);};
window.equipmentReview.setItems=async(items)=>{for(const[slot,id]of Object.entries(items))selectors[slot].value=id;await loadEquipment();};
defaults();loadCharacter().catch(fail);
