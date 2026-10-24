import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=process.env.TIMER_CHECK_URL||'http://127.0.0.1:8799';
const episode='8eba4816-abc7-40f9-8772-f3837d184473';
const state=await fetch(`${base}/api/live/${episode}/public`).then(r=>{assert(r.ok);return r.json()});
state.presentation.programScene='question';state.presentation.transition.kind='cut';state.presentation.audio.masterMuted=true;
state.d20=null;state.videoFeeds=[];
state.question={category:'Timer layout check',value:100,text:'Question timer alignment preview'};
state.timer.status='paused';state.timer.remainingMs=10000;
state.presentation.theme.designer.timer.size=180;state.presentation.theme.designer.typography.timer.size=48;
const browser=await chromium.launch({headless:true,channel:'msedge'});
await mkdir('.local/question-timer-check',{recursive:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let socket;await page.routeWebSocket('**/ws?**',s=>{socket=s;s.send(JSON.stringify({event:'state.public',data:state}))});
 await page.goto(`${base}/#audience/${episode}`);
 await page.locator('.broadcast-timer-value').waitFor();
 for(const variant of ['digital','circular','horizontal-bar','vertical-bar','minimal','segmented']){
 state.presentation.theme.designer.timer.style=variant;
 for(const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:640,height:480}]){
  await page.setViewportSize(viewport);
  for(const expired of [false,true]){
   state.timer.status=expired?'expired':'paused';state.timer.remainingMs=expired?0:10000;
   socket.send(JSON.stringify({event:'state.public',data:state}));
   await page.locator(`.broadcast-timer${expired?'.expired':'.paused'}`).waitFor();
   const fit=await page.locator('.broadcast-timer').evaluate(timer=>{
    const value=timer.querySelector('.broadcast-timer-value'),circle=timer.getBoundingClientRect(),text=value.getBoundingClientRect();
    return{circle:circle.toJSON(),text:text.toJSON(),card:timer.closest('.broadcast-question').getBoundingClientRect().toJSON(),fontSize:getComputedStyle(value).fontSize,transform:getComputedStyle(value).transform,textContent:value.textContent};
   });
   if(variant==='circular')assert(Math.abs(fit.circle.width-fit.circle.height)<1,'Circular timer stays circular');
   assert(fit.text.x>=fit.circle.x&&fit.text.y>=fit.circle.y&&fit.text.right<=fit.circle.right&&fit.text.bottom<=fit.circle.bottom,'All timer text stays inside its circle');
   assert(fit.circle.x>=fit.card.x&&fit.circle.right<=fit.card.right,'Wide timer styles stay inside the question card');
   if(expired){assert.equal(fit.textContent,"TIME'S UP!");assert(parseFloat(fit.fontSize)<=20)}
   else if(variant==='circular')assert.equal(fit.transform,'matrix(1, 0, 0, 1, 0, -4)');
   await page.screenshot({path:`.local/question-timer-check/${variant}-${expired?'expired':'countdown'}-${viewport.width}.jpg`});
   console.log(JSON.stringify({variant,viewport,expired,fontSize:fit.fontSize,width:fit.circle.width,height:fit.circle.height}));
  }
 }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
