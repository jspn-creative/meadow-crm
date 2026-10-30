ALTER TABLE clients ADD COLUMN imported_data TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(imported_data));
