-- Pinned opportunities stay at the top of their stage's column for both users; null means not pinned.
ALTER TABLE opportunities ADD COLUMN pinned_at TEXT;
