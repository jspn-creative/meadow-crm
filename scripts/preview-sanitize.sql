-- Keep production credentials, but never carry live sessions or verification tokens into a preview.
-- A preview database is cloned only when it is first created. If a clone fails and leaves it empty, delete that database and edit this file, so that the next deploy creates and clones it again.
DELETE FROM auth_support_impersonation;
DELETE FROM auth_session;
DELETE FROM auth_rate_limit;
DELETE FROM auth_verification;
