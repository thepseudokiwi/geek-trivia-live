import { lazy, Suspense, useEffect, useState } from "react";
import type { PublicD20State } from "../../shared/types";
const D20Three=lazy(()=>import('./D20Three').then(module=>({default:module.D20Three})));
function boardRollPath(key:string){
  let seed=2166136261;
  for(const char of key)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const direction=random()>.5?1:-1,start=direction*(32+Math.round(random()*10)),drift=(random()-.5)*12;
  return{'--roll-start-x':`${start}vw`,'--roll-x2':`${start*.66+drift}vw`,'--roll-x3':`${start*.43+drift*.7}vw`,'--roll-x4':`${start*.25+drift*.4}vw`,'--roll-x5':`${start*.12}vw`,'--roll-x6':`${start*.045}vw`};
}
function dieRollSound(durationMs: number, result: number, volume: number) {
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

    const chime = ctx.createOscillator(),
      chimeGain = ctx.createGain();
    chime.type = "sine";
    chime.frequency.setValueAtTime(result === 20 ? 1047 : result === 1 ? 220 : 660, landing);
    chimeGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    chimeGain.gain.setValueAtTime(result === 20 ? 0.65 : 0.38, landing);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, landing + 0.28);
    chime.connect(chimeGain).connect(master);
    chime.start(landing);
    chime.stop(landing + 0.3);

    const closeTimer = window.setTimeout(() => void ctx.close(), seconds * 1000 + 350);
    return () => {
      window.clearTimeout(closeTimer);
      void ctx.close();
    };
  } catch {
    /* OBS may block audio until explicitly enabled */
  }
}
export function D20Presentation({ roll,onDone }: { roll: PublicD20State;onDone?:()=>void }) {
  const elapsed = Math.max(0, Date.now() - Date.parse(roll.rolledAt)),
    [landed, setLanded] = useState(elapsed >= roll.animationDurationMs);
  useEffect(() => {
    const remaining = Math.max(0, roll.animationDurationMs - elapsed),
      stopSound = roll.soundEnabled && remaining > 0
        ? dieRollSound(remaining, roll.result, roll.volume)
        : undefined;
    if (remaining <= 0) {
      setLanded(true);
      return stopSound;
    }
    setLanded(false);
    const timer = setTimeout(
      () => setLanded(true),
      remaining,
    );
    return () => {
      clearTimeout(timer);
      stopSound?.();
    };
  }, [roll.rolledAt, roll.result]);
  useEffect(()=>{if(!roll.autoReturn||!onDone)return;const total=roll.animationDurationMs+roll.resultDisplayDurationMs,timer=setTimeout(onDone,Math.max(0,total-elapsed));return()=>clearTimeout(timer)},[roll.rolledAt,roll.autoReturn]);
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const path=boardRollPath(roll.rolledAt);
  return (
    <main
      className={`d20-public theme-${roll.theme} ${landed ? "landed" : "rolling"} natural-${roll.result}`}
      style={
        {
          "--roll-duration": `${roll.animationDurationMs}ms`,
          ...path,
        } as React.CSSProperties
      }
      aria-live="assertive"
    >
      {landed&&roll.result===20&&<div className="natural20-energy" aria-hidden="true"><i className="energy-ring ring-one"/><i className="energy-ring ring-two"/><i className="energy-core"/>{Array.from({length:24},(_,index)=><b key={index} style={{"--spark-angle":`${index*15}deg`,"--spark-delay":`${(index%6)*.055}s`,"--spark-distance":`${24+(index%5)*5}vmin`} as React.CSSProperties}/>)}</div>}
      {reduced?<div className="d20-webgl-fallback" role="img" aria-label={`D20 result ${roll.result}`}>{roll.result}</div>:<Suspense fallback={<div className="d20-webgl-fallback">{roll.result}</div>}><D20Three result={roll.result} theme={roll.theme} durationMs={Math.max(1,roll.animationDurationMs-elapsed)} onLanded={()=>setLanded(true)}/></Suspense>}
      {landed&&<strong className="d20-result-readout">{roll.result}</strong>}
      <h2>{landed ? roll.effectName : "Rolling D20…"}</h2>
      {landed && (
        <>
          <p>{roll.publicDescription}</p>
          {roll.selectedSquare && (
            <p className="selected-square">
              {roll.selectedSquare.category} · {roll.selectedSquare.value} XP
            </p>
          )}
          {roll.effectiveAwardXp && (
            <p className="modified-xp">
              Potential award: {roll.effectiveAwardXp} XP
            </p>
          )}
          {roll.timerOverrideMs && (
            <p>Speed timer: {roll.timerOverrideMs / 1000} seconds</p>
          )}
          {roll.stealEnabled && <p>STEAL ENABLED</p>}
        </>
      )}
    </main>
  );
}
