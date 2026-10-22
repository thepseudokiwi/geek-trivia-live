import { expect,it } from 'vitest';
import { defaultThemeConfig,themeConfigSchema } from '../shared/themeDesigner.js';
import { defaultPlayerTheme,playerThemeSchema,playerThemeVariables } from '../shared/playerTheme.js';
it('preserves the original colors for existing themes',()=>{
 const {playerScreen:ignored,...legacy}=defaultThemeConfig();
 expect(themeConfigSchema.parse(legacy).playerScreen).toEqual(defaultPlayerTheme);
 expect(playerThemeVariables()).toEqual({});
 expect(playerThemeVariables(defaultPlayerTheme)).toEqual({});
});
it('serializes each custom color and rejects non-color CSS',()=>{
 const config=defaultThemeConfig();config.playerScreen={enabled:true,background:'#102030',nameText:'#ffffff',xpText:'#ffcc00',divider:'#445566'};
 const restored=themeConfigSchema.parse(JSON.parse(JSON.stringify(config)));
 expect(playerThemeVariables(restored.playerScreen)).toEqual({'--player-screen-background':'#102030','--player-name-color':'#ffffff','--player-xp-color':'#ffcc00','--player-divider-color':'#445566'});
 expect(playerThemeSchema.safeParse({...config.playerScreen,background:'url(x)'}).success).toBe(false);
});
