type FontAsset={id:string;active?:boolean;asset_type?:string;display_name?:string;displayName?:string};
type Props={
  value:string;
  assets:FontAsset[];
  googleFonts:{family:string;category:string}[];
  onChange:(family:string)=>void;
  onPreview:()=>void;
};
const systemFonts=[
  ['system-ui, sans-serif','System UI'],['Arial, sans-serif','Arial'],
  ['Verdana, sans-serif','Verdana'],['Georgia, serif','Georgia'],
  ['"Courier New", monospace','Courier New'],['Impact, sans-serif','Impact'],
]as const;

export function TimerFontControls({value,assets,googleFonts,onChange,onPreview}:Props){
  const installed=assets.filter(asset=>asset.active&&asset.asset_type==='font'&&(asset.display_name||asset.displayName));
  const installedFamilies=new Set(installed.map(asset=>asset.display_name??asset.displayName));
  const known=systemFonts.some(([family])=>family===value)||installedFamilies.has(value);
  return <fieldset className="timer-font-controls">
    <legend>Timer text</legend>
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
