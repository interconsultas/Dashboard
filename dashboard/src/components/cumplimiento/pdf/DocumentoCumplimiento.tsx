/**
 * Documento PDF del informe de cumplimiento (@react-pdf/renderer).
 * Solo maqueta: los textos y las series llegan ya formateados en `InformeCumplimiento`.
 * Se carga bajo demanda en el navegador (ver `descargarInforme.ts`).
 */
import {
  Document,
  Font,
  G,
  Image,
  Line,
  Page,
  Polyline,
  Circle,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import { CATEGORIAS } from "@/lib/cumplimiento/categorias";
import { yEtiquetaBarra } from "@/lib/cumplimiento/informe";
import type {
  CeldaPct,
  FilaHistorialInforme,
  FilaRankingInforme,
  GraficaInforme,
  IndicadorInforme,
  InformeCumplimiento,
  TendenciaInforme,
} from "@/lib/cumplimiento/informe";
import type { EstadoMeta } from "@/lib/cumplimiento/presentacion";

// Sin guiones de partición: los encabezados de las tablas se cortan por palabras completas
Font.registerHyphenationCallback((palabra) => [palabra]);

/* ── Paleta (la misma de las gráficas en pantalla) ── */

const NAVY = "#1A3F72";
const NAVY_SERIE = "#1e3a5f";
const GREEN = "#4EA234";
const RED = "#dc2626";
const EMERALD = "#059669";
const GRAY = "#6b7280";
const GRAY_CLARO = "#9ca3af";
const BORDE = "#e5e7eb";
const FONDO_SUAVE = "#f3f6fb";
const GRILLA = "#f3f4f6";

const COLOR_ESTADO: Record<EstadoMeta, string> = {
  sobre: RED,
  dentro: EMERALD,
  sin_datos: GRAY_CLARO,
};

const FONDO_ESTADO: Record<EstadoMeta, string> = {
  sobre: "#fef2f2",
  dentro: "#ecfdf5",
  sin_datos: GRILLA,
};

/* ── Medidas: A4 horizontal (842 × 595 pt) ── */

const MARGEN = 28;
const ANCHO_UTIL = 842 - MARGEN * 2;

const s = StyleSheet.create({
  pagina: {
    paddingTop: MARGEN,
    paddingBottom: MARGEN + 18,
    paddingHorizontal: MARGEN,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#374151",
  },
  negrita: { fontWeight: "bold" },
  // Encabezado principal
  encabezado: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
  },
  logo: { width: 120, height: 35 },
  titulo: { fontWeight: "bold", fontSize: 18, color: NAVY },
  subtitulo: { fontSize: 9, color: GRAY, marginTop: 2 },
  metaEncabezado: { alignItems: "flex-end", maxWidth: 420 },
  metaLinea: { fontSize: 8.5, color: "#374151", marginTop: 2, textAlign: "right" },
  // Encabezado corto de las páginas siguientes
  encabezadoCorto: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDE,
  },
  logoCorto: { width: 72, height: 21 },
  textoCorto: { fontSize: 8, color: GRAY },
  // Secciones
  seccion: { marginBottom: 12 },
  tituloSeccion: {
    fontWeight: "bold",
    fontSize: 8.5,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  notaSeccion: { fontSize: 7.5, color: GRAY, marginTop: 1, marginBottom: 6 },
  aviso: {
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    color: "#92400e",
    borderRadius: 4,
    padding: 6,
    fontSize: 8,
    marginBottom: 10,
  },
  // Resumen
  resumen: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tileGlobal: {
    width: 170,
    backgroundColor: NAVY,
    borderRadius: 6,
    padding: 12,
    justifyContent: "center",
  },
  tiles: { flex: 1, gap: 6 },
  filaTiles: { flexDirection: "row", gap: 6 },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDE,
    borderRadius: 6,
    padding: 7,
  },
  etiquetaTile: {
    fontWeight: "bold",
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    fontWeight: "bold",
    fontSize: 6.5,
    marginTop: 4,
  },
  // Tablas
  tabla: { borderTopWidth: 1, borderTopColor: BORDE },
  filaEncabezado: {
    flexDirection: "row",
    backgroundColor: FONDO_SUAVE,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BORDE },
  filaPar: { backgroundColor: "#fafafa" },
  th: {
    fontWeight: "bold",
    fontSize: 6.5,
    color: GRAY,
    textTransform: "uppercase",
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  td: { fontSize: 7.5, paddingVertical: 3.5, paddingHorizontal: 3 },
  derecha: { textAlign: "right" },
  centro: { textAlign: "center" },
  // Pie
  pie: {
    position: "absolute",
    bottom: MARGEN - 6,
    left: MARGEN,
    right: MARGEN,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDE,
    paddingTop: 4,
    fontSize: 7,
    color: GRAY,
  },
});

/* ── Piezas comunes ── */

export interface PropsDocumento {
  informe: InformeCumplimiento;
  /** Logo de la IPS: URL, ruta local (servidor) o datos. null = solo texto. */
  logo: string | { data: Buffer; format: "png" | "jpg" } | null;
}

function Encabezado({ informe, logo }: PropsDocumento) {
  return (
    <View style={s.encabezado}>
      <View>
        {logo && <Image src={logo} style={s.logo} />}
        <Text style={[s.titulo, logo ? { marginTop: 8 } : {}]}>{informe.titulo}</Text>
        <Text style={s.subtitulo}>Órdenes por cita atendida frente a la meta del programa de cada profesional</Text>
      </View>
      <View style={s.metaEncabezado}>
        {informe.periodo && (
          <Text style={[s.metaLinea, s.negrita, { fontSize: 10, color: NAVY }]}>{`Periodo: ${informe.periodo}`}</Text>
        )}
        {informe.filtros.map((f) => (
          <Text key={f.etiqueta} style={s.metaLinea}>
            <Text style={s.negrita}>{`${f.etiqueta}: `}</Text>
            {f.valor}
          </Text>
        ))}
        <Text style={[s.metaLinea, { color: GRAY }]}>{informe.atribucion}</Text>
        <Text style={[s.metaLinea, { color: GRAY }]}>{`Generado el ${informe.generado}`}</Text>
      </View>
    </View>
  );
}

function EncabezadoCorto({ informe, logo }: PropsDocumento) {
  const profesional = informe.detalle.tipo === "profesional" ? informe.detalle.profesional.nombre : null;
  return (
    <View style={s.encabezadoCorto} fixed>
      {logo ? <Image src={logo} style={s.logoCorto} /> : <Text style={[s.negrita, { color: NAVY }]}>IPS Interconsultas</Text>}
      <Text style={s.textoCorto}>
        {[informe.titulo, profesional, informe.periodo].filter(Boolean).join(" · ")}
      </Text>
    </View>
  );
}

function Pie({ informe }: { informe: InformeCumplimiento }) {
  return (
    <View style={s.pie} fixed>
      <Text>{`${informe.titulo} · Generado el ${informe.generado}`}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

function TituloSeccion({ titulo, nota }: { titulo: string; nota?: string }) {
  return (
    <View>
      <Text style={s.tituloSeccion}>{titulo}</Text>
      {nota ? <Text style={s.notaSeccion}>{nota}</Text> : <View style={{ height: 6 }} />}
    </View>
  );
}

function Pct({ celda, estilo }: { celda: CeldaPct; estilo?: Styles[string] }) {
  return (
    <Text
      style={[
        s.td,
        s.derecha,
        { color: COLOR_ESTADO[celda.estado] },
        celda.estado === "sobre" ? s.negrita : {},
        estilo ?? {},
      ]}
    >
      {celda.texto}
    </Text>
  );
}

/* ── Resumen ── */

function Tile({ indicador }: { indicador: IndicadorInforme }) {
  return (
    <View style={s.tile}>
      <Text style={s.etiquetaTile}>{indicador.etiqueta}</Text>
      <Text
        style={[
          s.negrita,
          { fontSize: 15, marginTop: 3, color: indicador.estado === "sin_datos" ? GRAY_CLARO : NAVY },
        ]}
      >
        {indicador.texto}
      </Text>
      <Text style={[s.chip, { color: COLOR_ESTADO[indicador.estado], backgroundColor: FONDO_ESTADO[indicador.estado] }]}>
        {indicador.estadoTexto}
      </Text>
    </View>
  );
}

function Resumen({ resumen }: { resumen: InformeCumplimiento["resumen"] }) {
  const { global } = resumen;
  const chipGlobal = global.estado === "sobre" ? RED : global.estado === "dentro" ? GREEN : "#4b6a94";
  return (
    <View style={s.resumen} wrap={false}>
      <View style={s.tileGlobal}>
        <Text style={[s.etiquetaTile, { color: "#c7d2e3", fontSize: 8 }]}>{global.etiqueta}</Text>
        <Text style={[s.negrita, { fontSize: 34, color: "#ffffff", marginTop: 4 }]}>{global.texto}</Text>
        <Text style={[s.chip, { marginTop: 8, color: "#ffffff", backgroundColor: chipGlobal }]}>{global.estadoTexto}</Text>
        <Text style={{ fontSize: 7, color: "#c7d2e3", marginTop: 4 }}>{resumen.notaMeta}</Text>
      </View>
      <View style={s.tiles}>
        {[resumen.categorias.slice(0, 4), resumen.categorias.slice(4)].map((fila, i) => (
          <View key={i} style={s.filaTiles}>
            {fila.map((c) => (
              <Tile key={c.etiqueta} indicador={c} />
            ))}
            {/* Hueco para que la segunda fila conserve el ancho de las tarjetas */}
            {fila.length < 4 && <View style={{ flex: 4 - fila.length }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Gráficas (primitivas SVG de react-pdf) ── */

interface Area {
  ancho: number;
  alto: number;
  izq: number;
  arriba: number;
  abajo: number;
}

function y(area: Area, techo: number, pct: number): number {
  const util = area.alto - area.arriba - area.abajo;
  return area.arriba + util * (1 - Math.min(pct, techo) / techo);
}

function Eje({ area, techo, marcas, fuente }: { area: Area; techo: number; marcas: number[]; fuente: number }) {
  return (
    <G>
      {marcas.map((m) => (
        <G key={m}>
          <Line x1={area.izq} x2={area.ancho} y1={y(area, techo, m)} y2={y(area, techo, m)} stroke={GRILLA} strokeWidth={0.75} />
          <Text
            x={area.izq - 4}
            y={y(area, techo, m) + fuente / 3}
            style={{ fontSize: fuente, fill: GRAY }}
            textAnchor="end"
          >
            {`${m}%`}
          </Text>
        </G>
      ))}
    </G>
  );
}

function LineaMeta({ area, techo }: { area: Area; techo: number }) {
  const ym = y(area, techo, 100);
  return <Line x1={area.izq} x2={area.ancho} y1={ym} y2={ym} stroke={GREEN} strokeWidth={1.5} strokeDasharray="6 3" />;
}

function GraficaBarras({ grafica }: { grafica: GraficaInforme }) {
  const area: Area = { ancho: ANCHO_UTIL, alto: 175, izq: 36, arriba: 16, abajo: 16 };
  const n = grafica.puntos.length;
  const banda = (area.ancho - area.izq) / Math.max(n, 1);
  const anchoBarra = Math.min(28, banda * 0.6);
  const base = y(area, grafica.techo, 0);
  const centro = (i: number) => area.izq + banda * i + banda / 2;

  return (
    <View style={s.seccion} wrap={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <TituloSeccion titulo={grafica.titulo} nota={grafica.subtitulo} />
        {grafica.hayDatos && <LeyendaMeta texto="Meta 100% (menor es mejor)" />}
      </View>
      {!grafica.hayDatos ? (
        <Text style={{ color: GRAY, textAlign: "center", paddingVertical: 30 }}>Sin datos para mostrar la gráfica</Text>
      ) : (
        <Svg width={area.ancho} height={area.alto}>
          <Eje area={area} techo={grafica.techo} marcas={grafica.marcas} fuente={7} />
          {grafica.puntos.map((p, i) => {
            const cx = centro(i);
            const tope = p.pct === null ? base : y(area, grafica.techo, p.pct);
            return (
              <G key={p.periodo}>
                {p.pct !== null && (
                  <Rect x={cx - anchoBarra / 2} y={tope} width={anchoBarra} height={Math.max(base - tope, 0.5)} fill={NAVY_SERIE} />
                )}
                <Text x={cx} y={area.alto - 4} textAnchor="middle" style={{ fontSize: 7, fill: GRAY }}>
                  {p.etiqueta}
                </Text>
              </G>
            );
          })}
          <LineaMeta area={area} techo={grafica.techo} />
          {/* Las cifras van encima de la línea de la meta para que se lean completas */}
          {grafica.conEtiquetas &&
            grafica.puntos.map((p, i) =>
              p.pct === null ? null : (
                <Text
                  key={p.periodo}
                  x={centro(i)}
                  y={yEtiquetaBarra(y(area, grafica.techo, p.pct), y(area, grafica.techo, 100))}
                  textAnchor="middle"
                  style={{ fontSize: 7.5, fill: NAVY_SERIE, fontWeight: "bold" }}
                >
                  {p.texto}
                </Text>
              )
            )}
        </Svg>
      )}
    </View>
  );
}

function LeyendaMeta({ texto }: { texto: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Svg width={18} height={4}>
        <Line x1={0} x2={18} y1={2} y2={2} stroke={GREEN} strokeWidth={1.5} strokeDasharray="4 2" />
      </Svg>
      <Text style={{ fontSize: 7, color: GRAY }}>{texto}</Text>
    </View>
  );
}

// Un punto de holgura evita que el redondeo del layout pase la cuarta tarjeta a otra fila
const ANCHO_TENDENCIA = Math.floor((ANCHO_UTIL - 3 * 8) / 4) - 1;

function Tendencia({ tendencia }: { tendencia: TendenciaInforme }) {
  const area: Area = { ancho: ANCHO_TENDENCIA - 14, alto: 110, izq: 30, arriba: 8, abajo: 14 };
  const n = tendencia.puntos.length;
  const paso = n > 1 ? (area.ancho - area.izq - 26) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? area.izq + 12 + paso * i : (area.izq + area.ancho) / 2);
  // Los meses sin dato cortan la línea, como en pantalla
  const tramos: { x: number; y: number }[][] = [];
  let actual: { x: number; y: number }[] = [];
  tendencia.puntos.forEach((p, i) => {
    if (p.pct === null) {
      if (actual.length) tramos.push(actual);
      actual = [];
    } else {
      actual.push({ x: x(i), y: y(area, tendencia.techo, p.pct) });
    }
  });
  if (actual.length) tramos.push(actual);
  const cadaCuanto = Math.max(1, Math.ceil(n / 6));

  return (
    <View
      style={{ width: ANCHO_TENDENCIA, borderWidth: 1, borderColor: BORDE, borderRadius: 6, padding: 7 }}
      wrap={false}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <Text style={[s.etiquetaTile, { maxWidth: ANCHO_TENDENCIA - 70 }]}>{tendencia.etiqueta}</Text>
        {tendencia.ultimo && (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.negrita, { fontSize: 10, color: COLOR_ESTADO[tendencia.ultimo.estado] }]}>
              {tendencia.ultimo.texto}
            </Text>
            <Text style={{ fontSize: 6.5, color: GRAY }}>{tendencia.ultimo.periodo}</Text>
          </View>
        )}
      </View>
      {!tendencia.ultimo ? (
        <Text style={{ height: area.alto, color: GRAY, textAlign: "center", paddingTop: 45 }}>Sin datos</Text>
      ) : (
        <Svg width={area.ancho} height={area.alto}>
          <Eje area={area} techo={tendencia.techo} marcas={tendencia.marcas.filter((_, i, t) => t.length <= 5 || i % 2 === 0)} fuente={6} />
          <LineaMeta area={area} techo={tendencia.techo} />
          {tramos.map((t, i) =>
            t.length > 1 ? (
              <Polyline key={i} points={t.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={NAVY_SERIE} strokeWidth={1.5} />
            ) : null
          )}
          {tramos.flat().map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.2} fill={NAVY_SERIE} stroke="#ffffff" strokeWidth={0.8} />
          ))}
          {tendencia.puntos.map((p, i) =>
            i % cadaCuanto === 0 || i === n - 1 ? (
              <Text key={p.periodo} x={x(i)} y={area.alto - 2} textAnchor="middle" style={{ fontSize: 6, fill: GRAY }}>
                {p.etiqueta}
              </Text>
            ) : null
          )}
        </Svg>
      )}
    </View>
  );
}

function Tendencias({ tendencias }: { tendencias: TendenciaInforme[] }) {
  return (
    <View style={s.seccion}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <TituloSeccion titulo="Tendencia por indicador" nota="Porcentaje real de cada mes frente a la meta" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Svg width={18} height={4}>
              <Line x1={0} x2={18} y1={2} y2={2} stroke={NAVY_SERIE} strokeWidth={1.5} />
            </Svg>
            <Text style={{ fontSize: 7, color: GRAY }}>% real</Text>
          </View>
          <LeyendaMeta texto="Meta 100%" />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {tendencias.map((t) => (
          <Tendencia key={t.etiqueta} tendencia={t} />
        ))}
      </View>
    </View>
  );
}

/* ── Tablas ── */

const COL_RANKING = { nombre: 160, programa: 132, citas: 40, global: 46 };
const COL_RANKING_CATEGORIA =
  (ANCHO_UTIL - COL_RANKING.nombre - COL_RANKING.programa - COL_RANKING.citas - COL_RANKING.global) / CATEGORIAS.length;

function Programa({ programa, ancho }: { programa: string | null; ancho: number }) {
  return (
    <Text style={[s.td, { width: ancho, color: programa ? "#374151" : "#b45309" }]}>{programa ?? "Sin programa"}</Text>
  );
}

function TablaRanking({ filas }: { filas: FilaRankingInforme[] }) {
  return (
    <View>
      <View fixed>
        <TituloSeccion
          titulo="Ranking de profesionales"
          nota="Promedio del rango seleccionado, ordenado por cumplimiento global (mayor primero)."
        />
        <View style={[s.tabla, s.filaEncabezado]}>
          <Text style={[s.th, { width: COL_RANKING.nombre }]}>Profesional</Text>
          <Text style={[s.th, { width: COL_RANKING.programa }]}>Programa</Text>
          <Text style={[s.th, s.derecha, { width: COL_RANKING.citas }]}>Citas</Text>
          <Text style={[s.th, s.derecha, { width: COL_RANKING.global }]}>Global</Text>
          {CATEGORIAS.map((c) => (
            <Text key={c.clave} style={[s.th, s.derecha, { width: COL_RANKING_CATEGORIA }]}>
              {c.etiqueta}
            </Text>
          ))}
        </View>
      </View>
      {filas.length === 0 ? (
        <Text style={{ color: GRAY, textAlign: "center", paddingVertical: 20 }}>Sin profesionales para los filtros seleccionados</Text>
      ) : (
        filas.map((f, i) => (
          <View key={f.documento} style={[s.fila, i % 2 === 1 ? s.filaPar : {}]} wrap={false}>
            <View style={{ width: COL_RANKING.nombre, paddingVertical: 3, paddingHorizontal: 3 }}>
              <Text style={[s.negrita, { fontSize: 7.5 }]}>{f.nombre}</Text>
              <Text style={{ fontSize: 6.5, color: GRAY }}>{f.documento}</Text>
            </View>
            <Programa programa={f.programa} ancho={COL_RANKING.programa} />
            <Text style={[s.td, s.derecha, { width: COL_RANKING.citas }]}>{f.citas}</Text>
            <Pct celda={f.global} estilo={{ width: COL_RANKING.global, fontWeight: "bold" }} />
            {f.categorias.map((c, j) => (
              <Pct key={CATEGORIAS[j].clave} celda={c} estilo={{ width: COL_RANKING_CATEGORIA }} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const COL_HIST = { periodo: 50, citas: 38, programa: 78, global: 38 };
const COL_HIST_SUB = (ANCHO_UTIL - COL_HIST.periodo - COL_HIST.citas - COL_HIST.programa - COL_HIST.global) / (CATEGORIAS.length * 3);
const SEPARADOR = { borderLeftWidth: 0.5, borderLeftColor: "#d1d5db" };

function TablaHistorial({ filas }: { filas: FilaHistorialInforme[] }) {
  const thFijo = [s.th, { paddingTop: 20 }];
  return (
    <View>
      <View fixed>
        <TituloSeccion
          titulo="Historial mes a mes"
          nota="Tasa: órdenes por cita en medicamentos y laboratorios; órdenes por cada 100 citas en las demás categorías. Meta del programa del profesional en ese mes."
        />
        <View style={[s.tabla, s.filaEncabezado]}>
          <Text style={[...thFijo, { width: COL_HIST.periodo }]}>Periodo</Text>
          <Text style={[...thFijo, s.derecha, { width: COL_HIST.citas }]}>Citas</Text>
          <Text style={[...thFijo, { width: COL_HIST.programa }]}>Programa</Text>
          <Text style={[...thFijo, s.derecha, { width: COL_HIST.global }]}>Global</Text>
          {CATEGORIAS.map((c) => (
            <View key={c.clave} style={[{ width: COL_HIST_SUB * 3 }, SEPARADOR]}>
              {/* Altura fija: las etiquetas de dos líneas no descuadran la fila de Tasa / Meta / % */}
              <View style={{ height: 20, justifyContent: "flex-end" }}>
                <Text style={[s.th, s.centro, { paddingBottom: 1, fontSize: 6 }]}>{c.etiqueta}</Text>
              </View>
              <View style={{ flexDirection: "row" }}>
                {["Tasa", "Meta", "%"].map((t) => (
                  <Text key={t} style={[s.th, s.derecha, { width: COL_HIST_SUB, paddingTop: 1, fontSize: 6 }]}>
                    {t}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
      {filas.length === 0 ? (
        <Text style={{ color: GRAY, textAlign: "center", paddingVertical: 20 }}>Sin periodos para mostrar</Text>
      ) : (
        filas.map((f, i) => (
          <View key={f.periodo} style={[s.fila, i % 2 === 1 ? s.filaPar : {}]} wrap={false}>
            <Text style={[s.td, s.negrita, { width: COL_HIST.periodo }]}>{f.periodo}</Text>
            <Text style={[s.td, s.derecha, { width: COL_HIST.citas }]}>{f.citas}</Text>
            <Programa programa={f.programa} ancho={COL_HIST.programa} />
            <Pct celda={f.global} estilo={{ width: COL_HIST.global, fontWeight: "bold" }} />
            {f.categorias.map((c, j) => (
              <View key={CATEGORIAS[j].clave} style={[{ flexDirection: "row", width: COL_HIST_SUB * 3 }, SEPARADOR]}>
                <Text style={[s.td, s.derecha, { width: COL_HIST_SUB, fontSize: 7 }]}>{c.tasa}</Text>
                <Text style={[s.td, s.derecha, { width: COL_HIST_SUB, fontSize: 7, color: GRAY }]}>{c.meta}</Text>
                <Pct celda={c.pct} estilo={{ width: COL_HIST_SUB, fontSize: 7 }} />
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

/* ── Documento ── */

const PAGINA = { size: "A4" as const, orientation: "landscape" as const, style: s.pagina };

export function DocumentoCumplimiento({ informe, logo }: PropsDocumento) {
  const { detalle } = informe;
  return (
    <Document
      title={`${informe.titulo}${informe.periodo ? ` · ${informe.periodo}` : ""}`}
      author="IPS Interconsultas"
      subject={informe.atribucion}
      language="es-CO"
    >
      <Page {...PAGINA}>
        <Encabezado informe={informe} logo={logo} />
        <Resumen resumen={informe.resumen} />
        {informe.aviso && <Text style={s.aviso}>{informe.aviso}</Text>}
        <GraficaBarras grafica={informe.graficaGlobal} />
        <Pie informe={informe} />
      </Page>

      {detalle.tipo === "general" ? (
        <Page {...PAGINA}>
          <EncabezadoCorto informe={informe} logo={logo} />
          <TablaRanking filas={detalle.ranking} />
          <Pie informe={informe} />
        </Page>
      ) : (
        <>
          <Page {...PAGINA}>
            <EncabezadoCorto informe={informe} logo={logo} />
            <Tendencias tendencias={detalle.tendencias} />
            <Pie informe={informe} />
          </Page>
          <Page {...PAGINA}>
            <EncabezadoCorto informe={informe} logo={logo} />
            <TablaHistorial filas={detalle.historial} />
            <Pie informe={informe} />
          </Page>
        </>
      )}
    </Document>
  );
}
