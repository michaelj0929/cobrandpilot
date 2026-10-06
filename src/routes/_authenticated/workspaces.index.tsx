import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";

import { AppShell, Empty, PageHead } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace, listWorkspaces } from "@/lib/cobrand-client";
import { claimDemoWorkspaces } from "@/lib/workspaces.functions";
import { displayName, useAuthUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/workspaces/")({
  head: () => ({
    meta: [
      { title: "Brand Hub — CoBrand" },
      { name: "description", content: "Choose a brand. Each brand has one master brand system." },
      { property: "og:title", content: "Brand Hub — CoBrand" },
      { property: "og:description", content: "Each master brand holds its sub-brands and product lines." },
    ],
  }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const claimed = useRef(false);
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: listWorkspaces });
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  // First sign-in: pick up the unowned sample workspace, if any.
  useEffect(() => {
    if (claimed.current || !workspaces.isSuccess || workspaces.data.length > 0) return;
    claimed.current = true;
    claimDemoWorkspaces().then((r) => {
      if (r.claimed > 0) queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    });
  }, [workspaces.isSuccess, workspaces.data, queryClient]);

  const create = useMutation({
    mutationFn: () => createWorkspace(name),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: id } });
    },
  });

  const list = workspaces.data ?? [];

  return (
    <AppShell>
      <PageHead
        {...(user ? { eyebrow: `Hi, ${displayName(user).split(" ")[0]}` } : {})}
        title="Brand Hub"
        description="Each master brand holds its own sub-brands and product lines."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus aria-hidden />
            New Brand
          </Button>
        }
      />

      {open ? (
        <section className="surface rise-enter mb-7 flex flex-wrap items-end gap-4 px-6 py-[22px]">
          <div className="grid min-w-[240px] flex-1 gap-1.5">
            <Label htmlFor="ws-name">Master brand name</Label>
            <Input
              id="ws-name"
              placeholder="e.g. Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
          {create.isError ? (
            <p className="w-full text-sm text-destructive">{(create.error as Error).message}</p>
          ) : null}
        </section>
      ) : null}

      {workspaces.isLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : list.length === 0 ? (
        <Empty
          title="No master brands yet"
          body="Create your first master brand to get started."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {list.map((ws) => {
            const brands = ws.brands ?? [];
            const master = brands.find((b) => b.parent_brand_id === null);
            const subs = brands.length - (master ? 1 : 0);
            return (
              <Link
                key={ws.id}
                to="/workspaces/$workspaceId"
                params={{ workspaceId: ws.id }}
                className="rise-enter surface group flex flex-col gap-3 px-6 py-[22px] transition-shadow hover:shadow-md"
              >
                <p className="eyebrow">Master brand</p>
                <h2 className="text-2xl leading-8">{ws.name}</h2>
                <p className="text-sm text-ink-muted">
                  {master
                    ? `${master.name} · v${master.current_version} · ${subs} ${subs === 1 ? "sub-brand" : "sub-brands"}`
                    : "No master brand yet"}
                </p>
                <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  Open <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
