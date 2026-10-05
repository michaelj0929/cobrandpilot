import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { lovable } from "@/integrations/lovable/index";
import { useAuthUser } from "@/hooks/use-auth";

/** Public home: blue full-bleed page with the wordmark and Google sign-in. */
export function Landing() {
  const user = useAuthUser();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/workspaces", replace: true });
  }, [user, navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/workspaces", replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-brand text-on-brand">
      <header className="px-6 pt-8 md:px-14">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-center px-6 py-16 md:px-14">
        <div className="rise-enter flex max-w-2xl flex-col gap-6">
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight md:text-7xl">
            Your Source of Brand Truth
          </h1>
          <p className="max-w-lg text-lg text-on-brand/80">
            Upload your brand copy, strategy decks, and supporting materials to create a living
            source of truth that keeps every decision aligned with your brand.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2">
            <button
              type="button"
              onClick={signIn}
              disabled={busy}
              className="inline-flex h-12 items-center gap-3 rounded-full bg-card px-6 text-sm font-semibold text-ink shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-70"
            >
              <GoogleMark />
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
            {error ? <p className="text-sm text-highlight">{error}</p> : null}
          </div>
        </div>
      </main>
      <footer className="px-6 pb-8 text-xs text-on-brand/60 md:px-14">CoBrand pilot</footer>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex flex-col text-[34px] leading-[0.8] font-extrabold tracking-[-0.8px]">
      <span>co</span>
      <span>brand</span>
    </span>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
