UPDATE auth_user
SET name = 'Josh Spinney',
	updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE id = 'support-admin';
