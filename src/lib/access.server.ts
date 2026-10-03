import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Table = "brands" | "source_files" | "setup_gaps" | "validation_checks";

/**
 * Server functions do their work with the admin client, so first prove the
 * signed-in user can see the row through their own (RLS-scoped) client.
 */
export async function assertAccess(
  userDb: SupabaseClient<Database>,
  table: Table,
  id: string,
): Promise<void> {
  const { data, error } = await userDb.from(table).select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Not found or you don't have access.");
}
