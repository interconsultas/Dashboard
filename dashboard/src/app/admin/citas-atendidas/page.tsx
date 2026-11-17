import { redirect } from "next/navigation";

/** Ruta anterior de la pantalla de Citas: se conserva para enlaces guardados. */
export default function CitasAtendidasRedirect() {
  redirect("/admin/citas");
}
