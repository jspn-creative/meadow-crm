-- Cross-table checklist ownership needs triggers in addition to foreign keys; progress must belong to the inspected stage's active source.
CREATE TRIGGER progress_source_insert BEFORE INSERT ON checklist_progress
WHEN NOT EXISTS (
	SELECT 1 FROM stage_checklists s JOIN checklist_items i ON i.id = NEW.item_id
	WHERE s.id = NEW.checklist_id AND ((s.customized = 0 AND i.template_id = s.template_id) OR (s.customized = 1 AND i.checklist_id = s.id))
)
BEGIN
	SELECT RAISE(ABORT, 'Checklist item does not belong to this stage source');
END;
--> statement-breakpoint
CREATE TRIGGER progress_source_update BEFORE UPDATE ON checklist_progress
WHEN NOT EXISTS (
	SELECT 1 FROM stage_checklists s JOIN checklist_items i ON i.id = NEW.item_id
	WHERE s.id = NEW.checklist_id AND ((s.customized = 0 AND i.template_id = s.template_id) OR (s.customized = 1 AND i.checklist_id = s.id))
)
BEGIN
	SELECT RAISE(ABORT, 'Checklist item does not belong to this stage source');
END;
