import { useCallback, useEffect, useRef, useState } from 'react';

// Standalone audience tabs often have no user gesture when a remote host rolls.
// Offer an explicit one-click unlock instead of silently losing every cue.
export function GameAudioGate({enabled}:{enabled:boolean}) {
  const context=useRef<AudioContext|null>(null),[blocked,setBlocked]=useState(false);
  const unlock=useCallback(()=>{void context.current?.resume().catch(()=>{});},[]);
  useEffect(()=>{
    if(!enabled){setBlocked(false);return;}
    const Audio=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Audio)return;
    let probe:AudioContext;
    try{probe=new Audio();}catch{return;}
    let disposed=false,closed=false;context.current=probe;
    const update=()=>{
      if(disposed)return;
      setBlocked(probe.state==='suspended');
      if(probe.state==='running'&&!closed){closed=true;context.current=null;void probe.close().catch(()=>{});}
    };
    probe.addEventListener('statechange',update);update();
    document.addEventListener('pointerdown',unlock,{once:true});
    return()=>{
      disposed=true;document.removeEventListener('pointerdown',unlock);probe.removeEventListener('statechange',update);
      if(context.current===probe)context.current=null;
      if(!closed){closed=true;void probe.close().catch(()=>{});}
    };
  },[enabled,unlock]);
  return enabled&&blocked?<button className="game-audio-unlock" onClick={unlock} title="Your browser requires one click to allow dice and show sounds">Enable game audio</button>:null;
}
