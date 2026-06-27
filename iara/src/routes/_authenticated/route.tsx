import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { IaraHeader } from "@/lib/iara-header";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

function AuthedShell() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <IaraHeader user={{ email: user.email, name: (user.user_metadata as { full_name?: string } | null)?.full_name }} />
      <Outlet />
    </>
  );
}
