-- Written only after a successful clone and token sanitization; incomplete snapshots cannot be reused.
CREATE TABLE IF NOT EXISTS __meadow_preview_snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), synced_at TEXT NOT NULL);
INSERT OR REPLACE INTO __meadow_preview_snapshot (id, synced_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
