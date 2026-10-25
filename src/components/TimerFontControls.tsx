import type {ThemeConfig} from '../../shared/themeDesigner';
import {useEffect,useState} from 'react';

type FontAsset={id:string;active?:boolean;asset_type?:string;display_name?:string;displayName?:string};
type Props={
  value:string;
  assets:FontAsset[];
  googleFonts:{family:string;category:string}[];
  onChange:(family:string)=>void;
  onPreview:()=>void;
  timer:ThemeConfig['timer'];
  fontSize:number;
  onStyleChange:(style:ThemeConfig['timer']['style'])=>void;
  onSizeChange:(size:number)=>void;
  onFontSizeChange:(size:number)=>void;
  onTextPositionChange:(x:number,y:number)=>void;
};
const systemFonts=[
  ['system-ui, sans-serif','System UI'],['Arial, sans-serif','Arial'],
  ['Verdana, sans-serif','Verdana'],['Georgia, serif','Georgia'],
  ['"Courier New", monospace','Courier New'],['Impact, sans-serif','Impact'],
]as const;

function TextOffsetControl({label,name,value,onChange}:{label:string;name:string;value:number;onChange:(value:number)=>void}){
  const [entry,setEntry]=useState(String(value));
  useEffect(()=>setEntry(String(value)),[value]);
  const edit=(text:string)=>{
    setEntry(text);
    if(!text.trim()||!Number.isFinite(Number(text)))return;
    const number=Number(text),bounded=Math.max(-60,Math.min(60,number));
    onChange(bounded);if(bounded!==number)setEntry(String(bounded));
  };
  return <label>{label}
    <input aria-label={`${name} slider`} type="range" min={-60} max={60} step={.5} value={value} onChange={event=>onChange(Number(event.target.value))}/>
    <input aria-label={name} type="text" inputMode="decimal" value={entry} onChange={event=>edit(event.target.value)} onBlur={()=>setEntry(String(value))} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/>
  </label>;
}

export function TimerFontControls({value,assets,googleFonts,onChange,onPreview,timer,fontSize,onStyleChange,onSizeChange,onFontSizeChange,onTextPositionChange}:Props){
  const installed=assets.filter(asset=>asset.active&&asset.asset_type==='font'&&(asset.display_name||asset.displayName));
  const installedFamilies=new Set(installed.map(asset=>asset.display_name??asset.displayName));
  const known=systemFonts.some(([family])=>family===value)||installedFamilies.has(value);
  return <fieldset className="timer-font-controls">
    <legend>Timer appearance</legend>
    <label>Style<select aria-label="Timer style" value={timer.style} onChange={event=>onStyleChange(event.target.value as ThemeConfig['timer']['style'])}>
      <option value="digital">Digital</option><option value="circular">Circular</option><option value="horizontal-bar">Horizontal bar</option><option value="vertical-bar">Vertical bar</option><option value="minimal">Minimal</option><option value="segmented">Segmented</option>
    </select></label>
    <label>Timer size
      <input aria-label="Timer size slider" type="range" min={40} max={800} value={timer.size} onChange={event=>onSizeChange(Number(event.target.value))}/>
      <input aria-label="Timer size" type="number" min={40} max={800} value={timer.size} onChange={event=>onSizeChange(Math.max(40,Math.min(800,Number(event.target.value))))}/>
    </label>
    <label>Text size
      <input aria-label="Timer text size slider" type="range" min={10} max={240} value={fontSize} onChange={event=>onFontSizeChange(Number(event.target.value))}/>
      <input aria-label="Timer text size" type="number" min={10} max={240} value={fontSize} onChange={event=>onFontSizeChange(Math.max(10,Math.min(240,Number(event.target.value))))}/>
    </label>
    <p>Timer size scales the frame; Text size changes the numbers. The frame grows automatically if needed to keep larger text readable.</p>
    <fieldset className="timer-text-position">
      <legend>Text position</legend>
      <TextOffsetControl label="Horizontal offset" name="Timer text horizontal offset" value={timer.textOffsetX??0} onChange={x=>onTextPositionChange(x,timer.textOffsetY??0)}/>
      <TextOffsetControl label="Vertical offset" name="Timer text vertical offset" value={timer.textOffsetY??0} onChange={y=>onTextPositionChange(timer.textOffsetX??0,y)}/>
      <button type="button" onClick={()=>onTextPositionChange(0,0)}>Reset text position</button>
      <p>Moves text only, not the timer frame. Positive values move right/down. Units are pixels at 1080p and scale with the screen.</p>
    </fieldset>
    <label>Font family
      <select aria-label="Timer font family" value={value} onChange={event=>onChange(event.target.value)}>
        {!known&&<option value={value}>{value}</option>}
        <optgroup label="System fonts">{systemFonts.map(([family,label])=><option key={family} value={family}>{label}</option>)}</optgroup>
        <optgroup label="Installed local fonts">{installed.map(asset=>{const family=asset.display_name??asset.displayName!;return <option key={asset.id} value={family}>{family}</option>})}</optgroup>
        <optgroup label="Google Fonts — installs on selection">{googleFonts.filter(font=>font.family!==value&&!installedFamilies.has(font.family)).map(font=><option key={font.family} value={font.family}>{font.family} · {font.category}</option>)}</optgroup>
      </select>
    </label>
    <p className="timer-font-sample" aria-label="Timer font sample" style={{fontFamily:value,fontSize:'1.8rem',lineHeight:1.25,overflowWrap:'anywhere'}}>10 · 5 · TIME'S UP!</p>
    <button type="button" onClick={onPreview}>Preview question timer</button>
    <p>Applies to the countdown and “TIME'S UP!” text. Save changes and Publish to update the live show.</p>
  </fieldset>;
}
