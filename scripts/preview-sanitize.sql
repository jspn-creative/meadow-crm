-- Keep production credentials, but never carry live sessions or verification tokens into a preview.
DELETE FROM auth_support_impersonation;
DELETE FROM auth_session;
DELETE FROM auth_rate_limit;
DELETE FROM auth_verification;
