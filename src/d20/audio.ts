// Same soft ascending chime as the standalone Nerd Wars roller. The output
// gain is the game's existing D20 volume; context teardown cancels all voices.
export function scheduleLandingFlourish(ctx: AudioContext, output: AudioNode, at: number) {
  [523.25,659.25,783.99,1046.5].forEach((frequency,index) => {
    const start=at+index*.075;
    for(const [multiple,level] of [[1,.06],[2,.0047]]) {
      const voice=ctx.createOscillator(), envelope=ctx.createGain();
      voice.type='sine'; voice.frequency.setValueAtTime(frequency*multiple,start);
      envelope.gain.setValueAtTime(0,start);
      envelope.gain.linearRampToValueAtTime(level,start+.025);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+.78);
      envelope.gain.linearRampToValueAtTime(0,start+.85);
      voice.connect(envelope).connect(output); voice.start(start); voice.stop(start+.86);
      voice.addEventListener('ended',()=>{voice.disconnect();envelope.disconnect();},{once:true});
    }
  });
}

export function dieRollSound(durationMs: number, result: number, volume: number) {
  try {
    const Audio = window.AudioContext || (window as any).webkitAudioContext,
      ctx = new Audio(),
      master = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      seconds = Math.max(0.08, durationMs / 1000),
      level = Math.max(0, Math.min(1, volume)) * 0.32,
      sampleRate = ctx.sampleRate,
      noiseBuffer = ctx.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate),
      samples = noiseBuffer.getChannelData(0),
      noise = ctx.createBufferSource(),
      rattle = ctx.createGain();

    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    master.gain.value = level;
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.8;
    rattle.gain.setValueAtTime(0.0001, ctx.currentTime);

    // Irregular, increasingly spaced clacks make the die sound as though it is
    // losing momentum across a wood or laminate tabletop.
    let offset = 0.015;
    while (offset < seconds - 0.05) {
      const progress = offset / seconds,
        impact = ctx.currentTime + offset,
        strength = 0.2 + (1 - progress) * 0.45;
      rattle.gain.setValueAtTime(0.0001, impact);
      rattle.gain.linearRampToValueAtTime(strength, impact + 0.004);
      rattle.gain.exponentialRampToValueAtTime(0.0001, impact + 0.035);
      offset += 0.045 + progress * 0.13 + Math.random() * 0.035;
    }
    noise.buffer = noiseBuffer;
    noise.connect(filter).connect(rattle).connect(master).connect(ctx.destination);
    void ctx.resume().catch(() => {});
    noise.start();
    noise.stop(ctx.currentTime + seconds);

    const landing = ctx.currentTime + seconds - 0.025,
      thud = ctx.createOscillator(),
      thudGain = ctx.createGain();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(result === 1 ? 85 : 125, landing);
    thud.frequency.exponentialRampToValueAtTime(55, landing + 0.11);
    thudGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    thudGain.gain.setValueAtTime(0.8, landing);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, landing + 0.14);
    thud.connect(thudGain).connect(master);
    thud.start(landing);
    thud.stop(landing + 0.15);

    scheduleLandingFlourish(ctx, master, ctx.currentTime + seconds);

    const closeTimer = window.setTimeout(() => void ctx.close(), seconds * 1000 + 1400);
    return () => {
      window.clearTimeout(closeTimer);
      void ctx.close();
    };
  } catch {
    /* OBS may block audio until explicitly enabled */
  }
}
