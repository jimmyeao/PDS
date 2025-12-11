const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

const count = db.prepare('SELECT COUNT(*) as count FROM screenshots').get();
console.log('Total screenshots:', count.count);

const recent = db.prepare('SELECT id, deviceId, url, capturedAt FROM screenshots ORDER BY capturedAt DESC LIMIT 5').all();
console.log('\nRecent screenshots:');
recent.forEach(s => {
  console.log('  ID:', s.id, '| DeviceID:', s.deviceId, '| URL:', s.url, '| Captured:', s.capturedAt);
});

db.close();
