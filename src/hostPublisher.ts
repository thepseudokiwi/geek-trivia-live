// Applied before the iframe loads, including restored publisher sessions.
// VDO's mute flag starts capture muted but still permits manual unmuting.
export function mutedHostPublisherUrl(raw:string):string {
 if(!raw)return '';
 const url=new URL(raw);
 url.searchParams.delete('muted');
 url.searchParams.set('mute','');
 return url.toString();
}
