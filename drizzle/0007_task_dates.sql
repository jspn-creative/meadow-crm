-- Preserve existing tasks, using their due date or creation day as their initial date. No table references tasks, so rebuilding enforces a required date without a permanent placeholder default.
CREATE TABLE tasks_with_dates (
	id TEXT PRIMARY KEY NOT NULL,
	title TEXT NOT NULL,
	assigned_user_id TEXT NOT NULL,
	assigned_role TEXT NOT NULL DEFAULT 'realtor',
	client_id TEXT REFERENCES clients(id),
	opportunity_id TEXT REFERENCES opportunities(id),
	source_stage TEXT,
	date TEXT NOT NULL,
	due_date TEXT,
	completed_at TEXT,
	fictional INTEGER NOT NULL DEFAULT 0,
	revision INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT task_title_required CHECK (length(trim(title)) > 0),
	CONSTRAINT task_realtor_only CHECK (assigned_role = 'realtor'),
	CONSTRAINT task_single_link CHECK (client_id IS NULL OR opportunity_id IS NULL),
	CONSTRAINT task_source_stage CHECK (source_stage IS NULL OR (opportunity_id IS NOT NULL AND source_stage IN ('new-lead', 'active-lead', 'under-contract', 'closed'))),
	CONSTRAINT task_date_shape CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT task_start_date_shape CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT task_revision_positive CHECK (revision > 0)
);
--> statement-breakpoint
INSERT INTO tasks_with_dates SELECT id, title, assigned_user_id, assigned_role, client_id, opportunity_id, source_stage, COALESCE(due_date, substr(created_at, 1, 10)), due_date, completed_at, fictional, revision, created_at, updated_at FROM tasks;
--> statement-breakpoint
DROP TABLE tasks;
--> statement-breakpoint
ALTER TABLE tasks_with_dates RENAME TO tasks;
--> statement-breakpoint
CREATE INDEX tasks_attention ON tasks (completed_at, due_date);
--> statement-breakpoint
CREATE INDEX tasks_date ON tasks (completed_at, date);
--> statement-breakpoint
CREATE INDEX tasks_client ON tasks (client_id);
--> statement-breakpoint
CREATE INDEX tasks_opportunity ON tasks (opportunity_id);
