import { expect, test } from '@playwright/test';

test('theme drafts stay private until publish and survive reload',async({page,request})=>{
  await page.goto('/#theme-designer/nerd-wars-classic');
  await expect(page.getByRole('heading',{name:'Theme Designer'})).toBeVisible();
  await page.getByRole('button',{name:'Duplicate to edit'}).click();
  await expect(page.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();
  await expect(page.getByText(/Published v1/)).toBeVisible();
  const themeId=new URL(page.url()).hash.split('/')[1];
  const before=await (await request.get(`/api/theme-designer/themes/${themeId}`)).json();
  await page.getByRole('button',{name:'Colors'}).click();
  const primary=page.getByLabel('primary hex');
  await primary.fill('#123456');
  await primary.press('Tab');
  await expect(primary).toHaveValue('#123456');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('status')).toContainText('Program output is unchanged');
  const saved=await (await request.get(`/api/theme-designer/themes/${themeId}`)).json();
  expect(saved.draft.colors.primary).toBe('#123456');
  expect(saved.published.colors.primary).toBe(before.published.colors.primary);
  await page.reload();
  await page.getByRole('button',{name:'Publish'}).click();
  await expect(page.getByRole('status')).toContainText('Published');
  const published=await (await request.get(`/api/theme-designer/themes/${themeId}`)).json();
  expect(published.published.colors.primary).toBe('#123456');
  expect(published.versions.length).toBe(2);
});

test('preview route renders deterministic sample data without administration',async({page})=>{
  await page.goto('/#theme-preview/nerd-wars-classic?scene=board&layout=full&sample=eight-players');
  await expect(page.locator('.theme-preview-canvas.scene-board')).toBeVisible();
  await expect(page.getByText('PREVIEW')).toBeVisible();
  await expect(page.locator('.program-theme-logo')).toHaveCount(0);
  await expect(page.getByText('NW',{exact:true})).toHaveCount(0);
  const text=await page.locator('body').innerText();
  for(const privateText of ['Host notes','Alternate answers','Control lease','Question Library']) expect(text).not.toContain(privateText);
});

test('adds a blank theme and reverts unsaved changes',async({page,request})=>{
  await page.goto('/#theme-designer/nerd-wars-classic');
  await expect(page.getByRole('button',{name:'Add Theme'})).toBeVisible();
  await page.getByRole('button',{name:'Add Theme'}).click();
  await expect(page.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();
  const themeId=new URL(page.url()).hash.split('/')[1];
  const created=await (await request.get(`/api/theme-designer/themes/${themeId}`)).json();
  expect(created.name).toBe('Untitled Theme');
  await page.getByRole('button',{name:'Colors'}).click();
  const primary=page.getByLabel('primary hex');
  const published=created.published.colors.primary;
  await primary.fill('#123456');
  await primary.press('Tab');
  await expect(page.getByRole('button',{name:'Revert'})).toBeEnabled();
  await page.getByRole('button',{name:'Revert'}).click();
  await expect(primary).toHaveValue(published);
  await expect(page.getByRole('status')).toContainText('Draft reverted');
});

test('shows the save action while renaming and hides it after the name is committed',async({page,request})=>{
  await page.goto('/#theme-designer/nerd-wars-classic');
  await page.getByRole('button',{name:'Add Theme'}).click();
  await expect(page.getByRole('button',{name:'Duplicate',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save changes'})).toHaveCount(0);
  await page.getByLabel('Theme name').fill('Saturday Night Geekdown');
  await expect(page.getByRole('button',{name:'Save changes'})).toBeVisible();
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('button',{name:'Save changes'})).toHaveCount(0);
  await expect(page.getByLabel('Theme',{exact:true})).toContainText('Saturday Night Geekdown');
  const themeId=new URL(page.url()).hash.split('/')[1];
  const saved=await (await request.get(`/api/theme-designer/themes/${themeId}`)).json();
  expect(saved.name).toBe('Saturday Night Geekdown');
});

test('uploads and positions a custom logo independently of the show title',async({page})=>{
  await page.goto('/#theme-designer/nerd-wars-classic');
  const resolution=page.getByLabel('Preview resolution');
  await expect(resolution.locator('option[value="2560x1440"]')).toHaveText('2560×1440 (1440p)');
  await expect(resolution.locator('option[value="3840x2160"]')).toHaveText('3840×2160 (2160p / 4K)');
  await resolution.selectOption('3840x2160');
  await expect(resolution).toHaveValue('3840x2160');
  await page.getByRole('button',{name:'Duplicate to edit'}).click();
  await page.getByRole('button',{name:'Branding'}).click();
  await page.getByLabel('Show name').fill('The Kiwi Quiz');
  await expect(page.locator('.theme-preview-canvas .program-brand h1')).toHaveText('The Kiwi Quiz');
  await page.getByLabel('Upload custom logo').setInputFiles({
    name:'geek-trivia-logo.png',
    mimeType:'image/png',
    buffer:Buffer.from([137,80,78,71,13,10,26,10]),
  });
  await expect(page.getByRole('status')).toContainText('Logo uploaded and selected');
  await expect(page.locator('.theme-preview-canvas .program-brand h1')).toHaveCount(0);
  await expect(page.getByLabel('Logo',{exact:true})).not.toHaveValue('');
  await expect(page.getByText('logoAssetId',{exact:true})).toHaveCount(0);
  await expect(page.getByText('sponsorAssetId',{exact:true})).toHaveCount(0);
  const logo=page.locator('.theme-preview-canvas .program-theme-logo');
  await expect(logo).toHaveAttribute('src',/\/api\/presentation\/assets\//);
  const position=page.getByRole('group',{name:'Placement'});
  await expect(page.getByRole('button',{name:'Validate full theme'})).toHaveCount(0);
  await expect(page.locator('.layer-list')).toHaveCount(0);
  await position.getByLabel('Left percentage').fill('24');
  for(const control of ['Top percentage','Width percentage','Height percentage','Layer order','Nudge up','Nudge left','Nudge right','Nudge down']) await expect(position.getByLabel(control)).toBeVisible();
  await position.getByRole('button',{name:'Larger 10%'}).click();
  await expect(position.getByLabel('Width percentage')).toHaveValue('13.2');
  await expect(position.getByLabel('Height percentage')).toHaveValue('11');
  await expect(logo).toHaveAttribute('style',/left: 24%/);
  await expect(page.locator('.theme-preview-canvas .program-brand')).not.toHaveAttribute('style',/left: 24%/);
});

test('applies the category and XP typography roles to the board',async({page,request})=>{
  const copy=await (await request.post('/api/theme-designer/themes/nerd-wars-classic/duplicate',{data:{name:'XP Font Test'}})).json();
  const draft=structuredClone(copy.draft);
  draft.typography.categoryHeader.fontFamily='Georgia';
  draft.typography.xpValue.fontFamily='Courier New';
  await request.put(`/api/theme-designer/themes/${copy.id}/draft`,{data:draft});
  await page.goto(`/#theme-designer/${copy.id}`);
  await expect(page.locator('.theme-preview-canvas .audience-board h2').first()).toHaveCSS('font-family','Georgia');
  await expect(page.locator('.theme-preview-canvas .audience-square').first()).toHaveCSS('font-family','"Courier New"');
});

test('uses production-friendly typography labels and previews fonts before applying them',async({page,request})=>{
  await request.post('/api/presentation/assets',{data:{displayName:'Preview Test Font',fileName:'preview-test.ttf',mimeType:'font/ttf',assetType:'font',base64:Buffer.from([0,1,0,0]).toString('base64')}});
  await page.goto('/#theme-designer/nerd-wars-classic');
  await page.getByRole('button',{name:'Typography'}).click();
  for(const label of ['Show title','Scene title','Category headers','XP values','Question text','Answer text','Scores','Player/team names','Timer','Lower thirds']) await expect(page.getByRole('group',{name:label})).toBeVisible();
  await expect(page.getByText('showTitle',{exact:true})).toHaveCount(0);
  await expect(page.getByText('xpValue',{exact:true})).toHaveCount(0);
  const showTitle=page.getByRole('group',{name:'Show title'}),selector=showTitle.getByLabel('Show title font family');
  const before=await selector.inputValue();
  await showTitle.getByText('Preview installed fonts').click();
  const preview=showTitle.getByRole('button',{name:/Preview Test Font/});
  await expect(preview).toBeVisible();
  await expect(selector).toHaveValue(before);
  await preview.click();
  await expect(selector).toHaveValue('Preview Test Font');
});

test('deletes a custom theme after confirmation and protects built-in themes',async({page,request})=>{
  await page.goto('/#theme-designer/nerd-wars-classic');
  await expect(page.getByRole('button',{name:'Delete Theme'})).toHaveCount(0);
  await page.getByRole('button',{name:'Add Theme'}).click();
  await expect(page.getByRole('button',{name:'Delete Theme'})).toBeVisible();
  const themeId=new URL(page.url()).hash.split('/')[1];
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Delete Theme'}).click();
  await expect(page).not.toHaveURL(new RegExp(`${themeId}$`));
  const themes=await (await request.get('/api/theme-designer/themes')).json();
  expect(themes.some((theme:{id:string})=>theme.id===themeId)).toBe(false);
});
