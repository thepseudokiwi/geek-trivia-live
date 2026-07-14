import{useCallback,useEffect,useRef,useState}from'react';
import type{LiveCommand,PrivateLiveState,PublicLiveState}from'../shared/types';
export function useLiveState<T extends PrivateLiveState|PublicLiveState>(episodeId:string,role:'host'|'audience'){
 const[state,setState]=useState<T|null>(null),[connected,setConnected]=useState(false),[error,setError]=useState(''),socket=useRef<WebSocket|null>(null),clientId=useRef(crypto.randomUUID());
 useEffect(()=>{let retry:number|undefined,stopped=false;const connect=()=>{const protocol=location.protocol==='https:'?'wss':'ws',ws=new WebSocket(`${protocol}://${location.host}/ws?episodeId=${encodeURIComponent(episodeId)}&role=${role}&clientId=${clientId.current}`);socket.current=ws;ws.onopen=()=>{setConnected(true);setError('')};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.event===`state.${role==='host'?'private':'public'}`)setState(m.data);if(m.event==='command.rejected')setError(m.data.message);};ws.onclose=()=>{setConnected(false);if(!stopped)retry=window.setTimeout(connect,1000)}};connect();return()=>{stopped=true;if(retry)clearTimeout(retry);socket.current?.close()}},[episodeId,role]);
 const send=useCallback((type:LiveCommand['type'],payload:Record<string,unknown>={})=>{if(!state||!socket.current||socket.current.readyState!==WebSocket.OPEN)return;socket.current.send(JSON.stringify({type:'command',command:{episodeId,commandId:crypto.randomUUID(),expectedRevision:state.revision,type,payload}}))},[episodeId,state]);
 const control=useCallback((type:'host.claimControl'|'host.releaseControl')=>socket.current?.send(JSON.stringify({type})),[]);
 return{state,connected,error,send,control};
}
