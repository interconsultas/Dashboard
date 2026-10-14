import { EXPORT_COLUMNS } from "@/lib/export-columns";

describe("EXPORT_COLUMNS", () => {
  it("includes the digitizing user right after the professional", () => {
    const aliases = EXPORT_COLUMNS.map((c) => c.alias);
    const idx = aliases.indexOf("usuario_txt");

    expect(idx).toBeGreaterThan(-1);
    expect(aliases[idx - 1]).toBe("nombre_medico");
    expect(EXPORT_COLUMNS[idx]).toEqual({ sql: "usuario_txt", alias: "usuario_txt", header: "Usuario" });
  });

  it("has unique aliases", () => {
    const aliases = EXPORT_COLUMNS.map((c) => c.alias);
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});
