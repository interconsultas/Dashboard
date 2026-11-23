import { redirect } from "next/navigation";
import { rutaDeEntrada } from "@/lib/acceso-servidor";

/** La raíz lleva al inicio del rol según sus permisos (o a /sin-acceso). */
export default async function HomePage() {
  redirect(await rutaDeEntrada());
}
