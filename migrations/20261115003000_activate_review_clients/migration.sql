-- Frozen client-review-active.json SHA-256: f840cf5231bda5ee788a4dc1a4c61d7e04ec76fd3899341b46ba211e659f8b6f
-- Each guard, History row, update, and ledger insertion belongs to Alchemy's single migration request.
INSERT INTO mutation_guards (id, passed)
SELECT 'review-flags-targets', CASE WHEN NOT EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') OR (SELECT count(*) FROM clients WHERE id IN ('import-client-743','import-client-615','import-client-690','import-client-798','import-client-750','import-client-673','import-client-224','import-client-746','import-client-833','import-client-209','import-client-463','import-client-205','import-client-738','import-client-736','import-client-484','import-client-650','import-client-440','import-client-481','import-client-715','import-client-702','import-client-824','import-client-820','import-client-818','import-client-458','import-client-809','import-client-401','import-client-808','import-client-648','import-client-437','import-client-137')) = 30 THEN 1 ELSE 0 END;

WITH review (id, note) AS (VALUES
('import-client-743', 'The August buying note needs an outcome check: verify the pre-approval status and whether the inquiry progressed.'),
('import-client-615', 'The review evidence was a generic outbound introduction with no personal reply found. Verify actual engagement and whether this client belongs in the active Registry.'),
('import-client-690', 'The review evidence was a generic outbound introduction with no personal reply found. Verify actual engagement and whether this client belongs in the active Registry.'),
('import-client-798', 'The review evidence was a generic outbound introduction with no personal reply found. Verify actual engagement and whether this client belongs in the active Registry.'),
('import-client-750', 'Clarify which application the note refers to, its current status, and whether assistance is still needed.'),
('import-client-673', 'Confirm current timing and financing, and whether the proposed appointment was ever confirmed.'),
('import-client-224', 'The imported note flags a suspected scam. Verify identity and legitimacy before treating this as genuine business.'),
('import-client-746', 'Confirm whether the browsing inquiry became current buying work and fill in the missing qualification details.'),
('import-client-833', 'Confirm whether the requested showing happened, the inquiry outcome, and current agent representation.'),
('import-client-209', 'The review evidence was an invalid-email system notice, not personal engagement. Verify the email address and whether there is a genuine business relationship.'),
('import-client-463', 'The review evidence was an invalid-email system notice, not personal engagement. Verify the email address and whether there is a genuine business relationship.'),
('import-client-205', 'Confirm current buying interest, financing status, and whether the lender introduction happened.'),
('import-client-738', 'Confirm current buying interest, financing, and whether the unresolved qualification questions were answered.'),
('import-client-736', 'Detailed search notes exist but no personal engagement was detected by the classifier. Verify communication history and the search outcome.'),
('import-client-484', 'Confirm current interest and whether the client is represented by another agent before further outreach.'),
('import-client-650', 'The latest note puts plans on hold. Confirm whether they resumed before treating this as current work.'),
('import-client-440', 'Confirm the current sale and purchase status, the offer outcome, and whether another agent is involved.'),
('import-client-481', 'Reconcile the changing inquiry and showing notes; confirm current interest, agent representation, and the follow-up outcome.'),
('import-client-715', 'Two near-duplicate notes describe the same inquiry. Confirm financing and the follow-up outcome without treating the duplicate as additional evidence.'),
('import-client-702', 'Confirm who the intended buyer is, whether the client record represents them correctly, and current agent representation.'),
('import-client-824', 'Confirm who participated in the recorded conversation and whether the record identifies the intended buyer correctly.'),
('import-client-820', 'Confirm current buying interest, financing, and whether the requested callback happened.'),
('import-client-818', 'Confirm the current sale and purchase status and whether the requested callback was completed.'),
('import-client-458', 'Confirm current buying interest, financing status, and whether the requested callback happened.'),
('import-client-809', 'Confirm current buying interest, agent representation, and whether the planned follow-up happened.'),
('import-client-401', 'Confirm whether the recorded buying interest is still current and whether any later work or outcome is missing.'),
('import-client-808', 'The January notes deferred a decision until spring. Confirm whether that decision was made and whether the sale-and-purchase plans are still current.'),
('import-client-648', 'Confirm the current buying and selling status, financing, and outcome of the recorded follow-up.'),
('import-client-437', 'Confirm current buying interest, financing status, and whether the disconnected transfer was followed up.'),
('import-client-137', 'Confirm the current selling timeline and whether the recorded follow-up led to further work.')
)
INSERT INTO history (id, record_kind, record_id, action, actor_user_id, effective_user_id, data, fictional, created_at)
SELECT 'migration:20261115003000_activate_review_clients:' || c.id, 'client', c.id, 'activate-review', 'support-admin', 'support-admin',
json_object(
 'migration', '20261115003000_activate_review_clients',
 'sourceHash', 'f840cf5231bda5ee788a4dc1a4c61d7e04ec76fd3899341b46ba211e659f8b6f',
 'before', json_object('archivedAt', c.archived_at, 'flagged', json(CASE WHEN c.flagged = 1 THEN 'true' ELSE 'false' END), 'flagNote', c.flag_note, 'revision', c.revision, 'updatedAt', c.updated_at),
 'after', json_object('archivedAt', NULL, 'flagged', json('true'), 'flagNote', review.note, 'revision', c.revision + 1, 'updatedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
), c.fictional, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM clients c JOIN review ON review.id = c.id;

UPDATE clients AS c SET
 archived_at = NULL,
 flagged = 1,
 flag_note = json_extract(h.data, '$.after.flagNote'),
 revision = json_extract(h.data, '$.after.revision'),
 updated_at = json_extract(h.data, '$.after.updatedAt')
FROM history h
WHERE h.id = 'migration:20261115003000_activate_review_clients:' || c.id AND c.revision = json_extract(h.data, '$.before.revision');

INSERT INTO mutation_guards (id, passed)
SELECT 'review-flags-updated', CASE WHEN changes() = CASE WHEN EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') THEN 30 ELSE 0 END THEN 1 ELSE 0 END;
DELETE FROM mutation_guards WHERE id IN ('review-flags-targets', 'review-flags-updated');
