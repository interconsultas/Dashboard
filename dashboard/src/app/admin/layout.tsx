import { AppShell } from "@/components/layout/AppShell";
import { RolProvider } from "@/components/layout/RolContext";
import { sesionConPermisos } from "@/lib/acceso-servidor";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Permisos efectivos de permisos_rol: el menú y los controles de edición los siguen
  const { rol, permisos } = await sesionConPermisos();
  return (
    <RolProvider rol={rol} permisos={permisos}>
      <AppShell>{children}</AppShell>
    </RolProvider>
  );
}
