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
  await page.getByRole('button',{name:'Save draft'}).click();
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
  const text=await page.locator('body').innerText();
  for(const privateText of ['Host notes','Alternate answers','Control lease','Question Library']) expect(text).not.toContain(privateText);
});
