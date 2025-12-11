const Database = require('better-sqlite3');
const db = new Database('./data/kiosk.db');

const createTableSQL = `
CREATE TABLE IF NOT EXISTS screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceId INTEGER NOT NULL,
  imageData TEXT NOT NULL,
  url TEXT,
  capturedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
)`;

try {
  db.exec(createTableSQL);
  console.log('✅ Screenshots table created successfully');

  // Verify it was created
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='screenshots'").all();
  if (tables.length > 0) {
    console.log('✅ Table exists in database');
  }
} catch (error) {
  console.error('❌ Error creating table:', error.message);
} finally {
  db.close();
}
