# SiteRadar data model and tenant isolation

This is a proposed model. Apply it only in a dedicated SiteRadar Supabase project after reviewing the migration. Do not apply it to a production project that serves unrelated applications.

## Core entities

### profiles
- user_id UUID primary key references auth.users(id)
- display_name text null
- created_at timestamptz default now()
- updated_at timestamptz default now()

### workspaces
- id UUID primary key
- name text not null
- slug text not null unique
- created_by UUID references auth.users(id)
- plan_key text not null default 'free'
- created_at, updated_at timestamptz

### workspace_members
- workspace_id UUID references workspaces(id)
- user_id UUID references auth.users(id)
- role text constrained to owner, admin, member, viewer
- invited_at, joined_at timestamptz
- primary key (workspace_id, user_id)
- unique/foreign-key/index constraints as appropriate

### sites
- id UUID primary key
- workspace_id UUID references workspaces(id)
- name text not null
- start_url text not null
- normalized_origin text not null
- sitemap_url text null
- status text constrained to active, paused, archived
- crawl_config jsonb not null default '{}'
- created_by UUID references auth.users(id)
- created_at, updated_at timestamptz
- index workspace_id, normalized_origin

### audit_runs
- id UUID primary key
- site_id UUID references sites(id)
- workspace_id UUID references workspaces(id)
- initiated_by UUID references auth.users(id) null for scheduled job
- status text constrained to queued, running, completed, partial, failed, cancelled
- started_at, finished_at timestamptz null
- config_snapshot jsonb not null
- summary jsonb not null default '{}'
- ruleset_version text not null
- created_at timestamptz default now()
- indexes (site_id, created_at desc), (workspace_id, created_at desc), (status, created_at)

### audit_jobs
- id UUID primary key
- audit_run_id UUID references audit_runs(id)
- status text constrained to queued, running, completed, failed, cancelled
- attempts int not null default 0
- heartbeat_at timestamptz null
- started_at, finished_at timestamptz null
- error_code text null
- retry_after timestamptz null
- created_at timestamptz
- indexes for queue claiming and audit run lookups
- worker-only mutation policy; never allow browser clients to modify execution state directly

### pages
- id UUID primary key
- audit_run_id UUID references audit_runs(id)
- site_id UUID references sites(id)
- workspace_id UUID references workspaces(id)
- requested_url text not null
- final_url text null
- normalized_url text not null
- status_code int null
- response_content_type text null
- indexability_status text not null default 'unknown'
- fetch_state text not null default 'pending'
- redirect_chain jsonb not null default '[]'
- meta_snapshot jsonb not null default '{}'
- content_fingerprint text null
- inlinks_count int not null default 0
- outlinks_count int not null default 0
- crawl_depth int null
- fetched_at timestamptz null
- unique (audit_run_id, normalized_url)
- indexes (audit_run_id, status_code), (site_id, normalized_url), (workspace_id, fetched_at desc)

### page_links
- id UUID primary key
- audit_run_id UUID references audit_runs(id)
- source_page_id UUID references pages(id)
- target_url text not null
- normalized_target_url text not null
- target_page_id UUID references pages(id) null
- link_type text constrained to internal, external, asset, unknown
- anchor_text text null
- rel_tokens text[] not null default '{}'
- http_status int null
- created_at timestamptz
- indexes (source_page_id), (audit_run_id, normalized_target_url)

### issues
- id UUID primary key
- workspace_id UUID references workspaces(id)
- site_id UUID references sites(id)
- rule_id text not null
- rule_version text not null
- category text not null
- severity text constrained to critical, error, warning, info, opportunity
- title text not null
- description text not null
- recommendation text not null
- status text constrained to open, ignored, resolved
- first_seen_at timestamptz
- last_seen_at timestamptz
- last_audit_run_id UUID references audit_runs(id)
- assignee_user_id UUID references auth.users(id) null
- metadata jsonb not null default '{}'
- indexes (site_id, status, severity), (workspace_id, status), (rule_id)

### issue_occurrences
- id UUID primary key
- issue_id UUID references issues(id)
- audit_run_id UUID references audit_runs(id)
- page_id UUID references pages(id) null
- evidence jsonb not null default '{}'
- observed_at timestamptz not null default now()
- unique where semantics allow an issue per page and audit
- indexes (issue_id, observed_at desc), (audit_run_id, page_id)

### performance_results
- id UUID primary key
- site_id UUID references sites(id)
- workspace_id UUID references workspaces(id)
- audit_run_id UUID references audit_runs(id) null
- page_id UUID references pages(id) null
- source text constrained to lighthouse_lab, crux_url, crux_origin, rum
- device text null
- measured_at timestamptz not null
- metrics jsonb not null
- raw_artifact_location text null for protected object storage only
- indexes (site_id, measured_at desc), (page_id, measured_at desc)

### uptime_monitors and monitor_events
- monitor: workspace_id, site_id, target_url, interval, timeout, expected_status_range, enabled, latest_state, last_check_at
- event: monitor_id, observed_at, state, status_code, duration_ms, error_code, transition_key
- unique transition/idempotency key as appropriate
- retain minimum diagnostic details; never store request secrets

### report_exports
- workspace_id, site_id, audit_run_id, created_by, format, status, object_path, expires_at, created_at
- signed share URLs must be short-lived or backed by random revocable tokens and server authorization; never expose public storage paths

### usage_events
- workspace_id, actor_user_id nullable, resource_kind, quantity, audit_run_id nullable, idempotency_key, created_at
- unique idempotency key where appropriate; append-only for auditability

## Tenant isolation

All user-accessible tables in exposed schemas must have RLS enabled. Every table needs an authorization model appropriate to its relationships.

For example, a site is accessible only when the current user is a member of the site’s workspace. Audit runs, pages, issues, metrics, reports and monitors should inherit access via a site/workspace membership check. Define carefully reviewed helper SQL functions if needed, use SECURITY INVOKER by default, and restrict EXECUTE privileges. Do not rely only on a client-provided workspace_id.

RLS policies should explicitly use the authenticated role and membership/ownership predicates. UPDATE policies need both USING and WITH CHECK. No client may arbitrarily assign another user as owner or move a row across workspaces. Test all operations with two separate user identities.

Service-side workers use narrowly scoped server credentials and validate job/site relationships on every operation. Never place a service-role or secret key in browser bundles.

## Important constraints

- Unique normalized URL per audit run.
- Explicit maximum values for limits and counters.
- Audit state transitions validated server-side.
- JSONB only for flexible snapshots, not every queryable property.
- Index common filters and foreign key columns based on observed query plans.
- Retention and deletion rules for page-level/raw performance payloads.
- Store URLs and crawl evidence as untrusted content; escape it before UI rendering.
- Keep sensitive integration OAuth credentials encrypted server-side, with minimal scopes and revocation.
- Never store passwords, password reset tokens or confirmation codes in these application tables.

## Definition of done

- Reviewed migration plan.
- RLS enabled and policies tested for each exposed table.
- Cross-workspace tests for SELECT/INSERT/UPDATE/DELETE.
- Security and performance advisors reviewed and remediations completed.
- Indexes justified by common queries.
- Backup and restore documented.
