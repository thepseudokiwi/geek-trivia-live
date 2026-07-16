import { useEffect,useState } from 'react';
import { AudienceDisplay } from './pages/AudienceDisplay';
import { ContestantPlay } from './pages/ContestantPlay';
import { EpisodeBuilder } from './pages/EpisodeBuilder';
import { EpisodeRun } from './pages/EpisodeRun';
import { Episodes } from './pages/Episodes';
import { HostConsole } from './pages/HostConsole';
import { QuestionLibrary } from './pages/QuestionLibrary';
import { ThemeDesigner } from './pages/ThemeDesigner';
import { ThemePreview } from './pages/ThemePreview';
type View={page:'library'|'episodes'|'builder'|'run'|'host'|'audience'|'play'|'theme-designer'|'theme-preview';id?:string};
const parse=():View=>{const route=location.hash.replace(/^#/,'').split('?')[0],[page='library',id]=route.split('/');return['library','episodes','builder','run','host','audience','play','theme-designer','theme-preview'].includes(page)?{page:page as View['page'],id}:{page:'library'}};
export default function App(){const[view,setView]=useState<View>(parse);useEffect(()=>{const change=()=>setView(parse());addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change)},[]);const go=(page:View['page'],id?:string)=>{location.hash=`${page}${id?`/${id}`:''}`;setView({page,id})};if(view.page==='play')return <ContestantPlay joinCode={view.id}/>;if(view.page==='audience')return <AudienceDisplay id={view.id!}/>;if(view.page==='theme-preview')return <ThemePreview id={view.id!}/>;if(view.page==='host')return <HostConsole id={view.id!} back={()=>go('episodes')}/>;return <><nav><strong>Geek Trivia Live</strong><button className={view.page==='library'?'active':''} onClick={()=>go('library')}>Question Library</button><button className={view.page==='episodes'?'active':''} onClick={()=>go('episodes')}>Episodes</button><button className={view.page==='builder'?'active':''} onClick={()=>go('builder')}>New Episode</button><button className={view.page==='theme-designer'?'active':''} onClick={()=>go('theme-designer')}>Theme Designer</button></nav>{view.page==='library'?<QuestionLibrary/>:view.page==='episodes'?<Episodes openBuilder={id=>go('builder',id)} openRun={id=>go('run',id)} openHost={id=>go('host',id)}/>:view.page==='builder'?<EpisodeBuilder episodeId={view.id} back={()=>go('episodes')}/>:view.page==='theme-designer'?<ThemeDesigner id={view.id} onSelect={id=>go('theme-designer',id)}/>:<EpisodeRun id={view.id!} back={()=>go('episodes')}/>}</>}
