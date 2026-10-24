import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dieTopology } from '../src/d20/topology.ts';

const base=process.env.D20_CHECK_URL||'https://geek-trivia-live.onrender.com';
const episode=process.env.D20_CHECK_EPISODE||'DEMO-EP-RUN';
const state=await fetch(`${base}/api/live/${episode}/public`).then(r=>{assert(r.ok,'Public preview state must load');return r.json()});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
  const page=await browser.newPage({viewport:{width:2560,height:1271},deviceScaleFactor:1.5});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(vertices=>{
    window.__dieFrames=[];
    const proto=WebGL2RenderingContext.prototype;
    const locations=new WeakMap(), matrices=new WeakMap();
    const getLocation=proto.getUniformLocation;
    proto.getUniformLocation=function(program,name){const location=getLocation.call(this,program,name);if(location)locations.set(location,name);return location;};
    const setMatrix=proto.uniformMatrix4fv;
    proto.uniformMatrix4fv=function(location,transpose,value,...rest){
      const name=locations.get(location);
      if(name==='projectionMatrix'||name==='modelViewMatrix'){
        let entry=matrices.get(this);if(!entry){entry={};matrices.set(this,entry)}entry[name]=Array.from(value);
      }
      return setMatrix.call(this,location,transpose,value,...rest);
    };
    const transform=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[i+4]*v[1]+m[i+8]*v[2]+m[i+12]*v[3]);
    for(const name of ['drawArrays','drawElements']){
      const draw=proto[name];
      proto[name]=function(...args){
        const count=name==='drawArrays'?args[2]:args[1];
        const entry=matrices.get(this);
        if(count>100&&entry?.projectionMatrix&&entry?.modelViewMatrix&&this.getParameter(this.FRAMEBUFFER_BINDING)===null){
          const points=vertices.map(v=>transform(entry.projectionMatrix,transform(entry.modelViewMatrix,[...v,1]))).map(p=>[p[0]/p[3],p[1]/p[3]]);
          const rect=this.canvas.getBoundingClientRect();
          window.__dieFrames.push({at:performance.now(),minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1])),canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},pixels:this.drawingBufferWidth*this.drawingBufferHeight,projection:entry.projectionMatrix.slice()});
        }
        return draw.apply(this,args);
      };
    }
  },dieTopology.vertices.map(v=>v.toArray()));
  state.presentation.programScene='board';state.presentation.transition.kind='cut';
  state.videoFeeds=[];state.timer.status='idle';state.d20=null;
  await mkdir('.local/d20-viewport-check',{recursive:true});
  let socket;
  await page.routeWebSocket('**/ws?**',s=>{socket=s;s.send(JSON.stringify({event:'state.public',data:state}))});
  await page.goto(`${base}/#audience/${episode}`);
  await page.locator('.board-position').waitFor();
  for(let attempt=0;attempt<4;attempt++){
    state.presentation.programScene='d20';
    state.d20={result:10+attempt,mode:'question_selector',status:'rolling',effectName:'Question Selected',publicDescription:'Viewport check',selectedSquare:{category:state.board[0].name,value:100},effectiveAwardXp:100,timerOverrideMs:null,stealEnabled:false,rolledAt:new Date().toISOString(),animationDurationMs:3500,resultDisplayDurationMs:5000,autoReturn:false,theme:'holographic_scifi',soundEnabled:false,volume:0};
    await page.evaluate(()=>{window.__dieFrames=[]});
    socket.send(JSON.stringify({event:'state.public',data:state}));
    await page.locator('.d20-board-roll.rolling canvas').waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({path:`.local/d20-viewport-check/moving-${attempt}.jpg`});
    if(attempt===1)await page.setViewportSize({width:1920,height:540});
    if(attempt===2)await page.setViewportSize({width:1280,height:960});
    await page.locator('.d20-board-roll.revealed').waitFor();
    const frames=await page.evaluate(()=>window.__dieFrames);
    const active=frames.filter(f=>f.canvas.width>0);
    const clipped=active.filter(f=>Math.max(-f.minX,f.maxX,-f.minY,f.maxY)>.96);
    const gaps=frames.slice(1).map((f,i)=>f.at-frames[i].at).sort((a,b)=>a-b);
    console.log(JSON.stringify({attempt,frames:active.length,clipped:clipped.length,firstClipped:clipped[0],frameTime95:gaps[Math.floor(gaps.length*.95)],maxPixels:Math.max(...active.map(f=>f.pixels)),cameraResets:active.filter(f=>Math.abs(f.projection[0]-.1)>.00001).length}));
    assert(frames.length>10,'Must observe actual rendered mesh matrices');
    assert.equal(clipped.length,0,'Every rendered die face must stay in the real camera');
    assert(active.every(f=>Math.abs(f.projection[0]-.1)<.00001),'World-space camera must never reset to a pixel-space frustum');
    assert(active.every(f=>f.pixels<=1_810_000),'High-DPI dice layer must stay within its rendering budget');
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close()}
