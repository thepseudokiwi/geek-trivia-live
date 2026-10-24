import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { prepareD20Roll, sampleD20Roll } from '../src/d20/physics.js';
import { dieTopology } from '../src/d20/topology.js';
import { roundedD20 } from '../src/d20/geometry.js';
import { boardPixelRatio, boardRollFrame } from '../src/d20/boardCamera.js';
import { createRollClock, elapsedRollMs, landingGlowStrength } from '../src/d20/timing.js';
import { parseUtcTimestamp, utcTimestampIso } from '../shared/timestamps.js';
import { d20Palettes, d20Palette, d20ThemeIds } from '../shared/d20Themes.js';
import { defaultThemeConfig, themeConfigSchema } from '../shared/themeDesigner.js';

describe('ported D20 presentation', () => {
  it('lands every server result on its numbered face without changing that result', () => {
    for (let result = 1; result <= 20; result++) {
      const roll = prepareD20Roll(result,`authority-${result}`), last=sampleD20Roll(roll,1);
      const top=dieTopology.normals.map(normal=>normal.clone().applyQuaternion(last.rotation).y);
      expect(top[roll.topFace]).toBeGreaterThan(.998);
      expect(roll.faceValues[top.indexOf(Math.max(...top))]).toBe(result);
      expect([...roll.faceValues].sort((a,b)=>a-b)).toEqual(Array.from({length:20},(_,i)=>i+1));
      roll.faceValues.forEach((value,index)=>expect(value+roll.faceValues[dieTopology.opposite[index]]).toBe(21));
      expect(last.position.y).toBeCloseTo(dieTopology.inradius,2);
      expect(roll.samples.every(sample=>[...sample.position.toArray(),...sample.rotation.toArray()].every(Number.isFinite))).toBe(true);
    }
  });
  it('synchronizes host and audience paths by roll ID, including repeated results', () => {
    const first=prepareD20Roll(7,'roll-a'), same=prepareD20Roll(7,'roll-a'), next=prepareD20Roll(7,'roll-b');
    expect(first).toEqual(same);
    expect(first.samples[0]).not.toEqual(next.samples[0]);
    expect(sampleD20Roll(first,-10)).toEqual(first.samples[0]);
    expect(sampleD20Roll(first,10)).toEqual(first.samples.at(-1));
    expect(()=>prepareD20Roll(0,'bad')).toThrow(RangeError);
    expect(()=>prepareD20Roll(21,'bad')).toThrow(RangeError);
  });
  it('throws across the board on varied bounded paths while preserving the selected number', () => {
    for (let result = 1; result <= 20; result++) {
      const roll = prepareD20Roll(result, `board-travel-${result}`, 'board');
      const xs = roll.samples.map(sample => sample.position.x), zs = roll.samples.map(sample => sample.position.z);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(14);
      expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(2);
      expect(Math.max(...xs.map(Math.abs))).toBeLessThan(9);
      expect(Math.max(...zs.map(Math.abs))).toBeLessThan(5);
      const last = sampleD20Roll(roll, 1);
      const top = dieTopology.normals.map(normal => normal.clone().applyQuaternion(last.rotation).y);
      expect(top[roll.topFace]).toBeGreaterThan(.998);
      expect(roll.faceValues[top.indexOf(Math.max(...top))]).toBe(result);
      expect(last.position.y).toBeCloseTo(dieTopology.inradius, 2);
    }
    expect(prepareD20Roll(20, 'shared-board-roll', 'board')).toEqual(prepareD20Roll(20, 'shared-board-roll', 'board'));
    expect(prepareD20Roll(20, 'shared-board-roll', 'board').samples).not.toEqual(prepareD20Roll(20, 'different-board-roll', 'board').samples);
  });
  it('rounds a closed mesh inward, with outward continuous normals and flat label faces', () => {
    const {vertices,faces,normals,inradius}=dieTopology;
    const geometry=roundedD20(vertices,faces,normals), position=geometry.getAttribute('position'), normal=geometry.getAttribute('normal');
    const edges=new Map<string,number>(), point=(i:number)=>new THREE.Vector3().fromBufferAttribute(position,i);
    const key=(v:THREE.Vector3)=>v.toArray().map(value=>Math.round(value*1e5)).join(',');
    for(let i=0;i<position.count;i+=3){
      const triangle=[point(i),point(i+1),point(i+2)], cross=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0]));
      expect(cross.length()).toBeGreaterThan(1e-10);
      expect(cross.dot(new THREE.Vector3().fromBufferAttribute(normal,i))).toBeGreaterThan(0);
      for(let j=0;j<3;j++){
        expect(new THREE.Vector3().fromBufferAttribute(normal,i+j).length()).toBeCloseTo(1,5);
        expect(normals.every(n=>triangle[j].dot(n)<=inradius+1e-5)).toBe(true);
        const edge=[key(triangle[j]),key(triangle[(j+1)%3])].sort().join('/');edges.set(edge,(edges.get(edge)??0)+1);
      }
    }
    expect([...edges.values()].every(count=>count===2)).toBe(true);
    expect(geometry.boundingSphere!.radius).toBeLessThan(vertices[0].length());
    geometry.dispose();
  });
  it('paces board motion without large position or rotation jumps between display frames', () => {
    for (let result=1; result<=20; result++) {
      const roll=prepareD20Roll(result,`smooth-motion-${result}`,'board');
      let maxStep=0,maxTurn=0;
      for (let frame=1;frame<=132;frame++) {
        const previous=sampleD20Roll(roll,(frame-1)/132),current=sampleD20Roll(roll,frame/132);
        maxStep=Math.max(maxStep,current.position.distanceTo(previous.position));
        maxTurn=Math.max(maxTurn,current.rotation.angleTo(previous.rotation));
      }
      expect(maxStep).toBeLessThan(.8);
      expect(maxTurn).toBeLessThan(.6);
      expect(sampleD20Roll(roll,0)).toEqual(roll.samples[0]);
      expect(sampleD20Roll(roll,1)).toEqual(roll.samples.at(-1));
      expect(sampleD20Roll(roll,1/132).position.distanceTo(roll.samples[0].position)).toBeLessThan(maxStep*.1);
    }
  });
  it('uses a lower felt-surface launch and settles onto the nearest physical face',()=>{
    for(let result=1;result<=20;result++){
      const roll=prepareD20Roll(result,`felt-settle-${result}`,'board'),first=roll.samples[0],last=roll.samples.at(-1)!;
      expect(first.position.y).toBeGreaterThanOrEqual(1.7);expect(first.position.y).toBeLessThanOrEqual(2.3);
      expect(last.position.y).toBeCloseTo(dieTopology.inradius,5);
      expect(dieTopology.normals[roll.topFace].clone().applyQuaternion(last.rotation).y).toBeGreaterThan(.9999);
      expect(last.rotation.angleTo(roll.samples.at(-2)!.rotation)).toBeLessThan(.01);
    }
  });
  it('keeps every rotating face inside the camera in standard and wide/short board windows', () => {
    for(let result=1;result<=20;result++) {
      const roll=prepareD20Roll(result,`camera-clearance-${result}`,'board');
      for(const aspect of [1,1.75,2.22,3.2,4.5,6]) {
        const frame=boardRollFrame(roll,aspect);
        const camera=new THREE.OrthographicCamera(-frame.halfWidth,frame.halfWidth,frame.halfHeight,-frame.halfHeight,.1,100);
        camera.position.set(0,20,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
        let maxX=0,maxY=0;
        for(const sample of roll.samples) for(const vertex of dieTopology.vertices) {
          const point=vertex.clone().applyQuaternion(sample.rotation).multiplyScalar(frame.dieScale)
            .add(new THREE.Vector3(sample.position.x*frame.widthScale,sample.position.y*frame.dieScale,sample.position.z*frame.depthScale)).project(camera);
          maxX=Math.max(maxX,Math.abs(point.x));maxY=Math.max(maxY,Math.abs(point.y));
        }
        expect(maxX).toBeLessThan(.96);
        expect(maxY).toBeLessThan(.96);
      }
    }
  });
  it('bounds board canvas fill rate on high-DPI production screens without upscaling low-DPI screens',()=>{
    for(const [width,height,dpr] of [[2458,979,1.5],[3686,1663,2],[1229,739,1],[640,480,1.25]]){
      const ratio=boardPixelRatio(width,height,dpr);
      expect(width*height*ratio*ratio).toBeLessThanOrEqual(1_800_001);
      expect(ratio).toBeLessThanOrEqual(dpr);
      expect(ratio).toBeLessThanOrEqual(1.25);
    }
    expect(boardPixelRatio(0,0,NaN)).toBe(1);
  });
  it('keeps ten demo colors, legacy themes, and export/import validation compatible', () => {
    expect(d20ThemeIds).toHaveLength(13);
    for(const theme of d20ThemeIds){const config=defaultThemeConfig();config.d20.theme=theme;expect(themeConfigSchema.parse(config).d20.theme).toBe(theme);expect(d20Palette(theme)).toEqual(d20Palettes[theme]);}
    expect(d20Palette('__proto__')).toEqual(d20Palettes.neon_arcane);
    expect(d20Palette('old-unknown')).toEqual(d20Palettes.neon_arcane);
    expect(d20Palettes.ivory.numbers).not.toBe('#fff1ce');
  });
  it('resumes the existing roll clock and never restarts a stale landing glow', () => {
    const start=Date.parse('2026-10-21T12:00:00Z');
    expect(elapsedRollMs(new Date(start).toISOString(),2200,start+1000)).toBe(1000);
    expect(elapsedRollMs(new Date(start).toISOString(),2200,start-10)).toBe(0);
    expect(elapsedRollMs('preview-roll',0,start)).toBeGreaterThan(1500-1);
    expect(landingGlowStrength(-1)).toBe(0);expect(landingGlowStrength(300)).toBe(1);
    expect(landingGlowStrength(900)).toBeGreaterThan(0);expect(landingGlowStrength(1500)).toBe(0);
  });
  it('interprets legacy SQLite roll timestamps as UTC, not the browser timezone',()=>{
    const timestamp=Date.parse('2026-10-24T05:25:30Z');
    expect(parseUtcTimestamp('2026-10-24 05:25:30')).toBe(timestamp);
    expect(parseUtcTimestamp('2026-10-24T05:25:30')).toBe(timestamp);
    expect(parseUtcTimestamp('2026-10-23T22:25:30-07:00')).toBe(timestamp);
    expect(utcTimestampIso('2026-10-24 05:25:30')).toBe('2026-10-24T05:25:30.000Z');
    expect(elapsedRollMs('2026-10-24 05:25:30',2200,timestamp+1100)).toBe(1100);
  });
  it('advances from server time using a monotonic clock despite local clock skew',()=>{
    let monotonic=50;
    const start=Date.parse('2026-10-24T05:25:30Z');
    for(const skew of [-7*3600000,-120000,120000,7*3600000]){
      const clock=createRollClock('2026-10-24 05:25:30',2200,'2026-10-24T05:25:30.100Z',()=>monotonic,start+skew);
      expect(clock()).toBe(100);
      monotonic+=1100;expect(clock()).toBe(1200);
      monotonic+=1100;expect(clock()).toBe(2300);
    }
    const stale=createRollClock('2026-10-24 05:25:30',2200,'2026-10-24T05:25:40Z',()=>monotonic,start-120000);
    expect(stale()).toBe(10000);
  });
});
