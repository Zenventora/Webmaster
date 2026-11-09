drop policy if exists "Workspace members can read their workspace" on public.workspaces;
create index if not exists workspace_product_entitlements_edition_idx on public.workspace_product_entitlements(edition_key);
