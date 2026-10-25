import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { themeCssVariables } from '../shared/themeDesigner.js';

const dbPath=path.resolve(`data/test-theme-designer-${process.pid}.db`);
let themes:typeof import('../server/themeDesignerRepository.js');
let presentation:typeof import('../server/presentationRepository.js');
let db:any;

beforeAll(async()=>{
  for(const script of ['server/db/migrate.ts','server/db/seed.ts']) execFileSync(process.execPath,['--import','tsx',script],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:dbPath}});
  process.env.DATABASE_PATH=dbPath;
  themes=await import('../server/themeDesignerRepository.js');
  presentation=await import('../server/presentationRepository.js');
  presentation.listThemes();
  db=(await import('../server/db/database.js')).db;
});
afterAll(()=>db.close());

describe('Theme Designer drafts and publishing',()=>{
  it('saves and publishes versioned built-in customizations while protecting deletion',()=>{
    const builtIn=themes.getDesignerTheme('fantasy-codex'),draft=structuredClone(builtIn.draft);
    draft.global.radius=builtIn.draft.global.radius+1;
    draft.glass={style:'frosted',blur:22,opacity:70};
    draft.playerScreen={enabled:true,background:'#102030',nameText:'#eeeeee',xpText:'#ffcc00',divider:'#445566'};
    themes.saveThemeDraft(builtIn.id,draft);
    const published=themes.publishTheme(builtIn.id,{changeSummary:'Built-in customization'});
    expect(published.isBuiltin).toBe(true);
    expect(published.published.global.radius).toBe(draft.global.radius);
    expect(published.published.glass).toEqual(draft.glass);
    expect(published.published.playerScreen).toEqual(draft.playerScreen);
    expect(published.publishedVersion).toBe(builtIn.publishedVersion+1);
    expect(()=>themes.deleteDesignerTheme(builtIn.id)).toThrow(/cannot be deleted/i);
  });
  it('validates typed values and rejects injection-shaped values',()=>{
    const config=themes.normalizeThemeConfig({},'Safe theme');
    expect(themes.validateTheme(config).valid).toBe(true);
    expect(themes.validateTheme({...config,colors:{...config.colors,primary:'url(javascript:alert(1))'}}).valid).toBe(false);
    expect(themes.validateTheme({...config,typography:{...config.typography,question:{...config.typography.question,fontFamily:'Arial; background:url(x)'}}}).valid).toBe(false);
    config.typography.xpValue.fontFamily='XP Display Test';
    config.typography.categoryHeader.fontFamily='Category Display Test';
    expect(themeCssVariables(config)['--font-xp']).toBe('XP Display Test');
    expect(themeCssVariables(config)['--font-category']).toBe('Category Display Test');
  });

  it('keeps a saved draft out of public presentation until publish',()=>{
    const copy=themes.duplicateTheme('nerd-wars-classic','Isolation Test');
    const before=presentation.getPublicPresentation('DEMO-EP-RUN').theme;
    db.prepare('UPDATE presentation_state SET theme_id=? WHERE episode_id=?').run(copy.id,'DEMO-EP-RUN');
    const draft=structuredClone(copy.draft);
    draft.colors.primary='#123456';
    themes.saveThemeDraft(copy.id,draft);
    expect(presentation.getPublicPresentation('DEMO-EP-RUN').theme.colors.primary).toBe(copy.published.colors.primary);
    themes.publishTheme(copy.id,{changeSummary:'Isolation regression'});
    expect(presentation.getPublicPresentation('DEMO-EP-RUN').theme.colors.primary).toBe('#123456');
    db.prepare('UPDATE presentation_state SET theme_id=? WHERE episode_id=?').run(before.id,'DEMO-EP-RUN');
  });

  it('creates immutable versions and restores an old version as a draft',()=>{
    const copy=themes.duplicateTheme('neon-arcade','Version Test');
    const firstId=copy.versions[0].id;
    const draft=structuredClone(copy.draft);
    draft.global.radius=77;
    themes.saveThemeDraft(copy.id,draft);
    const published=themes.publishTheme(copy.id,{changeSummary:'Rounder cards'});
    expect(published.versions).toHaveLength(2);
    expect(published.published.global.radius).toBe(77);
    const restored=themes.restoreThemeVersion(copy.id,firstId);
    expect(restored.draft.global.radius).not.toBe(77);
    expect(restored.published.global.radius).toBe(77);
  });
  it('saves, publishes and exports the timer font without changing question typography',()=>{
    const copy=themes.duplicateTheme('nerd-wars-classic','Timer Font Test');
    const draft=structuredClone(copy.draft),questionFont=draft.typography.question.fontFamily;
    draft.typography.timer.fontFamily='Georgia, serif';
    draft.timer.textOffsetX=12.5;draft.timer.textOffsetY=-7;
    themes.saveThemeDraft(copy.id,draft);
    expect(themes.getDesignerTheme(copy.id).draft.typography.timer.fontFamily).toBe('Georgia, serif');
    expect(themes.getDesignerTheme(copy.id).published.typography.timer.fontFamily).toBe(copy.published.typography.timer.fontFamily);
    const published=themes.publishTheme(copy.id,{changeSummary:'Timer text font'});
    const tokens=themes.themeTokensFromConfig(copy.id,published.published);
    expect(themeCssVariables(tokens.designer!)['--font-timer']).toBe('Georgia, serif');
    expect(tokens.designer!.typography.question.fontFamily).toBe(questionFont);
    expect(tokens.designer!.timer).toMatchObject({textOffsetX:12.5,textOffsetY:-7});
    expect(themes.importTheme(themes.exportTheme(copy.id)).draft.typography.timer.fontFamily).toBe('Georgia, serif');
    expect(themes.importTheme(themes.exportTheme(copy.id)).draft.timer).toMatchObject({textOffsetX:12.5,textOffsetY:-7});
  });

  it('exports, inspects, and imports compatible JSON',()=>{
    const exported=themes.exportTheme('nerd-wars-classic');
    expect(themes.inspectThemeImport(exported).valid).toBe(true);
    const imported=themes.importTheme(exported);
    expect(imported.isBuiltin).toBe(false);
    expect(imported.name).toContain('Import');
  });

  it('requires a valid token to preview unpublished work',()=>{
    const copy=themes.duplicateTheme('nerd-wars-classic','Preview Token Test');
    const draft=structuredClone(copy.draft);
    draft.colors.accent='#abcdef';
    themes.saveThemeDraft(copy.id,draft);
    expect(themes.previewTheme(copy.id).config.colors.accent).not.toBe('#abcdef');
    expect(()=>themes.previewTheme(copy.id,'invalid')).toThrow(/token/i);
    const issued=themes.issuePreviewToken(copy.id);
    expect(themes.previewTheme(copy.id,issued.token).config.colors.accent).toBe('#abcdef');
  });

  it('saves and publishes custom background images and protects their assets',()=>{
    const asset=presentation.saveAsset({displayName:'Test Background',fileName:'background.png',mimeType:'image/png',assetType:'image',base64:Buffer.from([137,80,78,71,13,10,26,10,0]).toString('base64')});
    const copy=themes.duplicateTheme('nerd-wars-classic','Background Test');
    const draft=structuredClone(copy.draft);
    draft.background={type:'image',assetId:asset.id,fit:'contain',position:'right',repeat:'no-repeat',opacity:1,blur:0,overlayColor:'#000000',overlayOpacity:.45};
    themes.saveThemeDraft(copy.id,draft);
    expect(themes.getDesignerTheme(copy.id).draft.background).toEqual(draft.background);
    expect(themes.getDesignerTheme(copy.id).published.background.type).not.toBe('image');
    expect(()=>presentation.deleteAsset(asset.id)).toThrow(/referenced/i);
    const published=themes.publishTheme(copy.id,{changeSummary:'Custom background'});
    expect(themes.themeTokensFromConfig(copy.id,published.published).designer?.background).toEqual(draft.background);
    const exported=themes.exportTheme(copy.id);
    expect(themes.importTheme(exported).draft.background).toEqual(draft.background);
    draft.background.assetId='11111111-1111-4111-8111-111111111111';
    expect(themes.validateTheme(draft).errors).toContainEqual(expect.objectContaining({path:'background.assetId'}));
  });

  it('publishes a custom logo and protects it while the theme references it',()=>{
    const asset=presentation.saveAsset({displayName:'Test Logo',fileName:'test-logo.png',mimeType:'image/png',assetType:'image',base64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')});
    const copy=themes.duplicateTheme('nerd-wars-classic','Logo Test');
    const draft=structuredClone(copy.draft);
    draft.branding.showTitle='The Kiwi Quiz';
    draft.branding.logoAssetId=asset.id;
    draft.layouts.full.positions.logo={...draft.layouts.full.positions.logo,x:24,y:12,width:18,height:14};
    themes.saveThemeDraft(copy.id,draft);
    expect(()=>presentation.deleteAsset(asset.id)).toThrow(/referenced/i);
    themes.publishTheme(copy.id,{changeSummary:'Add custom logo'});
    db.prepare('UPDATE presentation_state SET theme_id=? WHERE episode_id=?').run(copy.id,'DEMO-EP-RUN');
    const output=presentation.getPublicPresentation('DEMO-EP-RUN');
    expect(output.profile.showTitle).toBe('The Kiwi Quiz');
    expect(output.profile.logoUrl).toBe(`/api/presentation/assets/${asset.id}`);
    expect(output.theme.designer?.layouts.full.positions.logo).toMatchObject({x:24,y:12,width:18,height:14});
    db.prepare('UPDATE presentation_state SET theme_id=? WHERE episode_id=?').run('nerd-wars-classic','DEMO-EP-RUN');
  });
});
