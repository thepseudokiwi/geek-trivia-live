import type {ReactNode} from 'react';
import {categoryIconName,type CategoryIconName} from '../../shared/categoryIcons';

const art:Record<CategoryIconName,ReactNode>={
 anime:<><path d="M6 18 12 5l6 13"/><path d="m8.5 13 3.5-3 3.5 3M9 18h6"/></>,
 cards:<><rect x="5" y="4" width="11" height="15" rx="2" transform="rotate(-8 10.5 11.5)"/><path d="m12 9 2 2-2 2-2-2Z"/></>,
 comics:<><path d="M4 5h16v11H9l-4 3 1-3H4Z"/><path d="M8 9h8M8 12h5"/></>,
 fantasy:<><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7Z"/></>,
 games:<><path d="M7 8h10c3 0 4 8 2 9-1 .5-3-3-4-3H9c-1 0-3.2 3.5-4 3-2-1 0-9 2-9Z"/><path d="M8 11v4M6 13h4M15.5 11.5h.01M17.5 13.5h.01"/></>,
 horror:<><path d="M6 20V11a6 6 0 0 1 12 0v9l-3-2-3 2-3-2Z"/><path d="M9 11h.01M15 11h.01M10 15h4"/></>,
 roleplay:<><path d="m12 3 8 6-3 10H7L4 9Z"/><path d="m12 7 3 3-1 5h-4l-1-5Z"/></>,
 'science-fiction':<><path d="M14 4c3 1 5 4 5 7l-5 5-6-6 5-6Z"/><path d="m8 10-3 2 3 1m6 3-2 3-1-3M15 8h.01"/></>,
 superhero:<><path d="M12 3 5 6v5c0 4 3 8 7 10 4-2 7-6 7-10V6Z"/><path d="m12 7 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z"/></>,
 technology:<><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m3-4v4m3-4v4M9 18v4m3-4v4m3-4v4M2 9h4m-4 3h4m-4 3h4m12-6h4m-4 3h4m-4 3h4M10 10h4v4h-4Z"/></>,
 general:<><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.3 2.1c-.8.4-1.1.9-1.1 1.9M12 17h.01"/></>,
};

export function CategoryIcon({category}:{category:string}){
 const name=categoryIconName(category);
 return <svg className={`category-icon category-icon-${name}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{art[name]}</svg>;
}
