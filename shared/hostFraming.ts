// Store presentation-only framing in the persisted view URL fragment. Remove
// it before loading VDO so changing the crop never reconnects the stream.
export const hostLabelFonts = {theme:'var(--font-participant, sans-serif)',sans:'Arial, Helvetica, sans-serif',serif:'Georgia, serif',mono:'"Courier New", monospace'};
export type HostFraming = { fit:'fill'|'fit'; x:number; scale?:number; insetX?:number; insetY?:number; labelFont?:keyof typeof hostLabelFonts; labelSize?:number; labelColor?:string; labelBackground?:string };
export function hostLabelStyle(value:HostFraming){return {fontFamily:hostLabelFonts[value.labelFont??'theme'],fontSize:`calc(clamp(.75rem,1.1vw,1.1rem) * ${(value.labelSize??100)/100})`,color:value.labelColor??'#ffffff',background:value.labelBackground??'#000000'}};
export function readHostFraming(raw:string):HostFraming {
 const params=new URLSearchParams(new URL(raw).hash.slice(1));
 const value=params.get('nw-x'),x=value===null?50:Number(value);
 const bounded=(key:string,fallback:number,min:number,max:number)=>{const raw=params.get(key),n=raw===null?fallback:Number(raw);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
 const font=params.get('nw-label-font')??'theme';
 const color=(key:string,fallback:string)=>/^#[0-9a-f]{6}$/i.test(params.get(key)??'')?params.get(key)!:fallback;
 return {fit:params.get('nw-fit')==='fit'?'fit':'fill',x:Number.isFinite(x)?Math.max(0,Math.min(100,x)):50,scale:bounded('nw-scale',100,50,200),insetX:bounded('nw-inset-x',6,0,70),insetY:bounded('nw-inset-y',22,0,70),labelFont:Object.hasOwn(hostLabelFonts,font)?font as keyof typeof hostLabelFonts:'theme',labelSize:bounded('nw-label-size',100,50,200),labelColor:color('nw-label-color','#ffffff'),labelBackground:color('nw-label-bg','#000000')};
}
export function writeHostFraming(raw:string,framing:HostFraming):string {
 const url=new URL(raw),params=new URLSearchParams(url.hash.slice(1));
 params.set('nw-fit',framing.fit);params.set('nw-x',String(Math.max(0,Math.min(100,framing.x))));
 params.set('nw-scale',String(framing.scale??100));params.set('nw-inset-x',String(framing.insetX??6));params.set('nw-inset-y',String(framing.insetY??22));
 params.set('nw-label-font',framing.labelFont??'theme');params.set('nw-label-size',String(framing.labelSize??100));params.set('nw-label-color',framing.labelColor??'#ffffff');params.set('nw-label-bg',framing.labelBackground??'#000000');
 url.hash=params.toString();return url.toString();
}
export function hostStreamUrl(raw:string):string {
 const url=new URL(raw),params=new URLSearchParams(url.hash.slice(1));
 for(const key of ['nw-fit','nw-x','nw-scale','nw-inset-x','nw-inset-y','nw-label-font','nw-label-size','nw-label-color','nw-label-bg'])params.delete(key);url.hash=params.toString();return url.toString();
}
