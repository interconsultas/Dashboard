import { Suspense } from "react";
import InteligenciaView from "@/components/inteligencia/InteligenciaView";

export default function InteligenciaPage() {
  // useSearchParams (nodo y periodo en la URL) exige un límite de Suspense
  return (
    <Suspense>
      <InteligenciaView />
    </Suspense>
  );
}
