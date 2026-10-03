import type { User } from "@supabase/supabase-js";

import { avatarUrl, displayName } from "@/hooks/use-auth";

export function UserAvatar({ user, size = 34 }: { user: User | null | undefined; size?: number }) {
  const url = avatarUrl(user);
  const initial = displayName(user).charAt(0).toUpperCase();
  return url ? (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand"
    >
      {initial}
    </span>
  );
}
