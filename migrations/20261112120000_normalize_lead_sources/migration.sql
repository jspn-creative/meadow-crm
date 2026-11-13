UPDATE clients
SET lead_source = CASE
		WHEN (referred_by_client_id IS NOT NULL OR referred_by_name <> '') THEN 'Referral'
		WHEN lead_source = 'A referral' THEN 'Referral'
		WHEN lead_source = 'An open house' THEN 'Open house'
		WHEN lead_source = 'A sign' THEN 'Sign'
		WHEN lead_source = 'The website' THEN 'Website'
		WHEN lead_source = 'A walk-in' THEN 'Walk-in'
		ELSE lead_source
	END,
	revision = revision + 1,
	updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE CASE
		WHEN (referred_by_client_id IS NOT NULL OR referred_by_name <> '') THEN 'Referral'
		WHEN lead_source = 'A referral' THEN 'Referral'
		WHEN lead_source = 'An open house' THEN 'Open house'
		WHEN lead_source = 'A sign' THEN 'Sign'
		WHEN lead_source = 'The website' THEN 'Website'
		WHEN lead_source = 'A walk-in' THEN 'Walk-in'
		ELSE lead_source
	END IS NOT lead_source;
