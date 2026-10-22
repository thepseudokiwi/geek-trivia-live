import {expect,it} from 'vitest';
import {mutedHostPublisherUrl} from '../src/hostPublisher.js';
it('starts new and restored host publishers muted without disabling mic capture',()=>{
 for(const raw of ['https://vdo.ninja/?push=test&autostart','https://vdo.ninja/?push=test&mute=false&muted=false']){
  const result=new URL(mutedHostPublisherUrl(raw));
  expect(result.searchParams.get('push')).toBe('test');
  expect(result.searchParams.get('mute')).toBe('');
  expect(result.searchParams.has('muted')).toBe(false);
  expect(result.searchParams.has('audiodevice')).toBe(false);
  expect(mutedHostPublisherUrl(result.toString())).toBe(result.toString());
 }
});
