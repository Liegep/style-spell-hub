import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  beforeLoad: ({ search }) => {
    const uiLang = search.uiLang === "es" ? "es" : search.uiLang === "en" ? "en" : undefined;
    throw redirect({ to: "/app/atelier", search: uiLang ? { uiLang } : undefined });
  },
  component: () => null,
});
