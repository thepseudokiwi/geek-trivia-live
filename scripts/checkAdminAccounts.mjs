import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 const owner={id:'owner',email:'owner@example.com',displayName:'Owner',role:'administrator',disabled:false};
 await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountMode:true,user:owner}}));
 await page.route('**/api/admin/users',route=>route.fulfill({json:{users:[owner,{...owner,id:'host',email:'host@example.com',displayName:'Host',role:'host'}],invitations:[]}}));
 await page.route('**/api/admin/invitations',route=>route.fulfill({json:{token:'isolated-test-token',expiresAt:Date.now()+86400000}}));
 await page.goto('http://127.0.0.1:8787/#admin');
 await page.getByRole('heading',{name:'Access Management',exact:true}).waitFor();
 await page.getByLabel('Email',{exact:true}).fill('invited@example.com');
 await page.getByRole('button',{name:'Create invitation'}).click();
 await page.getByRole('heading',{name:'Private setup link'}).waitFor();
 if(!(await page.getByLabel('Private setup link').inputValue()).endsWith('#admin-setup/isolated-test-token'))throw Error('Missing private link');
 await page.route('**/api/auth/invitation',route=>route.fulfill({json:{email:'invited@example.com',kind:'invite',role:'host'}}));
 await page.route('**/api/auth/accept-invitation',route=>route.fulfill({json:{email:'invited@example.com'}}));
 await page.goto('http://127.0.0.1:8787/#admin-setup/isolated-test-token');
 await page.getByLabel('Display name').fill('Invited Host');
 await page.getByLabel('Password (at least 15 characters)',{exact:true}).fill('this is an isolated test password');
 await page.getByLabel('Confirm password',{exact:true}).fill('this is an isolated test password');
 await page.getByRole('button',{name:'Save password'}).click();
 await page.getByRole('heading',{name:'Account ready'}).waitFor();
 if(page.url().includes('isolated-test-token'))throw Error('Setup token left in address bar');
 console.log('Admin management, invitation link, setup form, and token cleanup passed. No live accounts changed.');
}finally{await browser.close();}
