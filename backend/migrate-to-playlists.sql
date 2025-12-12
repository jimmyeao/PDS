-- Migration: Rename schedules to playlists
-- This renames all schedule-related tables and columns to playlist terminology

-- Step 1: Rename schedule_items table and its scheduleId column
ALTER TABLE schedule_items RENAME TO playlist_items;
ALTER TABLE playlist_items RENAME COLUMN scheduleId TO playlistId;

-- Step 2: Rename device_schedules table and its scheduleId column
ALTER TABLE device_schedules RENAME TO device_playlists;
ALTER TABLE device_playlists RENAME COLUMN scheduleId TO playlistId;

-- Step 3: Rename schedules table (do this last to avoid FK issues)
ALTER TABLE schedules RENAME TO playlists;

-- Verify tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('playlists', 'playlist_items', 'device_playlists');
