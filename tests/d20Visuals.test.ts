import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { prepareD20Roll, sampleD20Roll } from '../src/d20/physics.js';
import { dieTopology } from '../src/d20/topology.js';
import { roundedD20 } from '../src/d20/geometry.js';
import { elapsedRollMs, landingGlowStrength } from '../src/d20/timing.js';
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
});
