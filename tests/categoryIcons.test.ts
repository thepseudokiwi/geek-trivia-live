import{describe,expect,it}from'vitest';
import{categoryIconName}from'../shared/categoryIcons.js';

describe('category icons',()=>{
 it.each([
  ['Anime & Manga','anime'],['Board & Card Games','cards'],['Comic Books','comics'],['Fantasy','fantasy'],['Video Games','games'],['Horror','horror'],['Role-Playing Games','roleplay'],['Science Fiction','science-fiction'],['Superhero Film & TV','superhero'],['Geek Culture & Technology','technology'],
 ])('matches %s to the %s icon',(category,icon)=>expect(categoryIconName(category)).toBe(icon));
 it('uses a safe general icon for unfamiliar categories',()=>expect(categoryIconName('Potpourri')).toBe('general'));
});
