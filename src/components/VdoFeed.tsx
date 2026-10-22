import { useEffect, useRef, useState } from 'react';
import type { ProductionVideoFeed } from '../../shared/types';
import { vdoConnectionState } from '../vdoConnection';
import { readHostFraming, hostStreamUrl, hostLabelStyle } from '../../shared/hostFraming';

export function VdoFeed({feed,name}:{feed:ProductionVideoFeed;name?:string}) {
 const frame=useRef<HTMLIFrameElement>(null),[loaded,setLoaded]=useState(false),[online,setOnline]=useState(false);
 const displayName=name??(feed.label.replace(/\s+camera$/i,'').trim()||feed.participantName||'Contestant');
 const origin=new URL(feed.viewUrl).origin;
 const isHost=feed.label.startsWith('__NERD_WARS_HOST_CAMERA__');
 const framing=readHostFraming(feed.viewUrl),source=isHost?hostStreamUrl(feed.viewUrl):feed.viewUrl;
 const refresh=()=>frame.current?.contentWindow?.postMessage({getStreamIDs:true},origin);
 useEffect(()=>{
  setLoaded(false);setOnline(false);
  const receive=(event:MessageEvent)=>{
   if(event.source!==frame.current?.contentWindow||event.origin!==origin)return;
   const connected=vdoConnectionState(event.data);
   if(connected!==undefined)setOnline(connected);
  };
  window.addEventListener('message',receive);
  const poll=window.setInterval(refresh,2000);
  return()=>{window.removeEventListener('message',receive);window.clearInterval(poll)};
 },[feed.id,source,origin]);
 return <aside className={`production-video ${loaded?'loaded':'loading'} ${online?'online':'connecting'}`}>
  <iframe ref={frame} style={isHost&&framing.fit==='fill'?{position:'absolute',width:'177.777778%',maxWidth:'none',height:'100%',left:`${-framing.x*7/9}%`,top:0,aspectRatio:'16 / 9'}:undefined} onLoad={()=>{setLoaded(true);refresh()}} title={`${displayName} video`} src={source} allow="autoplay *; fullscreen *; picture-in-picture *" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
  <span style={isHost?hostLabelStyle(framing):undefined}>{displayName}{!online&&<small> Connecting…</small>}</span>
 </aside>;
}
