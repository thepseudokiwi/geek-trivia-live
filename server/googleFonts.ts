import { LifecycleError } from './episodesRepository.js';
import { saveAsset } from './presentationRepository.js';

type GoogleFont={family:string;category:string;variants:string[];files:Record<string,string>};
let cached:{expires:number;fonts:GoogleFont[]}|null=null;

function apiKey(){const key=process.env.GOOGLE_FONTS_API_KEY?.trim();if(!key)throw new LifecycleError('GOOGLE_FONTS_NOT_CONFIGURED','Add GOOGLE_FONTS_API_KEY to .env.local and restart the server.');return key}

export async function googleFontCatalog(){
  if(cached&&cached.expires>Date.now())return cached.fonts.map(({family,category,variants})=>({family,category,variants}));
  const response=await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=alpha&capability=WOFF2&key=${encodeURIComponent(apiKey())}`);
  if(!response.ok)throw new LifecycleError('GOOGLE_FONTS_UNAVAILABLE',`Google Fonts catalog request failed (${response.status}).`);
  const body=await response.json()as{items?:GoogleFont[]};
  cached={expires:Date.now()+24*60*60*1000,fonts:Array.isArray(body.items)?body.items:[]};
  return cached.fonts.map(({family,category,variants})=>({family,category,variants}));
}

export async function installGoogleFont(family:string){
  await googleFontCatalog();
  const font=cached?.fonts.find(item=>item.family===family);
  if(!font)throw new LifecycleError('GOOGLE_FONT_NOT_FOUND','Choose a family from the Google Fonts catalog.');
  const source=font.files.regular??font.files['400']??Object.entries(font.files).find(([variant])=>!variant.includes('italic'))?.[1];
  if(!source)throw new LifecycleError('GOOGLE_FONT_VARIANT_MISSING','This family has no installable regular variant.');
  const url=new URL(source.replace(/^http:/,'https:'));
  if(url.protocol!=='https:'||url.hostname!=='fonts.gstatic.com')throw new LifecycleError('UNSAFE_FONT_SOURCE','Google returned an unexpected font source.');
  const response=await fetch(url,{redirect:'error'});
  if(!response.ok)throw new LifecycleError('GOOGLE_FONT_DOWNLOAD_FAILED',`Font download failed (${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>10*1024*1024)throw new LifecycleError('INVALID_ASSET_SIZE','Google font exceeds the 10 MB install limit.');
  const signature=bytes.subarray(0,4).toString('ascii'),mime=signature==='wOF2'?'font/woff2':signature==='OTTO'?'font/otf':'font/ttf',extension=mime==='font/woff2'?'woff2':mime==='font/otf'?'otf':'ttf';
  return saveAsset({displayName:font.family,fileName:`${font.family.replace(/[^a-z0-9]+/gi,'-')}.${extension}`,mimeType:mime,assetType:'font',base64:bytes.toString('base64'),licensingNote:'Google Fonts catalog asset; verify the family license before broadcast use.',attributionNote:`Google Fonts: ${font.family}`});
}
