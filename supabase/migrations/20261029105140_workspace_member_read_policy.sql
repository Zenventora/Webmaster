drop policy if exists "Workspace members can read their workspace" on public.workspaces;
create policy "Workspace members can read their workspace"
  on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));
