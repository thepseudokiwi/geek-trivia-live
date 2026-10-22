import {describe,it,expect} from 'vitest';
import {readHostFraming,writeHostFraming,hostStreamUrl} from '../shared/hostFraming.js';
describe('host framing',()=>{
 const base='https://vdo.ninja/?view=test&cleanoutput=';
 it('defaults to a centered square crop beside the content',()=>expect(readHostFraming(base)).toMatchObject({fit:'fill',x:50,scale:100,insetX:6,insetY:22}));
 it('persists typography without reconnecting the stream',()=>{
  const settings={fit:'fill' as const,x:50,labelFont:'serif' as const,labelSize:150,labelColor:'#ffcc00',labelBackground:'#112233'};
  const url=writeHostFraming(base,settings);
  expect(readHostFraming(url)).toMatchObject(settings);
  expect(hostStreamUrl(url)).toBe(base);
 });
 it('rejects unsafe typography values',()=>expect(readHostFraming(base+'#nw-label-font=__proto__&nw-label-size=999&nw-label-color=red')).toMatchObject({labelFont:'theme',labelSize:200,labelColor:'#ffffff'}));
 it('persists framing without changing stream identity',()=>{
  const value=writeHostFraming(base,{fit:'fit',x:75});
  expect(readHostFraming(value)).toMatchObject({fit:'fit',x:75});
  expect(hostStreamUrl(value)).toBe(base);
 });
 it('bounds invalid positions',()=>{
  expect(readHostFraming(base+'#nw-scale=900&nw-inset-x=-5&nw-inset-y=90')).toMatchObject({scale:200,insetX:0,insetY:70});
  expect(readHostFraming(base+'#nw-x=500').x).toBe(100);
  expect(readHostFraming(base+'#nw-x=invalid').x).toBe(50);
 });
});
