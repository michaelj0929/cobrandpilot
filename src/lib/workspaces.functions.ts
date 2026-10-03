import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Pilot convenience: the first person to sign in with no workspaces of their
 * own takes over any unowned demo workspace (e.g. the seeded Nike sample).
 */
export const claimDemoWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("workspaces")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { claimed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("workspaces")
      .update({ owner_id: context.userId })
      .is("owner_id", null)
      .select("id");
    return { claimed: data?.length ?? 0 };
  });
