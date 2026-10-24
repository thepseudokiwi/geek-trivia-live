import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { D20Theme } from '../../shared/types';
import { d20Palette } from '../../shared/d20Themes';
import { roundedD20 } from '../d20/geometry';
import { dieTopology } from '../d20/topology';
import { prepareD20Roll, sampleD20Roll } from '../d20/physics';
import { boardPixelRatio, boardRollFrame } from '../d20/boardCamera';
import { elapsedRollMs, landingGlowStrength, landingGlowMs } from '../d20/timing';

type Props = { result: number; theme: D20Theme; durationMs: number; rolledAt: string; onLanded: (at:number) => void; space?: 'tray' | 'board'; resultVisible?:boolean; landingAt?:number|null };
const boardCameraOptions={position:[0,20,5] as [number,number,number],left:-10,right:10,top:6,bottom:-6};
const trayCameraOptions={position:[0,12,3.72] as [number,number,number],fov:38};
function numberTexture(value: number, color: string, glow = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = color; context.font = '600 138px Arial';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  if (glow) { context.shadowColor = '#ffffff'; context.shadowBlur = 23; }
  const paint = () => { context.fillText(String(value), 128, 137); if (value === 6 || value === 9) context.fillRect(109, 208, 38, 6); };
  if (glow) { paint(); paint(); } paint();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function contactShadowTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Canvas unavailable');
  const gradient=context.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'#0009');gradient.addColorStop(.45,'#0006');gradient.addColorStop(1,'#0000');
  context.fillStyle=gradient;context.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}
const numberedFaces = dieTopology.faces.map((face, index) => {
  const [a,b,c] = face.map(vertex => dieTopology.vertices[vertex]);
  const center = a.clone().add(b).add(c).multiplyScalar(1/3), normal = dieTopology.normals[index];
  const up = a.clone().sub(center).normalize(), right = new THREE.Vector3().crossVectors(up,normal).normalize();
  return { center: center.addScaledVector(normal,.007), normal, quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal)) };
});

function Die({ result, theme, durationMs, rolledAt, onLanded, space = 'tray', landingAt = null }: Props) {
  const group = useRef<THREE.Group>(null), glow = useRef<THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>>(null);
  const shadow = useRef<THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>>(null);
  const reported = useRef(false), callback = useRef(onLanded); callback.current = onLanded;
  const landed = useRef(landingAt), landingFrame = useRef<number|undefined>(undefined);
  const { camera, size, invalidate, setDpr, get } = useThree();
  const roll = useMemo(() => prepareD20Roll(result, rolledAt, space), [result, rolledAt, space]);
  const boardFrame = useMemo(() => space === 'board' ? boardRollFrame(roll,size.width/size.height) : null, [roll,space,size.width,size.height]);
  const geometry = useMemo(() => roundedD20(dieTopology.vertices,dieTopology.faces,dieTopology.normals), []);
  const palette = d20Palette(theme);
  const textures = useMemo(() => roll.faceValues.map(value => numberTexture(value,palette.numbers)), [roll,palette]);
  const glowTexture = useMemo(() => numberTexture(result,'#ffffff',true), [result]);
  const shadowTexture = useMemo(() => space==='board'?contactShadowTexture():null, [space]);
  const final = roll.samples[roll.samples.length - 1].position;
  const bound = useMemo(() => Math.max(...roll.samples.map(sample => Math.abs(sample.position.x-final.x)))+1.3, [roll,final]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { textures.forEach(texture => texture.dispose()); }, [textures]);
  useEffect(() => () => { glowTexture.dispose(); }, [glowTexture]);
  useEffect(() => () => { shadowTexture?.dispose(); }, [shadowTexture]);
  useEffect(() => () => { if (landingFrame.current !== undefined) cancelAnimationFrame(landingFrame.current); }, []);
  useLayoutEffect(() => {
    if (!boardFrame || !(camera instanceof THREE.OrthographicCamera)) return;
    camera.left = -boardFrame.halfWidth; camera.right = boardFrame.halfWidth; camera.top = boardFrame.halfHeight; camera.bottom = -boardFrame.halfHeight;
    camera.position.set(0, 20, 5); camera.lookAt(0, 0, 0);
    // R3F must not replace our world-space frustum with pixel-space bounds.
    (camera as THREE.OrthographicCamera & {manual:boolean}).manual=true;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); invalidate();
    setDpr(boardPixelRatio(size.width,size.height,window.devicePixelRatio));
  }, [camera, boardFrame, invalidate, setDpr, size.width, size.height]);
  useFrame(() => {
    if (!group.current) return;
    const elapsed = elapsedRollMs(rolledAt,durationMs), progress = durationMs > 0 ? Math.min(1,elapsed/durationMs) : 1;
    const sample = sampleD20Roll(roll,progress);
    if (boardFrame) {
      // Canvas configuration can reapply its DPR prop on a parent render.
      // Restore the budget before drawing, including the landing UI update.
      const ratio=boardPixelRatio(size.width,size.height,window.devicePixelRatio);
      if(Math.abs(get().viewport.dpr-ratio)>.001)setDpr(ratio);
      group.current.scale.setScalar(boardFrame.dieScale);
      group.current.position.set(sample.position.x * boardFrame.widthScale, sample.position.y * boardFrame.dieScale, sample.position.z * boardFrame.depthScale);
      if(shadow.current){
        const height=Math.max(0,sample.position.y-dieTopology.inradius);
        shadow.current.position.set(group.current.position.x,.005,group.current.position.z);
        shadow.current.scale.setScalar(boardFrame.dieScale*(1.1+height*.14));
        shadow.current.material.opacity=.6/(1+height*.55);
      }
    } else {
      group.current.scale.setScalar(1);
      group.current.position.copy(sample.position).sub(new THREE.Vector3(final.x,0,final.z));
      const zoom = THREE.MathUtils.smoothstep(progress,.82,1);
      const wide = Math.max(12,bound / Math.tan(THREE.MathUtils.degToRad(19)) / Math.max(.35,size.width/size.height));
      const distance = THREE.MathUtils.lerp(wide,6.5,zoom);
      camera.position.set(0,distance,distance*.31); camera.lookAt(0,0,0);
    }
    group.current.quaternion.copy(sample.rotation);
    if (progress === 1 && !reported.current) {
      reported.current = true;
      landed.current ??= Date.now();
      // Commit the final rendered pose before triggering sound and the reveal.
      landingFrame.current = requestAnimationFrame(() => callback.current(landed.current!));
    }
    const landingAge = landed.current === null ? -1 : Date.now() - landed.current;
    if (glow.current) { const strength=landingGlowStrength(landingAge); glow.current.visible=strength>0; glow.current.material.opacity=strength*.95; }
    if (progress < 1 || landingAge < landingGlowMs) invalidate();
  });
  const top = numberedFaces[roll.topFace];
  return <>
    {shadowTexture&&<mesh ref={shadow} rotation={[-Math.PI/2,0,0]} renderOrder={-1}>
      <planeGeometry args={[3,3]}/><meshBasicMaterial map={shadowTexture} transparent depthWrite={false} toneMapped={false}/>
    </mesh>}
    <group ref={group}>
    <mesh geometry={geometry} castShadow={space!=='board'} receiveShadow={space!=='board'} dispose={null}><meshStandardMaterial color={palette.surface} roughness={.34} metalness={.2}/></mesh>
    {numberedFaces.map((face,index) => <mesh key={index} position={face.center} quaternion={face.quaternion} renderOrder={1}>
      <planeGeometry args={[.58,.58]}/><meshBasicMaterial map={textures[index]} alphaTest={.08} alphaToCoverage depthWrite polygonOffset polygonOffsetFactor={-1}/>
    </mesh>)}
    <mesh ref={glow} position={top.center.clone().addScaledVector(top.normal,.002)} quaternion={top.quaternion} visible={false} renderOrder={2}>
      <planeGeometry args={[.58,.58]}/><meshBasicMaterial map={glowTexture} color={palette.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
    </mesh>
  </group></>;
}
function Fallback({result,resultVisible,durationMs,rolledAt,onLanded}:Props) {
  useEffect(() => {
    const timer=setTimeout(()=>onLanded(Date.now()),Math.max(0,durationMs-elapsedRollMs(rolledAt,durationMs)));
    return()=>clearTimeout(timer);
  }, [durationMs,rolledAt,onLanded]);
  return <div className="d20-webgl-fallback" role="img" aria-label={resultVisible?`D20 result ${result}`:'Rolling D20'}>{resultVisible?result:'D20'}</div>;
}
class RendererBoundary extends Component<Props&{children:ReactNode},{failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() { return this.state.failed ? <Fallback {...this.props}/> : this.props.children; }
}
export function D20Three(props: Props) {
  const [canRender, setCanRender] = useState(() => {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) return false;
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch { return false; }
  });
  const detachContextListener = useRef<(() => void)|undefined>(undefined);
  useEffect(() => () => detachContextListener.current?.(), []);
  return <div className="d20-three" role="img" aria-label={props.resultVisible?`D20 result ${props.result}`:'Rolling D20'}>
    {canRender?<RendererBoundary key={props.rolledAt} {...props}>
      <Canvas orthographic={props.space === 'board'} frameloop="demand" dpr={props.space==='board'?[.5,1.25]:[1,2]} camera={props.space==='board'?boardCameraOptions:trayCameraOptions} shadows={props.space!=='board'} gl={{alpha:true,antialias:true,powerPreference:'high-performance'}} fallback="3D dice are unavailable."
        onCreated={({gl})=>{
          detachContextListener.current?.();
          const lost=(event:Event)=>{event.preventDefault();setCanRender(false)};
          gl.domElement.addEventListener('webglcontextlost',lost);
          detachContextListener.current=()=>gl.domElement.removeEventListener('webglcontextlost',lost);
        }}>
        <hemisphereLight args={['#fff4dc','#3b4642',3]}/>
        <directionalLight position={props.space==='board'?[-6,16,8]:[-4,9,5]} intensity={3.5} color="#ffeed6" castShadow={props.space!=='board'} shadow-mapSize={[1024,1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-bias={-.001}/>
        <directionalLight position={[4,3,-4]} intensity={2} color="#b8d5e6"/>
        {props.space!=='board'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow><planeGeometry args={[60,60]}/><shadowMaterial opacity={.22}/></mesh>}
        <Die key={props.rolledAt} {...props}/>
      </Canvas>
    </RendererBoundary>:<Fallback {...props}/>}
  </div>;
}
