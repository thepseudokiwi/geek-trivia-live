import fs from 'node:fs';
import path from 'node:path';
import '../server/db/migrate.js';
import { saveAsset } from '../server/presentationRepository.js';

const root=path.resolve(process.argv[2]??'');
if(!process.argv[2]||!fs.existsSync(root)){
  console.error('Usage: npm run fonts:import -- <font-directory>');
  process.exitCode=1;
}else{
  const files=fs.readdirSync(root,{recursive:true,withFileTypes:true})
    .filter(entry=>entry.isFile()&&/\.(ttf|otf|woff2)$/i.test(entry.name))
    .map(entry=>path.join(entry.parentPath,entry.name));
  let imported=0,duplicates=0;
  for(const file of files){
    const extension=path.extname(file).slice(1).toLowerCase(),displayName=path.basename(file,path.extname(file)).replaceAll('_',' '),result:any=saveAsset({displayName,fileName:path.basename(file),mimeType:extension==='otf'?'font/otf':extension==='woff2'?'font/woff2':'font/ttf',assetType:'font',base64:fs.readFileSync(file).toString('base64'),licensingNote:'Operator supplied; license unverified. Operator accepts responsibility for broadcast use.',attributionNote:'Source: https://www.st-minutiae.com/resources/fonts/index.html'});
    result.duplicate?duplicates++:imported++;
  }
  console.log(`Font import complete: ${imported} imported, ${duplicates} already present, ${files.length} files checked.`);
}
