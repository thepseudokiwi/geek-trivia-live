import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

// Public-state replay only: never sends a command to the live game.
const base=process.env.D20_CHECK_URL||'http://127.0.0.1:8799';
const state=await fetch(`${base}/api/live/DEMO-EP-RUN/public`).then(r=>{assert(r.ok);return r.json()});
state.presentation.programScene='board';state.presentation.audio.masterMuted=false;state.presentation.audio.reducedAudio=false;
state.presentation.animationsDisabled=false;state.presentation.reducedMotion=false;state.videoFeeds=[];state.d20=null;
const browser=await chromium.launch({headless:true,channel:'msedge',args:['--autoplay-policy=document-user-activation-required']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},timezoneId:'America/Los_Angeles'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.__gameAudio=[];
  const Native=window.AudioContext;
  window.AudioContext=class extends Native{
   constructor(...args){
    super(...args);this.monitor=this.createAnalyser();this.monitor.fftSize=2048;
    // Headless/enterprise browser policies can allow autoplay even with the
    // strict flag. Simulate a blocked probe until a real click, then measure
    // the actual native Web Audio graph for the subsequent roll.
    this.needsGesture=window.__audioGateUnlocked!==true;
    const silent=this.createGain();silent.gain.value=0;this.monitor.connect(silent).connect(super.destination);
    this.events=[];this.peak=0;window.__gameAudio.push(this);
    this.monitorTimer=setInterval(()=>{
     if(this.state==='closed'){clearInterval(this.monitorTimer);return}
     const buffer=new Float32Array(this.monitor.fftSize);this.monitor.getFloatTimeDomainData(buffer);
     this.peak=Math.max(this.peak,Math.sqrt(buffer.reduce((sum,value)=>sum+value*value,0)/buffer.length));
    },20);
   }
   get destination(){return this.monitor||super.destination}
   get state(){return this.needsGesture?'suspended':super.state}
   resume(){
    if(this.needsGesture&&!navigator.userActivation.isActive)return new Promise(()=>{});
    this.needsGesture=false;window.__audioGateUnlocked=true;const resumed=super.resume();queueMicrotask(()=>this.dispatchEvent(new Event('statechange')));return resumed;
   }
   createOscillator(){
    const oscillator=super.createOscillator(),start=oscillator.start.bind(oscillator);
    oscillator.start=at=>{this.events.push({type:oscillator.type,at,wall:Date.now()});return start(at)};return oscillator;
   }
  };
 });
 let socket;await page.routeWebSocket('**/ws?**',s=>{socket=s;s.send(JSON.stringify({event:'state.public',data:state}))});
 await page.goto(`${base}/#audience/${state.episodeId}`);
 const enable=page.getByRole('button',{name:'Enable game audio',exact:true});
 try{await enable.waitFor({timeout:4000})}catch(error){console.log(JSON.stringify({errors,audio:await page.evaluate(()=>window.__gameAudio.map(c=>({state:c.state,peak:c.peak}))),body:await page.locator('body').innerText()}));throw error}
 await enable.click();await enable.waitFor({state:'hidden'});
 const started=Date.now();
 state.presentation.programScene='d20';
 state.d20={result:12,mode:'question_selector',status:'rolling',effectName:'Question Selected',publicDescription:'Audio test',selectedSquare:{category:state.board[0].name,value:100},effectiveAwardXp:100,timerOverrideMs:null,stealEnabled:false,rolledAt:new Date().toISOString(),serverNow:new Date().toISOString(),animationDurationMs:2200,resultDisplayDurationMs:5000,autoReturn:false,theme:'holographic_scifi',soundEnabled:true,volume:.7};
 socket.send(JSON.stringify({event:'state.public',data:state}));
 await page.locator('.d20-board-roll.rolling canvas').waitFor();
 await page.waitForTimeout(1000);
 const rolling=await page.evaluate(()=>window.__gameAudio.filter(c=>c.events.length===0&&c.state==='running').map(c=>c.peak));
 assert(rolling.some(peak=>peak>.0001),`Felt rolling audio must contain a measurable signal: ${JSON.stringify(rolling)}`);
 await page.locator('.d20-board-roll.revealed').waitFor();
 const cues=await page.evaluate(()=>window.__gameAudio.flatMap(c=>c.events));
 const thud=cues.find(c=>c.type==='triangle'),notes=cues.filter(c=>c.type==='sine');
 assert(thud&&thud.wall>=started+2100,'Landing sound must wait until the rendered stop');
 assert.equal(notes.length,8,'Play the complete four-note flourish and its overtones');
 assert(notes.every(note=>note.wall>=thud.wall&&note.wall-thud.wall<50),'Schedule the flourish together with the number glow');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({autoplayUnlock:'passed (simulated blocked policy)',feltRollingPeak:Math.max(...rolling),landingAfterMs:thud.wall-started,flourishVoices:notes.length}));
}finally{await browser.close()}
