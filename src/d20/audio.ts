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

    let stopped = false, landed = false;
    let closeTimer: number | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(closeTimer);
      void ctx.close().catch(() => {});
    };
    return {
      stop,
      // The rendered final frame owns the landing cue, not an audio timer.
      land() {
        if (landed || stopped) return;
        landed = true;
        try { noise.stop(); } catch { /* The rattle may already have finished. */ }
        rattle.gain.cancelScheduledValues(ctx.currentTime);
        rattle.gain.setValueAtTime(0, ctx.currentTime);
        void ctx.resume().then(() => {
          if (stopped) return;
          const landing = ctx.currentTime,
            thud = ctx.createOscillator(), thudGain = ctx.createGain();
          thud.type = 'triangle';
          thud.frequency.setValueAtTime(result === 1 ? 85 : 125, landing);
          thud.frequency.exponentialRampToValueAtTime(55, landing + .11);
          thudGain.gain.setValueAtTime(.8, landing);
          thudGain.gain.exponentialRampToValueAtTime(.0001, landing + .14);
          thud.connect(thudGain).connect(master);
          thud.start(landing); thud.stop(landing + .15);
          scheduleLandingFlourish(ctx, master, landing);
          closeTimer = window.setTimeout(stop, 1400);
        }).catch(() => {});
      },
    };
  } catch {
    /* OBS may block audio until explicitly enabled */
  }
}
