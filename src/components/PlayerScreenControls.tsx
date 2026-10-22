import type { ThemeConfig } from '../../shared/themeDesigner';
import { defaultPlayerTheme } from '../../shared/playerTheme';

export function PlayerScreenControls({draft,update}:{draft:ThemeConfig;update:(fn:(next:ThemeConfig)=>void)=>void}){
 const theme=draft.playerScreen??defaultPlayerTheme;
 return <fieldset><legend>Player screen colors</legend>
 <p>Customize the area around the player's game board. Publish to update connected players using this theme.</p>
 <label><input type="checkbox" checked={theme.enabled} onChange={event=>update(next=>{next.playerScreen={...theme,enabled:event.target.checked}})}/> Use custom player colors</label>
 {([['background','Background'],['nameText','Player-name text'],['xpText','XP text'],['divider','Divider']]as const).map(([key,label])=><label key={key} className="color-control"><span>{label}</span><input type="color" aria-label={label} value={theme[key]} onChange={event=>update(next=>{next.playerScreen={...theme,enabled:true,[key]:event.target.value}})}/><span>{theme[key]}</span></label>)}
 <h3>Player header preview</h3><div style={{padding:'1rem',background:theme.enabled?theme.background:'linear-gradient(110deg,#070814,#28145b)',color:theme.enabled?theme.nameText:'#f8fafc',borderRadius:8}}><small>NERD WARS</small><h2 style={{color:'inherit',margin:'.4rem 0'}}>Lars</h2><p>Individual player · <strong style={{color:theme.enabled?theme.xpText:'#f8fafc'}}>500 XP</strong></p><div style={{borderBottom:`1px solid ${theme.enabled?theme.divider:'#334155'}`}}/></div>
 <button type="button" onClick={()=>update(next=>{next.playerScreen={...defaultPlayerTheme}})}>Restore original player colors</button>
 </fieldset>;
}
