// Migration script to rename schedules tables to playlists
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'kiosk.db');
console.log(`Opening database: ${dbPath}`);

const db = new Database(dbPath);

try {
  console.log('\n=== Starting Migration: Schedules → Playlists ===\n');

  // Check if old tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%schedule%'").all();
  console.log('Current schedule-related tables:', tables.map(t => t.name));

  if (tables.length === 0) {
    console.log('\n✅ No schedule tables found - migration may already be complete or tables do not exist yet.');
    console.log('Checking for playlist tables...');
    const playlistTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%playlist%'").all();
    console.log('Playlist tables:', playlistTables.map(t => t.name));
    process.exit(0);
  }

  console.log('\n📝 Beginning table and column renames...\n');

  // Step 1: Rename schedule_items table
  if (tables.some(t => t.name === 'schedule_items')) {
    console.log('1. Renaming schedule_items → playlist_items');
    db.prepare('ALTER TABLE schedule_items RENAME TO playlist_items').run();
    console.log('   ✅ Table renamed');

    console.log('2. Renaming column scheduleId → playlistId in playlist_items');
    db.prepare('ALTER TABLE playlist_items RENAME COLUMN scheduleId TO playlistId').run();
    console.log('   ✅ Column renamed');
  }

  // Step 2: Rename device_schedules table
  if (tables.some(t => t.name === 'device_schedules')) {
    console.log('3. Renaming device_schedules → device_playlists');
    db.prepare('ALTER TABLE device_schedules RENAME TO device_playlists').run();
    console.log('   ✅ Table renamed');

    console.log('4. Renaming column scheduleId → playlistId in device_playlists');
    db.prepare('ALTER TABLE device_playlists RENAME COLUMN scheduleId TO playlistId').run();
    console.log('   ✅ Column renamed');
  }

  // Step 3: Rename schedules table (last to avoid FK issues)
  if (tables.some(t => t.name === 'schedules')) {
    console.log('5. Renaming schedules → playlists');
    db.prepare('ALTER TABLE schedules RENAME TO playlists').run();
    console.log('   ✅ Table renamed');
  }

  console.log('\n=== Verification ===\n');

  // Verify new tables exist
  const newTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('playlists', 'playlist_items', 'device_playlists')").all();
  console.log('New playlist tables:', newTables.map(t => t.name));

  // Check data integrity
  const playlistCount = db.prepare('SELECT COUNT(*) as count FROM playlists').get();
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM playlist_items').get();
  const assignmentCount = db.prepare('SELECT COUNT(*) as count FROM device_playlists').get();

  console.log('\nData counts:');
  console.log(`  - Playlists: ${playlistCount.count}`);
  console.log(`  - Playlist items: ${itemCount.count}`);
  console.log(`  - Device assignments: ${assignmentCount.count}`);

  console.log('\n✅ Migration completed successfully!\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
