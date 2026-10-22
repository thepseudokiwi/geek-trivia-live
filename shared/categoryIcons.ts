export type CategoryIconName='anime'|'cards'|'comics'|'fantasy'|'games'|'horror'|'roleplay'|'science-fiction'|'superhero'|'technology'|'general';

const rules:Array<[CategoryIconName,RegExp]>=[
 ['anime',/anime|manga|japan/],
 ['cards',/board|card|tabletop/],
 ['comics',/comic|graphic novel/],
 ['fantasy',/fantasy|magic|wizard|dragon|myth/],
 ['games',/video game|gaming|arcade|console/],
 ['horror',/horror|monster|vampire|zombie|spooky/],
 ['roleplay',/role.?playing|\brpg\b|dungeons|pathfinder/],
 ['science-fiction',/science.?fiction|sci.?fi|space|star trek|star wars/],
 ['superhero',/superhero|marvel|dc comics/],
 ['technology',/technology|computer|internet|geek culture|science/],
];

export function categoryIconName(category:string):CategoryIconName{
 const normalized=category.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return rules.find(([,pattern])=>pattern.test(normalized))?.[0]??'general';
}
