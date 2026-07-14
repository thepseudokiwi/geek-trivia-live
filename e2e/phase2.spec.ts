import { test, expect } from '@playwright/test';

test('host manages a saved episode through completion and read-only review', async ({ page, request }) => {
  test.setTimeout(45_000);
  page.on('dialog', dialog => dialog.accept());
  const title = `E2E Lifecycle ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'New Episode' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Recent use').selectOption('allow-all');
  await page.getByRole('button', { name: 'Generate board' }).click();
  await expect(page.locator('.board-column')).toHaveCount(4);
  await page.getByRole('button', { name: 'Save draft' }).click();

  await page.getByRole('button', { name: 'Episodes', exact: true }).click();
  await page.getByLabel('Search episodes').fill(title);
  const card = page.locator('.episode-card').filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Lock' }).click();
  await expect(card).toContainText('locked');
  await card.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText('Episode Run')).toBeVisible();

  await page.getByLabel('Participant name').fill('Ada');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.score-row')).toHaveCount(1);
  await page.getByLabel('Participant name').fill('Grace');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.score-row')).toHaveCount(2);

  const list = await (await request.get('/api/episodes', { params: { search: title } })).json();
  const episodeId = list.items[0].id;
  const episode = await (await request.get(`/api/episodes/${episodeId}`)).json();
  const questionId = episode.categories[0].questions[0].id;
  const beforeBackup = await (await request.get('/api/backup')).json();
  const beforeQuestion = beforeBackup.questions.find((q: any) => q.id === questionId);

  await page.locator('.question-tile').first().click();
  await page.getByLabel('Award participant').selectOption({ label: 'Ada' });
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page.locator('.score-row').first()).toContainText('100');
  await page.getByRole('button', { name: 'Complete episode' }).click();
  await expect(page.getByText('Read-only review')).toBeVisible();
  await expect(page.getByText(/Winner: Ada/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete episode' })).toHaveCount(0);

  const afterBackup = await (await request.get('/api/backup')).json();
  const afterQuestion = afterBackup.questions.find((q: any) => q.id === questionId);
  expect(afterQuestion.used_count).toBe(beforeQuestion.used_count + 1);
  const completed = await (await request.get(`/api/episodes/${episodeId}`)).json();
  expect(completed.status).toBe('completed');
  expect(completed.participants[0].placement).toBe(1);

  await page.reload();
  await expect(page.getByText('Read-only review')).toBeVisible();
  const repeat = await request.post(`/api/episodes/${episodeId}/complete`, { data: { confirmIncomplete: true } });
  expect(repeat.ok()).toBeTruthy();
  const finalBackup = await (await request.get('/api/backup')).json();
  expect(finalBackup.questions.find((q: any) => q.id === questionId).used_count).toBe(afterQuestion.used_count);
});
