import { useEffect, useState } from "react";
import type { LiveCommandType, PresentationScene, PrivateLiveState, TransitionKind } from "../../shared/types.js";

const transitionOptions:TransitionKind[]=["cut","fade","crossfade","slide-left","slide-right","slide-up","zoom","card-flip","wipe","glitch","iris","score-pulse","category-reveal","question-reveal","answer-reveal","winner-reveal"];
export function BroadcastControls({state,disabled,send}:{state:PrivateLiveState;disabled:boolean;send:(type:LiveCommandType,payload?:Record<string,unknown>)=>void}){
 const p=state.presentationPrivate,[preview,setPreview]=useState<PresentationScene>(p.previewScene??p.programScene),[transition,setTransition]=useState<TransitionKind>(p.transition.kind),[duration,setDuration]=useState(p.transition.durationMs),[message,setMessage]=useState(p.customMessage??""),[editing,setEditing]=useState(false),[assets,setAssets]=useState<any[]>([]),[profiles,setProfiles]=useState<any[]>([]);
 const refreshAdmin=async()=>{setAssets(await(await fetch('/api/presentation/assets')).json());setProfiles(await(await fetch('/api/presentation/profiles')).json())};
 useEffect(()=>{if(editing)void refreshAdmin()},[editing]);
 const choose=(scene:PresentationScene)=>setPreview(scene);
 const take=(cut=false)=>send(cut?"presentation.cut":"presentation.take",{scene:preview,transition:{...p.transition,kind:cut?"cut":transition,durationMs:cut?0:duration}});
 const upload=async(file:File|null)=>{if(!file)return;const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]??'');r.onerror=reject;r.readAsDataURL(file)});const response=await fetch('/api/presentation/assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:file.name,fileName:file.name,mimeType:file.type,assetType:file.type.startsWith('audio/')?'audio-cue':'image',base64:data,licensingNote:'User supplied; verify broadcast rights.'})});if(!response.ok)alert((await response.json()).error);else void refreshAdmin()};
 return <section className="broadcast-controls">
  <div className="broadcast-heading"><div><p className="eyebrow">Preview / Program</p><h2>Broadcast Controls</h2></div><div className="program-status"><a className="button secondary" href={`#theme-designer/${p.theme.id}`}>Edit active theme</a><a className="button secondary" href={`#theme-preview/${p.theme.id}?scene=${p.programScene}&layout=${p.layout}`}>Preview theme</a><strong>{state.control.audienceCount}</strong> audience client{state.control.audienceCount===1?'':'s'}</div></div>
  <div className="preview-program-grid">
   <div className="broadcast-monitor preview-monitor"><span>PREVIEW</span><div className={`mini-scene scene-${preview}`}><strong>{preview.replaceAll('-',' ')}</strong><small>{p.profile.showTitle} · {p.theme.name}</small></div></div>
   <div className="broadcast-monitor program-monitor"><span>PROGRAM</span><div className={`mini-scene scene-${p.programScene}`}><strong>{p.programScene.replaceAll('-',' ')}</strong><small>{p.transitionStatus}</small></div></div>
  </div>
  <div className="broadcast-toolbar">
   <label>Preview scene <select disabled={disabled} value={preview} onChange={e=>choose(e.target.value as PresentationScene)}>{p.availableScenes.map(x=><option key={x} value={x}>{x.replaceAll('-',' ')}</option>)}</select></label>
   <label>Transition <select value={transition} onChange={e=>setTransition(e.target.value as TransitionKind)}>{transitionOptions.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Duration <input type="number" min="0" max="5000" step="50" value={duration} onChange={e=>setDuration(Math.min(5000,Math.max(0,Number(e.target.value))))}/></label>
   <button disabled={disabled} className="take-button" onClick={()=>take(false)}>TAKE</button><button disabled={disabled} onClick={()=>take(true)}>CUT</button>
  </div>
  <div className="scene-shortcuts">{(['intro','board','scores','intermission','winner','credits']as PresentationScene[]).map(x=><button disabled={disabled} key={x} onClick={()=>choose(x)}>{x}</button>)}<button disabled={disabled} onClick={()=>send('presentation.cancelQueue')}>Cancel queue</button><button disabled={disabled} onClick={()=>send('presentation.resync')}>Resync displays</button></div>
  <div className="broadcast-options">
   <label>Theme <select disabled={disabled} value={p.theme.id} onChange={e=>send('presentation.setTheme',{themeId:e.target.value})}>{p.availableThemes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>Profile <select disabled={disabled} value={p.availableProfiles.find(x=>x.name===p.profile.name)?.id??'nerd-wars'} onChange={e=>send('presentation.setProfile',{profileId:e.target.value})}>{p.availableProfiles.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>Layout <select disabled={disabled} value={p.layout} onChange={e=>send('presentation.setLayout',{layout:e.target.value})}><option value="full">Full screen</option><option value="overlay">Transparent overlay</option><option value="scorebug">Score bug</option><option value="question">Question overlay</option><option value="lowerthird">Lower third</option></select></label>
   <label><input type="checkbox" checked={p.animationsDisabled} onChange={e=>send('presentation.setOptions',{animationsDisabled:e.target.checked,reducedMotion:p.reducedMotion,safeArea:p.safeArea,customMessage:message})}/> Disable animation</label>
   <label><input type="checkbox" checked={p.reducedMotion} onChange={e=>send('presentation.setOptions',{reducedMotion:e.target.checked,animationsDisabled:p.animationsDisabled,safeArea:p.safeArea,customMessage:message})}/> Reduced motion</label>
   <label><input type="checkbox" checked={p.audio.masterMuted} onChange={e=>send('presentation.setAudioState',{masterMuted:e.target.checked})}/> Mute Program audio</label>
  </div>
  <div className="inline"><input aria-label="Custom broadcast message" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Custom message"/><button disabled={disabled||!message.trim()} onClick={()=>{send('presentation.setOptions',{customMessage:message,reducedMotion:p.reducedMotion,animationsDisabled:p.animationsDisabled,safeArea:p.safeArea});choose('custom-message')}}>Preview message</button><button disabled={disabled||!message.trim()} onClick={()=>send('presentation.triggerGraphic',{graphicType:'custom-message',text:message,durationMs:8000})}>Show banner</button></div>
  <details onToggle={e=>setEditing((e.currentTarget as HTMLDetailsElement).open)}><summary>Presentation Editor &amp; Asset Manager</summary>
   <div className="presentation-editor"><h3>Safe areas</h3><label>Title safe % <input type="number" min="0" max="25" value={p.safeArea.titleSafePercent} onChange={e=>send('presentation.setOptions',{safeArea:{...p.safeArea,titleSafePercent:Number(e.target.value)},reducedMotion:p.reducedMotion,animationsDisabled:p.animationsDisabled,customMessage:message})}/></label><label><input type="checkbox" checked={p.safeArea.showGuides} onChange={e=>send('presentation.setOptions',{safeArea:{...p.safeArea,showGuides:e.target.checked},reducedMotion:p.reducedMotion,animationsDisabled:p.animationsDisabled,customMessage:message})}/> Rehearsal safe-area guides</label>
   <h3>Assets</h3><input aria-label="Upload presentation asset" type="file" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/ogg,video/mp4,font/woff2" onChange={e=>void upload(e.target.files?.[0]??null)}/><ul>{assets.map(a=><li key={a.id}>{a.display_name} · {Math.ceil(a.file_size/1024)} KB · {a.mime_type}</li>)}</ul>
   <h3>Branding profiles</h3><ul>{profiles.map(x=><li key={x.id}>{x.name}{x.is_default?' · default':''}</li>)}</ul><p className="field-help">Profile import/export uses the JSON backup. Binary assets are backed up separately from <code>data/presentation-assets</code>.</p></div>
  </details>
 </section>
}
