// VDO.Ninja may report an already-running stream via getStreamIDs rather than
// repeating the original connection event when a viewer is embedded later.
export function vdoConnectionState(data: unknown): boolean | undefined {
 if(!data || typeof data !== 'object') return undefined;
 const message = data as Record<string, unknown>;
 if(['view-connection','push-connection'].includes(String(message.action)) && typeof message.value === 'boolean') return message.value;
 if(message.action === 'guest-connected') return true;
 if(message.streamIDs && typeof message.streamIDs === 'object') return Object.keys(message.streamIDs).length > 0;
 if(typeof message.connected === 'boolean') return message.connected;
 return undefined;
}
