import { AppShell } from "@/components/layout/AppShell";
import { RolProvider } from "@/components/layout/RolContext";
import { rolDeSesion } from "@/lib/middleware-roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rol = await rolDeSesion();
  return (
    <RolProvider rol={rol}>
      <AppShell>{children}</AppShell>
    </RolProvider>
  );
}
