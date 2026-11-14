import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Creates a join session and rolls a real question. Run only on an isolated demo database.
const base = 'http://127.0.0.1:8799';
const episode = 'DEMO-EP-RUN';
const readState = () => request(`/api/live/${episode}/public`);
async function request(path, body) {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  assert(response.ok, data.error ?? `${path}: ${response.status}`);
  return data;
}

const initial = await readState();
assert(!initial.question && !initial.d20, 'Start with a fresh demo board.');
await request(`/api/live/${episode}/commands`, {
  type: 'display.setMode', commandId: randomUUID(), expectedRevision: initial.revision,
  payload: { mode: 'board' },
});
const host = await request(`/api/episodes/${episode}/join-session/open`, {});
const code = host.joinSession.joinCode;
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [];
await mkdir('.local/xp-tile-flip', { recursive: true });
try {
  const audience = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const player = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  for (const page of [audience, player, reduced]) page.on('pageerror', e => errors.push(e.message));
  await audience.addInitScript(() => {
    window.xpSequence = [];
    for (const type of ['animationstart', 'animationend']) {
      document.addEventListener(type, event => {
        if (event.animationName === 'xp-tile-flight') window.xpSequence.push({ type, at: Date.now() });
      });
    }
    let questionSeen = false;
    new MutationObserver(() => {
      if (!questionSeen && document.querySelector('.broadcast-question h2')) {
        questionSeen = true;
        window.xpSequence.push({ type: 'question', at: Date.now() });
      }
    }).observe(document, { subtree: true, childList: true });
  });
  await Promise.all([
    audience.goto(`${base}/#audience/${episode}`),
    reduced.goto(`${base}/#audience/${episode}`),
    player.goto(`${base}/#play/${code}`),
  ]);
  const name=`Tile Flip Tester ${randomUUID().slice(0, 4)}`;
  await player.getByLabel('Display name').fill(name);
  await player.getByRole('button', { name: 'Join show' }).click();
  const playerBoard = player.frameLocator('.player-program-view');
  const audienceBoard = audience.locator('.board-position');
  await audienceBoard.waitFor();
  await playerBoard.locator('.board-position').waitFor();
  const {privateParticipants} = await request(`/api/live/${episode}/private`);
  await request(`/api/episodes/${episode}/gameplay/control`, {
    participantId: privateParticipants.find(participant => participant.displayName === name).id,
  });
  const gridBefore = await audienceBoard.boundingBox();
  await player.getByRole('button', { name: 'Roll the D20' }).click();
  const card = audience.locator('.xp-flip-card');
  await card.waitFor();
  const roll = await readState();
  assert.equal(roll.presentation.programScene, 'd20');
  assert.equal(roll.question, null, 'The API must not reveal question text during the board scene.');
  assert.equal(await card.count(), 1);
  assert.equal(await card.evaluate(el => getComputedStyle(el).opacity), '0');
  assert.deepEqual(await audienceBoard.boundingBox(), gridBefore, 'Board stays in place when the flip mounts.');
  await audience.locator('.d20-board-roll.revealed').waitFor();
  await reduced.locator('.d20-board-roll.revealed').waitFor();
  assert.equal(await reduced.locator('.xp-flip-card').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await player.getByRole('button', { name: 'Get ready' }).isEnabled(), false);
  await playerBoard.locator('.xp-flip-card').waitFor();
  await audience.waitForFunction(() => {
    const animation = document.querySelector('.xp-flip-card')?.getAnimations()[0];
    return animation && animation.effect.getComputedTiming().progress >= .36;
  });
  assert.equal((await readState()).question, null);
  assert.equal(await audience.locator('.broadcast-question').count(), 0);
  assert.equal(await audience.locator('.d20-corner-number').textContent(), String(roll.d20.result));
  assert.equal(await audience.locator('.d20-critical-popup').count(), 0);
  await audience.screenshot({ path: '.local/xp-tile-flip/flight.jpg' });
  await Promise.all([
    audience.locator('.broadcast-question h2').waitFor(),
    playerBoard.locator('.broadcast-question h2').waitFor(),
    reduced.locator('.broadcast-question h2').waitFor(),
  ]);
  const question = await readState();
  assert.equal(question.question.category, roll.d20.selectedSquare.category);
  assert.equal(question.question.value, roll.d20.selectedSquare.value);
  assert.equal(question.timer.status, 'idle');
  const sequence = await audience.evaluate(() => window.xpSequence);
  assert.deepEqual(sequence.map(event => event.type), ['animationstart', 'animationend', 'question']);
  assert(sequence[1].at - sequence[0].at >= 1300, JSON.stringify(sequence));
  await player.getByRole('button', { name: 'BUZZ', exact: true }).waitFor();
  assert.equal(await player.getByRole('button', { name: 'BUZZ', exact: true }).isEnabled(), true);
  assert.equal((await readState()).timer.status, 'running');
  assert.deepEqual(errors, []);
  console.log('Real contestant roll → one glass tile flips → same question on audience/player → timer and buzzer open. Reduced-motion view skipped the flip.');
  console.log(JSON.stringify(sequence));
} finally {
  await browser.close();
}
