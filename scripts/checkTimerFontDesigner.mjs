import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {defaultThemeConfig} from '../shared/themeDesigner.ts';

// All API calls are isolated fixtures, including save/publish. Never modifies
// real themes or authenticates against a deployed admin account.
const base=process.env.TIMER_FONT_CHECK_URL||'http://127.0.0.1:8799';
const config=defaultThemeConfig('Timer Font Preview');
let theme={id:'timer-font-preview',name:config.metadata.name,description:'',isBuiltin:false,status:'published',revision:1,publishedVersion:1,hasDraftChanges:false,draft:config,published:structuredClone(config),versions:[]};
let saves=0,publishes=0;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method();let body;
  if(path==='/api/auth/session')body={authenticated:true,accountMode:true,role:'admin'};
  else if(path==='/api/presentation/assets')body=[];
  else if(path==='/api/theme-designer/google-fonts')body=[{family:'Roboto',category:'sans-serif',variants:['regular']}];
  else if(path==='/api/theme-designer/themes')body=[theme];
  else if(path===`/api/theme-designer/themes/${theme.id}`)body=theme;
  else if(path.endsWith('/draft')&&method==='PUT'){
   theme={...theme,draft:request.postDataJSON(),hasDraftChanges:true,revision:theme.revision+1};saves++;body=theme;
  }else if(path.endsWith('/publish')&&method==='POST'){
   theme={...theme,published:structuredClone(theme.draft),hasDraftChanges:false,publishedVersion:theme.publishedVersion+1};publishes++;body=theme;
  }else throw new Error(`Unexpected test API request: ${method} ${path}`);
  await route.fulfill({json:body});
 });
 await page.goto(`${base}/#theme-designer/${theme.id}`);
 await page.locator('.designer-navigation').getByRole('button',{name:'Timer',exact:true}).click();
 const picker=page.getByLabel('Timer font family',{exact:true});
 assert(await picker.locator('option').count()>6,'Offer system fonts and the existing font catalog');
 await picker.selectOption('Georgia, serif');
 await page.getByRole('button',{name:'Preview question timer',exact:true}).click();
 await page.locator('.broadcast-timer-value').waitFor();
 assert.match(await page.locator('.broadcast-timer-value').evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
 const textSize=page.getByLabel('Timer text size',{exact:true}),frameSize=page.getByLabel('Timer size',{exact:true});
 await textSize.fill('40');await frameSize.fill('180');
 for(const variant of ['digital','circular','horizontal-bar','vertical-bar','minimal','segmented']){
  await page.getByLabel('Timer style',{exact:true}).selectOption(variant);
  await page.locator(`.broadcast-timer[data-timer-style="${variant}"]`).waitFor();
  const appearance=await page.locator('.broadcast-timer').evaluate(el=>{const box=el.getBoundingClientRect(),css=getComputedStyle(el);return{width:box.width,height:box.height,radius:css.borderRadius,border:css.borderTopWidth}});
  if(variant==='circular'){assert.equal(appearance.radius,'50%');assert(Math.abs(appearance.width-appearance.height)<1)}
  if(variant==='minimal')assert.equal(appearance.border,'0px');
  if(variant==='horizontal-bar')assert(appearance.width>appearance.height*2);
  if(variant==='vertical-bar')assert(appearance.height>appearance.width*2);
  if(variant.includes('bar'))assert.equal(await page.locator('.timer-progress-track').count(),1);
  if(variant==='segmented')assert.equal(await page.locator('.timer-segments i').count(),10);
 }
 await page.getByLabel('Timer style',{exact:true}).selectOption('circular');
 const small=await page.locator('.broadcast-timer').boundingBox();
 await frameSize.fill('260');
 const large=await page.locator('.broadcast-timer').boundingBox();
 assert(large.width>small.width*1.3,'Timer size must resize the actual frame');
 const smallFont=await page.locator('.broadcast-timer-value').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 await textSize.fill('64');
 const largeFont=await page.locator('.broadcast-timer-value').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 assert(largeFont>smallFont*1.5,'Text size must change the actual rendered font');
 const xOffset=page.getByLabel('Timer text horizontal offset',{exact:true}),yOffset=page.getByLabel('Timer text vertical offset',{exact:true});
 const originalFrame=await page.locator('.broadcast-timer').boundingBox();
 await xOffset.fill('12.5');await yOffset.fill('-7');
 await expect(page.locator('.broadcast-timer-value')).toHaveCSS('transform','matrix(1, 0, 0, 1, 12.5, -11)');
 const translation=await page.locator('.broadcast-timer-value').evaluate(el=>{const matrix=new DOMMatrixReadOnly(getComputedStyle(el).transform);return{x:matrix.m41,y:matrix.m42}});
 assert(Math.abs(translation.x-12.5)<.01&&Math.abs(translation.y+11)<.01,'Text must move independently in both axes');
 const shiftedFrame=await page.locator('.broadcast-timer').boundingBox();
 for(const key of ['x','y','width','height'])assert(Math.abs(originalFrame[key]-shiftedFrame[key])<.1,'Moving text must not move or resize its frame');
 for(const [variant,baseline] of [['digital',-4],['circular',-4],['horizontal-bar',-1],['vertical-bar',-4],['minimal',-4],['segmented',-8]]){
  await page.getByLabel('Timer style',{exact:true}).selectOption(variant);
  await expect(page.locator('.broadcast-timer-value')).toHaveCSS('transform',`matrix(1, 0, 0, 1, 12.5, ${baseline-7})`);
 }
 await page.getByLabel('Timer style',{exact:true}).selectOption('circular');
 await page.getByRole('button',{name:'Reset text position',exact:true}).click();
 await expect(xOffset).toHaveValue('0');await expect(yOffset).toHaveValue('0');
 await xOffset.fill('9');await yOffset.fill('');await yOffset.pressSequentially('-5');
 await page.locator('.designer-navigation').getByRole('button',{name:'Typography',exact:true}).click();
 assert.equal(await page.getByLabel('Timer font family',{exact:true}).inputValue(),'Georgia, serif','Both sections edit the same setting');
 await page.locator('.designer-navigation').getByRole('button',{name:'Timer',exact:true}).click();
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Changes saved'}).waitFor();
 assert.equal(saves,1);assert.equal(theme.draft.typography.timer.fontFamily,'Georgia, serif');
 assert.equal(theme.draft.timer.style,'circular');assert.equal(theme.draft.timer.size,260);assert.equal(theme.draft.typography.timer.size,64);
 assert.equal(theme.draft.timer.textOffsetX,9);assert.equal(theme.draft.timer.textOffsetY,-5);
 await page.getByRole('button',{name:'Publish',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Published.'}).waitFor();
 assert.equal(publishes,1);assert.equal(theme.published.typography.timer.fontFamily,'Georgia, serif');
 await page.getByLabel('Sample data').selectOption('timer-expired');
 assert.match(await page.locator('.broadcast-timer.expired .broadcast-timer-value').evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
 const expiredTranslation=await page.locator('.broadcast-timer-value').evaluate(el=>{const matrix=new DOMMatrixReadOnly(getComputedStyle(el).transform);return{x:matrix.m41,y:matrix.m42}});
 assert(Math.abs(expiredTranslation.x-9)<.01&&Math.abs(expiredTranslation.y+6)<.01,'Offsets also apply to TIME\'S UP');
 await mkdir('.local/timer-font-designer',{recursive:true});
 await page.screenshot({path:'.local/timer-font-designer/timer-font-control.jpg'});
 await page.reload();
 await page.locator('.designer-navigation').getByRole('button',{name:'Timer',exact:true}).click();
 assert.equal(await picker.inputValue(),'Georgia, serif','Saved font survives a designer reload');
 assert.equal(await page.getByLabel('Timer style',{exact:true}).inputValue(),'circular');
 assert.equal(await page.getByLabel('Timer size',{exact:true}).inputValue(),'260');
 assert.equal(await page.getByLabel('Timer text size',{exact:true}).inputValue(),'64');
 assert.equal(await xOffset.inputValue(),'9');assert.equal(await yOffset.inputValue(),'-5');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({timerFontSelector:'passed',styles:6,frameSize:'passed',textSize:'passed',textPosition:'passed',resetPosition:'passed',expiryPosition:'passed',preview:'passed',typographySync:'passed',saves,publishes,reload:'passed',errors}));
}finally{await browser.close()}
