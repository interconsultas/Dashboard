import { LoadingState } from "@/components/layout/LoadingState";

// Va en cada sección (no en /admin): así el layout de la sección, que valida
// los permisos, queda fuera del límite de Suspense y la redirección es un 307 real.
export default function SeccionLoading() {
  return <LoadingState rows={2} />;
}
