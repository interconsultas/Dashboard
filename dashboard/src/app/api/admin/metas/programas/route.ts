import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";
import { normalizarProgramaMeta, type ProgramaMeta } from "@/lib/cumplimiento/categorias";

// programa_especialidad es VARCHAR(100), igual que en medicos
const ESPECIALIDAD_MAX = 100;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/** Misma normalización que el cruce en SQL: UPPER(TRIM()). */
function normalizarEspecialidad(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const texto = valor.trim().toUpperCase();
  if (texto === "" || texto.length > ESPECIALIDAD_MAX) return null;
  return texto;
}

/**
 * Mapeo especialidad → programa de metas. Lista cada programa_especialidad
 * presente en medicos más las especialidades ya mapeadas (aunque hoy no
 * tengan profesionales), con el número de profesionales de cada una.
 */
export async function GET() {
  const { error } = await requireAuth(["admin", "direccion_medica"]);
  if (error) return error;

  const mapeo = await query<{
    programa_especialidad: string;
    programa: string | null;
    profesionales: number;
  }>(
    `WITH especialidades AS (
       SELECT UPPER(TRIM(programa_especialidad)) AS especialidad, COUNT(*)::int AS profesionales
       FROM medicos
       WHERE TRIM(COALESCE(programa_especialidad, '')) <> ''
       GROUP BY 1
     )
     SELECT COALESCE(e.especialidad, UPPER(TRIM(p.programa_especialidad))) AS programa_especialidad,
            p.programa,
            COALESCE(e.profesionales, 0) AS profesionales
     FROM especialidades e
     FULL JOIN programa_meta_mapeo p
            ON UPPER(TRIM(p.programa_especialidad)) = e.especialidad
     ORDER BY 1`
  );

  return NextResponse.json({ mapeo });
}

export async function PUT(request: Request) {
  const { error } = await requireAuth(["admin"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return badRequest("El cuerpo de la solicitud no es válido");
  }
  if (!Array.isArray(body.mapeo) || body.mapeo.length === 0) {
    return badRequest("Debe enviar al menos una especialidad");
  }

  // Se valida todo antes de escribir: si una fila es inválida no se guarda ninguna
  const filas: { especialidad: string; programa: ProgramaMeta | null }[] = [];
  const vistas = new Set<string>();

  for (let i = 0; i < body.mapeo.length; i++) {
    const fila = body.mapeo[i];
    const n = i + 1;
    if (!fila || typeof fila !== "object") {
      return badRequest(`Fila ${n}: formato no válido`);
    }
    const especialidad = normalizarEspecialidad(fila.programa_especialidad);
    if (especialidad === null) {
      return badRequest(
        `Fila ${n}: la especialidad debe tener entre 1 y ${ESPECIALIDAD_MAX} caracteres`
      );
    }
    const ref = `Fila ${n} (${especialidad})`;
    if (vistas.has(especialidad)) {
      return badRequest(`${ref}: la especialidad está repetida`);
    }
    vistas.add(especialidad);

    // Vacío o null = "Sin meta". TOTAL MGI no es asignable a profesionales.
    const programa = normalizarProgramaMeta(fila.programa);
    if (!programa.valido) {
      return badRequest(`${ref}: programa no válido`);
    }
    filas.push({ especialidad, programa: programa.valor });
  }

  const values: unknown[] = [];
  const tuplas = filas.map((f) => {
    const base = values.length;
    values.push(f.especialidad, f.programa);
    return `($${base + 1}, $${base + 2})`;
  });

  // Un solo INSERT de varias filas: el guardado es atómico
  await query(
    `INSERT INTO programa_meta_mapeo (programa_especialidad, programa)
     VALUES ${tuplas.join(", ")}
     ON CONFLICT (programa_especialidad) DO UPDATE SET
       programa = EXCLUDED.programa,
       actualizado_en = NOW()`,
    values
  );

  // El cumplimiento se calcula con el programa resuelto: no debe servirse desde el caché
  clearCache();

  return NextResponse.json({ guardadas: filas.length });
}
