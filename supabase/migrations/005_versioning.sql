-- 005_versioning.sql
-- Deployment version registry in a PRIVATE schema (internal), NOT public.
-- Not exposed through the Data API (PostgREST exposes public/graphql_public only).
-- anon/authenticated fully revoked; writes only via service_role (deployment tooling).

create schema if not exists internal;

revoke all on schema internal from anon, authenticated;
grant usage on schema internal to service_role;

create table internal.deployment_registry (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('dev','production')),
  schema_version text not null,                -- semver, e.g. 1.0.0
  migration_head text not null,                -- last applied migration filename
  edge_functions_version text not null,        -- semver
  shopify_integration_version text not null,   -- semver
  git_sha text,
  notes text,
  deployed_at timestamptz not null default now()
);

alter table internal.deployment_registry enable row level security;

revoke all on table internal.deployment_registry from anon, authenticated;
grant select, insert on table internal.deployment_registry to service_role;
-- No policies: anon/authenticated denied; service_role (RLS-exempt) writes via tooling only.
