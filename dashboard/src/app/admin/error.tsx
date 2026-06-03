"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} titulo="No pudimos cargar la sección admin" />;
}
