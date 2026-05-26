import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicHeader } from "@/components/brand/PublicHeader";
import { PublicFooter } from "@/components/brand/PublicFooter";

export const Route = createFileRoute("/$lang")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <Outlet />
      <PublicFooter />
    </div>
  );
}
