/**
 * ECharts modular: solo los tipos de gráfica y componentes que usa la app.
 * Importar siempre desde aquí (nunca "echarts" completo) para no inflar el
 * bundle. Solo se carga en el navegador (ver components/productividad/Grafico).
 */
import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { NOMBRE_TEMA, TEMA_GRAFICAS } from "@/lib/tema/graficas";

echarts.use([
  LineChart,
  FunnelChart,
  HeatmapChart,
  TreemapChart,
  // Siguiente paso: dispersograma, Pareto y ficha individual
  BarChart,
  ScatterChart,
  // Inteligencia: mapa de relaciones
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  GraphicComponent,
  CanvasRenderer,
]);

// Tema único de la app (tokens de diseño): se registra una vez, al cargar el módulo
echarts.registerTheme(NOMBRE_TEMA, TEMA_GRAFICAS);

export { echarts, NOMBRE_TEMA };
export type { EChartsType } from "echarts/core";
