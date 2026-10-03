import { createFileRoute } from "@tanstack/react-router";

import { Landing } from "@/components/landing";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CoBrand" },
      { name: "description", content: "Sign in to CoBrand with your Google account." },
      { property: "og:title", content: "Sign in — CoBrand" },
      { property: "og:description", content: "Sign in to CoBrand with your Google account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});
