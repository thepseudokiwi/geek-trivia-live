import type {CSSProperties} from 'react';
import type {ThemeConfig} from '../../shared/themeDesigner.js';

type Props={remainingMs:number;durationMs:number;status:string;position?:CSSProperties;config?:ThemeConfig};
const dimensions={digital:[1.4,.8],circular:[1,1],'horizontal-bar':[2.4,.8],'vertical-bar':[.8,1.7],minimal:[1.4,.8],segmented:[2.4,1]}as const;

export function QuestionTimer({remainingMs,durationMs,status,position,config}:Props){
  const variant=config?.timer.style??'circular',expired=remainingMs<=0;
  const fontSize=config?.typography.timer.size??72;
  // Grow a too-small frame instead of silently capping the requested font.
  const size=Math.max(config?.timer.size??120,fontSize*(variant==='vertical-bar'?2.1:1.7));
  const [width,height]=dimensions[variant],progress=Math.max(0,Math.min(1,remainingMs/Math.max(1,durationMs)));
  const renderedWidth=`calc(${size*width} * var(--timer-unit) * var(--content-scale,1))`;
  const style={right:'auto',bottom:'auto',...(position??{right:'2rem',top:'2rem'}),
    ...(typeof position?.left==='string'?{left:`max(0px,min(${position.left},calc(100% - ${renderedWidth} - 1rem)))`}:{}),
    width:renderedWidth,
    height:`calc(${size*height} * var(--timer-unit) * var(--content-scale,1))`,
    '--timer-font-size':fontSize,
  }as CSSProperties;
  return <output style={style} role="timer" aria-live="off" aria-label={expired?"Time's up":`${Math.ceil(remainingMs/1000)} seconds remaining`}
    data-timer-style={variant} className={`broadcast-timer timer-style-${variant} ${expired?'expired':status}`}>
    {(variant==='horizontal-bar'||variant==='vertical-bar')&&<span className="timer-progress-track" aria-hidden="true"><i style={variant==='vertical-bar'?{height:`${progress*100}%`}:{width:`${progress*100}%`}}/></span>}
    {variant==='segmented'&&<span className="timer-segments" aria-hidden="true">{Array.from({length:10},(_,index)=><i key={index} className={index<Math.ceil(progress*10)?'filled':''}/>)}</span>}
    <span className="broadcast-timer-value">{expired?"TIME'S UP!":Math.ceil(remainingMs/1000)}</span>
  </output>;
}
