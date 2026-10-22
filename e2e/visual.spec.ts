import { expect, test } from '@playwright/test';

test('stable broadcast scene snapshots', async ({ browser, request }) => {
  const copy = await request.post('/api/episodes/DEMO-EP-LOCKED/duplicate');
  const episode = await copy.json();
  const id = episode.id;
  await request.post(`/api/episodes/${id}/lock`);
  await request.post(`/api/episodes/${id}/start`);

  const live = await (await request.get(`/api/live/${id}/private`)).json();
  const cut = await request.post(`/api/live/${id}/commands`, {
    data: {
      commandId: `visual-board-${id}`,
      expectedRevision: live.revision,
      type: 'presentation.cut',
      payload: { scene: 'board' },
    },
  });
  expect(cut.ok()).toBe(true);
  await expect.poll(async () => {
    const state = await (await request.get(`/api/live/${id}/public`)).json();
    return state.presentation.programScene;
  }).toBe('board');

  const captures = [
    { name: 'board-1920.png', width: 1920, height: 1080, layout: 'full' },
    { name: 'board-1280.png', width: 1280, height: 720, layout: 'full' },
    { name: 'overlay-1920.png', width: 1920, height: 1080, layout: 'overlay' },
    { name: 'scorebug-1920.png', width: 1920, height: 1080, layout: 'scorebug' },
  ];

  for (const item of captures) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height } });
    await page.goto(`/#audience/${id}?layout=${item.layout}&reducedMotion=true&audio=off`);
    await expect(page.locator('.scene-board')).toBeVisible();
    await expect(page).toHaveScreenshot(item.name, { animations: 'disabled' });
    await page.close();
  }
});
