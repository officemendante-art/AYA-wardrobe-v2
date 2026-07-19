import fs from 'fs';
import initSqlJs from 'sql.js';

async function fixDb() {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('data/aya.db');
  const db = new SQL.Database(filebuffer);
  
  // Fix GalleryImages
  db.run(`UPDATE GalleryImages SET image_path = 'data/images/flow/' || substr(image_path, instr(image_path, 'GOOGLE FLOW OUTFITS/') + 20) WHERE image_path LIKE '%GOOGLE FLOW OUTFITS%'`);
  
  // Fix FlowArchive if it exists
  try {
    db.run(`UPDATE FlowArchive SET image_path = 'data/images/flow/' || substr(image_path, instr(image_path, 'GOOGLE FLOW OUTFITS/') + 20) WHERE image_path LIKE '%GOOGLE FLOW OUTFITS%'`);
  } catch(e) {}
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync('data/aya.db', buffer);
  
  console.log("Database paths updated successfully!");
}
fixDb();
