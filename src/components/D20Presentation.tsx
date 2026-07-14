import { useEffect, useState } from "react";
import type { PublicD20State } from "../../shared/types";
function tone(result: number, volume: number) {
  try {
    const Audio = window.AudioContext || (window as any).webkitAudioContext,
      ctx = new Audio(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.frequency.value = result === 20 ? 880 : result === 1 ? 110 : 440;
    gain.gain.value = Math.min(0.15, volume * 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    /* OBS may block audio until explicitly enabled */
  }
}
export function D20Presentation({ roll,onDone }: { roll: PublicD20State;onDone?:()=>void }) {
  const elapsed = Math.max(0, Date.now() - Date.parse(roll.rolledAt)),
    [landed, setLanded] = useState(elapsed >= roll.animationDurationMs);
  useEffect(() => {
    if (roll.soundEnabled) tone(roll.result, roll.volume);
    if (landed) return;
    const timer = setTimeout(
      () => setLanded(true),
      Math.max(0, roll.animationDurationMs - elapsed),
    );
    return () => clearTimeout(timer);
  }, [roll.result]);
  useEffect(()=>{if(!roll.autoReturn||!onDone)return;const total=roll.animationDurationMs+roll.resultDisplayDurationMs,timer=setTimeout(onDone,Math.max(0,total-elapsed));return()=>clearTimeout(timer)},[roll.rolledAt,roll.autoReturn]);
  return (
    <main
      className={`d20-public theme-${roll.theme} ${landed ? "landed" : "rolling"} natural-${roll.result}`}
      style={
        {
          "--roll-duration": `${roll.animationDurationMs}ms`,
        } as React.CSSProperties
      }
      aria-live="assertive"
    >
      <div
        className="d20-poly"
        role="img"
        aria-label={`D20 result ${roll.result}`}
      >
        <div className="d20-face">{roll.result}</div>
      </div>
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
