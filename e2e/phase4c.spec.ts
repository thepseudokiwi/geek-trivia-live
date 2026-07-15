import { expect, test, type BrowserContext, type Page } from '@playwright/test';

test('four contestants join, ready, buzz, steal, score and reconnect', async ({ browser, request }) => {
  const copy = await request.post('/api/episodes/DEMO-EP-LOCKED/duplicate');
  const episode = await copy.json();
  const id = episode.id;
  await request.post(`/api/episodes/${id}/lock`);
  await request.post(`/api/episodes/${id}/start`);

  const host = await browser.newPage();
  await host.goto(`/#host/${id}`);
  await expect(host.getByRole('heading', { name: 'Contestants' })).toBeVisible();
  await host.getByRole('button', { name: 'Open joins' }).click();
  const code = await host.locator('.join-code strong').innerText();
  const players: Array<{ context: BrowserContext; page: Page; name: string }> = [];
  for (const name of ['Nova', 'Rune', 'Pixel', 'Comet']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/#play/${code}`);
    await page.getByLabel('Display name').fill(name);
    await page.getByRole('button', { name: 'Join show' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    players.push({ context, page, name });
  }

  await host.getByRole('button', { name: 'Open ready check' }).click();
  for (const player of players) await player.page.getByRole('button', { name: 'Ready', exact: true }).click();
  await expect.poll(async () => host.locator('.contestant-list').getByText(/Ready ·/).count()).toBe(4);
  await host.getByRole('button', { name: 'Lock joins' }).click();
  await host.locator('.live-square:not([disabled])').first().click();
  await host.getByRole('button', { name: 'Show question', exact: true }).click();
  await host.getByRole('button', { name: 'Open buzzer' }).click();
  await players[0].page.getByRole('button', { name: 'BUZZ' }).click();
  await expect(host.getByText('Current responder:', { exact: false })).toBeVisible();

  const firstWinner = 0;
  await expect(players[firstWinner].page.getByText('You buzzed first')).toBeVisible();
  await expect(players[1].page.getByText('Another contestant buzzed first')).toBeVisible();
  await host.getByRole('button', { name: 'Incorrect', exact: true }).click();
  await host.getByRole('button', { name: 'Open steal' }).click();
  const stealer = players.findIndex((_player, index) => index !== firstWinner);
  await expect(players[stealer].page.getByRole('button', { name: 'BUZZ' })).toBeEnabled();
  await players[stealer].page.getByRole('button', { name: 'BUZZ' }).click();
  await host.getByRole('button', { name: 'Correct', exact: true }).click();
  await expect(players[stealer].page.getByText(/Correct|XP/).first()).toBeVisible();

  await players[stealer].page.reload();
  await expect(players[stealer].page.getByRole('heading', { name: players[stealer].name })).toBeVisible();
  for (const player of players) await player.context.close();
  await host.close();
});
