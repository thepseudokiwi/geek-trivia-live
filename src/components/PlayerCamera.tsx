import { useEffect, useMemo, useRef, useState } from 'react';

export function PlayerCamera({url,onStop}:{url:string;onStop:()=>void}) {
 const frame=useRef<HTMLIFrameElement>(null),panel=useRef<HTMLElement>(null);
 const [expanded,setExpanded]=useState(true),[camera,setCamera]=useState(true),[mic,setMic]=useState(true);
 const autoDock=useRef(true);
 const source=useMemo(()=>{const result=new URL(url);result.searchParams.set('cleanoutput','');return result.toString()},[url]);
 const command=(data:Record<string,unknown>)=>frame.current?.contentWindow?.postMessage(data,'https://vdo.ninja');
 const dock=()=>{autoDock.current=false;command({toggleSettings:false});setExpanded(false)};
 useEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.origin!=='https://vdo.ninja'||event.source!==frame.current?.contentWindow)return;
   if(event.data?.action==='push-connection'&&event.data.value===true&&autoDock.current){autoDock.current=false;setExpanded(false)}
  };
  window.addEventListener('message',receive);
  return()=>window.removeEventListener('message',receive);
 },[]);
 useEffect(()=>{
  if(!expanded)return;
  const previous=document.activeElement as HTMLElement|null;
  panel.current?.focus();
  return()=>{if(previous?.isConnected)previous.focus()};
 },[expanded]);
 return <section ref={panel} tabIndex={-1} role={expanded?'dialog':undefined} aria-modal={expanded||undefined} aria-label={expanded?'Camera and microphone setup':'Your camera preview'} className={`player-camera ${expanded?'camera-setup-open':''}`} onKeyDown={event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();dock()}
  if(expanded&&event.key==='Tab'){
   const items=panel.current?.querySelectorAll<HTMLElement>('button,iframe');
   if(items?.length&&event.shiftKey&&(document.activeElement===items[0]||document.activeElement===panel.current)){event.preventDefault();items[items.length-1].focus()}
   else if(items?.length&&!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}
  }
 }}>
  <div className="player-camera-heading"><strong>{expanded?'Set up your camera & microphone':'Your camera preview'}</strong><div className="player-media-controls">
   {!expanded&&<><button aria-pressed={camera} onClick={()=>{setCamera(!camera);command({camera:!camera})}}>{camera?'Camera on':'Camera off'}</button><button aria-pressed={mic} onClick={()=>{setMic(!mic);command({mic:!mic})}}>{mic?'Mic on':'Mic muted'}</button><button onClick={()=>{autoDock.current=false;setExpanded(true);command({toggleSettings:true})}}>Change sources</button></>}
   {expanded&&<button onClick={dock}>Done — return to game</button>}
   <button className="secondary" onClick={onStop}>{expanded?'Cancel / stop media':'Stop media'}</button>
  </div></div>
  {expanded&&<p className="camera-setup-help">Allow camera and microphone access in your browser, then start your stream below. This window docks automatically when connected, or select Done when you are ready.</p>}
  <iframe key="publisher" ref={frame} title="Your VDO.Ninja camera and microphone" src={source} allow="camera; microphone; autoplay; fullscreen; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
 </section>;
}
