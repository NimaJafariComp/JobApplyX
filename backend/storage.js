import sqlite3 from 'sqlite3';
import { open } from 'sqlite';


let db;


export async function initDb(file = './jobapplyx.sqlite') {
db = await open({ filename: file, driver: sqlite3.Database });
await db.exec(`
CREATE TABLE IF NOT EXISTS profile (
id INTEGER PRIMARY KEY CHECK (id = 1),
json TEXT NOT NULL,
resume_text TEXT DEFAULT ''
);
INSERT OR IGNORE INTO profile (id, json, resume_text) VALUES (1, '{"name":"","email":"","phone":"","location":"","roles":["software engineer"],"skills":[],"work_history":[],"answers":{},"faqs":{}}', '');


CREATE TABLE IF NOT EXISTS queue (
id INTEGER PRIMARY KEY AUTOINCREMENT,
site TEXT NOT NULL,
job_url TEXT NOT NULL,
job_title TEXT,
company TEXT,
job_desc TEXT,
missing TEXT,
payload TEXT,
status TEXT DEFAULT 'pending',
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
return db;
}


export async function getProfile() { return db.get('SELECT json, resume_text FROM profile WHERE id = 1'); }
export async function setProfile(json) { await db.run('UPDATE profile SET json = ? WHERE id = 1', JSON.stringify(json)); }
export async function setResumeText(text) { await db.run('UPDATE profile SET resume_text = ? WHERE id = 1', text); }
export async function addQueue(item) {
const { site, job_url, job_title, company, job_desc, missing = [], payload = {} } = item;
const result = await db.run(
'INSERT INTO queue (site, job_url, job_title, company, job_desc, missing, payload, status) VALUES (?,?,?,?,?,?,?,?)',
site, job_url, job_title || '', company || '', job_desc || '', JSON.stringify(missing), JSON.stringify(payload), 'pending'
);
return result.lastID;
}
export async function listQueue(statuses = ['pending','answered']) {
const placeholders = statuses.map(()=>'?').join(',');
return db.all(`SELECT * FROM queue WHERE status IN (${placeholders}) ORDER BY created_at ASC`, statuses);
}
export async function getQueue(id) { return db.get('SELECT * FROM queue WHERE id = ?', id); }
export async function updateQueue(id, fields) {
const row = await getQueue(id); if (!row) return;
const merged = { ...row, ...fields };
await db.run(
'UPDATE queue SET site=?, job_url=?, job_title=?, company=?, job_desc=?, missing=?, payload=?, status=? WHERE id=?',
merged.site, merged.job_url, merged.job_title, merged.company, merged.job_desc,
JSON.stringify(merged.missing), JSON.stringify(merged.payload), merged.status, id
);
return getQueue(id);
}