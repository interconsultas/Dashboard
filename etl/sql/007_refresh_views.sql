-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 007_refresh_views.sql
-- Refresca todas las vistas materializadas después de carga ETL.
-- Ejecutar después de insertar/actualizar datos en autorizaciones.
-- ============================================================

REFRESH MATERIALIZED VIEW CONCURRENTLY vm_filtros_dashboard;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_laboratorios;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_rx;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_ecografias;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_remisiones_cap;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_medicamentos;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_remisiones_ext;
REFRESH MATERIALIZED VIEW CONCURRENTLY vm_dash_proc_dx;
