-- Creates application roles if they do not already exist.
-- On local Docker: roles are pre-created by docker/postgres/init/01-roles.sql,
--   and Flyway runs as finshield_owner (NOCREATEROLE) so the DO block is a no-op.
-- On Railway / managed Postgres: Flyway runs as the superuser (SPRING_FLYWAY_USER),
--   so the roles are created here before V1–V9 run.
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_roles WHERE rolname = current_user
      AND (rolsuper OR rolcreaterole)
  ) THEN

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finshield_owner') THEN
      CREATE ROLE finshield_owner LOGIN PASSWORD 'owner_dev_pw'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finshield_app') THEN
      CREATE ROLE finshield_app LOGIN PASSWORD 'app_dev_pw'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'finshield_auditor') THEN
      CREATE ROLE finshield_auditor LOGIN PASSWORD 'auditor_dev_pw'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;

  END IF;
END;
$$;
