import type { AppPage } from '../routing';
import './adminNavigation.css';

export function AdminNavigation({page,episodeId,dark,onToggleDark,onLogout}:{
 page:AppPage;episodeId?:string;dark:boolean;onToggleDark:()=>void;onLogout:()=>void;
}) {
 const episode=episodeId?encodeURIComponent(episodeId):null;
 const items:Array<{page:AppPage;label:string;href:string;title?:string}>=[
  {page:'host',label:'Host Console',href:episode?`#host/${episode}`:'#episodes',title:episode?'Return to the selected episode':'Choose an episode to open its Host Console'},
  {page:'episodes',label:'Episodes',href:'#episodes'},
  {page:'run',label:'Episode Controls',href:episode?`#run/${episode}`:'#episodes',title:episode?'Manage the selected episode':'Choose an episode first'},
  {page:'builder',label:'New Episode',href:'#builder'},
  {page:'library',label:'Question Library',href:'#library'},
  {page:'theme-designer',label:'Theme Designer',href:'#theme-designer'},
  {page:'admin',label:'Access Management',href:'#admin'},
 ];
 return <nav className="admin-navigation" aria-label="Admin navigation">
  <strong>Nerd Wars</strong>
  <div className="admin-navigation-links">{items.map(item=><a key={item.page} href={item.href} title={item.title} aria-current={page===item.page?'page':undefined} className={page===item.page?'active':undefined}>{item.label}</a>)}</div>
  <div className="admin-navigation-actions"><button className="app-dark-toggle" aria-pressed={dark} onClick={onToggleDark}>{dark?'☀ Light mode':'◐ Dark mode'}</button><button onClick={onLogout}>Sign out</button></div>
 </nav>;
}
