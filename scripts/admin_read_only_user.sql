-- Creates admin_ro, a login that can only READ the push tables. customer-api's
-- Django admin uses it (apps/push_data there), over the gostyle_admin-db
-- network (docker-compose.yml).
--
-- Run it as postgres in the push db container, with a hex password
-- (openssl rand -hex 24: it goes into customer-api's PUSH_DATABASE_URL):
--
--   docker exec -i push-notification-service-db-1 \
--     psql -U postgres -d push -v ON_ERROR_STOP=1 -v pw=<hex password> \
--     < scripts/admin_read_only_user.sql
--
-- Safe to run again: it then only sets the password anew. To undo:
--   DROP OWNED BY admin_ro; DROP ROLE admin_ro;

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_ro') AS need_role \gset
\if :need_role
  CREATE ROLE admin_ro LOGIN PASSWORD :'pw';
\else
  ALTER ROLE admin_ro PASSWORD :'pw';
\endif

-- Read-only even if a grant below is ever widened by mistake.
ALTER ROLE admin_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE :"DBNAME" TO admin_ro;
GRANT USAGE ON SCHEMA public TO admin_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO admin_ro;

-- Tables the app creates later (it creates its tables at boot, as postgres).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO admin_ro;

-- The answer: every table should say true.
SELECT table_name,
       has_table_privilege('admin_ro', 'public.' || quote_ident(table_name), 'SELECT') AS can_read
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
 ORDER BY 1;
