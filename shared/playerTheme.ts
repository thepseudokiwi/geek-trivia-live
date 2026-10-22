import { z } from 'zod';
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const defaultPlayerTheme={enabled:false,background:'#28145b',nameText:'#f8fafc',xpText:'#f8fafc',divider:'#334155'};
export const playerThemeSchema=z.object({enabled:z.boolean(),background:color,nameText:color,xpText:color,divider:color});
export type PlayerTheme=z.infer<typeof playerThemeSchema>;
export function playerThemeVariables(theme?:PlayerTheme):Record<string,string>{
 if(!theme?.enabled)return {};
 return {'--player-screen-background':theme.background,'--player-name-color':theme.nameText,'--player-xp-color':theme.xpText,'--player-divider-color':theme.divider};
}
