-- Client-owned references: a reference now belongs to a client or an opportunity.
CREATE TABLE record_references_new (
	id TEXT PRIMARY KEY NOT NULL,
	opportunity_id TEXT REFERENCES opportunities(id),
	client_id TEXT REFERENCES clients(id),
	label TEXT NOT NULL,
	kind TEXT NOT NULL,
	url TEXT,
	target_client_id TEXT REFERENCES clients(id),
	target_opportunity_id TEXT REFERENCES opportunities(id),
	revision INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK (length(trim(label)) > 0),
	CHECK (revision > 0),
	CHECK (kind IN ('url', 'client', 'opportunity')),
	CHECK (
		(opportunity_id IS NOT NULL AND client_id IS NULL) OR
		(opportunity_id IS NULL AND client_id IS NOT NULL)
	),
	CHECK (
		(kind = 'url' AND url IS NOT NULL AND (url LIKE 'https://%' OR url LIKE 'http://%') AND target_client_id IS NULL AND target_opportunity_id IS NULL) OR
		(kind = 'client' AND target_client_id IS NOT NULL AND url IS NULL AND target_opportunity_id IS NULL) OR
		(kind = 'opportunity' AND target_opportunity_id IS NOT NULL AND url IS NULL AND target_client_id IS NULL)
	)
);

--> statement-breakpoint

INSERT INTO record_references_new (id, opportunity_id, client_id, label, kind, url, target_client_id, target_opportunity_id, revision, created_at, updated_at)
SELECT id, opportunity_id, NULL, label, kind, url, target_client_id, target_opportunity_id, revision, created_at, updated_at
FROM record_references;

--> statement-breakpoint

DROP TABLE record_references;

--> statement-breakpoint

ALTER TABLE record_references_new RENAME TO record_references;

--> statement-breakpoint

CREATE INDEX references_opportunity ON record_references(opportunity_id);

--> statement-breakpoint

CREATE INDEX references_client ON record_references(client_id);
