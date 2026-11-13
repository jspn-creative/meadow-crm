UPDATE auth_user
SET name = CASE id
		WHEN 'business-realtor' THEN 'Jayden Bontrager'
		WHEN 'business-assistant' THEN 'Janae Spinney'
	END,
	updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE id IN ('business-realtor', 'business-assistant');
