import DashboardView from "@/components/dashboard/DashboardView";
import { exigirSeccion } from "@/lib/acceso-servidor";

// El layout de /dashboard también envuelve Cumplimiento y Productividad:
// la sección "dashboard" se valida aquí, en la página.
export default async function DashboardPage() {
  await exigirSeccion("dashboard");
  return (
    <DashboardView
      title="Dashboard"
      subtitle="Resumen de autorizaciones medicas"
    />
  );
}
