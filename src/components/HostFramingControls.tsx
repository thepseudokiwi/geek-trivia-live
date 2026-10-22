import {useEffect,useState} from 'react';
import {readHostFraming,writeHostFraming,hostLabelStyle,type HostFraming} from '../../shared/hostFraming';
import type {ProductionVideoFeed} from '../../shared/types';
import {api} from '../api';

export function HostFramingControls({feed,episodeId,disabled,onSaved}:{feed:ProductionVideoFeed;episodeId:string;disabled:boolean;onSaved:(feed:ProductionVideoFeed)=>void}){
 const [value,setValue]=useState(()=>readHostFraming(feed.viewUrl)),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>setValue(readHostFraming(feed.viewUrl)),[feed.viewUrl]);
 const save=async(next:HostFraming)=>{
  setSaving(true);setError('');
  try{const feeds=await api.updateVideoFeed(episodeId,{...feed,viewUrl:writeHostFraming(feed.viewUrl,next)});const updated=feeds.find(item=>item.id===feed.id);if(updated)onSaved(updated)}
  catch(problem){setError((problem as Error).message)}finally{setSaving(false)}
 };
 return <fieldset className="host-framing-controls" disabled={disabled||saving}><legend>Square video framing</legend>
  <label>Display mode<select value={value.fit} onChange={event=>{const next={...value,fit:event.target.value as HostFraming['fit']};setValue(next);void save(next)}}><option value="fill">Fill — crop sides</option><option value="fit">Fit — show entire video</option></select></label>
  <label>Horizontal crop position: {value.x}%<input type="range" min="0" max="100" step="1" disabled={value.fit==='fit'} value={value.x} onChange={event=>setValue({...value,x:Number(event.target.value)})}/></label>
  <p>Left 0% · Center 50% · Right 100%. Fill crops a 16:9 feed without stretching it; Fit adds space above and below.</p>
  <label>Window scale: {value.scale}%<input type="range" min="50" max="200" step="5" value={value.scale} onChange={event=>setValue({...value,scale:Number(event.target.value)})}/></label>
  <label>Horizontal inset: {value.insetX}%<input type="range" min="0" max="70" step="1" value={value.insetX} onChange={event=>setValue({...value,insetX:Number(event.target.value)})}/></label>
  <label>Vertical inset: {value.insetY}%<input type="range" min="0" max="70" step="1" value={value.insetY} onChange={event=>setValue({...value,insetY:Number(event.target.value)})}/></label>
  <p>Insets move the window inward from your selected corner. Apply changes to update both audience and player boards.</p>
  <h3 className="host-label-heading">Host name label</h3>
  <label>Label font<select value={value.labelFont} onChange={event=>setValue({...value,labelFont:event.target.value as HostFraming['labelFont']})}><option value="theme">Theme font</option><option value="sans">Sans serif (Arial)</option><option value="serif">Serif (Georgia)</option><option value="mono">Monospace (Courier)</option></select></label>
  <label>Label text size: {value.labelSize}%<input type="range" min="50" max="200" step="5" value={value.labelSize} onChange={event=>setValue({...value,labelSize:Number(event.target.value)})}/></label>
  <label>Label text color<input type="color" value={value.labelColor} onChange={event=>setValue({...value,labelColor:event.target.value})}/></label>
  <label>Label background<input type="color" value={value.labelBackground} onChange={event=>setValue({...value,labelBackground:event.target.value})}/></label>
  <div className="host-label-preview" aria-label="Host label preview"><span style={hostLabelStyle(value)}>{feed.label.replace('__NERD_WARS_HOST_CAMERA__','').trim()||'Host name'} - Host</span></div>
  <button type="button" onClick={()=>void save(value)}>{saving?'Saving…':'Apply window settings'}</button>
  <button type="button" onClick={()=>{const next={...value,scale:100,insetX:6,insetY:22};setValue(next);void save(next)}}>Near question</button>
  <button type="button" disabled={value.fit==='fit'} onClick={()=>{const next={...value,x:50};setValue(next);void save(next)}}>Center host</button>
  {error&&<p role="alert" className="error">{error}</p>}
 </fieldset>;
}
