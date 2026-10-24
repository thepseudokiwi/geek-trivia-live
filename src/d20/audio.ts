// Same soft ascending chime as the standalone Nerd Wars roller. The output
// gain is the game's existing D20 volume; context teardown cancels all voices.
export function scheduleLandingFlourish(ctx: AudioContext, output: AudioNode, at: number) {
  [523.25,659.25,783.99,1046.5].forEach((frequency,index) => {
    const start=at+index*.075;
    for(const [multiple,level] of [[1,.15],[2,.009]]) {
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
      level = Math.max(0, Math.min(1, volume)) * 0.48,
      sampleRate = ctx.sampleRate,
      noiseBuffer = ctx.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate),
      samples = noiseBuffer.getChannelData(0),
      noise = ctx.createBufferSource(),
      rattle = ctx.createGain();

    // Brown-tinged noise through a low-pass filter gives fabric/felt texture,
    // rather than the bright, sharp clacks of a hard tabletop.
    let brown=0;
    for (let i = 0; i < samples.length; i++) {
      brown=(brown+.04*(Math.random()*2-1))/1.04;
      samples[i]=brown*3.5;
    }
    master.gain.value = level;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950,ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(420,ctx.currentTime+seconds);
    filter.Q.value = 0.55;
    rattle.gain.setValueAtTime(0.018, ctx.currentTime);

    // A soft rolling bed with rounded, increasingly spaced felt impacts.
    let offset = 0.015;
    while (offset < seconds - 0.05) {
      const progress = offset / seconds,
        impact = ctx.currentTime + offset,
        strength = 0.18 + (1 - progress) * 0.38,
        bed = .001 + (1-progress)*.018;
      rattle.gain.setValueAtTime(bed, impact);
      rattle.gain.linearRampToValueAtTime(strength, impact + 0.012);
      rattle.gain.exponentialRampToValueAtTime(bed, impact + 0.075);
      offset += 0.09 + progress * 0.15 + Math.random() * 0.035;
    }
    noise.buffer = noiseBuffer;
    noise.connect(filter).connect(rattle).connect(master).connect(ctx.destination);
    void ctx.resume().catch(() => {});
    const unlock=()=>{void ctx.resume().catch(()=>{});};
    if(typeof document!=='undefined')document.addEventListener('pointerdown',unlock);
    noise.start();
    noise.stop(ctx.currentTime + seconds);

    let stopped = false, landed = false;
    let closeTimer: number | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearTimeout(closeTimer);
      if(typeof document!=='undefined')document.removeEventListener('pointerdown',unlock);
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
        const requestedAt=Date.now();
        closeTimer = window.setTimeout(stop, 1400);
        void ctx.resume().then(() => {
          // A blocked tab must not play a stale flourish long after the glow.
          if (stopped || Date.now()-requestedAt>450) return;
          const landing = ctx.currentTime,
            thud = ctx.createOscillator(), thudGain = ctx.createGain();
          thud.type = 'triangle';
          thud.frequency.setValueAtTime(result === 1 ? 85 : 125, landing);
          thud.frequency.exponentialRampToValueAtTime(55, landing + .11);
          thudGain.gain.setValueAtTime(.35, landing);
          thudGain.gain.exponentialRampToValueAtTime(.0001, landing + .14);
          thud.connect(thudGain).connect(master);
          thud.start(landing); thud.stop(landing + .15);
          scheduleLandingFlourish(ctx, master, landing);
        }).catch(() => {});
      },
    };
  } catch {
    /* OBS may block audio until explicitly enabled */
  }
}
