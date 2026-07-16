import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

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
  it('validates typed values and rejects injection-shaped values',()=>{
    const config=themes.normalizeThemeConfig({},'Safe theme');
    expect(themes.validateTheme(config).valid).toBe(true);
    expect(themes.validateTheme({...config,colors:{...config.colors,primary:'url(javascript:alert(1))'}}).valid).toBe(false);
    expect(themes.validateTheme({...config,typography:{...config.typography,question:{...config.typography.question,fontFamily:'Arial; background:url(x)'}}}).valid).toBe(false);
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
});
