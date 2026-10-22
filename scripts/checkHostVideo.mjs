import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
 const page = await browser.newPage();
 await page.addInitScript(()=>{window.videoEvents=[];addEventListener('message',event=>{if(event.origin==='https://vdo.ninja')window.videoEvents.push({action:event.data?.action,keys:Object.keys(event.data??{}),value:typeof event.data?.value==='boolean'?event.data.value:typeof event.data?.value})});});
 await page.goto('http://127.0.0.1:8787/#audience/8eba4816-abc7-40f9-8772-f3837d184473');
 await page.waitForTimeout(12000);
 console.log(JSON.stringify({host:await page.locator('.production-host-slot').count(),classes:await page.locator('.production-host-slot .production-video').getAttribute('class'),events:await page.evaluate(()=>window.videoEvents)},null,2));
 for(const frame of page.frames())if(frame.url().startsWith('https://vdo.ninja'))console.log(JSON.stringify(await frame.evaluate(()=>({secure:isSecureContext,videos:[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,width:v.videoWidth,paused:v.paused})),text:document.body.innerText.slice(0,250)}))));
}finally{await browser.close();}
