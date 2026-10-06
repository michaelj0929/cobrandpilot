<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Data is scoped per workspace: brands.workspace_id → workspaces.owner_id, enforced by RLS helpers (owns_workspace/can_access_brand); admin-client server functions must call assertAccess with the user's client first. Why: server functions bypass RLS.
- App pages live under src/routes/_authenticated (Google sign-in gate); "/" and "/auth" are the public landing. Why: one public entry, everything else needs a session.
- The shared AppShell owns a workspace-aware, collapsible navigation; keep brand actions hidden until a workspace is selected. Why: navigation should reflect the current scope without duplicating route-specific menus.
- Creative Review stores brief and copy uploads as JSON metadata on each validation check and keeps binaries in the existing private creatives bucket. Why: every review input supports the same document and image formats without introducing separate storage paths.
