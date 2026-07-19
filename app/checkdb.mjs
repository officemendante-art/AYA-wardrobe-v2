import fs from 'fs';
import initSqlJs from 'sql.js';

async function checkDb() {
  const SQL = await initSqlJs();
  const filebuffer = fs.readFileSync('data/aya.db');
  const db = new SQL.Database(filebuffer);
  
  // Find which images actually load. Let's see if any path DOES NOT start with 'C:'
  const stmt = db.prepare("SELECT id, title, image_path, source FROM GalleryImages LIMIT 25");
  const results = [];
  while(stmt.step()) {
    results.push(stmt.getAsObject());
  }
  fs.writeFileSync('db_check_results.json', JSON.stringify(results, null, 2));
}
checkDb();
