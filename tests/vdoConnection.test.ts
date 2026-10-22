import { expect, it } from 'vitest';
import { vdoConnectionState } from '../src/vdoConnection.js';
it('recognizes an already connected stream from the stream list',()=>{expect(vdoConnectionState({streamIDs:{stream:'Host'}})).toBe(true)});
it('hides disconnected streams even when a stream ID accompanies the event',()=>{expect(vdoConnectionState({action:'view-connection',value:false,streamID:'host'})).toBe(false);expect(vdoConnectionState({streamIDs:{}})).toBe(false)});
it('does not mistake a requested stream or signaling connection for live video',()=>{expect(vdoConnectionState({action:'requested-stream',streamID:'host'})).toBeUndefined();expect(vdoConnectionState({action:'hss-connection',value:'connected'})).toBeUndefined()});
