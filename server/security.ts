import crypto from 'node:crypto';
import type { NextFunction,Request,Response } from 'express';
import type { IncomingMessage } from 'node:http';

const production=process.env.NODE_ENV==='production';
const username=(process.env.HOST_USERNAME??'host').trim();
const password=process.env.HOST_PASSWORD??'';
const passwordHash=process.env.HOST_PASSWORD_HASH??'';
const secret=process.env.HOST_SESSION_SECRET??'';
const configured=Boolean((password||passwordHash)&&secret);
const allowedOrigins=new Set((process.env.APP_ORIGINS??process.env.APP_ORIGIN??'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787,http://76.175.104.200:8787').split(',').map(x=>x.trim()).filter(Boolean));
const attempts=new Map<string,{count:number;reset:number}>();
const ttl=Number(process.env.HOST_SESSION_HOURS??12)*3_600_000;
const configuredOrigins=(...values:(string|undefined)[])=>values.flatMap(value=>(value??'').split(',')).map(value=>value.trim()).filter(Boolean).flatMap(value=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?[url.origin]:[]}catch{return[]}});
const authConnectOrigins=configuredOrigins(process.env.VITE_NEON_AUTH_URL,process.env.VITE_NEON_DATA_API_URL);
const playerAvatarOrigins=configuredOrigins(process.env.PLAYER_AVATAR_ORIGINS??'https://lh3.googleusercontent.com');

if(production&&!configured)throw new Error('Production requires HOST_PASSWORD_HASH (or legacy HOST_PASSWORD) and HOST_SESSION_SECRET.');
if(production&&secret.length<32)throw new Error('HOST_SESSION_SECRET must contain at least 32 characters.');
if(production&&!process.env.APP_ORIGIN&&!process.env.APP_ORIGINS)throw new Error('Production requires APP_ORIGIN or APP_ORIGINS.');

const encode=(value:string)=>Buffer.from(value).toString('base64url');
const sign=(value:string)=>crypto.createHmac('sha256',secret).update(value).digest('base64url');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
function validPassword(candidate:string){if(passwordHash){const[scheme,salt,expected]=passwordHash.split('$');if(scheme!=='scrypt'||!salt||!expected)return false;try{return equal(crypto.scryptSync(candidate,salt,64).toString('base64url'),expected)}catch{return false}}return Boolean(password)&&equal(candidate,password)}
const cookies=(raw='')=>Object.fromEntries(raw.split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));

export function issueHostSession(now=Date.now()){const payload=encode(JSON.stringify({role:'host',iat:now,exp:now+ttl,nonce:crypto.randomBytes(12).toString('base64url')}));return`${payload}.${sign(payload)}`}
export function verifyHostSession(token:string|undefined,now=Date.now()){if(!configured)return!production;if(!token)return false;const[payload,signature]=token.split('.');if(!payload||!signature||!equal(sign(payload),signature))return false;try{const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return value.role==='host'&&Number(value.exp)>now}catch{return false}}
export function requestIsHost(request:IncomingMessage){return verifyHostSession(cookies(request.headers.cookie).nw_host)}
export function originAllowed(origin:string|undefined,requestHost?:string){if(!origin)return!production;if(allowedOrigins.has(origin))return true;if(requestHost)try{if(new URL(origin).host.toLowerCase()===requestHost.split(',')[0].trim().toLowerCase())return true}catch{return false}return!production}
export function authStatus(){return{authenticated:!configured&&!production,required:configured||production,usernameRequired:configured||production}}

function clientKey(request:Request){return request.ip||request.socket.remoteAddress||'unknown'}
function limited(key:string,limit=8,windowMs=15*60_000){const now=Date.now(),prior=attempts.get(key);if(!prior||prior.reset<=now){attempts.set(key,{count:1,reset:now+windowMs});return false}prior.count++;return prior.count>limit}
function publicApi(request:Request){const path=request.path;return path==='/health'||path.startsWith('/auth/')||path.startsWith('/contestant/')||request.method==='GET'&&(/^\/live\/[^/]+\/public$/.test(path)||/^\/presentation\/assets\/[^/]+$/.test(path)||/^\/theme-designer\/preview\/[^/]+$/.test(path))}

export function contentSecurityPolicy(){return`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${playerAvatarOrigins.join(' ')}; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' ws: wss: ${authConnectOrigins.join(' ')}; frame-src https://vdo.ninja; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`}
export function securityHeaders(_request:Request,response:Response,next:NextFunction){response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Frame-Options','SAMEORIGIN');response.setHeader('Permissions-Policy','camera=(self "https://vdo.ninja"), microphone=(self "https://vdo.ninja"), geolocation=(), payment=()');response.setHeader('Cross-Origin-Opener-Policy','same-origin');response.setHeader('Content-Security-Policy',contentSecurityPolicy());if(production)response.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');next()}
export function requireAllowedOrigin(request:Request,response:Response,next:NextFunction){const host=String(request.headers['x-forwarded-host']??request.headers.host??'');if(['GET','HEAD','OPTIONS'].includes(request.method)||originAllowed(request.headers.origin,host)){next();return}response.status(403).json({error:'Request origin is not allowed.',code:'ORIGIN_REJECTED'})}
export function requireHostApi(request:Request,response:Response,next:NextFunction){if(publicApi(request)||requestIsHost(request)){next();return}response.status(401).json({error:'Host authentication required.',code:'AUTH_REQUIRED'})}
export function apiRateLimit(request:Request,response:Response,next:NextFunction){if(limited(`api:${clientKey(request)}`,600,60_000)){response.status(429).json({error:'Too many requests. Try again shortly.',code:'RATE_LIMITED'});return}next()}
export function authRoutes(app:any){app.get('/api/auth/session',(request:Request,response:Response)=>response.json({...authStatus(),authenticated:requestIsHost(request)}));app.post('/api/auth/login',(request:Request,response:Response)=>{const key=`login:${clientKey(request)}`;if(limited(key)){response.status(429).json({error:'Too many sign-in attempts. Try again later.',code:'RATE_LIMITED'});return}if(!configured&&!production){response.json({authenticated:true});return}const candidateUser=String(request.body?.username??'').trim(),candidatePassword=String(request.body?.password??'');if(!candidateUser||!equal(candidateUser.toLocaleLowerCase(),username.toLocaleLowerCase())||!candidatePassword||!validPassword(candidatePassword)){response.status(401).json({error:'Invalid host username or password.',code:'INVALID_CREDENTIALS'});return}attempts.delete(key);response.setHeader('Set-Cookie',`nw_host=${encodeURIComponent(issueHostSession())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttl/1000)}${production?'; Secure':''}`);response.json({authenticated:true})});app.post('/api/auth/logout',(_request:Request,response:Response)=>{response.setHeader('Set-Cookie',`nw_host=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production?'; Secure':''}`);response.json({authenticated:false})})}
