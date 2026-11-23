import { Suspense } from "react";
import ProductividadView from "@/components/productividad/ProductividadView";

export default function ProductividadPage() {
  // useSearchParams (filtros en la URL) exige un límite de Suspense
  return (
    <Suspense>
      <ProductividadView />
    </Suspense>
  );
}
