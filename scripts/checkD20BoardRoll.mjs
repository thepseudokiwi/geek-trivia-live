import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Replays public snapshots only. No commands are sent to a real game.
const base = process.env.D20_CHECK_URL || 'http://127.0.0.1:8787';
const state = await fetch(`${base}/api/live/DEMO-EP-RUN/public`).then(response => {
  assert(response.ok, 'Preview API must be available');
  return response.json();
});
state.timer.status = 'idle';
state.videoFeeds = [];
state.presentation.programScene = 'board';
state.presentation.transition.kind = 'cut';
state.presentation.animationsDisabled = false;
state.presentation.reducedMotion = false;
for (const category of state.board) for (const square of category.squares) { square.status = 'unopened'; square.active = false; }
const selected = { category: state.board[0].name, value: state.board[0].squares[0].value };
const player = {
  episodeId: state.episodeId, showTitle: state.title, episodeTitle: state.title,
  displayName: 'Dice preview', team: null, score: 0, connected: true, ready: false,
  status: 'connected', episodeRevision: 1, displayMode: 'board', board: state.board,
  videoFeeds: [], d20: null,
  gameplay: { phase: 'awaiting-roll', hasControl: true, canRoll: true },
  buzzer: { id: null, state: 'disabled', revision: 0, eligible: false, result: 'idle' },
  question: null, responseTimer: { status: 'idle', remainingMs: 10000 }, hostMessage: null, modifier: null,
};
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [], report = [];
await mkdir('.local/d20-board-check', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let audienceSocket;
  await page.routeWebSocket('**/ws?**', socket => {
    audienceSocket = socket;
    socket.send(JSON.stringify({ event: 'state.public', data: state }));
  });
  await page.goto(`${base}/#audience/${state.episodeId}`);
  await page.locator('.board-position .audience-square').first().waitFor();
  const before = await page.locator('.board-position').boundingBox();
  const sendRoll = (result, age = 0, duration = 1600) => {
    state.presentation.programScene = 'd20';
    state.d20 = {
      result, mode: 'question_selector', status: 'rolling',
      effectName: 'Question Selected', publicDescription: 'The die has chosen the next square.',
      selectedSquare: selected, effectiveAwardXp: selected.value * (result === 20 ? 3 : 1),
      timerOverrideMs: null, stealEnabled: false,
      rolledAt: new Date(Date.now() - age).toISOString(), animationDurationMs: duration,
      resultDisplayDurationMs: 5000, autoReturn: false, theme: 'gold', soundEnabled: false, volume: 0,
    };
    audienceSocket.send(JSON.stringify({ event: 'state.public', data: state }));
  };
  // Warm the lazy 3D renderer with an old roll so loading cannot hide the throw.
  sendRoll(12, 10000);
  await page.locator('.d20-board-roll canvas').waitFor();
  sendRoll(12);
  await page.locator('.d20-board-roll.rolling').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(), 'ROLLING');
  const canvas = await page.locator('.d20-board-roll .d20-three').boundingBox();
  await page.screenshot({ path: '.local/d20-board-check/rolling-layout.jpg' });
  assert(canvas.width > 1800 && canvas.height > 700, `The die must roll over the board, not inside the corner: ${JSON.stringify(canvas)}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.local/d20-board-check/rolling.jpg' });
  await page.locator('.d20-board-roll.landed').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(), '12');
  assert.equal(await page.locator('.d20-critical-popup').count(), 0);
  const after = await page.locator('.board-position').boundingBox();
  for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(before[key] - after[key]) < 1, `Board ${key} shifted during the throw: ${JSON.stringify({before,after})}`);
  report.push({ normalRoll: 'passed', before, after, canvas });

  sendRoll(20);
  await page.locator('.d20-critical-popup').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(), '20');
  assert.match(await page.locator('.d20-critical-popup').textContent(), /TRIPLE XP!/);
  assert.match(await page.locator('.d20-critical-award').textContent(), new RegExp(`${selected.value * 3} XP`));
  await page.screenshot({ path: '.local/d20-board-check/natural-20.jpg' });
  report.push({ natural20: 'passed', award: selected.value * 3 });

  for (const viewport of [{ width: 1280, height: 720 }, { width: 640, height: 480 }]) {
    await page.setViewportSize(viewport);
    const panel = await page.locator('.d20-corner-summary').boundingBox();
    assert(panel.x >= 0 && panel.y >= 0 && panel.x + panel.width <= viewport.width && panel.y + panel.height <= viewport.height);
    const fit = await page.locator('.d20-corner-summary').evaluate(element => ({scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth}));
    await page.screenshot({path:`.local/d20-board-check/natural-20-${viewport.width}.jpg`});
    assert(fit.scrollHeight <= fit.clientHeight + 1 && fit.scrollWidth <= fit.clientWidth + 1, `Result text must fit the corner: ${JSON.stringify({viewport,fit})}`);
    const popup = await page.locator('.d20-critical-popup').boundingBox();
    assert(popup.x >= 0 && popup.y >= 0 && popup.x + popup.width <= viewport.width && popup.y + popup.height <= viewport.height);
    report.push({ viewport, panel, popup });
  }
  sendRoll(20, 15000);
  await page.locator('.d20-board-roll.landed').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.d20-critical-popup').count(), 0, 'Refreshing an old 20 must not replay the celebration');
  assert.equal(await page.locator('.d20-corner-number').textContent(), '20');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  sendRoll(20);
  await page.locator('.d20-reduced-motion').waitFor();
  assert.equal(await page.locator('.d20-board-roll canvas').count(), 0);
  await page.locator('.d20-critical-popup').waitFor();
  assert.equal(await page.locator('.d20-critical-popup').evaluate(element => getComputedStyle(element).animationName), 'none');
  report.push({ reducedMotion: 'passed', staleRoll: 'passed' });

  const contestant = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  contestant.on('pageerror', error => errors.push(error.message));
  await contestant.addInitScript(() => localStorage.setItem('geek-trivia-contestant-token', 'isolated-dice-preview'));
  let contestantAudienceSocket;
  await contestant.routeWebSocket('**/ws?**', socket => {
    if (socket.url().includes('role=contestant')) socket.send(JSON.stringify({ event: 'state.contestant', data: player }));
    else { contestantAudienceSocket = socket; socket.send(JSON.stringify({ event: 'state.public', data: state })); }
  });
  await contestant.goto(`${base}/#play/TEST`);
  const frame = contestant.frameLocator('.player-program-view');
  await frame.locator('.d20-board-roll').waitFor();
  state.d20.rolledAt = new Date().toISOString();
  contestantAudienceSocket.send(JSON.stringify({ event: 'state.public', data: state }));
  await frame.locator('.d20-critical-popup').waitFor();
  assert.equal(await frame.locator('.d20-corner-number').textContent(), '20');
  await contestant.screenshot({ path: '.local/d20-board-check/contestant-20.jpg' });
  report.push({ contestantEmbeddedBoard: 'passed' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ report, errors }, null, 2));
} finally { await browser.close(); }
