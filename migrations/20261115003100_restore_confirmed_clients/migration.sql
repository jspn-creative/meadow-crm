-- Frozen confirmed-client-records.csv SHA-256: f9a6b85b37bbd057f774dba5ba2e7e2f7842811d6764cd3d7c0748f9969edef3
-- Separate from flagging: already-active clients receive no write or artificial History.
INSERT INTO mutation_guards (id, passed)
SELECT 'confirmed-clients-targets', CASE WHEN NOT EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') OR (SELECT count(*) FROM clients WHERE id IN ('import-client-3','import-client-4','import-client-5','import-client-6','import-client-7','import-client-8','import-client-10','import-client-11','import-client-12','import-client-14','import-client-15','import-client-16','import-client-17','import-client-18','import-client-19','import-client-20','import-client-21','import-client-22','import-client-23','import-client-24','import-client-52','import-client-155','import-client-227','import-client-228','import-client-229','import-client-230','import-client-231','import-client-232','import-client-233','import-client-234','import-client-235','import-client-236','import-client-237','import-client-238','import-client-239','import-client-240','import-client-241','import-client-242','import-client-243','import-client-244','import-client-245','import-client-246','import-client-247','import-client-248','import-client-249','import-client-250','import-client-251','import-client-254','import-client-257','import-client-258','import-client-261','import-client-262','import-client-265','import-client-266','import-client-267','import-client-268','import-client-269','import-client-271','import-client-272','import-client-273','import-client-277','import-client-278','import-client-280','import-client-281','import-client-282','import-client-284','import-client-285','import-client-287','import-client-288','import-client-290','import-client-291','import-client-292','import-client-294','import-client-295','import-client-296','import-client-297','import-client-299','import-client-300','import-client-301','import-client-305','import-client-308','import-client-352','import-client-394','import-client-416','import-client-500','import-client-501','import-client-504','import-client-505','import-client-506','import-client-508','import-client-510','import-client-511','import-client-512','import-client-513','import-client-514','import-client-516','import-client-517','import-client-520','import-client-521','import-client-522','import-client-540','import-client-751','import-client-752','import-client-753','import-client-754','import-client-755','import-client-835','import-client-836','import-client-837','import-client-838','import-client-839','import-client-840','import-client-841')) = 113 THEN 1 ELSE 0 END;

WITH confirmed (id) AS (SELECT 'import-client-' || value FROM json_each('[3,4,5,6,7,8,10,11,12,14,15,16,17,18,19,20,21,22,23,24,52,155,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,254,257,258,261,262,265,266,267,268,269,271,272,273,277,278,280,281,282,284,285,287,288,290,291,292,294,295,296,297,299,300,301,305,308,352,394,416,500,501,504,505,506,508,510,511,512,513,514,516,517,520,521,522,540,751,752,753,754,755,835,836,837,838,839,840,841]'))
INSERT INTO history (id, record_kind, record_id, action, actor_user_id, effective_user_id, data, fictional, created_at)
SELECT 'migration:20261115003100_restore_confirmed_clients:' || c.id, 'client', c.id, 'restore', 'support-admin', 'support-admin',
json_object(
 'migration', '20261115003100_restore_confirmed_clients',
 'sourceHash', 'f9a6b85b37bbd057f774dba5ba2e7e2f7842811d6764cd3d7c0748f9969edef3',
 'before', json_object('archivedAt', c.archived_at, 'revision', c.revision, 'updatedAt', c.updated_at),
 'after', json_object('archivedAt', NULL, 'revision', c.revision + 1, 'updatedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
), c.fictional, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM clients c JOIN confirmed ON confirmed.id = c.id WHERE c.archived_at IS NOT NULL;

UPDATE clients AS c SET
 archived_at = NULL,
 revision = json_extract(h.data, '$.after.revision'),
 updated_at = json_extract(h.data, '$.after.updatedAt')
FROM history h
WHERE h.id = 'migration:20261115003100_restore_confirmed_clients:' || c.id AND c.revision = json_extract(h.data, '$.before.revision');

INSERT INTO mutation_guards (id, passed)
SELECT 'confirmed-clients-updated', CASE WHEN changes() = (SELECT count(*) FROM history WHERE json_extract(data, '$.migration') = '20261115003100_restore_confirmed_clients') THEN 1 ELSE 0 END;

WITH confirmed (id) AS (SELECT 'import-client-' || value FROM json_each('[3,4,5,6,7,8,10,11,12,14,15,16,17,18,19,20,21,22,23,24,52,155,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,254,257,258,261,262,265,266,267,268,269,271,272,273,277,278,280,281,282,284,285,287,288,290,291,292,294,295,296,297,299,300,301,305,308,352,394,416,500,501,504,505,506,508,510,511,512,513,514,516,517,520,521,522,540,751,752,753,754,755,835,836,837,838,839,840,841]'))
INSERT INTO mutation_guards (id, passed)
SELECT 'confirmed-clients-active', CASE WHEN NOT EXISTS (SELECT 1 FROM clients WHERE id GLOB 'import-client-*') OR (SELECT count(*) FROM clients c JOIN confirmed ON confirmed.id = c.id WHERE c.archived_at IS NULL) = 113 THEN 1 ELSE 0 END;
DELETE FROM mutation_guards WHERE id IN ('confirmed-clients-targets', 'confirmed-clients-updated', 'confirmed-clients-active');
