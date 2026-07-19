import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs({ locateFile: f => `node_modules/sql.js/dist/${f}` });
const buf = fs.readFileSync('data/aya.db');
const db = new SQL.Database(buf);

const before = db.exec('SELECT COUNT(*) FROM GalleryImages')[0].values[0][0];
console.log('Rows before:', before);

db.run("DELETE FROM GalleryImages WHERE image_path LIKE 'C:%'");

const after = db.exec('SELECT COUNT(*) FROM GalleryImages')[0].values[0][0];
console.log('Rows after:', after);
console.log('Deleted:', before - after, 'rows');

fs.writeFileSync('data/aya.db', Buffer.from(db.export()));
console.log('Database saved successfully.');
