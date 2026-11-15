UPDATE history
SET actor_user_id = 'support-admin',
	effective_user_id = 'support-admin'
WHERE json_extract(data, '$.source') = 'import'
	AND actor_user_id = 'business-realtor';
