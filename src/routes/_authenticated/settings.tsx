import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { AppShell, PageHead, SectionHead } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getBrandFamily, listWorkspaces, renameWorkspace } from "@/lib/cobrand-client";
import { SubBrandActions } from "@/components/sub-brands";
import { displayName, useAuthUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CoBrand" },
      { name: "description", content: "Your CoBrand account and workspaces." },
      { property: "og:title", content: "Settings — CoBrand" },
      { property: "og:description", content: "Your CoBrand account and workspaces." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: listWorkspaces });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <PageHead title="Settings" description="Your account and the workspaces you own." />

      <section className="surface mb-7 flex flex-wrap items-center gap-5 px-6 py-[22px]">
        <UserAvatar user={user} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{displayName(user)}</p>
          <p className="text-sm text-ink-muted">{user?.email} · Signed in with Google</p>
        </div>
        <Button variant="secondary" onClick={signOut}>
          <LogOut aria-hidden />
          Sign out
        </Button>
      </section>

      <section className="surface px-6 py-[22px]">
        <SectionHead title="Workspaces" description="Rename the workspaces you own." />
        <ul>
          {(workspaces.data ?? []).map((ws) => (
            <WorkspaceRow key={ws.id} id={ws.id} name={ws.name} />
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

function WorkspaceRow({ id, name }: { id: string; name: string }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(name);
  const save = useMutation({
    mutationFn: () => renameWorkspace(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  });
  return (
    <li className="border-t border-line-soft py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="max-w-sm" />
        <Button
          size="sm"
          variant="secondary"
          disabled={!value.trim() || value === name || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isSuccess && value === name ? "Saved" : "Save"}
        </Button>
      </div>
      <WorkspaceSubBrands workspaceId={id} />
    </li>
  );
}

function WorkspaceSubBrands({ workspaceId }: { workspaceId: string }) {
  const family = useQuery({
    queryKey: ["brand-family", workspaceId],
    queryFn: () => getBrandFamily(workspaceId),
  });
  const master = family.data?.master;
  const subs = family.data?.subBrands ?? [];
  if (!master) return null;
  return (
    <div className="mt-3 pl-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Sub-Brands and Product Lines
      </p>
      {subs.length === 0 ? (
        <p className="text-sm text-ink-muted">None yet.</p>
      ) : (
        <ul className="space-y-2">
          {subs.map((sub) => (
            <li
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line-soft px-3 py-2"
            >
              <span className="text-sm font-medium">{sub.name}</span>
              <SubBrandActions sub={sub} masterId={master.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
