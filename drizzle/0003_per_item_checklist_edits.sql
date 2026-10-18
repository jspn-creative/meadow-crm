-- Per-item checklist edits: track locally-removed template items instead of a whole-stage 'customized' flag.
ALTER TABLE stage_checklists ADD COLUMN removed_template_items TEXT NOT NULL DEFAULT '[]';

--> statement-breakpoint

-- Rebuild triggers without the 'customized' reference: an item belongs to a checklist if it is a local item (checklist_id = checklist.id) or a template item (template_id = checklist.template_id).

DROP TRIGGER IF EXISTS progress_source_insert;
DROP TRIGGER IF EXISTS progress_source_update;

CREATE TRIGGER progress_source_insert BEFORE INSERT ON checklist_progress
WHEN NOT EXISTS (
	SELECT 1 FROM stage_checklists s JOIN checklist_items i ON i.id = NEW.item_id
	WHERE s.id = NEW.checklist_id AND (
		i.checklist_id = s.id
		OR (i.template_id = s.template_id AND i.template_id IS NOT NULL)
	)
)
BEGIN
	SELECT RAISE(ABORT, 'Checklist item does not belong to this stage source');
END;

--> statement-breakpoint

CREATE TRIGGER progress_source_update BEFORE UPDATE ON checklist_progress
WHEN NOT EXISTS (
	SELECT 1 FROM stage_checklists s JOIN checklist_items i ON i.id = NEW.item_id
	WHERE s.id = NEW.checklist_id AND (
		i.checklist_id = s.id
		OR (i.template_id = s.template_id AND i.template_id IS NOT NULL)
	)
)
BEGIN
	SELECT RAISE(ABORT, 'Checklist item does not belong to this stage source');
END;