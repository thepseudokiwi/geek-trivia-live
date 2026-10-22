import { lazy, Suspense, useEffect, useState } from "react";
import { dieRollSound } from "../d20/audio";
import { elapsedRollMs } from "../d20/timing";
import type { PublicD20State } from "../../shared/types";
const D20Three=lazy(()=>import('./D20Three').then(module=>({default:module.D20Three})));
function boardRollPath(key:string){
  let seed=2166136261;
  for(const char of key)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const direction=random()>.5?1:-1,start=direction*(32+Math.round(random()*10)),drift=(random()-.5)*12;
  return{'--roll-start-x':`${start}vw`,'--roll-x2':`${start*.66+drift}vw`,'--roll-x3':`${start*.43+drift*.7}vw`,'--roll-x4':`${start*.25+drift*.4}vw`,'--roll-x5':`${start*.12}vw`,'--roll-x6':`${start*.045}vw`};
}
type Props = { roll: PublicD20State; onDone?:()=>void; reducedMotion?:boolean };
export function D20Presentation(props: Props) { return <D20Roll key={props.roll.rolledAt} {...props}/>; }
function D20Roll({ roll,onDone,reducedMotion=false }: Props) {
  const elapsed = elapsedRollMs(roll.rolledAt,roll.animationDurationMs),
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
  }, [roll.rolledAt, roll.result, roll.soundEnabled, roll.volume]);
  useEffect(()=>{if(!roll.autoReturn||!onDone)return;const total=roll.animationDurationMs+roll.resultDisplayDurationMs,timer=setTimeout(onDone,Math.max(0,total-elapsed));return()=>clearTimeout(timer)},[roll.rolledAt,roll.autoReturn]);
  const reduced=reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const path=boardRollPath(roll.rolledAt);
  return (
    <main
      className={`d20-public theme-${roll.theme} ${landed ? "landed" : "rolling"} natural-${roll.result}`}
      style={
        {
          "--roll-duration": `${roll.animationDurationMs}ms`,
          "--d20-glow-delay": `${-Math.max(0,elapsed-roll.animationDurationMs)}ms`,
          ...path,
        } as React.CSSProperties
      }
      aria-live="assertive"
    >
      {landed&&roll.result===20&&<div className="natural20-energy" aria-hidden="true"><i className="energy-ring ring-one"/><i className="energy-ring ring-two"/><i className="energy-core"/>{Array.from({length:24},(_,index)=><b key={index} style={{"--spark-angle":`${index*15}deg`,"--spark-delay":`${(index%6)*.055}s`,"--spark-distance":`${24+(index%5)*5}vmin`} as React.CSSProperties}/>)}</div>}
      {reduced?<div className="d20-webgl-fallback" role="img" aria-label={`D20 result ${roll.result}`}>{roll.result}</div>:<Suspense fallback={<div className="d20-webgl-fallback">{roll.result}</div>}><D20Three result={roll.result} theme={roll.theme} durationMs={roll.animationDurationMs} rolledAt={roll.rolledAt} onLanded={()=>setLanded(true)}/></Suspense>}
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
