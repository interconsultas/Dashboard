import { readFileSync } from "fs";
import { join } from "path";
import { PERMISOS_POR_DEFECTO, ROLES } from "@/lib/acceso";

const RAIZ = join(__dirname, "../../../../..");
const SQL = readFileSync(join(RAIZ, "etl/sql/019_inteligencia.sql"), "utf8");
const INIT = readFileSync(join(RAIZ, "docker/init-db.sh"), "utf8");

describe("019_inteligencia.sql", () => {
  it("siembra la sección inteligencia con los niveles por defecto de cada rol", () => {
    for (const rol of ROLES) {
      const nivel = PERMISOS_POR_DEFECTO[rol].inteligencia;
      expect(SQL).toMatch(new RegExp(`\\('${rol}',\\s*'inteligencia',\\s*'${nivel}'\\)`));
    }
  });

  it("es idempotente y no pisa lo configurado", () => {
    expect(SQL).toContain("ON CONFLICT (rol, seccion) DO NOTHING");
    expect(SQL).not.toMatch(/CREATE\s+(MATERIALIZED\s+)?VIEW|CREATE\s+TABLE/i);
  });

  it("init-db.sh la ejecuta justo después de 018", () => {
    expect(INIT).toMatch(/018_permisos_rol\.sql \\\s*\n\s*\/sql\/019_inteligencia\.sql; do/);
  });
});
