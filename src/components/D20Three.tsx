import{useEffect,useMemo,useRef}from'react';
import{Canvas,useFrame,useLoader}from'@react-three/fiber';
import{GLTFLoader}from'three/examples/jsm/loaders/GLTFLoader.js';
import*as THREE from'three';
import type{D20Theme}from'../../shared/types';

// Centers of the numbered islands in the model's baked UV atlas. Image Y is
// flipped to WebGL UV space. The normals recovered from these islands let the
// authored number—not an unrelated overlay—land facing the camera.
const atlas:Array<[number,number,number]>=[
 [16,.094,.925],[10,.241,.925],
 [18,.544,.878],[17,.713,.878],[1,.881,.878],
 [12,.544,.719],[20,.713,.719],[2,.881,.719],
 [14,.544,.575],[9,.713,.575],[3,.881,.575],
 [19,.544,.394],[15,.713,.394],[8,.881,.394],
 [5,.544,.231],[7,.713,.231],[13,.881,.231],
 [4,.544,.087],[6,.713,.087],[11,.881,.087],
];
function numberedNormals(root:THREE.Object3D){
 const best=new Map<number,{distance:number;area:number;normal:THREE.Vector3}>();root.updateMatrixWorld(true);
 root.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const geometry=object.geometry as THREE.BufferGeometry,position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),index=geometry.index;if(!position||!uv)return;const count=index?index.count:position.count;
  for(let offset=0;offset<count;offset+=3){const ids=[0,1,2].map(step=>index?index.getX(offset+step):offset+step),points=ids.map(id=>new THREE.Vector3(position.getX(id),position.getY(id),position.getZ(id)).applyMatrix4(object.matrixWorld)),uvs=ids.map(id=>new THREE.Vector2(uv.getX(id),uv.getY(id))),center=uvs[0].clone().add(uvs[1]).add(uvs[2]).divideScalar(3);let nearest=atlas[0],distance=Infinity;for(const candidate of atlas){const d=(center.x-candidate[1])**2+(center.y-candidate[2])**2;if(d<distance){distance=d;nearest=candidate}}if(distance>.025)return;const cross=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])),area=cross.length()/2;if(area<1e-7)return;const previous=best.get(nearest[0]);if(!previous||distance<previous.distance*.75||distance<previous.distance*1.2&&area>previous.area)best.set(nearest[0],{distance,area,normal:cross.normalize()});
  }
 });
 return Array.from({length:20},(_,index)=>best.get(index+1)?.normal??new THREE.Vector3(0,0,1));
}

function Die({result,durationMs,onLanded}:{result:number;theme:D20Theme;durationMs:number;onLanded:()=>void}){
 const gltf=useLoader(GLTFLoader,'/models/D20.glb'),group=useRef<THREE.Group>(null),started=useRef(performance.now()),reported=useRef(false),model=useMemo(()=>{const clone=gltf.scene.clone(true),box=new THREE.Box3().setFromObject(clone),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=2/Math.max(size.x,size.y,size.z);clone.position.sub(center);clone.scale.multiplyScalar(scale);clone.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;const multiple=Array.isArray(object.material),sources:THREE.Material[]=multiple?object.material:[object.material],materials=sources.map(source=>{const material=source.clone();if(material instanceof THREE.MeshStandardMaterial){material.color.set('#ffffff');if(material.map){material.map.colorSpace=THREE.SRGBColorSpace;material.map.anisotropy=8}if(material.normalMap){material.normalMap.colorSpace=THREE.NoColorSpace;material.normalMap.anisotropy=8}material.needsUpdate=true}return material});object.material=multiple?materials:materials[0]}});return clone},[gltf.scene]),normals=useMemo(()=>numberedNormals(gltf.scene),[gltf.scene]),target=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(normals[result-1],new THREE.Vector3(0,0,1)),[normals,result]),turns=4+(result%3),direction=result%2?1:-1,spinAxis=useMemo(()=>new THREE.Vector3(.72*direction,1,.48).normalize(),[direction]),settleStart=.78,tumbleAt=(progress:number)=>{const decay=(1-Math.exp(-2.15*progress))/(1-Math.exp(-2.15)),angle=(turns*2.35+.7)*Math.PI*2*decay;return new THREE.Quaternion().setFromAxisAngle(spinAxis,angle)},settleQuaternion=useMemo(()=>tumbleAt(settleStart),[spinAxis,turns]);
 useEffect(()=>{started.current=performance.now();reported.current=false},[result,durationMs]);
 useFrame(()=>{if(!group.current)return;const raw=Math.min(1,(performance.now()-started.current)/Math.max(1,durationMs)),impacts=[0,.24,.46,.65,.8,.91,1],heights=[.95,.56,.3,.14,.055,.01],found=impacts.findIndex((time,index)=>index>0&&raw<=time),segment=Math.max(0,Math.min(heights.length-1,found-1)),start=impacts[segment],end=impacts[segment+1],local=Math.max(0,Math.min(1,(raw-start)/(end-start))),ballistic=4*heights[segment]*local*(1-local),settle=Math.max(0,Math.min(1,(raw-settleStart)/(1-settleStart))),smooth=settle*settle*(3-2*settle),ground=-.52*(1-smooth),startX=direction*(1.55+(result%4)*.06),impactDistance=Math.min(...impacts.slice(1).map(time=>Math.abs(raw-time))),compression=Math.max(0,1-impactDistance/.014)*(1-raw)*.075;group.current.position.set(startX*Math.pow(1-raw,1.35),ground+ballistic,0);if(raw<settleStart)group.current.quaternion.copy(tumbleAt(raw));else group.current.quaternion.copy(settleQuaternion).slerp(target,smooth);group.current.scale.set(1+compression*.45,1-compression,1+compression*.45);if(raw===1&&!reported.current){reported.current=true;onLanded()}});
 return <group ref={group}><primitive object={model}/></group>
}

useLoader.preload(GLTFLoader,'/models/D20.glb');
export function D20Three({result,theme,durationMs,onLanded}:{result:number;theme:D20Theme;durationMs:number;onLanded:()=>void}){return <div className="d20-three" role="img" aria-label={`D20 result ${result}`}><Canvas dpr={[1,2]} camera={{position:[0,0,4.6],fov:42}} shadows gl={{alpha:true,antialias:true,powerPreference:'high-performance',toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.35}} fallback={null}><ambientLight intensity={1.7}/><hemisphereLight args={['#ffffff','#251234',2.4]}/><directionalLight position={[4,5,6]} intensity={3.2}/><pointLight position={[-4,-2,3]} intensity={2.2} color="#67e8f9"/><Die result={result} theme={theme} durationMs={durationMs} onLanded={onLanded}/></Canvas></div>}
