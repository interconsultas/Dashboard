"use client";

import { useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/Boton";
import { Input } from "@/components/ui/Campo";
import { CLASES_ETIQUETA_CAMPO } from "@/components/ui/clases";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Correo o contraseña incorrectos");
    // La raíz la resuelve el middleware según el rol (admin → Carga, demás → Dashboard)
    else router.push("/");
  }

  return (
    <div className="min-h-screen flex bg-fondo">
      {/* Panel de marca: degradado del logo (azul → verde), solo en pantallas anchas */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-1/2 relative overflow-hidden bg-cabecera text-white p-12 flex-col justify-between">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <p className="relative text-xs font-bold uppercase tracking-[0.12em] text-white/80">IPS Manizales</p>
        <div className="relative max-w-md">
          <h1 className="font-titulo text-4xl font-extrabold tracking-tight leading-tight">Interconsultas</h1>
          <p className="mt-3 text-base text-white/85">
            Autorizaciones, cumplimiento y productividad de la agenda en un solo lugar.
          </p>
        </div>
        <p className="relative text-xs text-white/75">Sistema de Autorizaciones Médicas</p>
      </aside>

      {/* Formulario */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-superficie border border-borde rounded-tarjeta shadow-tarjeta p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-white rounded-control shadow-logo px-4 py-3">
              <Image
                src="/logo.png"
                alt="IPS Manizales — Interconsultas"
                width={200}
                height={56}
                priority
                style={{ objectFit: "contain" }}
              />
            </div>
            <h2 className="font-titulo text-xl font-bold text-tinta mt-6">Iniciar sesión</h2>
            <p className="text-sm mt-1 text-tinta-3">Sistema de Autorizaciones Médicas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={CLASES_ETIQUETA_CAMPO}>
                Correo electrónico
              </label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5"
                placeholder="usuario@ips.com"
              />
            </div>

            <div>
              <label htmlFor="login-password" className={CLASES_ETIQUETA_CAMPO}>
                Contraseña
              </label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-critico bg-critico-suave border border-critico/20 rounded-control px-3 py-2">
                {error}
              </p>
            )}

            <Boton type="submit" disabled={loading} className="w-full py-2.5 mt-2">
              {loading ? "Ingresando..." : "Ingresar"}
            </Boton>
          </form>
        </div>
      </main>
    </div>
  );
}
