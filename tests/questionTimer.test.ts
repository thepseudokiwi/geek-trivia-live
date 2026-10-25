import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QuestionTimer} from '../src/components/QuestionTimer.js';
import {defaultThemeConfig,themeConfigSchema} from '../shared/themeDesigner.js';

describe('question timer appearance',()=>{
  it('renders every configured style instead of forcing a circle',()=>{
    const config=defaultThemeConfig();
    for(const variant of ['digital','circular','horizontal-bar','vertical-bar','minimal','segmented']as const){
      config.timer.style=variant;
      const html=renderToStaticMarkup(createElement(QuestionTimer,{config,remainingMs:5000,durationMs:10000,status:'paused'}));
      expect(html).toContain(`data-timer-style="${variant}"`);
      expect(html).toContain(`timer-style-${variant}`);
      expect(html).toContain('5 seconds remaining');
      if(variant==='horizontal-bar')expect(html).toContain('width:50%');
      if(variant==='vertical-bar')expect(html).toContain('height:50%');
      if(variant==='segmented')expect(html.match(/class="filled"/g)).toHaveLength(5);
    }
  });
  it('uses separate frame and text size settings and preserves the expiry label',()=>{
    const config=defaultThemeConfig();config.timer.style='circular';config.timer.size=200;config.typography.timer.size=40;
    const render=(remainingMs:number)=>renderToStaticMarkup(createElement(QuestionTimer,{config,remainingMs,durationMs:10000,status:'paused'}));
    expect(render(10000)).toContain('width:calc(200 * var(--timer-unit)');
    expect(render(10000)).toContain('--timer-font-size:40');
    config.typography.timer.size=64;expect(render(10000)).toContain('--timer-font-size:64');
    expect(render(0)).toContain('TIME&#x27;S UP!');
  });
  it('passes text-only offsets without changing frame size and defaults old themes to zero',()=>{
    const config=defaultThemeConfig();config.timer.textOffsetX=12.5;config.timer.textOffsetY=-7;
    const html=renderToStaticMarkup(createElement(QuestionTimer,{config,remainingMs:5000,durationMs:10000,status:'paused'}));
    expect(html).toContain('--timer-text-offset-x:12.5');expect(html).toContain('--timer-text-offset-y:-7');
    const legacy=structuredClone(config)as any;delete legacy.timer.textOffsetX;delete legacy.timer.textOffsetY;
    expect(themeConfigSchema.parse(legacy).timer).toMatchObject({textOffsetX:0,textOffsetY:0});
    expect(themeConfigSchema.safeParse({...config,timer:{...config.timer,textOffsetX:61}}).success).toBe(false);
  });
});
