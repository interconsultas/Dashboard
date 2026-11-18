import { readFileSync } from "fs";
import { join } from "path";
import { CLAVES_REGLAS, REGLAS_POR_DEFECTO } from "@/lib/inteligencia/reglas";

const RAIZ = join(__dirname, "../../../../..");
const SQL = readFileSync(join(RAIZ, "etl/sql/020_reglas_alerta.sql"), "utf8");
const INIT = readFileSync(join(RAIZ, "docker/init-db.sh"), "utf8");

const sqlValor = (v: number | null) => (v === null ? "NULL" : String(v));

describe("020_reglas_alerta.sql", () => {
  it("crea la tabla de forma idempotente con las restricciones de rango", () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS reglas_alerta/);
    expect(SQL).toMatch(/clave\s+VARCHAR\(40\)\s+PRIMARY KEY/);
    expect(SQL).toMatch(/CHECK \(umbral IS NULL OR \(umbral >= 0 AND umbral <= 1\)\)/);
    expect(SQL).toMatch(/CHECK \(periodos IS NULL OR periodos BETWEEN 1 AND 6\)/);
    expect(SQL).toMatch(/CHECK \(minimo IS NULL OR minimo >= 0\)/);
    expect(SQL).toMatch(/CHECK \(gravedad IN \('alta', 'media'\)\)/);
    expect(SQL).toContain("actualizado_por");
  });

  it("siembra cada regla con los valores por defecto del código sin pisar lo configurado", () => {
    for (const clave of CLAVES_REGLAS) {
      const r = REGLAS_POR_DEFECTO[clave];
      const fila = new RegExp(
        `\\('${clave}',[\\s\\S]*?TRUE,\\s*${sqlValor(r.umbral)},\\s*${sqlValor(r.periodos)},\\s*${sqlValor(r.minimo)},\\s*'${r.gravedad}'\\)`
      );
      expect(SQL).toMatch(fila);
    }
    expect(SQL).toContain("ON CONFLICT (clave) DO NOTHING");
  });

  it("no cambia permisos ni borra objetos (admin edita por regla fija)", () => {
    expect(SQL).not.toMatch(/'direccion_medica',\s*'inteligencia',\s*'editar'/);
    expect(SQL).not.toMatch(/DROP\s+TABLE|CASCADE/i);
  });

  it("init-db.sh la ejecuta justo después de 019", () => {
    expect(INIT).toMatch(/019_inteligencia\.sql \\\s*\n\s*\/sql\/020_reglas_alerta\.sql; do/);
  });
});
