import { createFileRoute } from "@tanstack/react-router";

import { Landing } from "@/components/landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CoBrand — Brand truth for every creative" },
      {
        name: "description",
        content:
          "Turn your brand guidelines into a living brand system and check every creative against it.",
      },
      { property: "og:title", content: "CoBrand — Brand truth for every creative" },
      {
        property: "og:description",
        content: "Build a living brand system and review creative against it, in context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});
