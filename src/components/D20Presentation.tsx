import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { dieRollSound } from "../d20/audio";
import { createRollClock, resultRevealDelayMs } from "../d20/timing";
import type { PublicD20State } from "../../shared/types";
const D20Three=lazy(()=>import('./D20Three').then(module=>({default:module.D20Three})));
type Props = { roll: PublicD20State; onDone?:()=>void; reducedMotion?:boolean; space?:'tray'|'board' };
export function D20Presentation(props: Props) { return <D20Roll key={props.roll.rolledAt} {...props}/>; }
function D20Roll({ roll,onDone,reducedMotion=false,space='tray' }: Props) {
  const [rollElapsed] = useState(()=>createRollClock(roll.rolledAt,roll.animationDurationMs,roll.serverNow));
  const elapsed = rollElapsed();
  const [landedAt, setLandedAt] = useState<number|null>(() => elapsed >= roll.animationDurationMs ? Date.now() - (elapsed - roll.animationDurationMs) : null);
  const [revealed, setRevealed] = useState(elapsed >= roll.animationDurationMs + resultRevealDelayMs);
  const landed = landedAt !== null;
  const landing = useRef(landedAt);
  const audio = useRef<ReturnType<typeof dieRollSound>>(undefined);
  const reduced=reducedMotion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const confirmLanding = useCallback((at:number) => {
    if (landing.current !== null) return;
    landing.current = at;
    audio.current?.land();
    setLandedAt(at);
  }, []);
  const [celebrating, setCelebrating] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  const hasDone = Boolean(onDone);
  useEffect(() => {
    const remaining = Math.max(0, roll.animationDurationMs - rollElapsed()),
      controller = roll.soundEnabled && remaining > 0
        ? dieRollSound(remaining, roll.result, roll.volume)
        : undefined;
    audio.current = controller;
    return () => {
      controller?.stop();
      if (audio.current === controller) audio.current = undefined;
    };
  }, [rollElapsed, roll.rolledAt, roll.animationDurationMs, roll.result, roll.soundEnabled, roll.volume]);
  useEffect(() => {
    if (!reduced || landedAt !== null) return;
    const remaining = Math.max(0, roll.animationDurationMs - rollElapsed());
    const timer = setTimeout(() => confirmLanding(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [rollElapsed, reduced, landedAt, roll.rolledAt, roll.animationDurationMs, confirmLanding]);
  useEffect(() => {
    if (landedAt === null) return;
    const remaining = Math.max(0, landedAt + resultRevealDelayMs - Date.now());
    if (!remaining) { setRevealed(true); return; }
    const timer = setTimeout(() => setRevealed(true), remaining);
    return () => clearTimeout(timer);
  }, [landedAt]);
  useEffect(()=>{
    if (!revealed || roll.result !== 20) { setCelebrating(false); return; }
    const remaining = roll.animationDurationMs + 5000 - rollElapsed();
    setCelebrating(remaining > 0);
    if (remaining <= 0) return;
    const timer = setTimeout(() => setCelebrating(false), remaining);
    return () => clearTimeout(timer);
  }, [rollElapsed, revealed, roll.result, roll.rolledAt, roll.animationDurationMs]);
  useEffect(()=>{
    if(!roll.autoReturn||!hasDone)return;
    const total=roll.animationDurationMs+roll.resultDisplayDurationMs;
    const timer=setTimeout(()=>done.current?.(),Math.max(0,total-rollElapsed()));
    return()=>clearTimeout(timer);
  },[rollElapsed,roll.rolledAt,roll.animationDurationMs,roll.resultDisplayDurationMs,roll.autoReturn,hasDone]);
  const details = <>
    <h2>{revealed ? roll.effectName : landed ? 'Lighting up the number…' : 'Rolling D20…'}</h2>
    {revealed && <>
      <p>{roll.publicDescription}</p>
      {roll.selectedSquare && <p className="selected-square">{roll.selectedSquare.category} · {roll.selectedSquare.value} XP</p>}
      {roll.effectiveAwardXp != null && <p className="modified-xp">Potential award: {roll.effectiveAwardXp} XP</p>}
      {roll.timerOverrideMs != null && <p>Speed timer: {roll.timerOverrideMs / 1000} seconds</p>}
      {roll.stealEnabled && <p>STEAL ENABLED</p>}
    </>}
  </>;
  return (
    <main
      className={`d20-public ${space==='board'?'d20-board-roll':''} ${reduced?'d20-reduced-motion':''} theme-${roll.theme} ${landed ? "landed" : "rolling"} ${revealed?'revealed':''} natural-${roll.result}`}
      style={
        {
          "--roll-duration": `${roll.animationDurationMs}ms`,
          "--d20-glow-delay": `${-Math.max(0,landedAt === null ? 0 : Date.now()-landedAt)}ms`,
        } as React.CSSProperties
      }
      aria-live="assertive"
    >
      {celebrating&&<div className="natural20-energy" aria-hidden="true"><i className="energy-ring ring-one"/><i className="energy-ring ring-two"/><i className="energy-core"/>{Array.from({length:24},(_,index)=><b key={index} style={{"--spark-angle":`${index*15}deg`,"--spark-delay":`${(index%6)*.055}s`,"--spark-distance":`${24+(index%5)*5}vmin`} as React.CSSProperties}/>)}</div>}
      {reduced?<div className="d20-webgl-fallback" role="img" aria-label={revealed?`D20 result ${roll.result}`:'Rolling D20'}>{revealed?roll.result:'D20'}</div>:<Suspense fallback={<div className="d20-webgl-fallback">D20</div>}><D20Three result={roll.result} resultVisible={revealed} landingAt={landedAt} theme={roll.theme} durationMs={roll.animationDurationMs} rolledAt={roll.rolledAt} elapsedMs={rollElapsed} space={space} onLanded={confirmLanding}/></Suspense>}
      {space==='board'?<aside className="d20-corner-tray d20-corner-summary active-roll" aria-label="D20 roll result">
        <span className="d20-corner-label">D20 RESULT</span>
        <strong className="d20-corner-number">{revealed?roll.result:landed?'LANDED':'ROLLING'}</strong>
        <div className="d20-corner-details">{details}</div>
      </aside>:<>{revealed&&<strong className="d20-result-readout">{roll.result}</strong>}{details}</>}
      {space==='board'&&celebrating&&<section className="d20-critical-popup" role="status">
        <span className="d20-critical-kicker">NATURAL 20!</span>
        <strong>TRIPLE XP!</strong>
        <p>This question’s point value is tripled.</p>
        {roll.selectedSquare&&<span className="d20-critical-award">{roll.selectedSquare.value} XP → {roll.effectiveAwardXp??roll.selectedSquare.value*3} XP</span>}
      </section>}
    </main>
  );
}
