import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 // Test only navigation; never connect a real host controller.
 await page.routeWebSocket('**/ws?**',()=>{});
 await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true}}));
 await page.goto('http://127.0.0.1:8787/#host/DEMO-EP-RUN');
 const nav=page.getByRole('navigation',{name:'Admin navigation'});
 await nav.waitFor();
 const expected=await nav.locator('a').allTextContents();
 for(const [label,route] of [['Question Library','library'],['Theme Designer','theme-designer'],['Episodes','episodes'],['New Episode','builder'],['Episode Controls','run/DEMO-EP-RUN'],['Host Console','host/DEMO-EP-RUN'],['Access Management','admin']]) {
  await nav.getByRole('link',{name:label,exact:true}).click();
  await page.waitForURL(`**/#${route}*`);
  await nav.waitFor();
  if(JSON.stringify(await nav.locator('a').allTextContents())!==JSON.stringify(expected))throw Error(`Inconsistent navigation on ${route}`);
  await nav.locator('a[aria-current="page"]').filter({hasText:label}).waitFor();
 }
 await nav.getByRole('link',{name:'Host Console',exact:true}).click();
 await page.waitForURL('**/#host/DEMO-EP-RUN');
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.querySelector('.admin-navigation').scrollWidth>innerWidth))throw Error('Mobile navigation overflows');
 await page.goto('http://127.0.0.1:8787/#play/TEST');
 await page.getByRole('heading',{name:'Join the game'}).waitFor();
 if(await nav.count())throw Error('Admin navigation leaked onto player screen');
 console.log('Shared admin links, active page, return-to-episode, mobile width, and player isolation passed.');
}finally{await browser.close();}
