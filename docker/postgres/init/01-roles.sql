-- Owner: runs migrations (DDL). Bypasses RLS because it owns the tables.
CREATE ROLE finshield_owner LOGIN PASSWORD 'owner_dev_pw'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

-- Runtime app role: least privilege, subject to RLS.
CREATE ROLE finshield_app LOGIN PASSWORD 'app_dev_pw'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

ALTER DATABASE finshield OWNER TO finshield_owner;
ALTER SCHEMA public OWNER TO finshield_owner;

REVOKE ALL ON DATABASE finshield FROM PUBLIC;
GRANT CONNECT ON DATABASE finshield TO finshield_owner, finshield_app;