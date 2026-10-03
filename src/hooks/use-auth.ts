import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/** The signed-in user (null when signed out, undefined while loading). */
export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

export function displayName(user: User | null | undefined) {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  return meta.full_name ?? meta.name ?? user?.email ?? "You";
}

export function avatarUrl(user: User | null | undefined) {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  return meta.avatar_url ?? meta.picture ?? null;
}
