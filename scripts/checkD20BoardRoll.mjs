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
function recordD20Phases() {
  window.__d20Phases=[];
  let previousRoot, previousPhase;
  new MutationObserver(()=>{
    const root=document.querySelector('.d20-board-roll');
    if(!root)return;
    const phase=root.classList.contains('revealed')?'revealed':root.classList.contains('landed')?'landed':'rolling';
    if(root===previousRoot&&phase===previousPhase)return;
    previousRoot=root;previousPhase=phase;
    window.__d20Phases.push({phase,at:Date.now(),value:root.querySelector('.d20-corner-number')?.textContent,details:root.querySelectorAll('.d20-corner-details .selected-square').length});
  }).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
}
await mkdir('.local/d20-board-check', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.addInitScript(recordD20Phases);
  await page.addInitScript(() => {
    window.__d20LandingSounds = [];
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function(...args) {
      const oscillator = original.apply(this,args), start=oscillator.start.bind(oscillator);
      oscillator.start = function(at) {
        window.__d20LandingSounds.push({type:oscillator.type,wall:Date.now(),at});
        return start(at);
      };
      return oscillator;
    };
  });
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
      resultDisplayDurationMs: 5000, autoReturn: false, theme: 'gold', soundEnabled: true, volume: 0,
    };
    audienceSocket.send(JSON.stringify({ event: 'state.public', data: state }));
  };
  // Warm the lazy 3D renderer with an old roll so loading cannot hide the throw.
  sendRoll(12, 10000);
  await page.locator('.d20-board-roll canvas').waitFor();
  await page.locator('body').click({position:{x:10,y:10}});
  const rollStarted=Date.now();
  sendRoll(12);
  await page.locator('.d20-board-roll.rolling').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(), 'ROLLING');
  const canvas = await page.locator('.d20-board-roll .d20-three').boundingBox();
  await page.screenshot({ path: '.local/d20-board-check/rolling-layout.jpg' });
  assert(canvas.width > 1800 && canvas.height > 700, `The die must roll over the board, not inside the corner: ${JSON.stringify(canvas)}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.local/d20-board-check/rolling.jpg' });
  assert.equal(await page.locator('.d20-board-roll .d20-three').evaluate(element=>getComputedStyle(element).filter),'none','Do not paint a second CSS shadow around the moving die');
  await page.locator('.d20-board-roll.revealed').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(), '12');
  const phases=await page.evaluate(()=>window.__d20Phases.slice(-3));
  assert.deepEqual(phases.map(event=>event.phase),['rolling','landed','revealed']);
  assert.equal(phases[1].value,'LANDED');assert.equal(phases[1].details,0);
  assert(phases[2].at-phases[1].at>=430,'Keep the result hidden during the landing flourish');
  const cue = await page.evaluate(()=>window.__d20LandingSounds.find(event=>event.type==='triangle'));
  assert(cue && cue.wall >= rollStarted + 1550, 'The landing cue must follow the rendered stop');
  assert(cue.wall>=phases[1].at-50,'The sound cannot precede the rendered stop');
  assert(phases[2].at-cue.wall>=400,'The value must wait for the landing glow and sound');
  assert.equal(await page.locator('.d20-critical-popup').count(), 0);
  const after = await page.locator('.board-position').boundingBox();
  for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(before[key] - after[key]) < 1, `Board ${key} shifted during the throw: ${JSON.stringify({before,after})}`);
  report.push({ normalRoll: 'passed', landingSoundAfterMs:cue.wall-rollStarted, before, after, canvas });

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
  await page.locator('.d20-board-roll.revealed').waitFor();
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

  // Exercise motion inside a short, wide window as well as a normal monitor.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1920,height:540});
  sendRoll(12,0,2200);
  await page.locator('.d20-board-roll.rolling canvas').waitFor();
  for(let frame=1;frame<=3;frame++) {
    await page.waitForTimeout(450);
    await page.screenshot({path:`.local/d20-board-check/wide-motion-${frame}.jpg`});
    assert.equal(await page.locator('.d20-corner-number').textContent(),'ROLLING');
  }
  await page.locator('.d20-board-roll.revealed').waitFor();
  assert.equal(await page.locator('.d20-corner-number').textContent(),'12');
  report.push({wideWindowMotion:'passed'});

  // A slow 3D download must not let a wall-clock timer reveal the value first.
  const cold = await browser.newPage({viewport:{width:1280,height:720}});
  await cold.addInitScript(recordD20Phases);
  const coldState = structuredClone(state);
  coldState.presentation.programScene='board';
  coldState.d20=null;
  let releaseRenderer;
  const rendererGate=new Promise(resolve=>{releaseRenderer=resolve});
  await cold.route('**/assets/D20Three-*.js',async route=>{await rendererGate;await route.continue()});
  let coldSocket;
  await cold.routeWebSocket('**/ws?**',socket=>{coldSocket=socket;socket.send(JSON.stringify({event:'state.public',data:coldState}))});
  await cold.goto(`${base}/#audience/${state.episodeId}`);
  await cold.locator('.board-position').waitFor();
  coldState.presentation.programScene='d20';
  coldState.d20={...state.d20,rolledAt:new Date().toISOString(),animationDurationMs:400,soundEnabled:false};
  coldSocket.send(JSON.stringify({event:'state.public',data:coldState}));
  await cold.waitForTimeout(1000);
  assert.equal(await cold.locator('.d20-corner-number').textContent(),'ROLLING');
  assert.equal(await cold.locator('.d20-corner-details .selected-square').count(),0);
  releaseRenderer();
  await cold.locator('.d20-board-roll.revealed').waitFor();
  assert.equal((await cold.evaluate(()=>window.__d20Phases.slice(-2)))[0].value,'LANDED');
  report.push({slowRendererReveal:'passed'});

  const fallback = await browser.newPage({viewport:{width:1280,height:720}});
  await fallback.addInitScript(recordD20Phases);
  await fallback.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return /webgl/i.test(type)?null:getContext.call(this,type,...args);
    };
  });
  const fallbackState=structuredClone(coldState);
  fallbackState.presentation.programScene='board';
  let fallbackSocket;
  await fallback.routeWebSocket('**/ws?**',socket=>{fallbackSocket=socket;socket.send(JSON.stringify({event:'state.public',data:fallbackState}))});
  await fallback.goto(`${base}/#audience/${state.episodeId}`);
  await fallback.locator('.board-position').waitFor();
  fallbackState.presentation.programScene='d20';
  fallbackState.d20={...fallbackState.d20,rolledAt:new Date().toISOString(),animationDurationMs:1000};
  fallbackSocket.send(JSON.stringify({event:'state.public',data:fallbackState}));
  await fallback.locator('.d20-three .d20-webgl-fallback').waitFor();
  assert.equal(await fallback.locator('.d20-three .d20-webgl-fallback').textContent(),'D20');
  await fallback.locator('.d20-board-roll.revealed').waitFor();
  const fallbackPhases=await fallback.evaluate(()=>window.__d20Phases.slice(-2));
  assert.equal(fallbackPhases[0].value,'LANDED');assert.equal(fallbackPhases[0].details,0);
  assert(fallbackPhases[1].at-fallbackPhases[0].at>=430);
  assert.equal(await fallback.locator('.d20-three .d20-webgl-fallback').textContent(),String(fallbackState.d20.result));
  report.push({webglFallbackReveal:'passed'});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ report, errors }, null, 2));
} finally { await browser.close(); }
