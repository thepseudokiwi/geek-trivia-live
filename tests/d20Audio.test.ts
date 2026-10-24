import { afterEach, describe, expect, it, vi } from 'vitest';
import { dieRollSound, scheduleLandingFlourish } from '../src/d20/audio.js';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('D20 landing flourish',()=>{
  it('starts gently at landing, plays four rising notes, and cleans up before glow ends',()=>{
    const nodes:any[]=[];
    const parameter=()=>({events:[] as number[][],setValueAtTime(value:number,at:number){this.events.push([value,at]);},linearRampToValueAtTime(value:number,at:number){this.events.push([value,at]);},exponentialRampToValueAtTime(value:number,at:number){expect(value).toBeGreaterThan(0);this.events.push([value,at]);}});
    const node=()=>{const value={type:'',frequency:parameter(),gain:parameter(),started:0,stopped:0,disconnected:false,onEnded:()=>{},connect(other:any){return other;},disconnect(){this.disconnected=true;},start(at:number){this.started=at;},stop(at:number){this.stopped=at;},addEventListener(_:string,fn:()=>void){this.onEnded=fn;}};nodes.push(value);return value;};
    const context={createOscillator:node,createGain:node};
    scheduleLandingFlourish(context as unknown as AudioContext,{} as AudioNode,10);
    const voices=nodes.filter(n=>n.frequency.events.length);
    expect(voices).toHaveLength(8);expect(voices[0].started).toBe(10);
    expect(voices.filter((_,i)=>i%2===0).map(n=>n.frequency.events[0][0])).toEqual([523.25,659.25,783.99,1046.5]);
    expect(voices.every(n=>n.type==='sine'&&n.stopped<11.5)).toBe(true);
    expect(nodes.filter(n=>!n.frequency.events.length).every(n=>n.gain.events[0][0]===0)).toBe(true);
    voices.forEach(n=>n.onEnded());expect(nodes.every(n=>n.disconnected)).toBe(true);
  });
  it('waits for the rendered landing signal, plays once, and cancels on cleanup',async()=>{
    vi.useFakeTimers();
    const starts:{type:string;at:number}[]=[];
    const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
    const node=()=>({gain:parameter(),frequency:parameter(),Q:parameter(),type:'',connect(other:unknown){return other;},start(){},stop(){},disconnect(){},addEventListener(){}});
    let context:any;
    class Audio {
      currentTime=10;sampleRate=100;destination={};close=vi.fn(async()=>{});resume=vi.fn(async()=>{});
      constructor(){context=this;}
      createGain(){return node();}createBiquadFilter(){return node();}createBufferSource(){return node();}
      createBuffer(_:number,length:number){return{getChannelData:()=>new Float32Array(length)}}
      createOscillator(){const voice=node();voice.start=(at?:number)=>{starts.push({type:voice.type,at:at??this.currentTime})};return voice;}
    }
    vi.stubGlobal('window',{AudioContext:Audio,setTimeout,clearTimeout});
    const sound=dieRollSound(1000,20,.5)!;
    await vi.advanceTimersByTimeAsync(2000);
    expect(starts).toEqual([]);
    context.currentTime=12;
    sound.land();sound.land();
    await Promise.resolve();
    expect(starts.filter(item=>item.type==='triangle')).toEqual([{type:'triangle',at:12}]);
    expect(starts.filter(item=>item.type==='sine')).toHaveLength(8);
    expect(starts.every(item=>item.at>=12)).toBe(true);
    sound.stop();sound.stop();
    expect(context.close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
