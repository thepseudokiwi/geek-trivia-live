import type { Server } from 'node:http';
import { WebSocketServer,WebSocket } from 'ws';
import type { LiveCommand } from '../shared/types.js';
import { executeLiveCommand,expireTimers,getPrivateLiveState,getPublicLiveState } from './liveRepository.js';

type Client=WebSocket&{episodeId?:string;role?:'host'|'audience';clientId?:string;alive?:boolean};
const send=(ws:Client,event:string,data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event,data}))};
const defaultOrigins=['http://localhost:5173','http://127.0.0.1:5173','http://localhost:8787','http://127.0.0.1:8787'];
export const socketOriginAllowed=(origin:string|undefined,allowedOrigins=defaultOrigins)=>!origin||allowedOrigins.includes(origin);
export function attachLiveSockets(server:Server){
  const allowedOrigins=(process.env.ALLOWED_WS_ORIGINS??defaultOrigins.join(',')).split(',').map(x=>x.trim()).filter(Boolean);
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:64*1024,verifyClient:({origin},done)=>done(socketOriginAllowed(origin,allowedOrigins),403,'WebSocket origin is not allowed.')}),controllers=new Map<string,Client>();
  const clients=(episodeId:string)=>[...wss.clients].filter(c=>(c as Client).episodeId===episodeId)as Client[];
  const counts=(id:string)=>clients(id).filter(c=>c.role==='audience').length;
  const broadcast=(id:string)=>{for(const c of clients(id)){if(c.role==='audience')send(c,'state.public',getPublicLiveState(id));else send(c,'state.private',getPrivateLiveState(id,{role:controllers.get(id)===c?'controller':'observer',controllerConnected:controllers.has(id),audienceCount:counts(id)}))}};
  const reject=(c:Client,error:any)=>send(c,'command.rejected',{code:error?.code??'INVALID_COMMAND',message:error?.message??'Command rejected.',details:error?.details});
  wss.on('connection',(ws:Client,request)=>{try{const url=new URL(request.url??'',`http://${request.headers.host??'localhost'}`),episodeId=url.searchParams.get('episodeId'),role=url.searchParams.get('role');if(!episodeId||!['host','audience'].includes(role??'')){ws.close(1008,'Invalid subscription');return}ws.episodeId=episodeId;ws.role=role as any;ws.clientId=url.searchParams.get('clientId')||crypto.randomUUID();ws.alive=true;if(role==='host'&&!controllers.has(episodeId))controllers.set(episodeId,ws);broadcast(episodeId);
      ws.on('pong',()=>{ws.alive=true});ws.on('message',raw=>{try{if(raw.toString().length>64*1024)throw new Error('Message too large.');const message=JSON.parse(raw.toString());if(message.type==='state.resync'){broadcast(episodeId);return}if(role!=='host')throw new Error('Audience connections are read-only.');if(message.type==='host.claimControl'){controllers.set(episodeId,ws);broadcast(episodeId);return}if(message.type==='host.releaseControl'){if(controllers.get(episodeId)===ws)controllers.delete(episodeId);broadcast(episodeId);return}if(message.type!=='command')throw new Error('Unknown message type.');if(controllers.get(episodeId)!==ws)throw Object.assign(new Error('This Host Console is an observer. Take control before issuing commands.'),{code:'CONTROL_REQUIRED'});const command=message.command as LiveCommand;if(command.episodeId!==episodeId)throw new Error('Episode mismatch.');const result=executeLiveCommand(command);send(ws,'command.accepted',{commandId:command.commandId,...result});broadcast(episodeId)}catch(error){reject(ws,error)}});
      ws.on('close',()=>{if(role==='host'&&controllers.get(episodeId)===ws){controllers.delete(episodeId);const next=clients(episodeId).find(c=>c!==ws&&c.role==='host');if(next)controllers.set(episodeId,next)}broadcast(episodeId)})
    }catch{ws.close(1011,'Subscription failed')}});
  const heartbeat=setInterval(()=>{for(const ws of wss.clients as Set<Client>){if(ws.alive===false){ws.terminate();continue}ws.alive=false;ws.ping()}for(const id of expireTimers())broadcast(id)},1000);heartbeat.unref();wss.on('close',()=>clearInterval(heartbeat));
  return{wss,broadcast};
}
