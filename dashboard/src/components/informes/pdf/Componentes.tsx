/**
 * Piezas comunes de los informes en PDF (@react-pdf/renderer): página con
 * banda de marca y pie, introducción, indicadores, gráficas y tablas.
 * Solo maquetan: los textos llegan formateados (lib/informes/presentacionPdf).
 */
import type { ReactNode } from "react";
import { Image, Page, Text, View } from "@react-pdf/renderer";
import type { Styles } from "@react-pdf/renderer";
import type { EncabezadoPdf } from "@/lib/informes/documentosPdf";
import type { CeldaPdf, ColumnaPdf, KpiPdf, Semaforo, TablaPdf } from "@/lib/informes/presentacionPdf";
import { ANCHO_UTIL, s } from "./estilos";

type Style = Styles[string];

export const PIE = "IPS Interconsultas · Productividad";

/* ── Página ───────────────────────────────────── */

export function PaginaInforme({
  encabezado,
  logo,
  children,
}: {
  encabezado: EncabezadoPdf;
  logo: string;
  children: ReactNode;
}) {
  return (
    <Page size="A4" orientation="landscape" style={s.pagina}>
      <View fixed style={s.banda}>
        <View style={s.placaLogo}>
          <Image src={logo} style={s.logo} />
        </View>
        <View style={s.bandaTextos}>
          <Text style={s.bandaTitulo}>{encabezado.titulo}</Text>
          <Text style={s.bandaPeriodo}>{encabezado.periodo}</Text>
        </View>
      </View>
      <View fixed style={s.acento} />

      {children}

      <View fixed style={s.pie}>
        <Text>{PIE}</Text>
        <Text>Generado el {encabezado.generado}</Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  );
}

/** Título, subtítulo, filtros aplicados y hora de generación. */
export function Introduccion({ encabezado, titulo = true }: { encabezado: EncabezadoPdf; titulo?: boolean }) {
  // El mensual ya lleva "Comparado con" entre los filtros
  const comparadoAparte = !encabezado.filtros.some((f) => f.etiqueta === "Comparado con");
  return (
    <View style={s.intro}>
      {titulo && <Text style={s.titulo}>{encabezado.titulo}</Text>}
      <Text style={s.subtitulo}>{encabezado.subtitulo}</Text>
      <View style={s.filtros}>
        {encabezado.filtros.map((f) => (
          <View key={f.etiqueta} style={s.filtro}>
            <Text style={s.filtroEtiqueta}>{f.etiqueta}: </Text>
            <Text>{f.valor}</Text>
          </View>
        ))}
      </View>
      <Text style={s.generado}>
        {[comparadoAparte ? encabezado.comparado : null, `Generado el ${encabezado.generado} (hora de Colombia)`]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </View>
  );
}

export function TituloSeccion({ titulo, nota }: { titulo: string; nota?: string }) {
  // minPresenceAhead: el título no queda solo al pie de una página
  return (
    <View style={s.cabeceraSeccion} minPresenceAhead={60}>
      <Text style={s.tituloSeccion}>{titulo}</Text>
      {nota && <Text style={s.notaSeccion}>{nota}</Text>}
    </View>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return <Text style={s.aviso}>{children}</Text>;
}

/* ── Indicadores ──────────────────────────────── */

function Chip({ semaforo }: { semaforo: Semaforo }) {
  return <Text style={[s.chip, { backgroundColor: semaforo.fondo, color: semaforo.tinta }]}>{semaforo.etiqueta}</Text>;
}

/** Tarjetas de indicadores en filas de `columnas`, con variación y semáforo. */
export function Kpis({ kpis, columnas = 5, comparado }: { kpis: KpiPdf[]; columnas?: number; comparado?: string | null }) {
  const GAP = 6;
  // Un punto de holgura: el redondeo de los bordes no debe mandar la última tarjeta a otra fila
  const ancho = Math.floor((ANCHO_UTIL - GAP * (columnas - 1)) / columnas) - 1;
  return (
    <View style={s.kpis}>
      {kpis.map((k) => (
        <View key={k.clave} style={[s.kpi, { width: ancho }]} wrap={false}>
          <Text style={s.kpiEtiqueta}>{k.etiqueta}</Text>
          <Text style={s.kpiValor}>{k.valor}</Text>
          <View style={s.kpiPie}>
            {k.semaforo && <Chip semaforo={k.semaforo} />}
            {k.variacion && (
              <Text style={s.kpiVariacion}>
                {k.variacion}
                {comparado ? " vs. anterior" : ""}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ── Gráficas ─────────────────────────────────── */

export function Grafica({
  titulo,
  ayuda,
  imagen,
  alto,
  estilo,
}: {
  titulo: string;
  ayuda?: string;
  imagen: string | undefined;
  alto: number;
  estilo?: Style;
}) {
  return (
    <View style={[s.grafica, estilo ?? {}]} wrap={false}>
      <Text style={s.tituloSeccion}>{titulo}</Text>
      {ayuda && <Text style={s.notaSeccion}>{ayuda}</Text>}
      {imagen ? (
        <Image src={imagen} style={[s.imagenGrafica, { height: alto }]} />
      ) : (
        <Text style={s.sinGrafica}>Gráfica no disponible.</Text>
      )}
    </View>
  );
}

/* ── Tablas ───────────────────────────────────── */

const ancho = (c: ColumnaPdf): Style => ({ flexGrow: c.peso, flexShrink: 1, flexBasis: 0 });

function Celda({ celda, columna, total }: { celda: CeldaPdf; columna: ColumnaPdf; total?: boolean }) {
  const alinear = columna.alineacion === "derecha" ? s.derecha : {};
  const texto = [s.td, alinear, total ? s.tdTotal : {}];
  if (!celda.semaforo) {
    return (
      <View style={ancho(columna)}>
        <Text style={texto}>{celda.texto}</Text>
      </View>
    );
  }
  // Color y etiqueta en texto: el semáforo no depende solo del color
  const { fondo, tinta, etiqueta } = celda.semaforo;
  return (
    <View style={[ancho(columna), s.semaforo, { backgroundColor: fondo }]}>
      <Text style={[...texto, { color: tinta }]}>
        {celda.texto} <Text style={s.etiquetaSemaforo}>{etiqueta}</Text>
      </Text>
    </View>
  );
}

/** Tabla del modelo: encabezado que se repite en cada página y filas que no se parten. */
export function Tabla({ tabla, salto }: { tabla: TablaPdf; salto?: boolean }) {
  return (
    <View style={s.seccion} break={salto}>
      <TituloSeccion titulo={tabla.titulo} nota={tabla.nota} />
      {tabla.filas.length === 0 ? (
        <Text style={s.notaSeccion}>Sin datos para el periodo y los filtros.</Text>
      ) : (
        <View style={s.tabla}>
          <View fixed style={s.filaEncabezado}>
            {tabla.columnas.map((c) => (
              <View key={c.etiqueta} style={ancho(c)}>
                <Text style={[s.th, c.alineacion === "derecha" ? s.derecha : {}]}>{c.etiqueta}</Text>
              </View>
            ))}
          </View>
          {tabla.filas.map((f, i) => (
            <View key={i} style={[s.fila, i % 2 === 1 ? s.filaPar : {}]} wrap={false}>
              {f.map((celda, j) => (
                <Celda key={j} celda={celda} columna={tabla.columnas[j]} />
              ))}
            </View>
          ))}
          {tabla.total && (
            <View style={[s.fila, s.filaTotal]} wrap={false}>
              {tabla.total.map((celda, j) => (
                <Celda key={j} celda={celda} columna={tabla.columnas[j]} total />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
