import { chromium } from '@playwright/test';

// Isolated browser replay: never issues commands to the live game.
const base = process.env.D20_CHECK_URL || 'http://127.0.0.1:8787';
const state = await fetch(`${base}/api/live/DEMO-EP-RUN/public`).then(response => response.json());
state.timer.status = 'idle';
state.videoFeeds = [];
state.presentation.programScene = 'board';
state.presentation.transition.kind = 'cut';
state.presentation.animationsDisabled = true;
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
 const page = await browser.newPage({ viewport: { width: Number(process.env.D20_CHECK_WIDTH || 1600), height: Number(process.env.D20_CHECK_HEIGHT || 900) } });
 const errors = [];
 page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
 page.on('pageerror', error => errors.push(error.message));
 let socket;
 await page.routeWebSocket('**/ws?**', ws => { socket = ws; ws.send(JSON.stringify({ event: 'state.public', data: state })); });
 await page.goto(`${base}/#audience/DEMO-EP-RUN`);
 await page.locator('.board-position .audience-square').first().waitFor();
 const before = await page.locator('.board-position').boundingBox();
 state.presentation.programScene = 'd20';
 state.d20 = { result: 12, mode: 'question_selector', status: 'resolved', effectName: 'Question Selected', publicDescription: 'The die has chosen the next square.', selectedSquare: null, effectiveAwardXp: 100, timerOverrideMs: null, stealEnabled: false, rolledAt: new Date().toISOString(), animationDurationMs: 1000, resultDisplayDurationMs: 5000, autoReturn: false, theme: 'neon_arcane', soundEnabled: false, volume: 0 };
 socket.send(JSON.stringify({ event: 'state.public', data: state }));
 await page.locator('.d20-three canvas').waitFor();
 await page.waitForTimeout(2500);
 const after = await page.locator('.board-position').boundingBox();
 await page.screenshot({ path: 'data/d20-display-check.png' });
 console.log(JSON.stringify({ before, after, errors }, null, 2));
 if (errors.some(error => /blob|texture|GLTF|Content Security/i.test(error)) || ['x','y','width','height'].some(key => Math.abs(before[key] - after[key]) > 1)) process.exitCode = 1;
} finally { await browser.close(); }
