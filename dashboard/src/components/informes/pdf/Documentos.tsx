/**
 * Los tres informes en PDF: la vista de Productividad con sus filtros, el
 * informe mensual y la ficha del profesional. Todo el contenido sale del
 * modelo (lib/informes/documentosPdf) y las gráficas llegan como imagen.
 */
import { Document, Text, View } from "@react-pdf/renderer";
import type { ContenidoPdf } from "@/lib/informes/documentosPdf";
import type { GraficaPdf } from "@/lib/informes/graficas";
import { META_INASISTENCIA } from "@/lib/productividad/metricas";
import { Aviso, Grafica, Introduccion, Kpis, PaginaInforme, Tabla } from "./Componentes";
import { s } from "./estilos";

/** Imágenes (data URL o URL) de las gráficas, por sección. */
export type ImagenesGraficas = Partial<Record<GraficaPdf["id"], string>>;

export interface PropsDocumento {
  contenido: ContenidoPdf;
  imagenes: ImagenesGraficas;
  /** URL absoluta (navegador) o ruta (Node) del logo. */
  logo: string;
}

const AYUDA_TENDENCIA = `% de inasistencia (inasistidas ÷ asignadas) por periodo contra la meta del ${META_INASISTENCIA * 100} %.`;

function Documento({ contenido, children }: { contenido: ContenidoPdf; children: React.ReactNode }) {
  return (
    <Document
      title={`${contenido.encabezado.titulo} — ${contenido.encabezado.periodo}`}
      author="IPS Interconsultas"
      subject={contenido.encabezado.subtitulo}
      creator="IPS Interconsultas · Productividad"
      producer="IPS Interconsultas"
      language="es-CO"
    >
      {children}
    </Document>
  );
}

const tabla = (c: ContenidoPdf, id: string) => c.tablas.find((t) => t.id === id);

/* ── Vista de Productividad ───────────────────── */

export function DocumentoVista({ contenido, imagenes, logo }: PropsDocumento) {
  const { encabezado } = contenido;
  return (
    <Documento contenido={contenido}>
      <PaginaInforme encabezado={encabezado} logo={logo}>
        <Introduccion encabezado={encabezado} />
        <Kpis kpis={contenido.kpis} comparado={encabezado.comparado} />
        <View style={s.graficas} wrap={false}>
          <Grafica
            titulo="Inasistencia por periodo"
            ayuda={AYUDA_TENDENCIA}
            imagen={imagenes.tendencia}
            alto={180}
            estilo={{ flex: 3 }}
          />
          <Grafica
            titulo="Embudo de la agenda"
            ayuda="Dónde se pierden las citas en el periodo."
            imagen={imagenes.embudo}
            alto={180}
            estilo={{ flex: 2 }}
          />
        </View>
        {contenido.tablas.map((t, i) => (
          <Tabla key={t.id} tabla={t} salto={i === 0} />
        ))}
      </PaginaInforme>
    </Documento>
  );
}

/* ── Informe mensual ──────────────────────────── */

export function DocumentoMensual({ contenido, imagenes, logo }: PropsDocumento) {
  const { encabezado } = contenido;
  const prioridades = tabla(contenido, "prioridades");
  const proyeccion = tabla(contenido, "proyeccion");
  const detalle = contenido.tablas.filter((t) => t !== prioridades && t !== proyeccion);

  return (
    <Documento contenido={contenido}>
      {/* Portada: indicadores del mes contra el anterior y tendencia */}
      <PaginaInforme encabezado={encabezado} logo={logo}>
        <View style={s.portada}>
          <Text style={s.portadaEtiqueta}>Informe para gerencia y líderes</Text>
          <Text style={s.portadaTitulo}>{encabezado.titulo}</Text>
          <Text style={s.portadaPeriodo}>{encabezado.periodo}</Text>
        </View>
        <Introduccion encabezado={encabezado} titulo={false} />
        <Kpis kpis={contenido.kpis} comparado={encabezado.comparado} />
        <Grafica
          titulo="Inasistencia en los últimos 12 periodos"
          ayuda={AYUDA_TENDENCIA}
          imagen={imagenes.tendencia}
          alto={125}
        />
      </PaginaInforme>

      {/* Prioridades, proyección y detalle */}
      <PaginaInforme encabezado={encabezado} logo={logo}>
        {contenido.notas.map((n) => (
          <Aviso key={n}>{n}</Aviso>
        ))}
        {prioridades && <Tabla tabla={prioridades} />}
        {proyeccion && <Tabla tabla={proyeccion} />}
        {detalle.map((t, i) => (
          <Tabla key={t.id} tabla={t} salto={i === 0 && (prioridades !== undefined || proyeccion !== undefined)} />
        ))}
      </PaginaInforme>
    </Documento>
  );
}

/* ── Ficha del profesional ────────────────────── */

export function DocumentoFicha({ contenido, imagenes, logo }: PropsDocumento) {
  const { encabezado } = contenido;
  return (
    <Documento contenido={contenido}>
      <PaginaInforme encabezado={encabezado} logo={logo}>
        <Introduccion encabezado={encabezado} />
        {contenido.notas.map((n) => (
          <Aviso key={n}>{n}</Aviso>
        ))}
        <Kpis kpis={contenido.kpis} columnas={7} comparado={encabezado.comparado} />
        <View style={s.graficas} wrap={false}>
          <Grafica
            titulo="Servicios que atiende"
            ayuda="Atendidas e inasistidas por servicio."
            imagen={imagenes.servicios}
            alto={150}
            estilo={{ flex: 1 }}
          />
          <Grafica
            titulo="Inasistencia en el tiempo"
            ayuda={AYUDA_TENDENCIA}
            imagen={imagenes.tendencia}
            alto={150}
            estilo={{ flex: 1 }}
          />
        </View>
        {contenido.tablas.map((t, i) => (
          <Tabla key={t.id} tabla={t} salto={i === 0} />
        ))}
      </PaginaInforme>
    </Documento>
  );
}

/** El documento que corresponde al tipo de informe. */
export function DocumentoInforme(props: PropsDocumento) {
  if (props.contenido.tipo === "mensual") return <DocumentoMensual {...props} />;
  if (props.contenido.tipo === "ficha") return <DocumentoFicha {...props} />;
  return <DocumentoVista {...props} />;
}
