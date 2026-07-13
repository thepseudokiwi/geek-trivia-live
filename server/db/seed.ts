import './migrate.js'; import { db } from './database.js';
const categories = [
  ['Star Voyagers','Cosmic Trek'], ['Arcane Academy','Wizard School'], ['Pixel Realms','Retro Games'],
  ['Cape Chronicles','Comic Heroes'], ['Robot Uprising','Science Fiction'], ['Mythic Quests','Fantasy Adventures']
];
const insert = db.prepare(`INSERT OR IGNORE INTO questions(id,category,subcategory,difficulty,point_value,question_text,correct_answer,alternate_answers,question_type,host_notes,source) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
db.exec('BEGIN'); try { for (const [ci,[category, franchise]] of categories.entries()) for (let d=1; d<=5; d++) for (let variant=1; variant<=2; variant++) { const n=ci*10+(d-1)*2+variant; insert.run(`SAMPLE-${String(n).padStart(3,'0')}`,category,franchise,d,d*100,`Sample ${category} difficulty ${d}, variant ${variant}: replace with a researched question.`,`Sample answer ${n}`,JSON.stringify([`Alternate ${n}`]),'text','DEVELOPMENT SAMPLE — verify before broadcast.','Geek Trivia Live sample data'); } db.exec('COMMIT'); } catch(error) { db.exec('ROLLBACK'); throw error; }
console.log('Seed complete: 60 labeled sample questions available.'); db.close();
