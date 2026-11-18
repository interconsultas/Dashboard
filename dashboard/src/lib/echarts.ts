/**
 * ECharts modular: solo los tipos de gráfica y componentes que usa la app.
 * Importar siempre desde aquí (nunca "echarts" completo) para no inflar el
 * bundle. Solo se carga en el navegador (ver components/productividad/Grafico).
 */
import * as echarts from "echarts/core";
import { BarChart, FunnelChart, HeatmapChart, LineChart, ScatterChart, TreemapChart } from "echarts/charts";
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

echarts.use([
  LineChart,
  FunnelChart,
  HeatmapChart,
  TreemapChart,
  // Siguiente paso: dispersograma, Pareto y ficha individual
  BarChart,
  ScatterChart,
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

export { echarts };
export type { EChartsType } from "echarts/core";
