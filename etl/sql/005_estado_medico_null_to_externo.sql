-- Reemplazar NULL en estado_medico por 'EXTERNO'
-- para simplificar filtros (elimina la logica especial de IS NULL)

BEGIN;

UPDATE autorizaciones
   SET estado_medico = 'EXTERNO'
 WHERE estado_medico IS NULL;

COMMIT;

-- Refrescar vista materializada para que refleje el cambio.
-- Usa REFRESH sin CONCURRENTLY porque en BD vacía (primer deploy)
-- la vista aún no está populada y CONCURRENTLY fallaría.
-- El ETL usa 007_refresh_views.sql con CONCURRENTLY para producción.
REFRESH MATERIALIZED VIEW vm_filtros_dashboard;
